package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 13.3 — Response containing available options for a template variable type.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateVariableOptionsResponse {

    private String type;
    private List<VariableOption> options;
}
