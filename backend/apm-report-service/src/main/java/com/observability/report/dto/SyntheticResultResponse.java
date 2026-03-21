package com.observability.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyntheticResultResponse {

    private UUID id;
    private UUID checkId;
    private String checkName;
    private Integer statusCode;
    private Long latencyMs;
    private boolean success;
    private Boolean statusCodeMatch;
    private Boolean bodyMatch;
    private Boolean latencyMatch;
    private String errorMessage;
    private String responseBodySnippet;
    private Instant executedAt;
}
