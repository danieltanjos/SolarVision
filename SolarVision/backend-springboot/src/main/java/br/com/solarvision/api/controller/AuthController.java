package br.com.solarvision.api.controller;

import br.com.solarvision.api.dto.AuthDtos;
import br.com.solarvision.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/google")
    public AuthDtos.AuthResponse loginWithGoogle(@Valid @RequestBody AuthDtos.GoogleAuthRequest request) {
        return authService.loginWithGoogle(request.google_token());
    }

    @GetMapping("/users/me")
    public AuthDtos.UserMeResponse me(Principal principal) {
        return authService.me(principal);
    }
}
