# Features Incompletas - SolarVision

Lista de funcionalidades que estão **referenciadas/parcialmente implementadas** mas ainda **não funcionam por completo**. Serve para rastrear o que falta e deixar claro, na apresentação, o que é demonstrativo e o que ainda será implementado.

> Itens marcados como **(parcial)** em [FUNCIONALIDADES.md](FUNCIONALIDADES.md) apontam para este documento.
> Observação: o **banco** está mais completo que o **frontend** - a RLS já permite editar e excluir grupos, placas e limpezas, mas a interface ainda não expõe tudo.

---

## Alta prioridade

### 1. Edição de perfil e senha do usuário
- **Estado atual:** a tela de Configurações é somente leitura (nome, e-mail, papel, data de criação). `usuarios` só tem política de `select`.
- **Falta:** política de `update` em `usuarios` (só a própria linha, sem permitir alterar `role`), troca de senha/e-mail via `supabase.auth.updateUser` e o formulário no `SettingsPage`.
- **Onde:** `frontend/src/pages/SettingsPage.jsx`, `frontend/src/lib/api.js`, nova migration em `supabase/migrations/`.

### 2. Autorização por papel (ADMIN/USER) sem efeito
- **Estado atual:** a coluna `usuarios.role` existe, mas **nenhuma** política RLS a considera: todo usuário autenticado pode criar, editar e excluir grupos, placas e limpezas.
- **Falta:** políticas que restrinjam escrita a `ADMIN` (ex.: `exists (select 1 from usuarios where id = auth.uid() and role = 'ADMIN')`) e uma forma de promover usuários.
- **Onde:** nova migration em `supabase/migrations/`.

### 3. Editar/excluir na interface (Cadastro e Limpeza)
- **Estado atual:** a RLS já permite `update`/`delete` em grupos, placas e limpezas, mas `lib/api.js` só tem funções de listar e criar, e a UI só cria e lista.
- **Falta:** funções de atualizar/excluir em `lib/api.js` e os botões nas telas. Para **Cadastro**, a versão com edição/exclusão já existe na branch `feat/muda-aba-cadastro` (feita sobre a API antiga; precisa ser adaptada ao Supabase; os nomes das colunas de local/especificações já são os mesmos); para **Limpeza** ainda não existe em nenhuma branch.
- **Onde:** `frontend/src/lib/api.js`, `frontend/src/pages/CadastroPage.jsx`, `frontend/src/pages/CleaningPage.jsx`.

### 4. QA e produção no mesmo projeto Supabase
- **Estado atual:** os ambientes `qa` e `production` da Vercel apontam para o mesmo banco; dados e usuários criados em QA aparecem em produção.
- **Falta:** um segundo projeto Supabase para QA (mesmas migrations) e variáveis `VITE_SUPABASE_*` diferentes por ambiente na Vercel.
- **Onde:** Supabase e configuração de variáveis da Vercel.

### 5. Geração medida (sensor ou inversor) - próximo passo
- **Estado atual:** o **real** é simulado (estimado × (1 − perda por sujeira), com taxa de 0,2 %/dia e limite de 20 % fixos e sem a chuva limpando as placas). `leituras_energia` está vazia.
- **Falta:** gravar leituras reais, por um sensor (ESP32) ou pela API do inversor, e usá-las no lugar da simulação; com dado medido, calibrar a taxa de sujeira por placa (e a limpeza pela chuva).
- **Onde:** dispositivo/integração externa, nova migration (forma de escrita em `leituras_energia`) e telas do dashboard.

---

## Média prioridade

### 6. Limitações da geração estimada
- **Resolução horária:** no Brasil o Open-Meteo só tem dados por hora (o de 15 min é interpolado).
- **Modelo fixo:** PR 0,82 e NOCT 45 °C são constantes em `potencia_estimada()`; viram colunas da placa quando houver dado medido para calibrar (item 5).
- **Edição não recarrega o clima:** mudar local, inclinação ou azimute de uma placa já sincronizada não recarrega o histórico (ainda não há tela de edição); ao criá-la (item 3), zerar `clima_historico_em` nesses updates.
- **Uma série por placa:** ~3,5 MB por placa a cada 5 anos em `clima_horario`; deduplicar por local + inclinação + azimute se houver muitas placas.
- **Uso não comercial:** a API gratuita do Open-Meteo não cobre uso comercial.
- **Onde:** `supabase/migrations/20261007120000_clima_open_meteo.sql`.

### 7. Alertas
- **Estado atual:** a tabela `alertas` e os serviços gRPC que a preenchiam foram removidos na migração.
- **Falta (se desejado):** tabela `alertas` com RLS, geração por função SQL/trigger ou Edge Function e tela de listagem.

### 8. Envio real de e-mail de alerta
- **Estado atual:** não existe (na versão Spring Boot era apenas simulado por `log`).
- **Falta:** Edge Function do Supabase integrada a um provedor de e-mail, disparada pelos alertas do item 7.

### 9. Dropdown "Meu perfil" x "Configurações"
- **Estado atual:** os dois itens do menu do usuário navegam para `/app/configuracoes`.
- **Falta:** ou uma tela de perfil separada (ver item 1), ou unificar os itens.
- **Onde:** `frontend/src/components/AppShell.jsx`.

### 10. Estados de carregamento e feedback de sucesso
- **Estado atual:** `HomePage` e `CadastroPage` não têm indicador de carregamento (mostram `--`/listas vazias); nenhum formulário mostra mensagem de sucesso após salvar.
- **Falta:** estado de `loading` (spinner/skeleton) e feedback de sucesso (toast/alerta) nos formulários.
- **Onde:** `frontend/src/pages/HomePage.jsx`, `CadastroPage.jsx`, `CleaningPage.jsx`.

---

## Baixa prioridade (polimento)

- **Cobertura de testes:** há testes de utilitários do frontend e um teste de ponta a ponta de `lib/api.js` contra o Supabase (`supabase/tests/e2e.mjs`, incluindo a carga do clima pelo pg_cron). Faltam testes das telas (ex.: Playwright contra a URL de QA) e testes isolados do banco (ex.: pgTAP).
- **Status do grupo exibido cru** ("ATIVO") na Home; `placaId` não reseta após salvar limpeza.

---

## Resumo priorizado

| # | Item | Prioridade | Camada |
|---|---|---|---|
| 1 | Edição de perfil/senha | Alta | Front + Banco |
| 2 | Autorização por papel sem efeito | Alta | Banco |
| 3 | Editar/excluir na UI (Cadastro/Limpeza) | Alta | Front |
| 4 | QA e produção no mesmo Supabase | Alta | Infra |
| 5 | Geração medida (sensor ESP32 ou inversor) | Alta | Hardware/integração + Banco + Front |
| 6 | Limitações da geração estimada | Média | Banco |
| 7 | Alertas | Média | Banco + Front |
| 8 | Envio real de e-mail | Média | Supabase (Edge Function) |
| 9 | "Meu perfil" x "Configurações" | Média | Front |
| 10 | Loading + feedback de sucesso | Média | Front |
| 11 | Testes ausentes / polimentos diversos | Baixa | Front + Banco |
