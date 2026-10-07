# SolarVision Frontend

Frontend SPA do SolarVision, construído em React + Vite, publicado na Vercel e conectado diretamente ao Supabase.

## Stack

- React
- Vite
- React Router
- `@supabase/supabase-js`
- ApexCharts
- Bootstrap

## Estrutura

```text
frontend/
├── src/
│   ├── components
│   ├── context        # AuthContext (Supabase Auth)
│   ├── lib            # api.js (cliente Supabase e funções de dados), placas.js, periodo.js, power.js, text.js
│   ├── pages
│   ├── styles         # app.css: tokens de cor (claro/escuro) sobre o Bootstrap
│   ├── App.jsx
│   └── main.jsx
├── test/              # testes nativos do Node
├── img/
├── .env.example
├── vercel.json        # rewrite de SPA para index.html
├── package.json
└── vite.config.js
```

## Funcionalidades

- Cadastro e login com Supabase Auth (sessão e refresh do JWT persistidos pelo `supabase-js`)
- Rotas privadas com `react-router-dom`
- Dados lidos/gravados nas tabelas do Supabase (PostgREST) e no dashboard via RPC (`lib/api.js`)
- Monitoramento por grupo ou placa (seleção na URL) com gráfico em `react-apexcharts`: séries real (simulada: estimado menos a sujeira) e estimada pelo clima (Open-Meteo, com previsão de 7 dias)
- Telas de grupos (com local), placas (com potência, inclinação e orientação), limpezas e configurações
- Atribuição do Open-Meteo (CC BY 4.0) no rodapé
- Tema claro/escuro com a paleta original (#3b7197, sidebar azul-marinho, âmbar)

## Desenvolvimento local

```bash
cd frontend
cp .env.example .env.local   # preencher VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev                   # http://localhost:5173
```

`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ficam em Supabase > Project Settings > API Keys. Não há mais proxy de `/api`: o navegador chama o Supabase diretamente.

## Testes e build

```bash
npm test        # 40 testes (node --test)
npm run build   # gera dist/
```

## Publicação

A Vercel publica este diretório (Root Directory `frontend`) com as mesmas variáveis `VITE_SUPABASE_*`. A branch `production` vai para Production e a branch `qa` para o ambiente de QA; ver o [README da raiz](../readme.md#deploy-e-branches).
