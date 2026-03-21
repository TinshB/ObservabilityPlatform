package com.observability.apm.service;

import com.observability.apm.dto.SpanBreakupResponse;
import com.observability.apm.dto.SpanBreakupResponse.OperationBreakup;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.JaegerProcess;
import com.observability.apm.jaeger.JaegerResponse.JaegerSpan;
import com.observability.apm.jaeger.JaegerResponse.JaegerTrace;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Story 8.1 — Decomposes a trace into per-operation span breakup
 * with self-time, total duration, error counts, and trace percentage.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpanBreakupService {

    private final JaegerClient jaegerClient;

    /**
     * Fetch a trace from Jaeger and produce a per-operation span breakup.
     *
     * @param traceId distributed trace ID
     * @return span breakup response
     */
    public SpanBreakupResponse getSpanBreakup(String traceId) {
        JaegerResponse jaegerResponse = jaegerClient.getTrace(traceId);

        if (jaegerResponse.getData() == null || jaegerResponse.getData().isEmpty()) {
            throw new ResourceNotFoundException("Trace", traceId);
        }

        JaegerTrace trace = jaegerResponse.getData().getFirst();
        List<JaegerSpan> spans = trace.getSpans() != null ? trace.getSpans() : List.of();
        Map<String, JaegerProcess> processes = trace.getProcesses() != null ? trace.getProcesses() : Map.of();

        if (spans.isEmpty()) {
            return SpanBreakupResponse.builder()
                    .traceId(traceId)
                    .traceDurationMicros(0)
                    .totalSpans(0)
                    .serviceCount(0)
                    .operations(List.of())
                    .build();
        }

        // Compute trace-level timing
        long minStart = spans.stream().mapToLong(JaegerSpan::getStartTime).min().orElse(0);
        long maxEnd = spans.stream().mapToLong(s -> s.getStartTime() + s.getDuration()).max().orElse(0);
        long traceDuration = maxEnd - minStart;

        // Build parent→children map for self-time calculation
        Map<String, List<JaegerSpan>> childrenMap = buildChildrenMap(spans);

        // Distinct services
        Set<String> distinctServices = new HashSet<>();

        // Group spans by (serviceName, operationName)
        Map<String, List<JaegerSpan>> grouped = new LinkedHashMap<>();
        for (JaegerSpan span : spans) {
            JaegerProcess process = processes.get(span.getProcessId());
            String serviceName = process != null ? process.getServiceName() : "unknown";
            distinctServices.add(serviceName);

            String key = serviceName + "::" + span.getOperationName();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(span);
        }

        // Build per-operation breakup entries
        List<OperationBreakup> operations = new ArrayList<>();
        for (Map.Entry<String, List<JaegerSpan>> entry : grouped.entrySet()) {
            List<JaegerSpan> opSpans = entry.getValue();
            JaegerSpan firstSpan = opSpans.getFirst();

            JaegerProcess process = processes.get(firstSpan.getProcessId());
            String serviceName = process != null ? process.getServiceName() : "unknown";
            String operationName = firstSpan.getOperationName();

            long totalDuration = 0;
            long selfTime = 0;
            long maxDur = Long.MIN_VALUE;
            long minDur = Long.MAX_VALUE;
            int errorCount = 0;

            for (JaegerSpan span : opSpans) {
                long dur = span.getDuration();
                totalDuration += dur;
                maxDur = Math.max(maxDur, dur);
                minDur = Math.min(minDur, dur);

                if (isErrorSpan(span)) errorCount++;

                // Self-time = span duration minus sum of direct children durations
                long childrenDuration = 0;
                List<JaegerSpan> children = childrenMap.getOrDefault(span.getSpanId(), List.of());
                for (JaegerSpan child : children) {
                    childrenDuration += child.getDuration();
                }
                selfTime += Math.max(0, dur - childrenDuration);
            }

            int spanCount = opSpans.size();
            long avgDuration = spanCount > 0 ? totalDuration / spanCount : 0;
            double pctOfTrace = traceDuration > 0 ? (double) totalDuration / traceDuration * 100.0 : 0;

            operations.add(OperationBreakup.builder()
                    .operationName(operationName)
                    .serviceName(serviceName)
                    .spanCount(spanCount)
                    .errorCount(errorCount)
                    .totalDurationMicros(totalDuration)
                    .selfTimeMicros(selfTime)
                    .avgDurationMicros(avgDuration)
                    .maxDurationMicros(maxDur)
                    .minDurationMicros(minDur)
                    .percentOfTrace(Math.round(pctOfTrace * 100.0) / 100.0)
                    .build());
        }

        // Sort by total duration descending
        operations.sort(Comparator.comparingLong(OperationBreakup::getTotalDurationMicros).reversed());

        return SpanBreakupResponse.builder()
                .traceId(trace.getTraceId())
                .traceDurationMicros(traceDuration)
                .totalSpans(spans.size())
                .serviceCount(distinctServices.size())
                .operations(operations)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Build a map from parent span ID → list of direct child spans.
     */
    private Map<String, List<JaegerSpan>> buildChildrenMap(List<JaegerSpan> spans) {
        Map<String, List<JaegerSpan>> map = new HashMap<>();
        for (JaegerSpan span : spans) {
            String parentId = getParentSpanId(span);
            if (parentId != null) {
                map.computeIfAbsent(parentId, k -> new ArrayList<>()).add(span);
            }
        }
        return map;
    }

    private String getParentSpanId(JaegerSpan span) {
        if (span.getReferences() == null) return null;
        return span.getReferences().stream()
                .filter(ref -> "CHILD_OF".equals(ref.getRefType()))
                .map(JaegerResponse.JaegerReference::getSpanId)
                .findFirst()
                .orElse(null);
    }

    private boolean isErrorSpan(JaegerSpan span) {
        if (span.getTags() == null) return false;
        return span.getTags().stream()
                .anyMatch(t -> "error".equals(t.getKey()) && "true".equals(String.valueOf(t.getValue())));
    }
}
