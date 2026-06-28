package com.medical.skeleton.domain.user.controller;

import com.medical.skeleton.domain.user.dto.LoginRequest;
import com.medical.skeleton.domain.user.dto.LoginResponse;
import com.medical.skeleton.domain.user.dto.RegisterRequest;
import com.medical.skeleton.domain.user.service.AuthService;
import com.medical.skeleton.global.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "인증", description = "로그인/로그아웃/토큰 갱신")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "로그인")
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }

    @Operation(summary = "회원가입 (의료진 계정 생성 후 즉시 로그인)")
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<LoginResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("회원가입이 완료되었습니다.", authService.register(request)));
    }

    @Operation(summary = "토큰 갱신")
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(
            @RequestHeader("Refresh-Token") String refreshToken) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refresh(refreshToken)));
    }

    @Operation(summary = "로그아웃 (클라이언트에서 토큰 삭제)")
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout() {
        return ResponseEntity.ok(ApiResponse.ok("로그아웃되었습니다.", null));
    }
}
