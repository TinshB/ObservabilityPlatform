package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Available filter options for the Service Catalog UI dropdowns.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceFilterResponse {

    private List<String> environments;
    private List<String> teams;
    private List<String> tiers;
}
