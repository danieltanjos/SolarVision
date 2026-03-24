package br.com.solarvision.api.controller;

import br.com.solarvision.api.dto.NotificationDtos;
import br.com.solarvision.api.service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/notifications")
public class InternalNotificationController {

    private final NotificationService notificationService;

    public InternalNotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/email")
    public NotificationDtos.MessageResponse send(@RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
                                                 @Valid @RequestBody NotificationDtos.InternalEmailRequest request) {
        return notificationService.sendInternalEmail(internalToken, request);
    }
}
