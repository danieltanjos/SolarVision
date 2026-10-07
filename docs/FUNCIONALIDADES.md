# Funcionalidades - SolarVision

Compilado do que o sistema faz, organizado por módulo. SolarVision é uma plataforma de **monitoramento de energia solar**: cadastra grupos de placas, acompanha a geração de energia ao longo do tempo (estimada pelo clima real e, quando houver sensores, medida) e registra limpezas.

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
- Cada grupo tem um **local** (latitude/longitude, opcional), usado para buscar o clima das suas placas. O campo único de coordenadas aceita os formatos do Google Maps: `-27.548, -48.4988` (clique direito no mapa) ou `27°32'52.8"S 48°29'55.6"W` (painel do lugar), e mostra a latitude/longitude reconhecida (`lib/coordenadas.js`).
- A listagem traz a **contagem de placas** (`placas(count)` na mesma consulta).

## 3. Placas / painéis

Tabela `placas`, sempre vinculada a um grupo:

- Criar e listar placas pela interface; a RLS também permite atualizar e excluir.
- Cada placa tem **modelo** e **status** (ATIVA, INATIVA, MANUTENCAO).
- Especificações opcionais para a estimativa: **potência** (Wp), **inclinação** (0-90°) e **orientação** (azimute: 0 = Norte, 90 = Leste, 180 = Sul, 270 = Oeste; a tela oferece as 8 direções). O coeficiente de temperatura usa o padrão −0,40 %/°C (sem campo na tela).
- A lista mostra as especificações e o **status do clima**: sem local/especificações, sincronizando (~1 min) ou "5 anos + previsão". Enquanto alguma placa sincroniza, a lista se recarrega a cada 15 s.
- Excluir um grupo remove suas placas em cascata (`on delete cascade`).

## 4. Limpezas

Tabela `limpezas`, histórico de limpeza das placas:

- Criar e listar limpezas pela interface; a RLS também permite atualizar e excluir.
- Cada limpeza tem **data** e uma **observação** opcional (até 1000 caracteres), associada a uma placa.

## 5. Geração medida e estimada

- **Medida** - `leituras_energia`: data/hora e watts por placa, vindos de sensores. Usuários autenticados só leem. Ainda **vazia**: falta integrar o sensor (ESP32) ou a API do inversor (ver [FEATURES-INCOMPLETAS.md](FEATURES-INCOMPLETAS.md)). Os dados mocados do CSV foram removidos do banco; o CSV fica no repo só como referência.
- **Estimada** - a partir do clima real ([Open-Meteo](https://open-meteo.com/)). Com o local no grupo e potência/inclinação/orientação na placa, o job pg_cron `sincronizar-clima` (a cada minuto) carrega em ~1 min **5 anos de clima horário** + os últimos 3 dias e a **previsão** (3 dias) em `clima_horario`, e renova a previsão de hora em hora. A potência de cada hora vem de `potencia_estimada()` (Wp, irradiância no plano da placa, temperatura e PR 0,82). Detalhes em [ARQUITETURA.md](ARQUITETURA.md#5-geração-estimada-pelo-clima-open-meteo).
- A atribuição exigida pela licença dos dados (CC BY 4.0) fica no rodapé do app.

## 6. Dashboard

Painel alimentado por duas funções SQL (RPC):

- **Métricas** (`rpc('dashboard_metricas', { granularidade, data_inicio, data_fim })`): devolve `x`, `medida` e `estimada` - a **potência média** do conjunto (soma da média de cada placa) por balde de tempo (`hora`, `dia`, `semana` ou `mes` via `date_trunc`) dentro do período. Granularidade inválida ou início depois do fim geram erro. Alimenta o gráfico de geração.
- **Resumo** (`rpc('dashboard_resumo')`): `estimadoHoje` e `previsaoAmanha` (Wh, soma das horas estimadas), `potenciaAgora` (W estimados na hora atual), `totalGeradoHoje` (medido; cada leitura é a potência média de 5 min: Wh = W × 5/60), número de placas ativas e dados da última limpeza. Energia exibida com auto-escala Wh/kWh/MWh.
- As agregações usam o fuso `America/Sao_Paulo`.

### Gráfico de geração (Monitoramento)

O gráfico de área usa quatro **visões de calendário** - **Dia, Semana, Mês e Ano**. A visão define a janela mostrada; o agrupamento (balde) é escolhido automaticamente para dar uma quantidade adequada de pontos:

| Visão | Janela (alinhada ao calendário) | Balde (agrupamento) |
|---|---|---|
| Dia | dia 00:00-23:59 | por hora |
| Semana | domingo a sábado | por dia |
| Mês | dia 1 ao último | por dia |
| Ano | janeiro a dezembro | por mês |

As setas navegam uma unidade por vez (um dia, uma semana, um mês ou um ano). O gráfico abre ancorado em **agora** e inclui as horas de previsão. Há duas séries, **Medida (sensores)** e **Estimada (clima)** (tracejada); só aparecem as que têm dados no período. O eixo Y mostra **potência média** com **auto-escala de unidade** (W, kW, MW ou GW) conforme a magnitude dos valores, e o gráfico tem legenda.

## 7. API GraphQL

O Supabase expõe GraphQL nativo (pg_graphql) em `https://skfguameoeklepcjnqth.supabase.co/graphql/v1`, gerado a partir das mesmas tabelas e sujeito às mesmas políticas RLS. Substitui o endpoint `/api/graphql` do Spring Boot; a SPA não o usa.

## 8. Frontend (SPA React)

Aplicação de página única, com rotas protegidas pela sessão do Supabase e tema escuro:

| Tela | Rota | Função | Tabelas / RPC |
|---|---|---|---|
| Login | `/login` | Autenticação | Supabase Auth (`signInWithPassword`) |
| Registro | `/register` | Criação de conta | Supabase Auth (`signUp`) + trigger em `usuarios` |
| Home | `/app/home` | Cards Estimado Hoje (agora/amanhã), Medido Hoje, placas ativas e última limpeza + grupos | `rpc dashboard_resumo`, `grupos_solares` |
| Monitoramento | `/app/monitoramento` | Gráfico medido x estimado (com previsão), visões Dia/Semana/Mês/Ano e auto-escala de potência | `rpc dashboard_metricas` |
| Cadastro | `/app/cadastro` | Grupos (com local) e placas (com potência, inclinação e orientação) e status do clima. **(parcial)** - só cria/lista; editar/excluir está na branch `feat/muda-aba-cadastro` | `grupos_solares`, `placas` |
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
| `clima_horario` | select (gravação só pelo pg_cron) | Autenticado |
| `rpc dashboard_metricas` | execute | Autenticado |
| `rpc dashboard_resumo` | execute | Autenticado |
| `/graphql/v1` | conforme as políticas acima | Autenticado |
