package br.com.solarvision.api.security;

import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.repository.AppUserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserDetailsServiceCustom implements UserDetailsService {

    private final AppUserRepository appUserRepository;

    public UserDetailsServiceCustom(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        AppUser user = appUserRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado."));

        return new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                user.getNome(),
                user.getRole().name(),
                user.getSenhaHash(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
