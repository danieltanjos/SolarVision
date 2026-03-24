package br.com.solarvision.api.service;

import br.com.solarvision.api.dto.NotificationDtos;
import br.com.solarvision.api.exception.BadRequestException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String internalToken;

    public NotificationService(ObjectProvider<JavaMailSender> mailSenderProvider,
                               @Value("${app.internal.token}") String internalToken) {
        this.mailSenderProvider = mailSenderProvider;
        this.internalToken = internalToken;
    }

    public NotificationDtos.MessageResponse sendInternalEmail(String headerToken, NotificationDtos.InternalEmailRequest request) {
        if (headerToken == null || !headerToken.equals(internalToken)) {
            throw new BadRequestException("X-Internal-Token inválido.");
        }
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            return new NotificationDtos.MessageResponse("Solicitação recebida. Configure spring.mail.* para envio real.");
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(request.to());
            helper.setSubject(request.subject());
            helper.setText(buildBody(request), false);
            mailSender.send(message);
            return new NotificationDtos.MessageResponse("Email interno enviado com sucesso.");
        } catch (Exception ex) {
            throw new BadRequestException("Falha ao enviar email: " + ex.getMessage());
        }
    }

    private String buildBody(NotificationDtos.InternalEmailRequest request) {
        return "Template: " + request.template() + "
Dados: " + request.data();
    }
}
