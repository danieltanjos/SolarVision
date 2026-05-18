# SolarVision Frontend

Frontend SPA do SolarVision, construído em React + Vite e servido por Nginx.

## Stack

- React
- Vite
- React Router
- Axios
- ApexCharts
- Bootstrap

## Estrutura

```text
frontend/
├── src/
│   ├── components
│   ├── context
│   ├── lib
│   ├── pages
│   ├── styles
│   ├── App.jsx
│   └── main.jsx
├── css/style.css
├── img/
├── nginx/default.conf
├── Dockerfile
├── package.json
└── vite.config.js
```

## Funcionalidades

- Login e registro com JWT
- Rotas privadas com `react-router-dom`
- Interceptor Axios para `Authorization: Bearer <token>`
- Dashboard com gráfico em `react-apexcharts`
- Telas de grupos, placas, limpezas e configurações
- Tema escuro preservado da identidade anterior

## Desenvolvimento local

Se quiser rodar o frontend fora do Docker:

```bash
cd frontend
npm install
npm run dev
```

Por padrão, o `vite.config.js` faz proxy de `/api` para `http://localhost:8081`.

## Publicação no projeto

No fluxo padrão, o frontend é publicado pelo serviço:

```bash
docker compose up --build -d frontend
```
