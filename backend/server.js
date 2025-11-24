const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: 5432,
});

// Registro
app.post('/api/register', async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        await pool.query('INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)', [nome, email, senha]);
        res.status(201).send({ message: 'Sucesso' });
    } catch (err) {
        console.error('Erro no registro:', err);
        res.status(500).send({ message: 'Erro ao registrar.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND senha_hash = $2', [email, senha]);
        if (result.rows.length > 0) res.status(200).send({ message: 'OK' });
        else res.status(401).send({ message: 'Inválido' });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).send({ message: 'Erro no servidor' });
    }
});

// --- ROTA CORRIGIDA E BLINDADA ---
app.get('/api/leituras', async (req, res) => {
    try {
        // Tenta buscar os dados
        const result = await pool.query('SELECT dia, hora, wats5min FROM leituras_energia ORDER BY dia ASC, hora ASC LIMIT 500');
        
        const dados = result.rows.map(row => {
            // Conversão de dia segura: Garante que é um objeto Date ou string válida
            // Se row.dia já for string (dependendo da config do driver), new Date() resolve.
            // Se row.dia for objeto Date, new Date() clona e funciona igual.
            const dateObj = new Date(row.dia);
            const diaStr = dateObj.toISOString().split('T')[0];
            
            // Monta o timestamp combinando dia e hora
            const dateTimeStr = `${diaStr}T${row.hora}`;
            
            return { 
                x: new Date(dateTimeStr).getTime(), 
                y: parseFloat(row.wats5min) 
            };
        });

        res.json(dados);

    } catch (err) {
        // AQUI ESTÁ O SEGREDO: Imprime o erro real no terminal do Docker
        console.error('CRITICAL ERROR em /api/leituras:', err);
        
        // Verifica se o erro é de tabela inexistente
        if (err.code === '42P01') { // Código Postgres para "undefined table"
            return res.status(500).json({ message: 'A tabela leituras_energia não existe. Rode o script de banco.' });
        }

        res.status(500).json({ message: 'Erro interno ao buscar leituras', details: err.message });
    }
});

app.listen(port, () => console.log(`API rodando na porta ${port}`));