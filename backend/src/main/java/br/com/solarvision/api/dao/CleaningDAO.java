package br.com.solarvision.api.dao;

import br.com.solarvision.api.model.Cleaning;
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
public class CleaningDAO {

    private final JdbcTemplate jdbcTemplate;
    private final JdbcClient jdbcClient;

    private final RowMapper<Cleaning> rowMapper = (rs, rowNum) -> {
        SolarGroup group = new SolarGroup();
        group.setId(rs.getLong("grupo_id"));
        group.setNome(rs.getString("grupo_nome"));
        group.setStatus(GroupStatus.valueOf(rs.getString("grupo_status")));
        group.setCriadoEm(rs.getObject("grupo_criado_em", OffsetDateTime.class));

        Panel panel = new Panel();
        panel.setId(rs.getLong("placa_id"));
        panel.setGrupo(group);
        panel.setModel(rs.getString("placa_modelo"));
        panel.setStatus(PanelStatus.valueOf(rs.getString("placa_status")));
        panel.setCriadoEm(rs.getObject("placa_criado_em", OffsetDateTime.class));

        Cleaning cleaning = new Cleaning();
        cleaning.setId(rs.getLong("id"));
        cleaning.setPlaca(panel);
        cleaning.setDataLimpeza(rs.getObject("data_limpeza", OffsetDateTime.class));
        cleaning.setObservacao(rs.getString("observacao"));
        cleaning.setCriadoEm(rs.getObject("criado_em", OffsetDateTime.class));
        return cleaning;
    };

    public CleaningDAO(JdbcTemplate jdbcTemplate, JdbcClient jdbcClient) {
        this.jdbcTemplate = jdbcTemplate;
        this.jdbcClient = jdbcClient;
    }

    public Cleaning salvar(Cleaning cleaning) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO limpezas (placa_id, data_limpeza, observacao)
                    VALUES (?, ?, ?)
                    """, new String[]{"id"});
            ps.setLong(1, cleaning.getPlaca().getId());
            ps.setObject(2, cleaning.getDataLimpeza());
            ps.setString(3, cleaning.getObservacao());
            return ps;
        }, keyHolder);

        Number id = keyHolder.getKey();
        return buscarPorId(id.longValue()).orElseThrow();
    }

    public Optional<Cleaning> buscarPorId(Long id) {
        return jdbcClient.sql(baseSelect() + " WHERE l.id = :id")
                .param("id", id)
                .query(rowMapper)
                .optional();
    }

    public List<Cleaning> listarTodos() {
        return jdbcClient.sql(baseSelect() + " ORDER BY l.data_limpeza DESC, l.id DESC")
                .query(rowMapper)
                .list();
    }

    public List<Cleaning> buscar(Long placaId, OffsetDateTime dataInicio, OffsetDateTime dataFim) {
        return jdbcClient.sql("""
                        SELECT l.id,
                               l.placa_id,
                               l.data_limpeza,
                               l.observacao,
                               l.criado_em,
                               p.modelo AS placa_modelo,
                               p.status AS placa_status,
                               p.criado_em AS placa_criado_em,
                               p.grupo_id,
                               g.nome AS grupo_nome,
                               g.status AS grupo_status,
                               g.criado_em AS grupo_criado_em
                        FROM limpezas l
                        JOIN placas p ON p.id = l.placa_id
                        JOIN grupos_solares g ON g.id = p.grupo_id
                        WHERE (:placaId IS NULL OR l.placa_id = :placaId)
                          AND (:dataInicio IS NULL OR l.data_limpeza >= :dataInicio)
                          AND (:dataFim IS NULL OR l.data_limpeza <= :dataFim)
                        ORDER BY l.data_limpeza DESC, l.id DESC
                        """)
                .param("placaId", placaId)
                .param("dataInicio", dataInicio)
                .param("dataFim", dataFim)
                .query(rowMapper)
                .list();
    }

    public Optional<Cleaning> buscarUltima() {
        return jdbcClient.sql(baseSelect() + " ORDER BY l.data_limpeza DESC, l.id DESC LIMIT 1")
                .query(rowMapper)
                .optional();
    }

    private String baseSelect() {
        return """
                SELECT l.id,
                       l.placa_id,
                       l.data_limpeza,
                       l.observacao,
                       l.criado_em,
                       p.modelo AS placa_modelo,
                       p.status AS placa_status,
                       p.criado_em AS placa_criado_em,
                       p.grupo_id,
                       g.nome AS grupo_nome,
                       g.status AS grupo_status,
                       g.criado_em AS grupo_criado_em
                FROM limpezas l
                JOIN placas p ON p.id = l.placa_id
                JOIN grupos_solares g ON g.id = p.grupo_id
                """;
    }
}
