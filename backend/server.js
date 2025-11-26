const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const app = express();
const port = 3000;

// Middleware para entender JSON no corpo das requisições
app.use(express.json());

// --- Configuração da Conexão com o PostgreSQL ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: 5432,
});

// ============================================
// ROTA 1: REGISTRO DE USUÁRIO
// ============================================
app.post('/api/register', async (req, res) => {
    const { nome, email, senha } = req.body;
    
    // Query para inserir usuário (POC: senha em texto puro)
    const query = 'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)';
    
    try {
        const senha_hash = await bcrypt.hash(senha, 10);
        await pool.query(query, [nome, email, senha_hash]);
        console.log(`Novo usuário registrado: ${email}`);
        res.status(201).send({ message: 'Usuário registrado com sucesso!' });
    } catch (err) {
        console.error('Erro no registro:', err);
        res.status(500).send({ message: 'Erro ao registrar usuário. Verifique se o e-mail já existe.' });
    }
});

// ============================================
// ROTA 2: LOGIN
// ============================================
// app.post('/api/login', async (req, res) => {
//     const { email, senha } = req.body;
    
//     const query = 'SELECT nome, email, senha_hash FROM usuarios WHERE email = $1';
    
//     try {
//         const result = await pool.query(query, [email]);
//         const passCheck = await bcrypt.compare(senha, senha_hash);
//         const user = result.rows[0]

//         if (user && passCheck) {
//             console.log(`Login efetuado: ${email}`);
//             const user = result.rows[0];
//             res.status(200).send({ 
//                 message: 'Login bem-sucedido!', 
//                 user: { nome: user.nome, email: user.email } 
//             });
//         } else {
//             console.log(`Falha de login para: ${email}`);
//             res.status(401).send({ message: 'E-mail ou senha incorretos.' });
//         }
//     } catch (err) {
//         console.error('Erro no login:', err);
//         res.status(500).send({ message: 'Erro interno do servidor.' });
//     }
// });

app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    console.log('Login attempt received:', { email, senha_length: senha ? senha.length : 0 });

    const query = 'SELECT nome, email, senha_hash FROM usuarios WHERE email = $1';

    try {
        const result = await pool.query(query, [email]);
        console.log('DB query result:', { rowCount: result.rowCount, rows: result.rows });

        if (result.rowCount === 0) {
            console.log(`Usuário não encontrado: ${email}`);
            return res.status(401).send({ message: 'E-mail ou senha incorretos.' });
        }

        const user = result.rows[0];
        if (!user || !user.senha_hash) {
            console.log('Dados de usuário inválidos ou sem senha_hash:', user);
            return res.status(500).send({ message: 'Erro interno do servidor.' });
        }

        const passCheck = await bcrypt.compare(senha, user.senha_hash);
        console.log('Password comparison result for', email, ':', passCheck);

        if (passCheck) {
            console.log(`Login efetuado: ${email}`);
            res.status(200).send({
                message: 'Login bem-sucedido!',
                user: { nome: user.nome, email: user.email }
            });
        } else {
            console.log(`Falha de login (senha incorreta) para: ${email}`);
            res.status(401).send({ message: 'E-mail ou senha incorretos.' });
        }
    } catch (err) {
        console.error('Erro no login (stack):', err.stack || err);
        res.status(500).send({ message: 'Erro interno do servidor.' });
    }
});

// ============================================
// ROTA 3: DADOS DE ENERGIA (CORRIGIDO: 'dia' em vez de 'data')
// ============================================
app.get('/api/leituras', async (req, res) => {
    try {
        const { inicio, fim } = req.query;

        // CORREÇÃO: Usando a coluna 'dia'
        let query = 'SELECT dia, hora, wats5min FROM leituras_energia';
        let params = [];

        if (inicio && fim) {
            // CORREÇÃO: Usando a coluna 'dia' no filtro
            query += ' WHERE dia >= $1 AND dia <= $2';
            params = [inicio, fim];
        }

        // CORREÇÃO: Ordenando por 'dia'
        query += ' ORDER BY dia ASC, hora ASC';
        query += ' LIMIT 5000';

        const result = await pool.query(query, params);
        
        const dados = result.rows.map(row => {
            // CORREÇÃO: Acessando row.dia (não row.data)
            // O driver do PG pode retornar 'dia' como objeto Date ou string
            const dateObj = new Date(row.dia);
            
            // Ajuste para evitar problemas de fuso horário na conversão simples
            // Pegamos a parte da data YYYY-MM-DD
            const diaStr = dateObj.toISOString().split('T')[0];
            
            // Combina dia e hora para criar o timestamp
            const dateTimeStr = `${diaStr}T${row.hora}`;
            
            return { 
                x: new Date(dateTimeStr).getTime(), 
                y: parseFloat(row.wats5min) 
            };
        });

        res.json(dados);

    } catch (err) {
        console.error('Erro ao buscar leituras:', err);
        
        if (err.code === '42P01') {
            return res.status(500).json({ message: 'Erro: A tabela leituras_energia não existe no banco.' });
        }
        // Se a coluna não existir, o erro será '42703' (undefined_column)
        if (err.code === '42703') {
             return res.status(500).json({ message: 'Erro: A coluna "dia" ou "hora" não foi encontrada. Verifique o schema.' });
        }

        res.status(500).json({ message: 'Erro interno ao buscar leituras', details: err.message });
    }
});

app.listen(port, () => {
    console.log(`Backend SolarVision rodando na porta ${port}`);
});