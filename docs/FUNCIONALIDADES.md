# Funcionalidades - SolarVision

Compilado do que o sistema faz, organizado por módulo. SolarVision é uma plataforma de **monitoramento de energia solar**: cadastra grupos de placas, acompanha a geração de energia ao longo do tempo e registra limpezas.

> Arquitetura: [ARQUITETURA.md](ARQUITETURA.md) · Modelo de dados: [MODELO-DE-CLASSES.md](MODELO-DE-CLASSES.md)
>
> **Atenção:** alguns itens abaixo estão **parcialmente implementados** e marcados com **(parcial)**. O detalhamento e o que ainda falta estão em [FEATURES-INCOMPLETAS.md](FEATURES-INCOMPLETAS.md).

---

## 1. Autenticação e usuários

- **Cadastro** (`supabase.auth.signUp`) com nome, e-mail e senha; o Supabase Auth garante e-mail único e guarda a senha como hash. O trigger `criar_perfil_usuario` cria o perfil em `usuarios`.
- **Login** (`supabase.auth.signInWithPassword`) que abre uma sessão com JWT, renovada automaticamente pelo `supabase-js`.
- **Perfil do usuário logado**: `select` em `usuarios`; a RLS só devolve a linha do próprio usuário.
- Autorização por papéis: **ADMIN** e **USER**. **(parcial)** - o papel existe em `usuarios.role`, mas nenhuma política RLS o considera; qualquer usuário logado tem o mesmo acesso.
- Edição do próprio perfil/senha: **(parcial)** - ainda não implementada (sem política de `update` em `usuarios` nem tela de edição).
- Todas as tabelas exigem usuário autenticado (RLS); sem sessão nada é lido nem gravado.

## 2. Grupos solares

Tabela `grupos_solares` (uma instalação/usina que agrupa placas):

- Criar e listar grupos pela interface; a RLS também permite atualizar e excluir.
- Cada grupo tem um **status**: ATIVO, INATIVO ou MANUTENCAO (constraint `CHECK`).
- A listagem traz a **contagem de placas** (`placas(count)` na mesma consulta).

## 3. Placas / painéis

Tabela `placas`, sempre vinculada a um grupo:

- Criar e listar placas pela interface; a RLS também permite atualizar e excluir.
- Cada placa tem **modelo** e **status** (ATIVA, INATIVA, MANUTENCAO).
- Excluir um grupo remove suas placas em cascata (`on delete cascade`).

## 4. Limpezas

Tabela `limpezas`, histórico de limpeza das placas:

- Criar e listar limpezas pela interface; a RLS também permite atualizar e excluir.
- Cada limpeza tem **data** e uma **observação** opcional (até 1000 caracteres), associada a uma placa.

## 5. Leituras de energia e carga inicial

- A geração de energia fica em **leituras** (`leituras_energia`): data/hora e watts gerados por placa. Usuários autenticados só leem.
- A carga inicial é feita por `supabase/seed/inserirCSV.py`, que importa o CSV histórico (`Dados_Tratados_CDTE-PSI.csv`) em lote, executado uma vez com `DATABASE_URL`.
- O job pg_cron `deslocar-leituras-para-hoje` (todo dia às 00:05 de Brasília) desloca as leituras para que a última caia no dia atual.

## 6. Dashboard

Painel alimentado por duas funções SQL (RPC) e uma consulta:

- **Métricas** (`rpc('dashboard_metricas', { granularidade, data_inicio, data_fim })`): **potência média** (AVG dos watts) por balde de tempo (`hora`, `dia`, `semana` ou `mes` via `date_trunc`) dentro do período. Granularidade inválida ou início depois do fim geram erro. Alimenta o gráfico de geração.
- **Resumo** (`rpc('dashboard_resumo')`): energia gerada no dia em Wh (cada leitura é a potência média de 5 min: Wh = W × 5/60; exibida com auto-escala Wh/kWh/MWh), número de placas ativas e dados da última limpeza.
- **Última leitura** (`select data_hora` em `leituras_energia`, mais recente): o gráfico ancora nessa data, que fica ~hoje por causa do deslocamento.
- As agregações usam o fuso `America/Sao_Paulo`.

### Gráfico de geração (Monitoramento)

O gráfico de área usa quatro **visões de calendário** - **Dia, Semana, Mês e Ano**. A visão define a janela mostrada; o agrupamento (balde) é escolhido automaticamente para dar uma quantidade adequada de pontos:

| Visão | Janela (alinhada ao calendário) | Balde (agrupamento) |
|---|---|---|
| Dia | dia 00:00-23:59 | por hora |
| Semana | domingo a sábado | por dia |
| Mês | dia 1 ao último | por dia |
| Ano | janeiro a dezembro | por mês |

As setas navegam uma unidade por vez (um dia, uma semana, um mês ou um ano). O eixo Y mostra **potência média** com **auto-escala de unidade** (W, kW, MW ou GW) conforme a magnitude dos valores, e o gráfico tem legenda.

## 7. API GraphQL

O Supabase expõe GraphQL nativo (pg_graphql) em `https://skfguameoeklepcjnqth.supabase.co/graphql/v1`, gerado a partir das mesmas tabelas e sujeito às mesmas políticas RLS. Substitui o endpoint `/api/graphql` do Spring Boot; a SPA não o usa.

## 8. Frontend (SPA React)

Aplicação de página única, com rotas protegidas pela sessão do Supabase e tema escuro:

| Tela | Rota | Função | Tabelas / RPC |
|---|---|---|---|
| Login | `/login` | Autenticação | Supabase Auth (`signInWithPassword`) |
| Registro | `/register` | Criação de conta | Supabase Auth (`signUp`) + trigger em `usuarios` |
| Home | `/app/home` | Resumo do dashboard + grupos | `rpc dashboard_resumo`, `grupos_solares` |
| Monitoramento | `/app/monitoramento` | Gráfico com visões Dia/Semana/Mês/Ano e auto-escala de potência | `rpc dashboard_metricas`, `leituras_energia` (última leitura) |
| Cadastro | `/app/cadastro` | Gestão de grupos e placas. **(parcial)** - só cria/lista; editar/excluir está na branch `feat/muda-aba-cadastro` | `grupos_solares`, `placas` |
| Limpeza | `/app/limpeza` | Registro e histórico de limpezas. **(parcial)** - só cria/lista | `limpezas`, `placas` |
| Configurações | `/app/configuracoes` | Dados do usuário e do sistema (somente leitura). **(parcial)** - sem edição de perfil/senha | `usuarios` |

Todas as chamadas passam por `frontend/src/lib/api.js` e `frontend/src/context/AuthContext.jsx`. O nome do usuário é exibido com a primeira letra de cada palavra em maiúscula (ex.: "luiz gustavo" -> "Luiz Gustavo"), independente de como foi digitado no cadastro.

---

## Resumo do acesso aos dados

| Recurso | Operações liberadas pela RLS | Acesso |
|---|---|---|
| `auth.signUp` / `auth.signInWithPassword` | - | Público |
| `usuarios` | select (só a própria linha) | Autenticado |
| `grupos_solares` | select, insert, update, delete | Autenticado |
| `placas` | select, insert, update, delete | Autenticado |
| `limpezas` | select, insert, update, delete | Autenticado |
| `leituras_energia` | select | Autenticado |
| `rpc dashboard_metricas` | execute | Autenticado |
| `rpc dashboard_resumo` | execute | Autenticado |
| `/graphql/v1` | conforme as políticas acima | Autenticado |
