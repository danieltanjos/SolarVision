package br.com.solarvision.api.service;

import br.com.solarvision.api.dao.AppUserDAO;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.model.UserDtos;
import br.com.solarvision.api.security.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final AppUserDAO appUserDAO;

    public UserService(AppUserDAO appUserDAO) {
        this.appUserDAO = appUserDAO;
    }

    @Transactional(readOnly = true)
    public UserDtos.CurrentUserResponse getCurrentUser(AuthenticatedUser authenticatedUser) {
        AppUser user = appUserDAO.buscarPorId(authenticatedUser.id())
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
