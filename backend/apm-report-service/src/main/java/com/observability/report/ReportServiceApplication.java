package com.observability.report;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchClientAutoConfiguration;
import org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchRestClientAutoConfiguration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = {
        ElasticsearchClientAutoConfiguration.class,
        ElasticsearchRestClientAutoConfiguration.class
})
@EnableAsync
@EnableScheduling
public class ReportServiceApplication {

    public static void main(String[] args) {
        // Force IPv4 before any networking — fixes localhost→[::1] on Windows
        System.setProperty("java.net.preferIPv4Stack", "true");
        SpringApplication.run(ReportServiceApplication.class, args);
    }
}
