const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Isso permite que a API leia o JSON enviado pelo frontend
app.use(express.json());

// --- Configuração da Conexão com o PostgreSQL ---
// Usamos as variáveis de ambiente do docker-compose
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: 5432,
});

// --- Rota de Registro ---
app.post('/api/register', async (req, res) => {
    const { nome, email, senha } = req.body;

    // Lembrete: POC insegura, salvando senha em texto puro
    const query = 'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)';
    
    try {
        await pool.query(query, [nome, email, senha]);
        console.log('Usuário registrado:', email);
        res.status(201).send({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).send({ message: 'Erro ao registrar usuário. O e-mail já pode existir.' });
    }
});

// --- Rota de Login ---
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;

    // Lembrete: POC insegura, consultando senha em texto puro
    const query = 'SELECT * FROM usuarios WHERE email = $1 AND senha_hash = $2';
    
    try {
        const result = await pool.query(query, [email, senha]);

        if (result.rows.length > 0) {
            // Login bem-sucedido
            console.log('Login bem-sucedido:', email);
            res.status(200).send({ message: 'Login bem-sucedido!', user: result.rows[0] });
        } else {
            // Login falhou
            console.log('Falha no login (e-mail ou senha):', email);
            res.status(401).send({ message: 'E-mail ou senha incorretos.' });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).send({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/leituras', async (req, res) => {
    try {
        // Busca as últimas 100 leituras ordenadas por data e hora
        // (Limitamos a 100 para não travar o navegador se tiver muitos dados)
        const query = 'SELECT data, hora, wats5min FROM leituras_energia ORDER BY data ASC, hora ASC LIMIT 200';
        const result = await pool.query(query);
        
        // Formata os dados para o ApexCharts entender
        // Ele precisa de um array: [{ x: 'data hora', y: valor }]
        const dadosFormatados = result.rows.map(row => {
            // Combina data e hora para criar um timestamp ISO
            // O Postgres retorna a data como objeto Date e hora como string
            const dataStr = row.data.toISOString().split('T')[0]; // Pega YYYY-MM-DD
            const dataHora = `${dataStr}T${row.hora}`; // Formato ISO
            
            return {
                x: new Date(dataHora).getTime(), // Converte para timestamp numérico
                y: parseFloat(row.wats5min)
            };
        });

        res.json(dadosFormatados);

    } catch (error) {
        console.error('Erro ao buscar leituras:', error);
        res.status(500).json({ message: 'Erro interno ao buscar dados.' });
    }
});

app.listen(port, () => {
    console.log(`Backend SolarVision rodando na porta ${port}`);
});