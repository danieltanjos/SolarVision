package br.com.solarvision.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class SolarVisionApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(SolarVisionApiApplication.class, args);
    }
}
