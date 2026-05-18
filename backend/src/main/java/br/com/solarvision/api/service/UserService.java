package br.com.solarvision.api.service;

import br.com.solarvision.api.dto.UserDtos;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.repository.AppUserRepository;
import br.com.solarvision.api.security.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final AppUserRepository appUserRepository;

    public UserService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Transactional(readOnly = true)
    public UserDtos.CurrentUserResponse getCurrentUser(AuthenticatedUser authenticatedUser) {
        AppUser user = appUserRepository.findById(authenticatedUser.id())
                .orElseThrow(() -> new NotFoundException("Usuário autenticado não encontrado."));

        return new UserDtos.CurrentUserResponse(
                user.getId(),
                user.getNome(),
                user.getEmail(),
                user.getRole().name(),
                user.getCriadoEm()
        );
    }
}
