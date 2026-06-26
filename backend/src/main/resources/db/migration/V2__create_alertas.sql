CREATE TABLE IF NOT EXISTS alertas (
    id BIGSERIAL PRIMARY KEY,
    placa_id BIGINT NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    severidade VARCHAR(30) NOT NULL,
    canal VARCHAR(30) NOT NULL DEFAULT 'GRPC',
    detalhe TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alertas_placa
        FOREIGN KEY (placa_id)
        REFERENCES placas (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alertas_placa_id
    ON alertas (placa_id);

CREATE INDEX IF NOT EXISTS idx_alertas_criado_em
    ON alertas (criado_em DESC);
