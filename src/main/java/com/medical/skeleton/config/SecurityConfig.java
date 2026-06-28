package com.medical.skeleton.config;

import com.medical.skeleton.security.JwtAuthenticationFilter;
import com.medical.skeleton.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security 전체 설정.
 *
 * <p>이 프로젝트는 JWT 기반 Stateless 인증을 사용하므로
 * 세션(HttpSession)과 CSRF를 비활성화합니다.</p>
 *
 * <h3>엔드포인트 접근 규칙</h3>
 * <ul>
 *   <li>{@code /api/auth/**}     — 누구나 접근 가능 (로그인, 토큰 갱신)</li>
 *   <li>{@code /api/ai/**}       — JWT 없이 접근 가능 (AI 서버가 API Key로 별도 인증)</li>
 *   <li>{@code /swagger-ui/**}   — 개발 편의를 위해 공개</li>
 *   <li>그 외 모든 경로          — 유효한 JWT 필수</li>
 * </ul>
 *
 * <h3>필터 체인 순서</h3>
 * JwtAuthenticationFilter → UsernamePasswordAuthenticationFilter → ... (나머지 Spring Security 필터)
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity   // @PreAuthorize, @Secured 어노테이션 활성화
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // REST API 서버이므로 CSRF 불필요 (토큰 기반 인증에서는 CSRF 공격이 불가)
            .csrf(AbstractHttpConfigurer::disable)
            // 프론트엔드(localhost:5173)에서 백엔드(localhost:8080) 호출 허용
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // 세션 사용 안 함 — JWT로 상태 관리하므로 서버에 세션을 만들지 않음
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 인증 없이 허용
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/api-docs/**", "/swagger-ui.html").permitAll()
                // AI 서버는 X-AI-API-Key 헤더로 자체 인증 (AiEventController 참고)
                .requestMatchers("/api/ai/**").permitAll()
                // CCTV용 정적 파일 (영상, 스켈레톤 JSON) - 인증 없이 허용
                .requestMatchers("/videos/**", "/skeleton/**").permitAll()
                // WebSocket(STOMP/SockJS) 핸드셰이크 - 인증 없이 허용
                .requestMatchers("/ws/**").permitAll()
                // 대시보드: 간호사·의사·관리자 모두 접근 가능
                .requestMatchers(HttpMethod.GET, "/api/wards/*/dashboard")
                    .hasAnyRole("NURSE", "DOCTOR", "ADMIN")
                // 나머지는 로그인 필요
                .anyRequest().authenticated()
            )
            // JWT 필터를 Spring Security 기본 폼 로그인 필터 앞에 추가
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider),
                UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS 설정.
     * 프론트엔드(Vite 개발 서버 포트 5173)에서 백엔드(8080) API 호출을 허용한다.
     * 배포 시 allowedOrigins에 실제 도메인을 추가할 것.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // 허용할 출처 (프론트엔드 개발 서버)
        config.setAllowedOrigins(List.of(
            "http://localhost:5173",   // Vite 개발 서버
            "http://localhost:3000"    // 혹시 다른 포트 사용 시를 위한 예비
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        // JWT, 쿠키 등 인증 정보 포함 허용
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * BCrypt 해시 알고리즘으로 비밀번호 암호화.
     * 회원가입·로그인 시 사용.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * AuthenticationManager — AuthService에서 직접 인증 처리 시 사용.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
