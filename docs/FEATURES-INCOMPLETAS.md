# Features Incompletas - SolarVision

Lista de funcionalidades que estão **referenciadas/parcialmente implementadas** mas ainda **não funcionam por completo**. Serve para rastrear o que falta e deixar claro, na apresentação, o que é demonstrativo e o que ainda será implementado.

> Itens marcados como **(parcial)** em [FUNCIONALIDADES.md](FUNCIONALIDADES.md) apontam para este documento.
> Observação: o **backend** está mais completo que o **frontend** - boa parte do CRUD existe na API, mas a interface ainda não expõe tudo.

---

## Alta prioridade

### 1. Edição de perfil e senha do usuário
- **Estado atual:** a tela de Configurações é somente leitura (nome, e-mail, papel, data de criação). O backend só tem `GET /api/users/me`.
- **Falta:** endpoint `PUT /api/users/me` (atualizar nome/senha/e-mail) e o formulário de edição no `SettingsPage`.
- **Onde:** `frontend/src/pages/SettingsPage.jsx`, `backend/.../controller/UserController.java`.

### 2. Autorização por papel (ADMIN/USER) sem efeito
- **Estado atual:** o enum `UserRole` e os papéis existem no token JWT, e a documentação cita "papéis mapeados", mas **nenhum** endpoint restringe acesso por papel.
- **Falta:** aplicar `@PreAuthorize`/`hasRole("ADMIN")` (ou regras no `SecurityConfig`) nas rotas de escrita (criação/edição/exclusão), além de habilitar `@EnableMethodSecurity`.
- **Onde:** `backend/.../security/SecurityConfig.java` e os controllers.

### 3. Editar/excluir na interface (Cadastro e Limpeza)
- **Estado atual:** a API já tem `PUT`/`DELETE` para grupos, placas e limpezas, mas a UI só cria e lista.
- **Falta:** botões de editar/excluir nas telas. Para **Cadastro**, a versão com edição/exclusão já existe na branch `feat/muda-aba-cadastro` (planejada para o próximo semestre); para **Limpeza** ainda não existe em nenhuma branch.
- **Onde:** `frontend/src/pages/CadastroPage.jsx`, `frontend/src/pages/CleaningPage.jsx`.

---

## Média prioridade

### 4. Leitura de alertas via API REST
- **Estado atual:** a tabela `alertas` existe (migration V2), a entidade está mapeada e os alertas são **gravados** pelos serviços gRPC. Porém não há como **consultá-los** pela API.
- **Falta:** `AlertController` com `GET /api/alerts` (e filtros por placa/período), métodos no `AlertRepository` (ex.: `findByPlacaId`) e tela de listagem.
- **Onde:** `backend/.../repository/AlertRepository.java` (sem queries), nenhum `AlertController`.

### 5. Envio real de e-mail de alerta
- **Estado atual:** `AlertService.DispararEmailAlerta` apenas registra um `log.info` (simulação intencional).
- **Falta:** integração real (Spring Mail/JavaMailSender ou API de e-mail). Como demonstrativo está ok; apenas deixar claro que não envia de verdade.
- **Onde:** `backend/.../service/GrpcOperationsService.java`.

### 6. Dropdown "Meu perfil" x "Configurações"
- **Estado atual:** os dois itens do menu do usuário navegam para `/app/configuracoes`.
- **Falta:** ou uma tela de perfil separada (ver item 1), ou unificar os itens.
- **Onde:** `frontend/src/components/AppShell.jsx`.

### 7. Estados de carregamento e feedback de sucesso
- **Estado atual:** `HomePage` e `CadastroPage` não têm indicador de carregamento (mostram `--`/listas vazias); nenhum formulário mostra mensagem de sucesso após salvar.
- **Falta:** estado de `loading` (spinner/skeleton) e feedback de sucesso (toast/alerta) nos formulários.
- **Onde:** `frontend/src/pages/HomePage.jsx`, `CadastroPage.jsx`, `CleaningPage.jsx`.

### 8. Tratamento de erros do gRPC na ponte REST
- **Estado atual:** se o servidor gRPC falhar, a `StatusRuntimeException` cai no handler genérico (500 cru).
- **Falta:** tratar `StatusRuntimeException` no `GlobalExceptionHandler` (ex.: 503 com mensagem amigável).
- **Onde:** `backend/.../exception/GlobalExceptionHandler.java`.

---

## Baixa prioridade (polimento)

- **Cobertura de testes:** faltam testes para `CleaningService`, `DashboardService`, `GraphqlService`, `UserService`, `JwtService` e para os controllers.
- **CSS `sv-state-block`:** usado em `MetricChart` e `CleaningPage`, mas não definido em nenhum CSS (spinner não centraliza).
- **CORS fixo em `localhost`:** sem variável de ambiente, trava deploy fora do ambiente local. (`SecurityConfig`)
- **401 sem corpo padronizado:** o filtro JWT responde 401 sem o JSON de erro dos demais casos. (`JwtAuthenticatorFilter`)
- **POST de criação retorna 200** em vez de 201 Created (semântica REST).
- **`JwtService.gerarToken(UserDetails)`:** método nunca chamado (código morto).
- **`refreshUser` no `AppShell`:** possível re-execução em excesso se `/api/users/me` não retornar `criadoEm`.
- **Status do grupo exibido cru** ("ATIVO") na Home; `placaId` não reseta após salvar limpeza.

---

## Resumo priorizado

| # | Item | Prioridade | Camada |
|---|---|---|---|
| 1 | Edição de perfil/senha | Alta | Front + Back |
| 2 | Autorização por papel sem efeito | Alta | Back |
| 3 | Editar/excluir na UI (Cadastro/Limpeza) | Alta | Front |
| 4 | Leitura de alertas via REST | Média | Back + Front |
| 5 | Envio real de e-mail | Média | Back |
| 6 | "Meu perfil" x "Configurações" | Média | Front |
| 7 | Loading + feedback de sucesso | Média | Front |
| 8 | Tratamento de erro gRPC | Média | Back |
| 9 | Testes ausentes / polimentos diversos | Baixa | Front + Back |
