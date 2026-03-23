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

    private String geminiApiKey = "";

    private String geminiModel = "gemini-2.5-flash";

    /** Return the API key for the active provider. */
    public String getActiveApiKey() {
        return switch (provider.toLowerCase()) {
            case "anthropic" -> anthropicApiKey;
            case "gemini" -> geminiApiKey;
            default -> openaiApiKey;
        };
    }

    /** Return the model for the active provider. */
    public String getActiveModel() {
        return switch (provider.toLowerCase()) {
            case "anthropic" -> anthropicModel;
            case "gemini" -> geminiModel;
            default -> openaiModel;
        };
    }
}
