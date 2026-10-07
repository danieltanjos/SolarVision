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
- **Regras no banco: SQL / PL/pgSQL** - as agregações do dashboard, o trigger de perfil, o modelo de geração estimada e a busca agendada do clima (extensão `http` + pg_cron) rodam dentro do PostgreSQL, perto dos dados.

> Reconhecimento da adequação linguagem x plataforma: JavaScript para o navegador e SQL para regras e integrações que dependem dos dados.

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
| `node:test` | Biblioteca (teste) | Testes automatizados do frontend |
| Supabase (Auth, PostgREST, pg_graphql, pg_cron, `http`) | Plataforma / ferramenta | Backend gerenciado |
| Open-Meteo | Serviço externo (API) | Clima horário: histórico e previsão |
| Vite | Ferramenta | Servidor de desenvolvimento e build |
| Vercel | Ferramenta | Hospedagem e deploy por branch |
| GitHub Actions | Ferramenta | CI (testes + build) |
| Git / GitHub | Ferramenta | Versionamento e colaboração |

---

## 4. Justificativas por dimensão

### Técnica
- **RLS no lugar de um filtro de segurança**: a regra de acesso (cada usuário só vê as próprias usinas; ADMIN vê todas) fica no banco e vale para qualquer cliente (REST, GraphQL, SQL).
- **Funções SQL para o dashboard**: a agregação (`date_trunc` + `avg`) roda onde os dados estão e devolve só os pontos do gráfico.
- **Migration versionada** (`supabase/migrations/`): schema, políticas, funções e jobs reproduzíveis, como era com o Flyway.
- **Supabase Auth**: JWT com refresh, hash de senha e confirmação de e-mail prontos, sem código próprio de autenticação.

### Legal / Normativa
- **LGPD**: o sistema trata dados pessoais (nome, e-mail, senha). A senha fica apenas como hash no Supabase Auth e não existe em tabela da aplicação; cada usuário só lê o próprio perfil e as próprias usinas. Os dados ficam na região **São Paulo**.
- **Fator de emissão de CO₂**: o CO₂ evitado usa o fator médio anual do Sistema Interligado Nacional publicado pelo MCTI (2023: 0,0385 tCO₂/MWh); é uma estimativa, não um crédito de carbono certificado.
- **Licenças open-source**: React (MIT), PostgreSQL (licença PostgreSQL) e os componentes do Supabase (Apache 2.0/MIT) - compatíveis com uso acadêmico e comercial.
- **Dados do Open-Meteo**: licença CC BY 4.0, com a atribuição no rodapé do app. A API gratuita é para uso não comercial; um uso comercial exige o plano pago.
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
| **Um único projeto Supabase para QA e produção** | QA e produção compartilham banco, usuários e leituras; um teste em QA altera dados vistos em produção | Aceito por ser ambiente acadêmico e para não duplicar migrations e chaves; separar em dois projetos quando houver usuários reais |

---

## 6. Principais trade-offs assumidos

| Decisão | Alternativa | Por que escolhemos |
|---|---|---|
| Supabase como backend | Manter Spring Boot em um host | Sem servidor nem custo; recursos equivalentes já prontos |
| Vercel | Nginx em contêiner | Deploy automático por branch, HTTPS e CDN sem configuração |
| RLS | Validação de acesso no frontend | O frontend é público; só o banco é confiável para autorização |
| Funções SQL para o dashboard | Agregar no navegador | Evita trafegar todas as leituras |
| Geração estimada pelo Open-Meteo | CSV mocado deslocado para hoje (versão anterior) | Dado real do local de cada placa, com histórico e previsão (ver seção 7) |
| HTTP dentro do Postgres (`http` + pg_cron) | Edge Function agendada | Tudo em migrations aplicadas pelo CI existente, sem deploy nem token à parte |
| Um projeto Supabase para QA e produção | Um projeto por ambiente | Simplicidade: as mesmas migrations e um conjunto de chaves (ver seção 5) |

---

## 7. Geração estimada pelo clima (Open-Meteo)

**Decisão:** trocar os dados mocados do CSV por geração **estimada** a partir do clima real do local de cada placa, buscado pelo próprio banco.

**Por que Open-Meteo:**
- Gratuito e **sem chave** (nada para guardar como segredo), com cobertura do Brasil.
- **Arquivo histórico** (reanálise) e **previsão** na mesma API: 5 anos de histórico por hora para ver tendências e a previsão para os próximos dias.
- Calcula a irradiância **no plano da placa** (GTI) a partir da inclinação e do azimute, então o banco só aplica o modelo de potência (`potencia_estimada`).

**Por que o HTTP roda dentro do Postgres:**
- A extensão `http` + o job pg_cron `sincronizar-clima` ficam em uma migration, aplicada pelo mesmo CI (`supabase db push`) que já cuida do schema.
- Uma Edge Function exigiria deploy separado, token de acesso no CI e um agendamento chamando a função por HTTP.
- O custo é a chamada síncrona dentro de uma transação (timeout de 60 s, até 5 placas por minuto); suficiente para a escala do projeto.

**Limites aceitos:** estimado não é medido (as leituras reais entram por CSV, mas não há sensor nem API de inversor integrados), PR e NOCT fixos e uma série de clima por placa - ver [FEATURES-INCOMPLETAS.md](FEATURES-INCOMPLETAS.md). A validação do modelo contra 5 anos de leituras reais do Fotovoltaica-UFSC está em [validacao/RESULTADO.md](validacao/RESULTADO.md).

---

## 8. Análises: dono por grupo, chuva, valores, histórico e leituras reais

Rodada da branch `feat/analises` (migrations `20261008090000` a `20261008130000`).

| Decisão | Alternativa | Por que escolhemos |
|---|---|---|
| Dono por grupo (`grupos_solares.dono_id`, padrão `auth.uid()`) e o resto herdando pelo grupo | Coluna de dono em cada tabela | Uma regra só; placas, limpezas, leituras, clima, chuvas e previsões já pendem do grupo |
| Políticas `placa_id in (select id from placas)` | `exists (...)` correlacionado | A subconsulta não depende da linha e é calculada uma vez por consulta |
| ADMIN por `e_admin()` na política dos grupos, promoção por SQL | Tela de administração | Basta para o projeto acadêmico; a tela fica como pendência |
| Grupos antigos com o primeiro usuário cadastrado | Deixar sem dono (invisíveis) | Nada some depois do deploy; dá para reatribuir por SQL |
| View `geracao_horaria` (`security_invoker`) como fonte única da geração por hora | Cada função recalcular estimado e real | Gráfico, cards e análises somam a mesma coisa; a view respeita a RLS de quem consulta e as colunas não usadas não são calculadas |
| `perda_sujeira_em` security definer com a regra do dono repetida | Deixar a RLS filtrar | Roda por hora e por placa; com RLS a visão Ano de todas as placas levava 14 s. O custo é manter a regra em dois lugares |
| Tabela `chuvas_que_lavam` (≥ 5 mm/dia) | Somar a chuva do dia a cada hora calculada | A última chuva vira uma busca no índice; limiar fixo e limpeza total até haver dado para calibrar |
| CO₂ com o fator médio anual do SIN de 2023 (0,0385 kgCO₂/kWh, MCTI) | Fator mensal ou de outro ano | Valor oficial mais recente na data; fixo na função, a trocar quando o MCTI publicar o próximo |
| Média de 5 anos só do **estimado** | Média do real | O real carrega a sujeira; a média do clima separa "o clima foi ruim" de "a placa está ruim" |
| `previsoes_diarias` + job `guardar-previsao` | Comparar com `clima_horario` | O clima da previsão é sobrescrito de hora em hora pelo observado; a previsão precisa ser guardada antes |
| Importação de CSV lida no navegador e gravada por upsert | Edge Function ou upload de arquivo | Sem deploy à parte; a RLS já garante que só o dono grava; reimportar não duplica |
| Ranking contra a **mediana do grupo** | Alarmar por desempenho absoluto | No mesmo grupo o clima é o mesmo e o erro da reanálise (~15 % ao dia, ver a validação) se cancela |

Os atalhos conscientes ficam marcados com `ponytail:` nas migrations e listados em [FEATURES-INCOMPLETAS.md](FEATURES-INCOMPLETAS.md).
