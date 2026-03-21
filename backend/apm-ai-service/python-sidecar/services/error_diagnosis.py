"""
Error diagnosis service — matches trace error spans against an LLM for fix suggestions.

Supports two LLM providers:
  - OpenAI  (default)
  - Anthropic (Claude)

Provider, API key, and model are passed from the Spring Boot service via gRPC
(read from application.yml). Falls back to environment variables if not provided.
"""

import json
import logging
import os

logger = logging.getLogger("ml-sidecar.error-diagnosis")

# ── Shared prompt ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert Site Reliability Engineer and software debugger embedded in an \
observability platform. You receive error spans from distributed traces and must \
diagnose the root cause and suggest fixes.

For each error span, return a JSON object with these fields:
- span_id: the span ID you are diagnosing
- service_name: the service that produced the error
- error_type: the exception/error class (e.g. "NullPointerException", "TimeoutError", "HTTP 503")
- diagnosis: 1-3 sentence explanation of what went wrong and why
- suggested_fix: actionable fix recommendation
- code_snippet: a short code example showing the fix (or empty string if not applicable)
- severity: "CRITICAL", "WARNING", or "INFO"
- references: list of relevant documentation URLs or known-issue links (may be empty)

Return a JSON object with:
{
  "summary": "<one-line overall diagnosis>",
  "confidence": <0.0 to 1.0>,
  "suggestions": [ ... array of fix suggestions per span ... ]
}

Return ONLY valid JSON. No markdown fences, no extra commentary.\
"""


def _build_user_prompt(trace_id, error_spans, associated_logs, language_hint):
    parts = [f"Trace ID: {trace_id}\n"]

    if language_hint:
        parts.append(f"Primary language: {language_hint}\n")

    parts.append(f"Error spans ({len(error_spans)}):\n")
    for i, span in enumerate(error_spans, 1):
        parts.append(f"\n--- Span {i} ---")
        parts.append(f"Span ID: {span['span_id']}")
        parts.append(f"Service: {span['service_name']}")
        parts.append(f"Operation: {span['operation']}")
        parts.append(f"Duration: {span['duration_micros']}µs")
        if span.get("http_method"):
            parts.append(f"HTTP: {span['http_method']} {span.get('http_url', '')} → {span.get('http_status_code', '')}")
        if span.get("tags"):
            parts.append(f"Tags: {json.dumps(span['tags'])}")
        if span.get("error_logs"):
            parts.append("Error logs:")
            for log_line in span["error_logs"]:
                parts.append(f"  {log_line}")

    if associated_logs:
        parts.append(f"\nAssociated service logs ({len(associated_logs)}):")
        for log_line in associated_logs[:50]:
            parts.append(f"  {log_line}")

    return "\n".join(parts)


def _strip_markdown_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3].rstrip()
    return text


# ── Provider-specific call functions ─────────────────────────────────────────

def _call_openai(user_prompt: str, api_key: str, model: str) -> tuple[str, str]:
    import openai
    client = openai.OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content or ""
    return raw, model


def _call_anthropic(user_prompt: str, api_key: str, model: str) -> tuple[str, str]:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model,
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = message.content[0].text
    return raw, model


# ── Main entry point ─────────────────────────────────────────────────────────

def diagnose(trace_id, error_spans, associated_logs=None, language_hint="",
             llm_provider="", llm_api_key="", llm_model=""):
    """
    Send error spans to an LLM for diagnosis.

    LLM config is passed from Spring Boot via gRPC. Falls back to env vars
    if not provided in the request.

    Returns:
        dict with summary, confidence, suggestions list, and llm_model.
    """
    if not error_spans:
        return {
            "summary": "No error spans provided.",
            "confidence": 0.0,
            "suggestions": [],
            "llm_model": "",
        }

    # Resolve config: request args > env vars > defaults
    provider = (llm_provider or os.environ.get("LLM_PROVIDER", "openai")).lower()

    if provider == "anthropic":
        api_key = llm_api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        model = llm_model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    else:
        api_key = llm_api_key or os.environ.get("OPENAI_API_KEY", "")
        model = llm_model or os.environ.get("OPENAI_MODEL", "gpt-4o")

    if not api_key:
        msg = f"No API key configured for LLM provider '{provider}'. Set it in application.yml (ai.llm section)."
        logger.warning(msg)
        return {
            "summary": msg,
            "confidence": 0.0,
            "suggestions": [],
            "llm_model": provider,
        }

    user_prompt = _build_user_prompt(
        trace_id, error_spans, associated_logs or [], language_hint,
    )

    logger.info(
        "Sending %d error spans to %s (model=%s) for diagnosis (trace=%s)",
        len(error_spans), provider, model, trace_id,
    )

    try:
        if provider == "anthropic":
            raw, used_model = _call_anthropic(user_prompt, api_key, model)
        else:
            raw, used_model = _call_openai(user_prompt, api_key, model)

        raw = _strip_markdown_fences(raw)
        result = json.loads(raw)
        result["llm_model"] = used_model

        logger.info(
            "LLM diagnosis complete (%s): %d suggestions, confidence=%.2f",
            used_model,
            len(result.get("suggestions", [])),
            result.get("confidence", 0),
        )
        return result

    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s", e)
        return {
            "summary": "LLM returned non-JSON response.",
            "confidence": 0.0,
            "suggestions": [],
            "llm_model": model,
        }
    except Exception as e:
        logger.error("LLM API error (%s): %s", provider, e)
        return {
            "summary": f"LLM API error: {e}",
            "confidence": 0.0,
            "suggestions": [],
            "llm_model": model,
        }
