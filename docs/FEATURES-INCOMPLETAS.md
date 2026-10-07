# Features Incompletas - SolarVision

Lista de funcionalidades que estão **referenciadas/parcialmente implementadas** mas ainda **não funcionam por completo**. Serve para rastrear o que falta e deixar claro, na apresentação, o que é demonstrativo e o que ainda será implementado.

> Itens marcados como **(parcial)** em [FUNCIONALIDADES.md](FUNCIONALIDADES.md) apontam para este documento.
> Os números dos itens são estáveis: os resolvidos ficam marcados (e listados no fim) em vez de renumerar a lista. Os atalhos conscientes do código estão comentados com `ponytail:` nas migrations e em `frontend/src/lib/`.

---

## Alta prioridade

### 1. Edição de perfil e senha do usuário - resolvido
- **Estado atual:** Configurações edita o nome e as preferências (migration `20261009090000`: política de update na própria linha + grant por coluna, `role`/`email` nunca) e troca a senha confirmando a atual.
- **Falta:** trocar o e-mail (exige o fluxo de confirmação do Supabase Auth).

### 2. Autorização: dono por grupo e ADMIN (parcial)
- **Estado atual:** cada grupo tem um dono (`grupos_solares.dono_id`, preenchido com quem o cria) e cada usuário só vê e altera os próprios grupos; placas, limpezas, leituras, clima, chuvas e previsões herdam pelo grupo. `role = 'ADMIN'` (função `e_admin()`) vê e altera tudo. Os grupos que já existiam ficaram com o primeiro usuário cadastrado (migration `20261008090000`).
- **Falta:**
  - tela (ou fluxo) para promover/rebaixar ADMIN: hoje só por SQL, `update usuarios set role = 'ADMIN' where email = '...'`;
  - transferir um grupo para outro dono (hoje `update grupos_solares set dono_id = ...` por SQL) e compartilhar um grupo com vários usuários (só há um dono por grupo, sem papel de leitura);
  - o ADMIN não vê os perfis dos outros usuários (`usuarios` continua "só a própria linha"), então uma tela de administração precisaria de uma política para isso;
  - `perda_sujeira_em` é security definer e repete a regra do dono (por desempenho): se a política dos grupos mudar, ela precisa mudar junto.
- **Onde:** nova migration em `supabase/migrations/`, `frontend/src/pages/SettingsPage.jsx`.

### 3. Editar/excluir na interface (Cadastro e Limpeza) - resolvido
- Grupos, placas e limpezas têm editar e excluir na interface (`updateGroup`/`deleteGroup`, `updatePanel`/`deletePanel`, `updateCleaning`/`deleteCleaning` em `lib/api.js`), com modal de confirmação (`ConfirmarExclusao`) que avisa o que a exclusão em cascata remove. Coberto pelo teste de ponta a ponta.

### 4. QA e produção no mesmo projeto Supabase
- **Estado atual:** os ambientes `qa` e `production` da Vercel apontam para o mesmo banco; dados e usuários criados em QA aparecem em produção.
- **Falta:** um segundo projeto Supabase para QA (mesmas migrations) e variáveis `VITE_SUPABASE_*` diferentes por ambiente na Vercel.
- **Onde:** Supabase e configuração de variáveis da Vercel.

### 5. Geração medida (sensor ou inversor) (parcial)
- **Estado atual:** o dono importa leituras por **CSV** no Monitoramento (`ImportarLeituras`, `lib/leituras.js`); nas horas com leituras o real é o medido, nas demais continua simulado (estimado × (1 − perda por sujeira)).
- **Falta:**
  - integração automática: um sensor (ESP32) ou a API do inversor gravando em `leituras_energia`. A RLS exige o JWT do dono do grupo, então o dispositivo precisa de uma credencial própria (ou uma função/Edge Function de ingestão);
  - calibrar por placa, a partir das leituras, a taxa e o limite de sujeira, a limpeza pela chuva e o PR (item 6).
- **Limitações da importação:**
  - **CSV sem aspas:** o leitor separa as colunas pelo separador simples; célula entre aspas contendo o separador quebra a linha (trocar por um parser de CSV se aparecer arquivo assim);
  - **real medido só nas horas com clima:** a view `geracao_horaria` parte de `clima_horario`, então leituras de placa sem local/especificações, de antes dos 5 anos carregados ou de horas ainda não sincronizadas não aparecem;
  - **intervalo inferido por hora:** vem do espaçamento das leituras dentro da hora; uma lacuna no meio da hora é preenchida pela média das demais e uma leitura isolada vale pela hora inteira (gravar o intervalo de cada leitura se aparecer datalogger irregular);
  - sem fuso no arquivo, o horário é São Paulo com UTC−3 fixo (sem horário de verão);
  - com leituras, a "perda por sujeira" do período (estimado − real em `dashboard_financeiro`) passa a incluir toda a diferença entre o modelo e o medido (PR, sombra, defeito), não só a sujeira.
- **Onde:** dispositivo/integração externa, `supabase/migrations/20261008130000_leituras_reais.sql`, `frontend/src/lib/leituras.js`.

---

## Média prioridade

### 6. Limitações da geração estimada
- **Resolução horária:** no Brasil o Open-Meteo só tem dados por hora (o de 15 min é interpolado).
- **Modelo fixo:** PR 0,82 e NOCT 45 °C são constantes em `potencia_estimada()`. A [validação com 5 anos de leituras do Fotovoltaica-UFSC](validacao/RESULTADO.md) confirma a forma (r diário ≈ 0,89, erro mensal ≈ 6 %), mas sugere **PR real ≈ 0,71 a 0,77** e uma queda de **~2 %/ano** (degradação + sujeira), além de ±5 % entre os meses. Melhorias, em ordem de ganho: PR calibrado por placa a partir das leituras (o `desempenho` do `ranking_placas` é o PR medido ÷ 0,82), degradação anual a partir de `instalada_em` e só depois um ajuste sazonal.
- **Recarga do clima após edição:** resolvida (triggers da migration `20261008100000`); horas fora da nova janela de 5 anos ficam com o clima antigo (apagar o clima da placa antes de recarregar, se isso aparecer nas análises).
- **Uma série por placa:** ~3,5 MB por placa a cada 5 anos em `clima_horario`; deduplicar por local + inclinação + azimute se houver muitas placas.
- **Uso não comercial:** a API gratuita do Open-Meteo não cobre uso comercial.
- **Onde:** `supabase/migrations/20261007120000_clima_open_meteo.sql`, `20261008100000_cadastro_edicao.sql`.

### 7. Alertas - resolvido
- **Estado atual:** tabela `alertas` com RLS, `gerar_alertas()` no job `gerar-alertas` (07:00 de São Paulo) e sino no cabeçalho (ver [FUNCIONALIDADES.md](FUNCIONALIDADES.md#alertas)).
- **Limitações:** alerta não lido não some sozinho quando a situação se resolve (some ao ser lido; abrir pelo link já marca); placa há mais de ~6 dias sem previsão reduz a soma do grupo e pode gerar falso "previsão baixa"; a sujeira simulada pode disparar limpeza e desempenho da mesma placa ao mesmo tempo; `gerar_alertas` cresce linear com as placas (~16 ms por placa, quase tudo no `ranking_placas`).

### 8. Envio real de e-mail de alerta
- **Estado atual:** não existe (na versão Spring Boot era apenas simulado por `log`).
- **Falta:** Edge Function do Supabase integrada a um provedor de e-mail, disparada pelos alertas do item 7 (hoje só aparecem no sino do app).

### 9. Dropdown "Meu perfil" x "Configurações" - resolvido
- "Meu perfil" leva à seção Perfil de Configurações (`/app/configuracoes#perfil`).

### 10. Estados de carregamento e feedback de sucesso - resolvido
- Cadastro, Limpeza, Configurações e a importação de leituras mostram mensagem de sucesso; todas as telas têm indicador de carregamento.

### 12. Limitações das análises
- **Fator de CO₂ fixo:** 0,0385 kgCO₂/kWh (fator médio anual do SIN de 2023, MCTI) dentro de `dashboard_financeiro`; conferir e trocar pelo do ano mais recente publicado pelo MCTI (ou pelo fator mensal).
- **Limpeza pela chuva:** dia com ≥ 5 mm (limiar fixo) lava a placa por completo; vira limpeza parcial, proporcional à chuva, quando houver dado para calibrar. A sujeira continua com taxa (0,2 %/dia) e limite (20 %) fixos.
- **Recomendação de limpeza:** supõe a perda constante na semana (na verdade cresce 0,2 %/dia) e a chuva em até 3 dias e o retorno em até 30 dias são fixos; o limiar de perda (padrão 10 %) e o da previsão baixa (padrão 60 %) são preferências do dono. Um ADMIN vendo o grupo de outro dono recebe a recomendação com 10 % (a RLS de `usuarios` não mostra a linha do outro dono); o alerta usa o limiar do dono certo.
- **Média de 5 anos recalculada a cada chamada:** `dashboard_historico` refaz até 5 anos × placas (~1,2 s na visão Ano com 4 placas; cresce com o número de placas). Pré-agregar o estimado por placa e dia numa tabela se a visão Ano ficar lenta.
- **Acerto da previsão começa vazio:** a primeira previsão é guardada às 21:00 do dia do deploy e só é comparada depois que o dia seguinte termina; até lá o rodapé mostra "acumulando dados". Placa criada depois das 21:00 entra no ciclo seguinte.
- **Ranking:** a anomalia só existe em grupo com 2+ placas e usa limiar fixo (10 p.p. abaixo da mediana); sem leituras, o desempenho reflete só a sujeira simulada.
- **Onde:** `supabase/migrations/20261008110000_sujeira_chuva_financeiro.sql`, `20261008120000_historico_previsao.sql`, `20261008130000_leituras_reais.sql`.

---

## Baixa prioridade (polimento)

### 11. Testes ausentes
- **Estado atual:** 54 testes de utilitários do frontend (`node --test`) e 10 testes de ponta a ponta de `lib/api.js` contra o Supabase (`supabase/tests/e2e.mjs`: RLS por dono, cadastros, edição/exclusão, recarga do clima, carga pelo pg_cron, valores do período, recomendação, leituras importadas, ranking, média de 5 anos, acerto da previsão, alertas e preferências do usuário).
- **Falta:** testes das telas (ex.: Playwright contra a URL de QA) e testes isolados do banco (ex.: pgTAP).

Polimentos resolvidos: o status do grupo na Home usa o selo (`StatusBadge`, desde o redesign) e a placa do formulário de limpeza volta ao vazio depois de salvar (rodada de análises).

---

## Resumo priorizado

| # | Item | Prioridade | Camada | Situação |
|---|---|---|---|---|
| 1 | Edição de perfil/senha | Alta | Front + Banco | Resolvido (falta trocar e-mail) |
| 2 | Autorização: tela de ADMIN, transferir/compartilhar grupos | Alta | Front + Banco | Parcial (dono por grupo e ADMIN prontos) |
| 3 | Editar/excluir na UI (Cadastro/Limpeza) | Alta | Front | Resolvido |
| 4 | QA e produção no mesmo Supabase | Alta | Infra | Pendente |
| 5 | Geração medida (sensor ESP32 ou inversor) | Alta | Hardware/integração + Banco + Front | Parcial (importação de CSV pronta) |
| 6 | Limitações da geração estimada (PR fixo etc.) | Média | Banco | Pendente (recarga do clima resolvida) |
| 7 | Alertas | Média | Banco + Front | Resolvido (sem e-mail: item 8) |
| 8 | Envio real de e-mail | Média | Supabase (Edge Function) | Pendente |
| 9 | "Meu perfil" x "Configurações" | Média | Front | Resolvido |
| 10 | Loading + feedback de sucesso | Média | Front | Resolvido |
| 12 | Limitações das análises (CO₂, chuva, histórico, acerto) | Média | Banco | Pendente |
| 11 | Testes ausentes | Baixa | Front + Banco | Pendente |

## Resolvidos na rodada de análises (`feat/analises`)

| Item | O que entrou |
|---|---|
| 2 (parcial) | Dono por grupo com RLS herdada; ADMIN vê tudo |
| 3 | Editar/excluir grupos, placas e limpezas, com confirmação |
| 5 (parcial) | Importação de leituras por CSV; real medido no lugar do simulado |
| 6 (recarga) | Mudar local, inclinação, azimute ou grupo recarrega o clima |
| 10 (parcial) | Mensagem de sucesso no Cadastro, na Limpeza e na importação |
| Polimento | Placa do formulário de limpeza volta ao vazio após salvar |
| 7 | Alertas (limpeza, previsão baixa, desempenho) no sino do cabeçalho |
| Novo | Relatório mensal imprimível (`/app/relatorio`); sujeira e recomendações são as do dia da emissão, não as do mês |
