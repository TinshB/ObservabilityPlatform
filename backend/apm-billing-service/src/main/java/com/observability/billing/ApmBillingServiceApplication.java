package com.observability.billing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchClientAutoConfiguration;
import org.springframework.boot.autoconfigure.elasticsearch.ElasticsearchRestClientAutoConfiguration;

@SpringBootApplication(exclude = {
        ElasticsearchClientAutoConfiguration.class,
        ElasticsearchRestClientAutoConfiguration.class,
})
public class ApmBillingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApmBillingServiceApplication.class, args);
    }
}
