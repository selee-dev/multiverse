package kr.co.herob.board;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Spring Boot 진입점으로 애플리케이션 구성과 설정 바인딩을 시작합니다. */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class HeroBoardApplication {
    public static void main(String[] args) {
        SpringApplication.run(HeroBoardApplication.class, args);
    }
}
