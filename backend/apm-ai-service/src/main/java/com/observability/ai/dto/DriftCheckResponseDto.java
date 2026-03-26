package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DriftCheckResponseDto {

    private List<DriftResult> drifts;

    @Data
    @Builder
    public static class DriftResult {
        private UUID workflowId;
        private String workflowName;
        private UUID matchedPatternId;
        private DriftChanges changes;
        private String severity;  // INFO, WARNING, CRITICAL
    }

    @Data
    @Builder
    public static class DriftChanges {
        private List<DriftStep> addedSteps;
        private List<DriftStep> removedSteps;
        private List<ModifiedStep> modifiedSteps;
    }

    @Data
    @Builder
    public static class DriftStep {
        private String serviceName;
        private String method;
        private String path;
    }

    @Data
    @Builder
    public static class ModifiedStep {
        private int stepOrder;
        private String field;
        private String previousValue;
        private String currentValue;
    }
}
