/* ====================================================================
   Script de Inicialização da Tabela de Usuários - SolarVision (POC)
   ====================================================================
*/

CREATE TABLE IF NOT EXISTS usuarios (
    
    -- Chave primária única para identificar o usuário
    id SERIAL PRIMARY KEY,
    
    -- Coluna do campo 'Nome' do register.html
    nome VARCHAR(100) NOT NULL,
    
    -- Coluna do campo 'E-mail' do register.html e login.html
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Coluna para a senha (Armazenando HASH gerado pelo bcrypt)
    senha_hash VARCHAR(255) NOT NULL,
    
    -- Data de criação do registro
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================================
-- TABELA DE LEITURAS DE ENERGIA (5min)
-- ==================================
CREATE TABLE IF NOT EXISTS leituras_energia (
    id SERIAL PRIMARY KEY,

    dia DATE NOT NULL,
    hora TIME NOT NULL,

    -- valor em watts medidos em intervalo de 5 minutos
    wats5min NUMERIC(12,4) NOT NULL
);

-- Cria um índice na coluna de e-mail para logins mais rápidos
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Cria um índice composto na coluna de dia e hora para otimizar os relatórios
CREATE INDEX IF NOT EXISTS idx_leituras_energia_dia_hora ON leituras_energia(dia, hora);

-- ---
-- (Opcional) Inserir um usuário de teste
-- ---
-- Inserindo hash da senha na coluna 'senha_hash'
-- ---
-- INSERT INTO usuarios (nome, email, senha_hash) 
-- VALUES (
--     'Arthur Teste', 
--     'arthur@teste.com', 
--     'senha123'
-- ) 
-- ON CONFLICT (email) DO NOTHING;


