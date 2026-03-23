package com.observability.report.elasticsearch;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import com.observability.report.config.ElasticsearchProperties;
import com.observability.report.dto.KpiReportData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Queries Elasticsearch for alert and log data used in KPI report generation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ElasticsearchQueryService {

    private final ElasticsearchClient esClient;
    private final ElasticsearchProperties esProperties;

    /**
     * Query alert counts grouped by severity within a time range.
     */
    public AlertCounts queryAlertCounts(Instant start, Instant end, String serviceName) {
        try {
            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esProperties.getAlertIndex())
                            .size(0)
                            .query(q -> q.bool(b -> {
                                b.must(m -> m.range(r -> r
                                        .field("@timestamp")
                                        .gte(co.elastic.clients.json.JsonData.of(start.toString()))
                                        .lte(co.elastic.clients.json.JsonData.of(end.toString()))
                                ));
                                if (serviceName != null && !serviceName.isBlank()) {
                                    b.must(m -> m.term(t -> t
                                            .field("service_name.keyword")
                                            .value(serviceName)));
                                }
                                return b;
                            }))
                            .aggregations("by_severity", a -> a
                                    .terms(t -> t.field("severity.keyword").size(10))
                            ),
                    Void.class);

            int critical = 0, warning = 0, info = 0;
            var buckets = response.aggregations().get("by_severity").sterms().buckets().array();
            for (StringTermsBucket bucket : buckets) {
                switch (bucket.key().stringValue().toUpperCase()) {
                    case "CRITICAL" -> critical = (int) bucket.docCount();
                    case "WARNING" -> warning = (int) bucket.docCount();
                    case "INFO" -> info = (int) bucket.docCount();
                }
            }

            return new AlertCounts(critical + warning + info, critical, warning, info);
        } catch (Exception e) {
            log.warn("Failed to query alert counts: {}", e.getMessage());
            return new AlertCounts(0, 0, 0, 0);
        }
    }

    /**
     * Query top offending services by alert count.
     */
    public List<KpiReportData.TopOffendingService> queryTopOffendingServices(Instant start,
                                                                             Instant end,
                                                                             int limit) {
        List<KpiReportData.TopOffendingService> result = new ArrayList<>();
        try {
            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esProperties.getAlertIndex())
                            .size(0)
                            .query(q -> q.range(r -> r
                                    .field("@timestamp")
                                    .gte(co.elastic.clients.json.JsonData.of(start.toString()))
                                    .lte(co.elastic.clients.json.JsonData.of(end.toString()))
                            ))
                            .aggregations("by_service", a -> a
                                    .terms(t -> t.field("service_name.keyword").size(limit))
                                    .aggregations("critical_count", sub -> sub
                                            .filter(f -> f.term(t -> t
                                                    .field("severity.keyword")
                                                    .value("CRITICAL")))
                                    )
                            ),
                    Void.class);

            var buckets = response.aggregations().get("by_service").sterms().buckets().array();
            for (StringTermsBucket bucket : buckets) {
                long criticalCount = bucket.aggregations().get("critical_count").filter().docCount();
                result.add(KpiReportData.TopOffendingService.builder()
                        .serviceName(bucket.key().stringValue())
                        .alertCount((int) bucket.docCount())
                        .criticalCount((int) criticalCount)
                        .avgResolutionMinutes(0)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Failed to query top offending services: {}", e.getMessage());
        }
        return result;
    }

    /**
     * Query alert trends grouped by day.
     */
    public List<KpiReportData.AlertTrend> queryAlertTrends(Instant start,
                                                            Instant end,
                                                            String serviceName) {
        List<KpiReportData.AlertTrend> trends = new ArrayList<>();
        try {
            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esProperties.getAlertIndex())
                            .size(0)
                            .query(q -> q.bool(b -> {
                                b.must(m -> m.range(r -> r
                                        .field("@timestamp")
                                        .gte(co.elastic.clients.json.JsonData.of(start.toString()))
                                        .lte(co.elastic.clients.json.JsonData.of(end.toString()))
                                ));
                                if (serviceName != null && !serviceName.isBlank()) {
                                    b.must(m -> m.term(t -> t
                                            .field("service_name.keyword")
                                            .value(serviceName)));
                                }
                                return b;
                            }))
                            .aggregations("by_day", a -> a
                                    .dateHistogram(dh -> dh
                                            .field("@timestamp")
                                            .calendarInterval(co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval.Day)
                                    )
                                    .aggregations("by_severity", sub -> sub
                                            .terms(t -> t.field("severity.keyword").size(10))
                                    )
                            ),
                    Void.class);

            var byDayAgg = response.aggregations().get("by_day");
            if (byDayAgg == null) {
                log.debug("No 'by_day' aggregation returned — alert index may be empty");
                return trends;
            }
            var dateBuckets = byDayAgg.dateHistogram().buckets().array();
            for (var dateBucket : dateBuckets) {
                int critical = 0, warning = 0, infoCount = 0;
                var severityBuckets = dateBucket.aggregations().get("by_severity").sterms().buckets().array();
                for (StringTermsBucket sb : severityBuckets) {
                    switch (sb.key().stringValue().toUpperCase()) {
                        case "CRITICAL" -> critical = (int) sb.docCount();
                        case "WARNING" -> warning = (int) sb.docCount();
                        case "INFO" -> infoCount = (int) sb.docCount();
                    }
                }

                String dateStr = LocalDate.ofInstant(
                        Instant.ofEpochMilli(dateBucket.key()),
                        ZoneOffset.UTC
                ).toString();

                trends.add(KpiReportData.AlertTrend.builder()
                        .date(dateStr)
                        .criticalCount(critical)
                        .warningCount(warning)
                        .infoCount(infoCount)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Failed to query alert trends: {}", e.getMessage());
        }
        return trends;
    }

    /**
     * Query SLA compliance data from Elasticsearch.
     */
    public List<KpiReportData.SlaComplianceEntry> querySlaCompliance(Instant start,
                                                                      Instant end,
                                                                      String serviceName) {
        List<KpiReportData.SlaComplianceEntry> entries = new ArrayList<>();
        try {
            SearchResponse<Void> response = esClient.search(s -> s
                            .index("sla-evaluations-*")
                            .size(0)
                            .query(q -> q.bool(b -> {
                                b.must(m -> m.range(r -> r
                                        .field("@timestamp")
                                        .gte(co.elastic.clients.json.JsonData.of(start.toString()))
                                        .lte(co.elastic.clients.json.JsonData.of(end.toString()))
                                ));
                                if (serviceName != null && !serviceName.isBlank()) {
                                    b.must(m -> m.term(t -> t
                                            .field("service_name.keyword")
                                            .value(serviceName)));
                                }
                                return b;
                            }))
                            .aggregations("by_rule", a -> a
                                    .terms(t -> t.field("sla_rule_name.keyword").size(50))
                                    .aggregations("by_service", sub -> sub
                                            .terms(t -> t.field("service_name.keyword").size(50))
                                    )
                                    .aggregations("breaches", sub -> sub
                                            .filter(f -> f.term(t -> t
                                                    .field("status.keyword")
                                                    .value("BREACH")))
                                    )
                            ),
                    Void.class);

            var ruleBuckets = response.aggregations().get("by_rule").sterms().buckets().array();
            for (StringTermsBucket ruleBucket : ruleBuckets) {
                long total = ruleBucket.docCount();
                long breaches = ruleBucket.aggregations().get("breaches").filter().docCount();
                double compliance = total > 0 ? (1 - (double) breaches / total) * 100 : 100;

                String svcName = serviceName != null ? serviceName : "all";
                var svcBuckets = ruleBucket.aggregations().get("by_service").sterms().buckets().array();
                if (!svcBuckets.isEmpty()) {
                    svcName = svcBuckets.getFirst().key().stringValue();
                }

                entries.add(KpiReportData.SlaComplianceEntry.builder()
                        .serviceName(svcName)
                        .slaRuleName(ruleBucket.key().stringValue())
                        .compliancePct(compliance)
                        .totalEvaluations((int) total)
                        .breaches((int) breaches)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Failed to query SLA compliance: {}", e.getMessage());
        }
        return entries;
    }

    public record AlertCounts(int total, int critical, int warning, int info) {}
}
