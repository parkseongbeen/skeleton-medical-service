package com.medical.skeleton.domain.user.service;

import com.medical.skeleton.domain.user.dto.LoginRequest;
import com.medical.skeleton.domain.user.dto.LoginResponse;
import com.medical.skeleton.domain.user.dto.RegisterRequest;
import com.medical.skeleton.domain.user.entity.Role;
import com.medical.skeleton.domain.user.entity.User;
import com.medical.skeleton.domain.user.repository.UserRepository;
import com.medical.skeleton.domain.ward.entity.Ward;
import com.medical.skeleton.domain.ward.repository.WardRepository;
import com.medical.skeleton.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final WardRepository wardRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        String accessToken = jwtTokenProvider.createAccessToken(user.getUsername(), user.getRole().name());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUsername());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .username(user.getUsername())
                .name(user.getName())
                .role(user.getRole().name())
                .wardId(user.getWardId())
                .userId(user.getId())
                .build();
    }

    /**
     * 회원가입 — 의료진(간호사/의사) 계정을 새로 만들고 즉시 로그인 처리한다.
     *
     * <p>ADMIN 권한은 자체 가입을 허용하지 않으며, role 값은 "NURSE"/"DOCTOR"만 허용한다.</p>
     */
    public LoginResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("이미 사용 중인 사번 또는 이메일입니다.");
        }

        Role role = parseRegistrableRole(request.getRole());

        // 가입 시 병동을 지정하지 않으면(현재 프런트에서는 별도 선택 UI가 없음)
        // 시스템에 등록된 기본 병동에 자동 배정한다. 병동이 없으면 null로 둔다(관리자가 추후 배정).
        Long wardId = request.getWardId();
        if (wardId == null) {
            wardId = wardRepository.findAll().stream()
                    .findFirst()
                    .map(Ward::getId)
                    .orElse(null);
        }

        User user = userRepository.save(User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .role(role)
                .wardId(wardId)
                .build());

        String accessToken = jwtTokenProvider.createAccessToken(user.getUsername(), user.getRole().name());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUsername());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .username(user.getUsername())
                .name(user.getName())
                .role(user.getRole().name())
                .wardId(user.getWardId())
                .userId(user.getId())
                .build();
    }

    private Role parseRegistrableRole(String roleValue) {
        try {
            Role role = Role.valueOf(roleValue.trim().toUpperCase());
            if (role == Role.ADMIN) {
                throw new IllegalArgumentException("관리자 권한은 직접 가입할 수 없습니다.");
            }
            return role;
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null && e.getMessage().contains("관리자")) {
                throw e;
            }
            throw new IllegalArgumentException("역할은 간호사 또는 의사만 선택할 수 있습니다.");
        }
    }

    public LoginResponse refresh(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new IllegalArgumentException("유효하지 않은 리프레시 토큰입니다.");
        }

        String username = jwtTokenProvider.getUsername(refreshToken);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        String newAccessToken = jwtTokenProvider.createAccessToken(user.getUsername(), user.getRole().name());
        String newRefreshToken = jwtTokenProvider.createRefreshToken(user.getUsername());

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .username(user.getUsername())
                .name(user.getName())
                .role(user.getRole().name())
                .build();
    }
}
