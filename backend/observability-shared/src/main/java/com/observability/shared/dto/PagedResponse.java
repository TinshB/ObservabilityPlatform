package com.observability.shared.dto;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Standard paginated response wrapper.
 *
 * <pre>
 * {
 *   "content":       [...],
 *   "page":          0,
 *   "size":          20,
 *   "totalElements": 150,
 *   "totalPages":    8,
 *   "first":         true,
 *   "last":          false
 * }
 * </pre>
 *
 * Usage:
 * <pre>
 *   Page&lt;ServiceEntity&gt; page = serviceRepository.findAll(pageable);
 *   return ApiResponse.success(PagedResponse.from(page, serviceMapper::toDto));
 * </pre>
 */
@Data
@Builder
public class PagedResponse<T> {

    private List<T> content;
    private int     page;
    private int     size;
    private long    totalElements;
    private int     totalPages;
    private boolean first;
    private boolean last;

    /** Wraps a Spring {@link Page} without mapping. */
    public static <T> PagedResponse<T> from(Page<T> springPage) {
        return PagedResponse.<T>builder()
                .content(springPage.getContent())
                .page(springPage.getNumber())
                .size(springPage.getSize())
                .totalElements(springPage.getTotalElements())
                .totalPages(springPage.getTotalPages())
                .first(springPage.isFirst())
                .last(springPage.isLast())
                .build();
    }

    /** Wraps a Spring {@link Page} and maps each element with {@code mapper}. */
    public static <S, T> PagedResponse<T> from(Page<S> springPage, Function<S, T> mapper) {
        return PagedResponse.<T>builder()
                .content(springPage.getContent().stream().map(mapper).toList())
                .page(springPage.getNumber())
                .size(springPage.getSize())
                .totalElements(springPage.getTotalElements())
                .totalPages(springPage.getTotalPages())
                .first(springPage.isFirst())
                .last(springPage.isLast())
                .build();
    }
}
