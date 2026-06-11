package br.com.solarvision.api.dao;

import br.com.solarvision.api.model.GroupStatus;
import br.com.solarvision.api.model.SolarGroup;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Component
public class SolarGroupDAO {

    private final JdbcTemplate jdbcTemplate;
    private final JdbcClient jdbcClient;

    private final RowMapper<SolarGroup> rowMapper = (rs, rowNum) -> {
        SolarGroup group = new SolarGroup();
        group.setId(rs.getLong("id"));
        group.setNome(rs.getString("nome"));
        group.setStatus(GroupStatus.valueOf(rs.getString("status")));
        group.setCriadoEm(rs.getObject("criado_em", OffsetDateTime.class));
        return group;
    };

    public SolarGroupDAO(JdbcTemplate jdbcTemplate, JdbcClient jdbcClient) {
        this.jdbcTemplate = jdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    public SolarGroup salvar(SolarGroup group) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO grupos_solares (nome, status)
                    VALUES (?, ?)
                    """, new String[]{"id"});
            ps.setString(1, group.getNome());
            ps.setString(2, group.getStatus().name());
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        return buscarPorId(id.longValue()).orElseThrow();
    }

    public Optional<SolarGroup> buscarPorId(Long id) {
        return jdbcClient.sql("""
                        SELECT id, nome, status, criado_em
                        FROM grupos_solares
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(rowMapper)
                .optional();
    }

    public List<SolarGroup> listarTodos() {
        return jdbcClient.sql("""
                        SELECT id, nome, status, criado_em
                        FROM grupos_solares
                        ORDER BY id ASC
                        """)
                .query(rowMapper)
                .list();
    }

    public int contarPlacas(Long grupoId) {
        Integer total = jdbcClient.sql("""
                        SELECT COUNT(*)
                        FROM placas
                        WHERE grupo_id = :grupoId
                        """)
                .param("grupoId", grupoId)
                .query(Integer.class)
                .single();

        return total == null ? 0 : total;
    }
}
