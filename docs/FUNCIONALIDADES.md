# Funcionalidades - SolarVision

Compilado do que o sistema faz, organizado por módulo. SolarVision é uma plataforma de **monitoramento de energia solar**: cadastra grupos de placas, acompanha a geração de energia ao longo do tempo, registra limpezas e gera alertas.

> Arquitetura: [ARQUITETURA.md](ARQUITETURA.md) · Modelo de dados: [MODELO-DE-CLASSES.md](MODELO-DE-CLASSES.md)

---

## 1. Autenticação e usuários

- **Registro** de novo usuário (`POST /api/auth/register`) com nome, e-mail e senha; o e-mail é único e a senha é guardada como hash BCrypt.
- **Login** (`POST /api/auth/login`) que retorna um **token JWT** usado nas demais chamadas.
- **Perfil do usuário logado** (`GET /api/users/me`).
- Autorização por papéis: **ADMIN** e **USER**.
- Todas as rotas (exceto registro e login) exigem o token `Authorization: Bearer <jwt>`.

## 2. Grupos solares

CRUD completo de grupos (uma instalação/usina que agrupa placas):

- Criar, listar, detalhar, atualizar e excluir grupos.
- Listar as placas de um grupo (`GET /api/groups/{id}/panels`).
- Cada grupo tem um **status**: ATIVO, INATIVO ou MANUTENCAO.
- A resposta de grupo inclui a **contagem de placas**.

## 3. Placas / painéis

CRUD completo de placas, sempre vinculadas a um grupo:

- Criar, listar, detalhar, atualizar e excluir placas.
- Cada placa tem **modelo** e **status** (ATIVA, INATIVA, MANUTENCAO).
- Excluir um grupo remove suas placas em cascata.

## 4. Limpezas

Registro do histórico de limpeza das placas:

- Criar, listar, detalhar, atualizar e excluir limpezas.
- Cada limpeza tem **data** e uma **observação** opcional, associada a uma placa.

## 5. Leituras de energia e carga inicial

- A geração de energia é registrada em **leituras** (`leituras_energia`): data/hora e watts gerados por placa.
- A carga inicial é feita pelo serviço **seed-data** (Python), que importa um CSV histórico (`Dados_Tratados_CDTE-PSI.csv`) em lote para o banco.

## 6. Dashboard

Painel de acompanhamento alimentado por dois endpoints:

- **Métricas** (`GET /api/dashboard/metrics`): geração agregada por **granularidade** (hora, dia, semana ou mês) dentro de um período (`dataInicio`/`dataFim`). Alimenta o gráfico de geração.
- **Resumo** (`GET /api/dashboard/summary`): total gerado no dia, número de placas ativas e dados da última limpeza.
- **Intervalo de dados** (`GET /api/dashboard/range`): primeira e última leitura existentes na base; o gráfico usa a primeira leitura para iniciar no primeiro dia com dados.
- As agregações respeitam o fuso configurado (`America/Sao_Paulo` por padrão).

## 7. API GraphQL

Endpoint único `POST /api/graphql` como alternativa flexível ao REST:

- **Queries**: `panels(filter)` e `cleanings(filter)` - com filtros por grupo, status, modelo, placa e intervalo de datas.
- **Mutations**: `createPanel` e `createCleaning`.

## 8. Serviços gRPC e alertas

Servidor gRPC interno (porta 9090), exposto também por uma ponte REST em `/api/internal/grpc`:

- **Checar placa** (`PanelService.ChecarPlaca`): verifica a placa e registra uma leitura de disponibilidade.
- **Gerar alerta** (`AlertService.GerarAlerta`): cria um **alerta** vinculado à placa (tabela `alertas`).
- **Disparar e-mail de alerta** (`AlertService.DispararEmailAlerta`): registra o alerta e simula o envio de e-mail (log).

## 9. Documentação da API

- **Swagger UI** em `/swagger-ui.html` (especificação OpenAPI em `/v3/api-docs`), com suporte a autenticação via Bearer JWT para testar os endpoints protegidos.

## 10. Frontend (SPA React)

Aplicação de página única, com rotas protegidas por JWT e tema escuro:

| Tela | Rota | Função |
|---|---|---|
| Login | `/login` | Autenticação |
| Registro | `/register` | Criação de conta |
| Home | `/app/home` | Resumo do dashboard + grupos |
| Monitoramento | `/app/monitoramento` | Gráfico de geração com filtro de granularidade |
| Cadastro | `/app/cadastro` | Gestão de grupos e placas |
| Limpeza | `/app/limpeza` | Registro e histórico de limpezas |
| Configurações | `/app/configuracoes` | Ajustes |

O frontend consome a API via Nginx (proxy reverso de `/api`), com um interceptor Axios que injeta o token JWT automaticamente.

---

## Resumo dos endpoints REST

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/register` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/users/me` | Autenticado |
| GET / POST | `/api/groups` | Autenticado |
| GET / PUT / DELETE | `/api/groups/{groupId}` | Autenticado |
| GET | `/api/groups/{groupId}/panels` | Autenticado |
| GET / POST | `/api/panels` | Autenticado |
| GET / PUT / DELETE | `/api/panels/{panelId}` | Autenticado |
| GET / POST | `/api/cleanings` | Autenticado |
| GET / PUT / DELETE | `/api/cleanings/{cleaningId}` | Autenticado |
| GET | `/api/dashboard/metrics` | Autenticado |
| GET | `/api/dashboard/summary` | Autenticado |
| GET | `/api/dashboard/range` | Autenticado |
| POST | `/api/graphql` | Autenticado |
| POST | `/api/internal/grpc/panels/{panelId}/check` | Autenticado |
| POST | `/api/internal/grpc/alerts` | Autenticado |
| POST | `/api/internal/grpc/alerts/email` | Autenticado |
