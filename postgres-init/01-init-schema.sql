/* ====================================================================
   Script de Inicialização da Tabela de Usuários - SolarVision (POC)
   ====================================================================
   VERSÃO DE PROVA DE CONCEITO (INSEGURA)
   A coluna 'senha_hash' ESTÁ ARMAZENANDO SENHAS EM TEXTO PURO.
   NÃO USE ESTE SCRIPT EM PRODUÇÃO.
*/

CREATE TABLE IF NOT EXISTS usuarios (
    
    -- Chave primária única para identificar o usuário
    id SERIAL PRIMARY KEY,
    
    -- Coluna do campo 'Nome' do register.html
    nome VARCHAR(100) NOT NULL,
    
    -- Coluna do campo 'E-mail' do register.html e login.html
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Coluna para a senha (Armazenando TEXTO PURO para a POC)
    senha_hash VARCHAR(255) NOT NULL,
    
    -- Data de criação do registro
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cria um índice na coluna de e-mail para logins mais rápidos
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- ---
-- (Opcional) Inserir um usuário de teste
-- ---
-- Inserindo 'senha123' em texto puro na coluna 'senha_hash'
-- ---
INSERT INTO usuarios (nome, email, senha_hash) 
VALUES (
    'Arthur Teste', 
    'arthur@teste.com', 
    'senha123'
) 
ON CONFLICT (email) DO NOTHING;