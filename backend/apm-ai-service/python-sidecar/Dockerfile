FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY protos/ protos/
COPY generate_protos.py .
RUN python generate_protos.py

COPY services/ services/
COPY server.py .

EXPOSE 50051

# LLM configuration — provide at runtime
ENV LLM_PROVIDER="openai"
ENV OPENAI_API_KEY=""
ENV OPENAI_MODEL="gpt-4o"
ENV ANTHROPIC_API_KEY=""
ENV ANTHROPIC_MODEL="claude-sonnet-4-20250514"
ENV GEMINI_API_KEY=""
ENV GEMINI_MODEL="gemini-2.5-flash"

CMD ["python", "server.py", "--port", "50051"]
