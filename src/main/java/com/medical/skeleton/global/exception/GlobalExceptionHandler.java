package com.medical.skeleton.global.exception;

import com.medical.skeleton.global.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * 전역 예외 처리 핸들러.
 *
 * <p>모든 컨트롤러에서 발생한 예외를 이곳에서 통합 처리합니다.
 * 각 서비스 레이어에서 던진 예외가 컨트롤러를 거쳐 여기서 잡힙니다.</p>
 *
 * <h3>예외 → HTTP 상태 코드 매핑</h3>
 * <ul>
 *   <li>{@link IllegalArgumentException}        → 400 (예: 존재하지 않는 ID, 잘못된 파라미터)</li>
 *   <li>{@link IllegalStateException}           → 400 (예: 중단된 처방, 중복 투여)</li>
 *   <li>{@link AccessDeniedException}           → 403 (Spring Security 권한 부족)</li>
 *   <li>{@link MethodArgumentNotValidException} → 400 (Bean Validation @Valid 실패)</li>
 *   <li>{@link Exception} (기타)                → 500</li>
 * </ul>
 *
 * <p>모든 응답은 {@link ApiResponse} 형태로 통일합니다.</p>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 존재하지 않는 리소스, 잘못된 요청 파라미터 */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
    }

    /** 비즈니스 규칙 위반 (예: 중단된 처방, 중복 투여 시도) */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalState(IllegalStateException e) {
        return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
    }

    /** 로그인 실패, 현재 비밀번호 불일치 등 인증 정보 오류 */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error(e.getMessage()));
    }

    /** @PreAuthorize 등 Spring Security 권한 체크 실패 */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("접근 권한이 없습니다."));
    }

    /**
     * @Valid 유효성 검증 실패 — 오류 필드를 모두 나열해서 반환.
     * 예) "name: 이름은 필수입니다, wardId: 병동 ID는 필수입니다"
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        BindingResult result = e.getBindingResult();
        String message = result.getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(ApiResponse.error(message));
    }

    /** 그 외 예상치 못한 서버 오류 — 스택트레이스는 로그로만 기록 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("서버 오류가 발생했습니다."));
    }
}
