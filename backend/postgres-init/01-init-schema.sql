BEGIN;

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'USER',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_usuarios_role CHECK (role IN ('ADMIN', 'USER'))
);

CREATE TABLE IF NOT EXISTS grupos_solares (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ATIVO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_grupos_solares_status CHECK (status IN ('ATIVO', 'INATIVO', 'MANUTENCAO'))
);

CREATE TABLE IF NOT EXISTS placas (
    id BIGSERIAL PRIMARY KEY,
    grupo_id BIGINT NOT NULL,
    modelo VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_placas_grupo
        FOREIGN KEY (grupo_id)
        REFERENCES grupos_solares (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_placas_status CHECK (status IN ('ATIVA', 'INATIVA', 'MANUTENCAO'))
);

CREATE TABLE IF NOT EXISTS limpezas (
    id BIGSERIAL PRIMARY KEY,
    placa_id BIGINT NOT NULL,
    data_limpeza TIMESTAMPTZ NOT NULL,
    observacao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_limpezas_placa
        FOREIGN KEY (placa_id)
        REFERENCES placas (id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leituras_energia (
    id BIGSERIAL PRIMARY KEY,
    placa_id BIGINT NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL,
    wats_gerados NUMERIC(14, 4) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leituras_energia_placa
        FOREIGN KEY (placa_id)
        REFERENCES placas (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email
    ON usuarios (email);

CREATE INDEX IF NOT EXISTS idx_grupos_solares_status
    ON grupos_solares (status);

CREATE INDEX IF NOT EXISTS idx_placas_grupo_id
    ON placas (grupo_id);

CREATE INDEX IF NOT EXISTS idx_placas_status
    ON placas (status);

CREATE INDEX IF NOT EXISTS idx_limpezas_placa_id
    ON limpezas (placa_id);

CREATE INDEX IF NOT EXISTS idx_limpezas_data_limpeza
    ON limpezas (data_limpeza DESC);

CREATE INDEX IF NOT EXISTS idx_leituras_energia_placa_data_hora
    ON leituras_energia (placa_id, data_hora DESC);

COMMIT;
