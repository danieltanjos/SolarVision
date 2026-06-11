package br.com.solarvision.api.dao;

import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.model.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.time.OffsetDateTime;
import java.util.Optional;

@Component
public class AppUserDAO {

    private final JdbcTemplate jdbcTemplate;
    private final JdbcClient jdbcClient;

    private final RowMapper<AppUser> rowMapper = (rs, rowNum) -> {
        AppUser user = new AppUser();
        user.setId(rs.getLong("id"));
        user.setNome(rs.getString("nome"));
        user.setEmail(rs.getString("email"));
        user.setSenhaHash(rs.getString("senha_hash"));
        user.setRole(UserRole.valueOf(rs.getString("role")));
        user.setCriadoEm(rs.getObject("criado_em", OffsetDateTime.class));
        return user;
    };

    public AppUserDAO(JdbcTemplate jdbcTemplate, JdbcClient jdbcClient) {
        this.jdbcTemplate = jdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    public AppUser salvar(AppUser user) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO usuarios (nome, email, senha_hash, role)
                    VALUES (?, ?, ?, ?)
                    """, new String[]{"id"});
            ps.setString(1, user.getNome());
            ps.setString(2, user.getEmail());
            ps.setString(3, user.getSenhaHash());
            ps.setString(4, user.getRole().name());
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        return buscarPorId(id.longValue()).orElseThrow();
    }

    public Optional<AppUser> buscarPorId(Long id) {
        return jdbcClient.sql("""
                        SELECT id, nome, email, senha_hash, role, criado_em
                        FROM usuarios
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(rowMapper)
                .optional();
    }

    public Optional<AppUser> buscarPorEmail(String email) {
        return jdbcClient.sql("""
                        SELECT id, nome, email, senha_hash, role, criado_em
                        FROM usuarios
                        WHERE lower(email) = lower(:email)
                        """)
                .param("email", email)
                .query(rowMapper)
                .optional();
    }

    public boolean existePorEmail(String email) {
        Integer total = jdbcClient.sql("""
                        SELECT COUNT(*)
                        FROM usuarios
                        WHERE lower(email) = lower(:email)
                        """)
                .param("email", email)
                .query(Integer.class)
                .single();

        return total != null && total > 0;
    }
}
