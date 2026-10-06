# Decisões Técnicas e Justificativas - SolarVision

Este documento registra **as escolhas tecnológicas e as decisões de projeto**, justificando-as sob diferentes referenciais (técnico, legal/normativo, institucional/acadêmico e ético/social).

> Arquitetura e mecanismos de segurança: [ARQUITETURA.md](ARQUITETURA.md).

---

## 1. Contexto e critério condutor

O SolarVision é um **trabalho acadêmico**. Na primeira fase (disciplina de Desenvolvimento Web), o critério condutor foi **atender aos critérios de avaliação da matéria** e **usar as tecnologias lecionadas** - Spring Data JPA, Spring Security/JWT, Flyway, Swagger/OpenAPI, mais GraphQL e gRPC como diferencial. Esse backend Spring Boot cumpriu o papel e está preservado no histórico do Git.

Na fase atual, o critério passou a ser **colocar o sistema no ar de forma contínua, com ambientes de QA e produção, sem custo e sem servidor para manter**. Daí a migração para **Supabase + Vercel** (seção 5).

---

## 2. Linguagem e plataforma

**Plataforma do sistema:** **SPA** no navegador + **backend como serviço** (Supabase).

- **Front-end: JavaScript (React + Vite)** - plataforma navegador, onde JS é a linguagem nativa; React é o padrão de mercado para SPAs.
- **Regras no banco: SQL / PL/pgSQL** - as agregações do dashboard e o trigger de perfil rodam dentro do PostgreSQL, perto dos dados.
- **Carga de dados: Python** - script curto para ler o CSV e inserir em lote (psycopg2).

> Reconhecimento da adequação linguagem x plataforma: JavaScript para o navegador, SQL para regras que dependem dos dados, Python para a tarefa pontual de importação.

---

## 3. Framework x ferramenta x biblioteca

Distinção conceitual usada no projeto:

- **Framework**: impõe a estrutura e o fluxo da aplicação (inversão de controle - "ele chama o seu código"). Você preenche os pontos de extensão.
- **Biblioteca**: você chama quando precisa; não dita a estrutura.
- **Ferramenta**: utilitário externo ao código, usado no build, na infraestrutura ou na operação.

| Tecnologia | Categoria | Papel |
|---|---|---|
| React | Framework | SPA do front-end |
| `@supabase/supabase-js`, ApexCharts, Bootstrap, React Router | Biblioteca | Acesso ao Supabase, gráfico, UI, rotas |
| psycopg2 | Biblioteca | Conexão do seeder com o PostgreSQL |
| `node:test` | Biblioteca (teste) | Testes automatizados do frontend |
| Supabase (Auth, PostgREST, pg_graphql, pg_cron) | Plataforma / ferramenta | Backend gerenciado |
| Vite | Ferramenta | Servidor de desenvolvimento e build |
| Vercel | Ferramenta | Hospedagem e deploy por branch |
| GitHub Actions | Ferramenta | CI (testes + build) |
| Git / GitHub | Ferramenta | Versionamento e colaboração |

---

## 4. Justificativas por dimensão

### Técnica
- **RLS no lugar de um filtro de segurança**: a regra de acesso fica no banco e vale para qualquer cliente (REST, GraphQL, SQL).
- **Funções SQL para o dashboard**: a agregação (`date_trunc` + `avg`) roda onde os dados estão e devolve só os pontos do gráfico.
- **Migration versionada** (`supabase/migrations/`): schema, políticas, funções e job reproduzíveis, como era com o Flyway.
- **Supabase Auth**: JWT com refresh, hash de senha e confirmação de e-mail prontos, sem código próprio de autenticação.

### Legal / Normativa
- **LGPD**: o sistema trata dados pessoais (nome, e-mail, senha). A senha fica apenas como hash no Supabase Auth e não existe em tabela da aplicação; cada usuário só lê o próprio perfil. Os dados ficam na região **São Paulo**.
- **Licenças open-source**: React (MIT), PostgreSQL (licença PostgreSQL) e os componentes do Supabase (Apache 2.0/MIT) - compatíveis com uso acadêmico e comercial.
- **Boas práticas de segurança**: HTTPS em todo o tráfego (Vercel e Supabase), consultas parametrizadas pelo PostgREST e apenas a chave publicável no frontend.

### Institucional / Acadêmica
- A primeira fase demonstrou as tecnologias da disciplina de Desenvolvimento Web; a fase atual demonstra operação real: deploy contínuo, ambientes separados e fluxo de promoção entre branches.
- **Convenções de engenharia**: versionamento com Git, fluxo de **branches + Pull Requests**, CI em cada push/PR e documentação no diretório `docs/`.

### Ética / Social
- **Proteção dos dados do usuário** (hash de senha, RLS, mensagens de erro traduzidas que não expõem detalhes internos).
- **Usabilidade**: mensagens de validação claras em português.
- **Software livre**: tecnologias open-source, acessíveis e auditáveis.

---

## 5. Migração para Supabase + Vercel

**Decisão:** remover o backend Spring Boot, o Docker Compose e o Nginx; usar o Supabase como backend completo e a Vercel para hospedar a SPA.

**Por quê:**
- **Hospedagem sem custo e sem servidor**: um backend Java exige uma máquina ou contêiner sempre ligado; Supabase e Vercel têm planos gratuitos e não há processo para manter.
- **Tudo o que o backend fazia tem equivalente gerenciado**: JWT/BCrypt → Supabase Auth; controllers REST → PostgREST; `SecurityConfig` → RLS; `DashboardService` → funções SQL; Flyway → migrations do Supabase; Spring GraphQL → pg_graphql; reinício do seeder no `docker compose up` → job pg_cron.
- **Deploy por branch**: a Vercel publica `production` e `qa` automaticamente, cada uma com sua URL, e cria previews para PRs.
- **Menos código**: o frontend manteve o mesmo formato de dados (aliases em `lib/api.js`), então as telas quase não mudaram.

**O que se perdeu (trade-offs aceitos):**

| Perda | Impacto | Mitigação |
|---|---|---|
| gRPC (servidor embarcado, ponte REST e tabela `alertas`) | Os alertas e a simulação de e-mail deixaram de existir | Era demonstrativo; alertas voltam como tabela + função/Edge Function se necessário |
| Swagger/OpenAPI | Sem a UI interativa do springdoc | O painel do Supabase gera a documentação da API (tabelas e funções) a partir do schema |
| 38 testes Java (JUnit/Mockito/MockMvc) | As regras que estavam em Java (validação, dashboard) não têm teste automatizado | Regras agora são constraints e funções SQL; testes de banco (pgTAP) ficam como evolução |
| Regra de negócio em Java | Lógica passou para SQL/RLS | Migration única e comentada |
| **Um único projeto Supabase para QA e produção** | QA e produção compartilham banco, usuários e leituras; um teste em QA altera dados vistos em produção | Aceito por ser ambiente acadêmico e para não duplicar migration, carga e chaves; separar em dois projetos quando houver usuários reais |

---

## 6. Principais trade-offs assumidos

| Decisão | Alternativa | Por que escolhemos |
|---|---|---|
| Supabase como backend | Manter Spring Boot em um host | Sem servidor nem custo; recursos equivalentes já prontos |
| Vercel | Nginx em contêiner | Deploy automático por branch, HTTPS e CDN sem configuração |
| RLS | Validação de acesso no frontend | O frontend é público; só o banco é confiável para autorização |
| Funções SQL para o dashboard | Agregar no navegador | Evita trafegar todas as leituras |
| pg_cron para "tempo real" | Reexecutar o seeder | Atualiza as datas sem intervenção, uma vez por dia |
| Um projeto Supabase para QA e produção | Um projeto por ambiente | Simplicidade: uma migration, uma carga, um conjunto de chaves (ver seção 5) |
