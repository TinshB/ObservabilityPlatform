package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 13.3 — A single option for a template variable dropdown.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VariableOption {

    private String value;
    private String label;
}
