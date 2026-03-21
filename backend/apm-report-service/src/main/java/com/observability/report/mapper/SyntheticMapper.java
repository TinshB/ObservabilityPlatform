package com.observability.report.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.report.dto.SyntheticCheckResponse;
import com.observability.report.dto.SyntheticResultResponse;
import com.observability.report.entity.SyntheticCheckEntity;
import com.observability.report.entity.SyntheticResultEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.Map;

@Mapper(componentModel = "spring")
public interface SyntheticMapper {

    @Mapping(target = "requestHeaders", source = "requestHeaders", qualifiedByName = "jsonToMap")
    SyntheticCheckResponse toCheckResponse(SyntheticCheckEntity entity);

    SyntheticResultResponse toResultResponse(SyntheticResultEntity entity);

    @Named("jsonToMap")
    default Map<String, String> jsonToMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return new ObjectMapper().readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    @Named("mapToJson")
    default String mapToJson(Map<String, String> map) {
        if (map == null || map.isEmpty()) return null;
        try {
            return new ObjectMapper().writeValueAsString(map);
        } catch (Exception e) {
            return null;
        }
    }
}
