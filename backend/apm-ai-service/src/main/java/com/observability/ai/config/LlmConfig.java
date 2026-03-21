package com.observability.ai.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ai.llm")
@Getter
@Setter
public class LlmConfig {

    private String provider = "openai";

    private String openaiApiKey = "";

    private String openaiModel = "gpt-4o";

    private String anthropicApiKey = "";

    private String anthropicModel = "claude-sonnet-4-20250514";

    /** Return the API key for the active provider. */
    public String getActiveApiKey() {
        return "anthropic".equalsIgnoreCase(provider) ? anthropicApiKey : openaiApiKey;
    }

    /** Return the model for the active provider. */
    public String getActiveModel() {
        return "anthropic".equalsIgnoreCase(provider) ? anthropicModel : openaiModel;
    }
}
