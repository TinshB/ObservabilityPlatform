package com.observability.report;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.RestTemplate;

@SpringBootTest
@ActiveProfiles("test")
class ReportServiceApplicationTest {

    @MockitoBean
    private ElasticsearchClient elasticsearchClient;

    @MockitoBean
    private RedisConnectionFactory redisConnectionFactory;

    @MockitoBean
    private JavaMailSender javaMailSender;

    @MockitoBean
    private RestTemplate restTemplate;

    @Test
    void contextLoads() {
    }
}
