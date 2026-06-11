package br.com.solarvision.api.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

public class AuthenticatedUser implements UserDetails {

    private final Long id;
    private final String email;
    private final String nome;
    private final String role;
    private final String senhaHash;
    private final Collection<? extends GrantedAuthority> authorities;

    public AuthenticatedUser(Long id,
                             String email,
                             String nome,
                             String role,
                             String senhaHash,
                             Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.email = email;
        this.nome = nome;
        this.role = role;
        this.senhaHash = senhaHash;
        this.authorities = authorities;
    }

    public Long id() {
        return id;
    }

    public String email() {
        return email;
    }

    public String nome() {
        return nome;
    }

    public String role() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return senhaHash;
    }

    @Override
    public String getUsername() {
        return email;
    }
}
