package kr.co.herob.board.config;

import kr.co.herob.board.service.AccountService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/** 세션 로그인, API별 접근 규칙, 비밀번호 암호화, 데모 관리자 준비를 구성합니다. */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** 공개 경로와 로그인 세션이 필요한 경로를 구분하는 보안 필터 체인을 만듭니다. */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityContextRepository contextRepository,
                                                   @Value("${spring.h2.console.enabled:false}") boolean h2Console) throws Exception {
        http
            // JSON API와 세션 쿠키(SameSite=Lax) 조합이라 CSRF 토큰은 쓰지 않습니다.
            .csrf(AbstractHttpConfigurer::disable)
            .securityContext(context -> context.securityContextRepository(contextRepository))
            .authorizeHttpRequests(auth -> {
                // SSE 종료 시의 비동기 재디스패치에서 인가를 다시 검사하면 이미 커밋된 응답에 AccessDenied가 기록됩니다.
                auth.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC).permitAll();
                // H2 콘솔은 명시적으로 켠 개발 환경에서만 공개합니다.
                if (h2Console) auth.requestMatchers("/h2-console/**").permitAll();
                auth
                .requestMatchers("/", "/index.html", "/css/**", "/js/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/register", "/api/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/register/username-available").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/me").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().authenticated();
            })
            .headers(headers -> headers.frameOptions(frame -> {
                if (h2Console) frame.sameOrigin(); else frame.deny();
            }))
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(logout -> logout
                .logoutUrl("/api/logout")
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)));

        return http.build();
    }

    /** 가입 비밀번호와 저장된 비밀번호 해시에 사용할 BCrypt 인코더를 제공합니다. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** 로그인 후 인증 정보를 HTTP 세션에 저장하도록 저장소를 제공합니다. */
    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** 로그인 요청을 처리할 Spring Security 인증 관리자를 제공합니다. */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    /** 관리자 비밀번호 환경변수가 설정돼 있을 때만 관리자 계정을 준비합니다. */
    @Bean
    public ApplicationRunner seedAdmin(AccountService accounts) {
        return args -> accounts.ensureAdmin();
    }
}
