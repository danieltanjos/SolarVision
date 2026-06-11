package br.com.solarvision.api.dao;

import br.com.solarvision.api.model.GroupStatus;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelStatus;
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
public class PanelDAO {

    private final JdbcTemplate jdbcTemplate;
    private final JdbcClient jdbcClient;

    private final RowMapper<Panel> rowMapper = (rs, rowNum) -> {
        SolarGroup group = new SolarGroup();
        group.setId(rs.getLong("grupo_id"));
        group.setNome(rs.getString("grupo_nome"));
        group.setStatus(GroupStatus.valueOf(rs.getString("grupo_status")));
        group.setCriadoEm(rs.getObject("grupo_criado_em", OffsetDateTime.class));

        Panel panel = new Panel();
        panel.setId(rs.getLong("id"));
        panel.setGrupo(group);
        panel.setModel(rs.getString("modelo"));
        panel.setStatus(PanelStatus.valueOf(rs.getString("status")));
        panel.setCriadoEm(rs.getObject("criado_em", OffsetDateTime.class));
        return panel;
    };

    public PanelDAO(JdbcTemplate jdbcTemplate, JdbcClient jdbcClient) {
        this.jdbcTemplate = jdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    public Panel salvar(Panel panel) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO placas (grupo_id, modelo, status)
                    VALUES (?, ?, ?)
                    """, new String[]{"id"});
            ps.setLong(1, panel.getGrupo().getId());
            ps.setString(2, panel.getModel());
            ps.setString(3, panel.getStatus().name());
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        return buscarPorId(id.longValue()).orElseThrow();
    }

    public Optional<Panel> buscarPorId(Long id) {
        return jdbcClient.sql(baseSelect() + " WHERE p.id = :id")
                .param("id", id)
                .query(rowMapper)
                .optional();
    }

    public List<Panel> listarTodos() {
        return jdbcClient.sql(baseSelect() + " ORDER BY p.id ASC")
                .query(rowMapper)
                .list();
    }

    public List<Panel> listarPorGrupo(Long grupoId) {
        return jdbcClient.sql(baseSelect() + " WHERE p.grupo_id = :grupoId ORDER BY p.id ASC")
                .param("grupoId", grupoId)
                .query(rowMapper)
                .list();
    }

    public long contarPorStatus(PanelStatus status) {
        Long total = jdbcClient.sql("""
                        SELECT COUNT(*)
                        FROM placas
                        WHERE status = :status
                        """)
                .param("status", status.name())
                .query(Long.class)
                .single();

        return total == null ? 0L : total;
    }

    private String baseSelect() {
        return """
                SELECT p.id,
                       p.grupo_id,
                       p.modelo,
                       p.status,
                       p.criado_em,
                       g.nome AS grupo_nome,
                       g.status AS grupo_status,
                       g.criado_em AS grupo_criado_em
                FROM placas p
                JOIN grupos_solares g ON g.id = p.grupo_id
                """;
    }
}
