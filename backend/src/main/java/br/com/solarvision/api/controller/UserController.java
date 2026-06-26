package br.com.solarvision.api.controller;

import br.com.solarvision.api.model.UserDtos;
import br.com.solarvision.api.security.AuthenticatedUser;
import br.com.solarvision.api.service.UserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserDtos.CurrentUserResponse me(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return userService.getCurrentUser(authenticatedUser);
    }
}
