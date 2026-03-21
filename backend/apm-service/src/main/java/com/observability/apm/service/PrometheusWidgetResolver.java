package com.observability.apm.service;

import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Story 13.2 — Resolves widget data by querying Prometheus.
 * Reuses {@link PrometheusClient} and the existing {@link TimeSeries}/{@link MetricDataPoint} model.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PrometheusWidgetResolver implements WidgetDataResolver {

    private final PrometheusClient prometheusClient;

    @Override
    public WidgetDataResponse resolve(WidgetDataRequest request) {
        try {
            PrometheusResponse response;

            if (request.getStart() != null && request.getEnd() != null) {
                long step = request.getStepSeconds() > 0 ? request.getStepSeconds() : 60;
                response = prometheusClient.queryRange(
                        request.getQuery(), request.getStart(), request.getEnd(), step);
            } else {
                response = prometheusClient.query(request.getQuery());
            }

            List<TimeSeries> seriesList = extractTimeSeries(response);

            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(seriesList)
                    .build();

        } catch (Exception ex) {
            log.error("Prometheus widget resolution failed for widget [{}]: {}",
                    request.getWidgetId(), ex.getMessage());
            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .error("Prometheus query failed: " + ex.getMessage())
                    .build();
        }
    }

    private List<TimeSeries> extractTimeSeries(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null) {
            return Collections.emptyList();
        }

        List<TimeSeries> seriesList = new ArrayList<>();
        for (PrometheusResponse.PromResult result : response.getData().getResult()) {
            List<MetricDataPoint> points = new ArrayList<>();

            // Range query — values is a list of [timestamp, value] pairs
            if (result.getValues() != null) {
                for (List<Object> pair : result.getValues()) {
                    if (pair.size() >= 2) {
                        long ts = ((Number) pair.get(0)).longValue();
                        double val = parseDouble(pair.get(1));
                        if (!Double.isNaN(val)) {
                            points.add(new MetricDataPoint(ts, val));
                        }
                    }
                }
            }
            // Instant query — value is a single [timestamp, value]
            else if (result.getValue() != null && result.getValue().size() >= 2) {
                long ts = ((Number) result.getValue().get(0)).longValue();
                double val = parseDouble(result.getValue().get(1));
                if (!Double.isNaN(val)) {
                    points.add(new MetricDataPoint(ts, val));
                }
            }

            Map<String, String> labels = result.getMetric() != null ? result.getMetric() : Map.of();
            String name = labels.getOrDefault("__name__", "series");

            seriesList.add(TimeSeries.builder()
                    .name(name)
                    .labels(labels)
                    .dataPoints(points)
                    .build());
        }
        return seriesList;
    }

    private static double parseDouble(Object obj) {
        try {
            return Double.parseDouble(obj.toString());
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }
}
