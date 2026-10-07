# Funcionalidades - SolarVision

Compilado do que o sistema faz, organizado por módulo. SolarVision é uma plataforma de **monitoramento de energia solar**: cadastra grupos de placas, acompanha a geração de energia ao longo do tempo (estimada pelo clima real e medida, quando há leituras importadas), registra limpezas e analisa sujeira, valores em R$/CO₂, histórico do clima e desempenho das placas.

> Arquitetura: [ARQUITETURA.md](ARQUITETURA.md) · Modelo de dados: [MODELO-DE-CLASSES.md](MODELO-DE-CLASSES.md)
>
> **Atenção:** alguns itens abaixo estão **parcialmente implementados** e marcados com **(parcial)**. O detalhamento e o que ainda falta estão em [FEATURES-INCOMPLETAS.md](FEATURES-INCOMPLETAS.md).

---

## 1. Autenticação e usuários

- **Cadastro** (`supabase.auth.signUp`) com nome, e-mail e senha; o Supabase Auth garante e-mail único e guarda a senha como hash. O trigger `criar_perfil_usuario` cria o perfil em `usuarios`.
- **Login** (`supabase.auth.signInWithPassword`) que abre uma sessão com JWT, renovada automaticamente pelo `supabase-js`.
- **Perfil do usuário logado**: `select` em `usuarios`; a RLS só devolve a linha do próprio usuário.
- **Cada usuário só vê as próprias usinas**: o grupo guarda o dono (`dono_id`, preenchido com quem o cria) e placas, limpezas, leituras, clima, chuvas e previsões herdam o acesso pelo grupo. Os grupos que já existiam ficaram com o primeiro usuário cadastrado.
- Papéis **ADMIN** e **USER**: o ADMIN vê e altera os grupos de todos. **(parcial)** - a promoção é só por SQL (`update usuarios set role = 'ADMIN' where email = '...'`); não há tela para isso.
- Edição do próprio perfil/senha: **(parcial)** - ainda não implementada (sem política de `update` em `usuarios` nem tela de edição).
- Todas as tabelas exigem usuário autenticado (RLS); sem sessão nada é lido nem gravado.

## 2. Grupos solares

Tabela `grupos_solares` (uma instalação/usina que agrupa placas):

- **Criar, listar, editar e excluir** grupos pela interface. A exclusão pede confirmação num modal e avisa que remove as placas, limpezas e o clima do grupo (`on delete cascade`).
- Cada grupo tem um **status**: ATIVO, INATIVO ou MANUTENCAO (constraint `CHECK`).
- Cada grupo tem um **local** (latitude/longitude, opcional), usado para buscar o clima das suas placas. O campo único de coordenadas aceita os formatos do Google Maps: `-27.548, -48.4988` (clique direito no mapa) ou `27°32'52.8"S 48°29'55.6"W` (painel do lugar), e mostra a latitude/longitude reconhecida (`lib/coordenadas.js`). **Mudar o local recarrega o clima** de todas as placas do grupo (trigger `ao_mudar_local_grupo`).
- **Tarifa** (R$/kWh, opcional): converte a energia gerada em economia e a perda por sujeira em R$.
- **Custo de limpeza** (R$ por placa, opcional): entra na recomendação de limpeza (em quantos dias a limpeza se paga).
- A listagem traz a **contagem de placas** (`placas(count)` na mesma consulta), a tarifa e o custo de limpeza.

## 3. Placas / painéis

Tabela `placas`, sempre vinculada a um grupo:

- **Criar, listar, editar e excluir** placas pela interface (exclusão com confirmação; remove limpezas, leituras e clima da placa).
- Cada placa tem **modelo** e **status** (ATIVA, INATIVA, MANUTENCAO).
- Especificações opcionais para a estimativa: **potência** (Wp), **inclinação** (0-90°) e **orientação** (azimute: 0 = Norte, 90 = Leste, 180 = Sul, 270 = Oeste; a tela oferece as 8 direções). O coeficiente de temperatura usa o padrão −0,40 %/°C (sem campo na tela). **Mudar inclinação, orientação ou grupo recarrega o clima** da placa (trigger `ao_mudar_orientacao_placa`).
- **Instalada em** (data, opcional): sem limpeza nem chuva que lave depois dela, a sujeira conta a partir dessa data.
- A lista mostra as especificações, a data de instalação e o **status do clima**: sem local/especificações, sincronizando (~1 min) ou "5 anos + previsão". Enquanto alguma placa sincroniza, a lista se recarrega a cada 15 s.

## 4. Limpezas

Tabela `limpezas`, histórico de limpeza das placas:

- **Criar, listar, editar e excluir** limpezas pela interface (exclusão com confirmação: a perda por sujeira volta a contar a partir da limpeza anterior).
- Cada limpeza tem **data** e uma **observação** opcional (até 1000 caracteres), associada a uma placa.
- Cadastro, Limpeza e a importação de leituras mostram **mensagem de sucesso** depois de salvar ou excluir.

## 5. Geração real e estimada

Por hora e por placa, na view `geracao_horaria`:

- **Real** - nas horas com **leituras importadas** (seção 5.1), a energia medida; nas demais horas já completas, **simulada** = estimado × (1 − **perda por sujeira**). A perda cresce 0,2 %/dia, até 20 %, desde o evento mais recente que limpou a placa: **limpeza registrada**, **chuva que lava** (dia com ≥ 5 mm, pelo Open-Meteo) ou **instalação**; sem nenhum deles, está no limite. A API expõe a perda atual de cada placa (`placas?select=...,perda_sujeira`); a partir de 10 % a tela marca a placa como suja.
- **Estimada** - a partir do clima real ([Open-Meteo](https://open-meteo.com/)). Com o local no grupo e potência/inclinação/orientação na placa, o job pg_cron `sincronizar-clima` (a cada minuto) carrega em ~1 min **5 anos de clima horário** (irradiância, temperatura e chuva) + os últimos 3 dias e a **previsão** (7 dias) em `clima_horario`, e renova a previsão de hora em hora. A potência de cada hora vem de `potencia_estimada()` (Wp, irradiância no plano da placa, temperatura e PR 0,82). Detalhes em [ARQUITETURA.md](ARQUITETURA.md#5-geração-estimada-pelo-clima-open-meteo); validação do modelo com dados reais em [validacao/RESULTADO.md](validacao/RESULTADO.md).
- A atribuição exigida pela licença dos dados (CC BY 4.0) fica no rodapé do app.

### 5.1 Importação de leituras (CSV)

No Monitoramento, com uma placa selecionada, **Importar leituras (CSV)**:

- Arquivo com uma linha por leitura: data, hora e potência média (W) do intervalo, no horário de São Paulo. Aceita separador `,` ou `;`, vírgula decimal, data `aaaa-mm-dd` ou `dd/mm/aaaa`, hora na mesma coluna da data ou em outra, e instantes com fuso explícito (`Z`/`±hh:mm`).
- As colunas são adivinhadas pelo nome do cabeçalho e podem ser trocadas; a tela mostra as 5 primeiras leituras, o período, quantas linhas são válidas e quantas foram ignoradas.
- Grava em lotes de 5000 com barra de progresso, por upsert em `(placa_id, data_hora)`: reimportar o mesmo arquivo não duplica e, se um lote falhar, os anteriores ficam gravados e basta importar de novo. Só o dono do grupo (ou ADMIN) grava.
- Depois de importar, gráfico e valores do período recarregam; as horas com leituras passam a usar o real medido.

## 6. Dashboard

Painel alimentado por funções SQL (RPC), todas sobre `geracao_horaria` e filtradas pela RLS (só as usinas do usuário):

- **Métricas** (`rpc('dashboard_metricas', { granularidade, data_inicio, data_fim, grupo, placa })`): devolve `x`, `medida` (= real, só até a última hora completa) e `estimada` - a **potência média** do conjunto (soma da média de cada placa) por balde de tempo (`hora`, `dia`, `semana` ou `mes` via `date_trunc`) dentro do período - e `medida_wh`/`estimada_wh`, a **energia** do balde, e `medida_sensor_wh`, a parte do real que veio de leituras. `grupo` e `placa` são opcionais (null = todas). Granularidade inválida ou início depois do fim geram erro. Alimenta o gráfico de geração, a previsão de 7 dias e o calendário.
- **Resumo** (`rpc('dashboard_resumo')`): `estimadoHoje` e `previsaoAmanha` (Wh, soma das horas estimadas), `potenciaAgora` (W estimados na hora atual), `totalGeradoHoje` (real de hoje), `geradoHojeSensor` (parte dele que veio de leituras) e `estimadoAteAgora` (estimado das mesmas horas, para comparar), número de placas ativas e dados da última limpeza. Energia exibida com auto-escala Wh/kWh/MWh.
- **Valores do período** (`rpc('dashboard_financeiro', { data_inicio, data_fim, grupo, placa })`): `realWh`, `economia` (R$, real × tarifa, só dos grupos com tarifa), `perdaSujeiraWh` e `perdaSujeira` (R$; estimado − real nas horas com real), `co2EvitadoKg` (real × 0,0385 kgCO₂/kWh, fator médio do SIN de 2023, MCTI) e `placasSemTarifa`.
- **Recomendações de limpeza** (`rpc('recomendacoes_limpeza')`): por placa, perda atual, kWh e R$ perdidos na próxima semana sem limpar, chuva que lava prevista, dias para a limpeza se pagar, `limpar` e `motivo` em texto. Recomenda limpar com perda ≥ 10 %, sem chuva que lava nos próximos 3 dias e com a limpeza se pagando em até 30 dias (ou sem custo informado); senão o motivo diz por que esperar ("Chuva prevista para quinta (12 mm): espere").
- **Média histórica** (`rpc('dashboard_historico', { granularidade, data_inicio, data_fim, grupo, placa })`): média, mínimo e máximo do **estimado** (só o clima) na mesma janela dos 5 anos anteriores, nos mesmos `x` das métricas, e quantos anos entraram (ano sem clima na janela inteira fica de fora).
- **Acerto da previsão** (`rpc('acerto_previsao', { dias, grupo, placa })`): por dia encerrado, a energia prevista na véspera (guardada às 21:00 pelo job `guardar-previsao` em `previsoes_diarias`) x o estimado com o clima que aconteceu. Começa vazio após o deploy.
- **Ranking das placas** (`rpc('ranking_placas', { data_inicio, data_fim, grupo })`): por placa, real, kWh/kWp (real ÷ potência instalada), desempenho (real ÷ estimado), mediana do desempenho no grupo e `anomalia` (mais de 10 p.p. abaixo da mediana, em grupo com 2+ placas: sombra, defeito ou sujeira).
- As agregações usam o fuso `America/Sao_Paulo`.

### Gráfico de geração (Monitoramento)

A tela tem um **seletor** à esquerda (busca + *Todas as usinas* → grupos → placas); a seleção fica na URL (`?grupo=17&placa=10`), então dá para compartilhar o link e chegar direto da Home ou do Cadastro. Acima do gráfico, cards com a energia real (diz se foi medida, simulada ou quanto % veio de leituras) e a estimada do período (com o texto "Clima X% abaixo/acima da média de N anos" quando há média histórica), a perda por sujeira (média ponderada pela potência) e a capacidade instalada. Abaixo do gráfico:

- **Valores do período**: economia (R$), perdido com sujeira (kWh e R$) e CO₂ evitado, no mesmo período do gráfico; avisa quantas placas estão sem tarifa, com link para o Cadastro.
- **Previsão de geração dos próximos 7 dias**, com o **acerto da previsão** no rodapé ("Previsão de ontem: 9,6 kWh · aconteceu 8,1 kWh (erro 18%) · erro médio em 7 dias: 12%"; enquanto não há dados, "acumulando dados").
- **Calendário de geração**: heatmap da energia estimada por dia de um ano (meses × dias), navegável por ano.
- Sem placa selecionada, a **tabela de placas** com a sujeira, **kWh/kWp** e **Desempenho** de cada uma no período do gráfico, com o selo "abaixo do grupo" nas anomalias. Com placa selecionada, os **detalhes da placa**, com a recomendação de limpeza, e os atalhos **Importar leituras (CSV)** e **Registrar limpeza**.

O gráfico de área usa quatro **visões de calendário** - **Dia, Semana, Mês e Ano**. A visão define a janela mostrada; o agrupamento (balde) é escolhido automaticamente para dar uma quantidade adequada de pontos:

| Visão | Janela (alinhada ao calendário) | Balde (agrupamento) |
|---|---|---|
| Dia | dia 00:00-23:59 | por hora |
| Semana | domingo a sábado | por dia |
| Mês | dia 1 ao último | por dia |
| Ano | janeiro a dezembro | por mês |

As setas navegam uma unidade por vez (um dia, uma semana, um mês ou um ano) e **Hoje** volta para a data atual; uma linha marca **Agora**. O gráfico abre ancorado em **agora** e inclui as horas de previsão. Há as séries **Real** e **Estimada (previsão do tempo)** (tracejada) e a linha **Média de N anos** (estimado médio da mesma janela nos anos anteriores, se houver); o real para na última hora completa; só aparecem as que têm dados no período. O eixo Y mostra **potência média** com **auto-escala de unidade** (W, kW, MW ou GW) conforme a magnitude dos valores, e o gráfico tem legenda.

## 7. API GraphQL

O Supabase expõe GraphQL nativo (pg_graphql) em `https://skfguameoeklepcjnqth.supabase.co/graphql/v1`, gerado a partir das mesmas tabelas e sujeito às mesmas políticas RLS. Substitui o endpoint `/api/graphql` do Spring Boot; a SPA não o usa.

## 8. Frontend (SPA React)

Aplicação de página única, com rotas protegidas pela sessão do Supabase e tema escuro:

| Tela | Rota | Função | Tabelas / RPC |
|---|---|---|---|
| Login | `/login` | Autenticação | Supabase Auth (`signInWithPassword`) |
| Registro | `/register` | Criação de conta | Supabase Auth (`signUp`) + trigger em `usuarios` |
| Home | `/app/home` | Cards (real hoje x estimado até agora, estimado hoje/agora, perda por sujeira, placas ativas), gráfico de hoje, limpezas recentes, **limpezas recomendadas** (placas para limpar agora e as sujas em que a chuva prevista adia a limpeza), previsão de 7 dias com o acerto da previsão e grupos (link para o Monitoramento) | `rpc dashboard_resumo`, `rpc dashboard_metricas`, `rpc recomendacoes_limpeza`, `rpc acerto_previsao`, `grupos_solares`, `placas`, `limpezas` |
| Monitoramento | `/app/monitoramento` | Seletor de grupo/placa, cards de energia e sujeira, gráfico real x estimado (com previsão e média de 5 anos), valores do período (R$/CO₂), previsão de 7 dias com acerto, calendário de geração, ranking das placas (kWh/kWp, desempenho), detalhes da placa com recomendação de limpeza e importação de leituras (CSV) | `rpc dashboard_metricas`, `rpc dashboard_historico`, `rpc dashboard_financeiro`, `rpc ranking_placas`, `rpc recomendacoes_limpeza`, `rpc acerto_previsao`, `grupos_solares`, `placas`, `limpezas`, `leituras_energia` (upsert) |
| Cadastro | `/app/cadastro` | Grupos (com local, tarifa e custo de limpeza) e placas (com potência, inclinação, orientação e data de instalação): criar, editar e excluir, status do clima e mensagem de sucesso. **(parcial)** - sem indicador de carregamento | `grupos_solares`, `placas` |
| Limpeza | `/app/limpeza` | Registro, edição, exclusão e histórico de limpezas | `limpezas`, `placas` |
| Configurações | `/app/configuracoes` | Dados do usuário e do sistema (somente leitura). **(parcial)** - sem edição de perfil/senha | `usuarios` |

Todas as chamadas passam por `frontend/src/lib/api.js` e `frontend/src/context/AuthContext.jsx`. O nome do usuário é exibido com a primeira letra de cada palavra em maiúscula (ex.: "luiz gustavo" -> "Luiz Gustavo"), independente de como foi digitado no cadastro.

---

## Resumo do acesso aos dados

"Dono" = o usuário em `grupos_solares.dono_id` do grupo da linha; um ADMIN tem o mesmo acesso em todos os grupos.

| Recurso | Operações liberadas pela RLS | Acesso |
|---|---|---|
| `auth.signUp` / `auth.signInWithPassword` | - | Público |
| `usuarios` | select (só a própria linha) | Autenticado |
| `grupos_solares` | select, insert, update, delete | Dono ou ADMIN |
| `placas` | select, insert, update, delete | Dono do grupo ou ADMIN |
| `limpezas` | select, insert, update, delete | Dono do grupo ou ADMIN |
| `leituras_energia` | select, insert, update, delete (importação por upsert) | Dono do grupo ou ADMIN |
| `clima_horario` | select (gravação só pelo pg_cron) | Dono do grupo ou ADMIN |
| `chuvas_que_lavam`, `previsoes_diarias` | select (gravação só pelo pg_cron) | Dono do grupo ou ADMIN |
| view `geracao_horaria` | select (com a RLS de quem consulta) | Autenticado |
| `rpc dashboard_metricas`, `dashboard_resumo`, `dashboard_financeiro`, `dashboard_historico`, `ranking_placas`, `recomendacoes_limpeza`, `acerto_previsao` | execute (somam só as placas visíveis) | Autenticado |
| `/graphql/v1` | conforme as políticas acima | Autenticado |
