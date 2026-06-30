# Guia do Código - SolarVision (Backend e APIs)

Material de estudo para **explicar o backend inteiro** e suas APIs (REST, GraphQL e gRPC). Percorre o projeto camada a camada, mostra o fluxo de uma requisição e termina com **perguntas prováveis da banca**.

> Visões complementares: [ARQUITETURA.md](ARQUITETURA.md) (macro), [MODELO-DE-CLASSES.md](MODELO-DE-CLASSES.md) (domínio), [FUNCIONALIDADES.md](FUNCIONALIDADES.md) (o que o sistema faz), [DECISOES-TECNICAS.md](DECISOES-TECNICAS.md) (justificativas).

---

## 1. Organização do backend

Pacote raiz: `br.com.solarvision.api`. Arquitetura em camadas (cada uma só conhece a de baixo):

```
controller/   -> recebe HTTP, valida entrada, devolve DTO  (camada de entrada)
  graphql/    -> controller GraphQL
service/      -> regras de negócio + fronteira de transação
repository/   -> acesso a dados (Spring Data JPA)
model/        -> entidades @Entity, enums e DTOs (records)
security/     -> filtro JWT, configuração do Spring Security
config/       -> OpenApiConfig (Swagger)
exception/    -> exceções de negócio + handler global
grpc/         -> server (@GrpcService) e client (stubs) gRPC
```

Princípios: **injeção de dependência por construtor** (testável), **DTOs nas bordas** (controllers/services nunca expõem entidades), e **tratamento de erro centralizado**.

---

## 2. Ciclo de vida de uma requisição REST (fio condutor)

Exemplo: `GET /api/panels` com um token JWT.

1. **Navegador -> Nginx**: a SPA chama `/api/panels`; o Nginx do `frontend` faz **proxy reverso** para `http://backend:8081`.
2. **Tomcat embutido** (Spring Boot) recebe a requisição.
3. **Cadeia de filtros do Spring Security**: o `JwtAuthenticatorFilter` lê `Authorization: Bearer <token>`, valida assinatura/expiração (`JwtService`), carrega o usuário (`UserDetailsServiceCustom`) e popula o `SecurityContext`. O `SecurityConfig` decide se a rota exige autenticação.
4. **Controller** (`PanelController.listPanels`) recebe a chamada já autenticada e delega ao service.
5. **Service** (`PanelService`, anotado `@Transactional`) executa a regra e chama o repositório.
6. **Repository** (`PanelRepository`, Spring Data JPA) gera o SQL e consulta o **PostgreSQL**.
7. O service converte as entidades em **DTOs** (`PanelDtos.PanelResponse`).
8. O controller retorna o DTO; o Spring serializa para **JSON** -> volta pelo Nginx até o navegador.

Se algo falhar, o `GlobalExceptionHandler` converte a exceção em uma resposta HTTP padronizada (ver seção 7).

---

## 3. Segurança (em volta de toda a API)

Autenticação **stateless** com **JWT** - não há sessão no servidor.

### `SecurityConfig`
Define o `SecurityFilterChain`:
- `csrf` desabilitado (API sem sessão/cookies, então CSRF não se aplica).
- `cors` habilitado com origens explícitas (`CorsConfigurationSource`).
- `sessionCreationPolicy(STATELESS)` - o servidor não guarda sessão.
- `authorizeHttpRequests`: `permitAll` para `POST /api/auth/login`, `POST /api/auth/register`, `/error` e as rotas do Swagger (`/swagger-ui/**`, `/v3/api-docs/**`); `anyRequest().authenticated()` para o resto.
- `addFilterBefore(jwtAuthenticatorFilter, UsernamePasswordAuthenticationFilter.class)` - injeta nosso filtro na cadeia.
- Beans: `PasswordEncoder` = `BCryptPasswordEncoder`; `AuthenticationManager`.

### `JwtAuthenticatorFilter` (extends `OncePerRequestFilter`)
Roda **uma vez por requisição**:
- Se **não** há header `Bearer`, deixa passar (é isso que permite as rotas públicas funcionarem).
- Se há token: valida com `JwtService.validarToken`, carrega o `UserDetails` e seta a `Authentication` no `SecurityContext`.
- Token inválido/expirado -> responde `401`.

### `JwtService`
- Constrói a chave a partir de `app.jwt.secret` (Base64) - assinatura **HMAC**.
- `gerarToken(AppUser)`: subject = e-mail, claims `userId`, `nome`, `role`, `issuer = SolarVision`, expiração por `app.jwt.expiration-seconds`.
- `validarToken(token)`: verifica assinatura e expiração e devolve as `Claims`.

### `UserDetailsServiceCustom` + `AuthenticatedUser`
- `loadUserByUsername(email)` busca o usuário (`AppUserRepository.findByEmailIgnoreCase`) e devolve um `AuthenticatedUser` (implementa `UserDetails`) com a authority `ROLE_<role>`.
- `AuthenticatedUser` carrega id, email, nome, role e o hash da senha; é o objeto acessível via `@AuthenticationPrincipal`.

### Fluxo de login/registro
`POST /api/auth/register` ou `/login` -> `AuthService` valida (e-mail único; senha confere via `passwordEncoder.matches`) -> gera o JWT -> retorna `AuthResponse { token, user }`. A senha é guardada como **hash BCrypt** (`senha_hash`); a senha original nunca é persistida nem vai no token.

---

## 4. As três APIs

### 4.1 REST (Spring Web)

Controllers anotados com `@RestController` + `@RequestMapping`. Entrada validada com `@Valid` (Bean Validation); erros viram 400 via handler global. POST retorna `200` com o recurso criado; DELETE retorna `204 No Content`.

| Controller | Base | Endpoints |
|---|---|---|
| `AuthController` | `/api/auth` | `POST /register`, `POST /login` (públicos) |
| `UserController` | `/api/users` | `GET /me` (usa `@AuthenticationPrincipal AuthenticatedUser`) |
| `GroupController` | `/api/groups` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/panels` |
| `PanelController` | `/api/panels` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| `CleaningController` | `/api/cleanings` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| `DashboardController` | `/api/dashboard` | `GET /metrics`, `GET /summary`, `GET /range` |
| `GrpcBridgeController` | `/api/internal/grpc` | `POST /panels/{id}/check`, `POST /alerts`, `POST /alerts/email` |

Detalhes úteis:
- `DashboardController.metrics` recebe `dataInicio`/`dataFim` (ISO-8601, `@DateTimeFormat`) e `granularidade` como query params.
- O controller **não** tem regra de negócio: só recebe, valida e delega.

### 4.2 GraphQL (Spring GraphQL)

- Endpoint único: `POST /api/graphql` (`spring.graphql.path`).
- Schema em `resources/graphql/schema.graphqls`: `Query { panels(filter), cleanings(filter) }` e `Mutation { createPanel(input), createCleaning(input) }`.
- `SolarGraphqlController` (`@Controller`) mapeia com `@QueryMapping`, `@MutationMapping` e `@Argument`; delega ao `GraphqlService`, que aplica filtros (grupo, status, modelo, intervalo de datas), valida e converte para os DTOs `GraphqlDtos.*`.
- Diferença para o REST: o cliente pede **exatamente os campos que quer** num único POST.

### 4.3 gRPC (Spring gRPC + Protobuf)

- Contratos em `src/main/proto/*.proto`: `PanelService.ChecarPlaca` e `AlertService.GerarAlerta` / `DispararEmailAlerta`.
- O plugin de build (`protobuf-maven-plugin`) **gera as classes Java** (mensagens + stubs) a partir dos `.proto`.
- **Servidor** (porta 9090, embarcado no mesmo processo): `PanelGrpcService` e `AlertGrpcService` (`@Service` que estendem os `*ImplBase` gerados). A lógica real (banco) fica em `GrpcOperationsService` (checar placa registra uma leitura; gerar alerta grava na tabela `alertas`; e-mail é simulado por log).
- **Cliente**: `GrpcClientConfig` cria os *blocking stubs* via `GrpcChannelFactory`.
- **Ponte REST -> gRPC**: `GrpcBridgeController` injeta os stubs e expõe os serviços gRPC por HTTP, demonstrando a comunicação ponta a ponta dentro do mesmo processo.

---

## 5. Camada de serviço (regras de negócio)

Todo service usa **injeção por construtor** e `@Transactional` (escrita) ou `@Transactional(readOnly = true)` (leitura).

| Service | Responsabilidade |
|---|---|
| `AuthService` | Registro/login: normaliza e-mail, valida unicidade, BCrypt, emite JWT |
| `UserService` | Dados do usuário autenticado (`/me`) |
| `GroupService` | CRUD de grupos; conta placas; lista placas do grupo |
| `PanelService` | CRUD de placas; valida que o grupo existe |
| `CleaningService` | CRUD de limpezas; valida que a placa existe |
| `DashboardService` | Agrega métricas por granularidade/fuso; resumo (gerado hoje, placas ativas, última limpeza); intervalo de datas |
| `GraphqlService` | Implementa as queries/mutations GraphQL (filtros + parsing de datas) |
| `GrpcOperationsService` | Lógica transacional dos serviços gRPC (checar placa, alerta, e-mail) |

`@Transactional` = a operação roda dentro de uma transação do banco (commit no fim, rollback se lançar exceção). É a **fronteira transacional** do sistema.

---

## 6. Persistência (JPA / Hibernate)

### Entidades (`model/`)
`AppUser`, `SolarGroup`, `Panel`, `Cleaning`, `PanelReading`, `Alert`. Anotações principais:
- `@Entity` + `@Table(name=...)` mapeiam a classe para a tabela.
- `@Id @GeneratedValue(strategy = IDENTITY)` - PK gerada pelo PostgreSQL.
- `@Column(name=...)` - mapeia o campo para a coluna.
- `@ManyToOne` / `@OneToMany(mappedBy=...)` - relacionamentos (ex.: `Panel` -> `SolarGroup`; `SolarGroup` -> lista de `Panel`).
- `@Enumerated(EnumType.STRING)` - enums (`UserRole`, `GroupStatus`, `PanelStatus`) gravados como texto.
- `@CreationTimestamp` - preenche `criado_em` na inserção.

### Repositórios (`repository/`)
Interfaces que estendem `JpaRepository<Entidade, Long>` - **o Spring gera a implementação**. Tipos de consulta:
- **Derived queries** (pelo nome): `findByEmailIgnoreCase`, `findByGrupoIdOrderByIdAsc`, `countByStatus`, `existsByEmailIgnoreCase`.
- **`@Query` (JPQL)**: ex.: filtro de limpezas por placa/intervalo.
- **`@Query(nativeQuery = true)`**: a agregação do dashboard usa SQL nativo (`date_trunc` + `timezone`) porque é específica do PostgreSQL e fora do que o JPQL faz bem - é o **híbrido JPA + SQL nativo**.

### Schema e migrations (Flyway)
- O schema é criado por **migrations versionadas** em `resources/db/migration` (`V1__init_schema.sql`, `V2__create_alertas.sql`).
- `spring.jpa.hibernate.ddl-auto=validate`: o Hibernate **valida** se as entidades batem com o schema, mas **não** cria/altera nada - quem manda no schema é o Flyway.

### DTOs (records)
`GroupDtos`, `PanelDtos`, `CleaningDtos`, `AuthDtos`, `DashboardDtos`, `UserDtos`, `GraphqlDtos`. São `record` Java com validação (`@NotBlank`, `@NotNull`, `@Size`...). Motivo: **não expor a entidade** (evita vazar campos/relacionamentos e desacopla a API do banco).

---

## 7. Tratamento de erros

`GlobalExceptionHandler` (`@RestControllerAdvice`) centraliza:

| Exceção | HTTP | Resposta |
|---|---|---|
| `NotFoundException` | 404 | mensagem |
| `BadRequestException` | 400 | mensagem |
| `MethodArgumentNotValidException` (falha de `@Valid`) | 400 | mapa `errors` por campo |
| `ConstraintViolationException` | 400 | mensagem |
| `Exception` (genérica) | 500 | mensagem |

O corpo segue um formato padrão (`timestamp`, `status`, `error`, `message`, e `errors` quando há validação por campo). É isso que o frontend lê para mostrar mensagens claras.

---

## 8. Configuração e infra ao redor

`application.yml` (principais chaves):
- `spring.datasource.*` - conexão PostgreSQL (pool HikariCP).
- `spring.flyway.*` - migrations habilitadas.
- `spring.jpa` - `open-in-view: false`, `ddl-auto: validate`.
- `spring.graphql.path: /api/graphql`.
- `spring.grpc` - porta do servidor (9090) e canal do cliente.
- `app.jwt.secret` / `app.jwt.expiration-seconds` - JWT.
- `app.dashboard.zone-id` - fuso das agregações.

Infra: `Dockerfile` **multi-stage** (estágio Maven builda o JAR; estágio JRE roda); `docker-compose.yml` sobe `postgres`, `backend`, `frontend` (Nginx) e `seed-data` (job Python que carrega o CSV e encerra). Swagger UI em `/swagger-ui.html`.

---

## 9. Perguntas prováveis da banca (Q&A)

**Por que Spring Data JPA e não JDBC manual?**
Produtividade (CRUD sem boilerplate), mapeamento objeto-relacional, e é o padrão **ativo** no código do professor. Onde o JPA é fraco (agregações), usamos SQL nativo pontual - abordagem híbrida.

**O que é `@Transactional`?**
Delimita uma transação: tudo dentro do método roda atômico (commit no sucesso, rollback em exceção). `readOnly = true` otimiza leituras.

**Como o JWT é validado a cada requisição?**
O `JwtAuthenticatorFilter` lê o `Bearer`, o `JwtService` verifica a assinatura HMAC com o segredo e a expiração; se válido, popula o `SecurityContext`. Como é **stateless**, não há consulta de sessão.

**O que é o filtro `OncePerRequestFilter`?**
Um filtro que executa uma vez por requisição, antes dos controllers, usado para interceptar e autenticar.

**Diferença entre framework, biblioteca e ferramenta?**
Framework dita a estrutura e te chama (Spring Boot, React); biblioteca você chama quando precisa (jjwt, Axios); ferramenta é externa ao código (Maven, Docker, Flyway, protoc). Detalhe em DECISOES-TECNICAS.md.

**O que o Flyway faz e por que `ddl-auto=validate`?**
Versiona o schema do banco (migrations ordenadas e aplicadas uma vez). O Hibernate só **valida** o mapeamento contra esse schema, sem alterá-lo - schema previsível e auditável.

**REST x GraphQL x gRPC, por que ter os três?**
REST = padrão simples por recurso; GraphQL = cliente escolhe os campos num endpoint único; gRPC = RPC binário sobre HTTP/2 para comunicação interna eficiente. Os três demonstram repertório (critério da disciplina).

**Por que DTOs e não retornar as entidades?**
Para não acoplar a API ao banco nem vazar campos/relacionamentos sensíveis; o DTO define o contrato da API.

**Como funciona o CORS aqui?**
Configurado no `SecurityConfig` com origens permitidas. Na prática, como o frontend chama `/api` no mesmo domínio (proxy do Nginx), as requisições são same-origin.

**Por que BCrypt para senha?**
Hash com salt, de mão única; a senha original nunca é armazenada nem recuperável.

**O que o Swagger/OpenAPI gera?**
A especificação OpenAPI (`/v3/api-docs`) e uma UI interativa (`/swagger-ui.html`) para testar a API, com suporte a Bearer JWT.

**Como o projeto sobe?**
`docker compose up --build -d`: Postgres -> backend (Flyway cria o schema) -> seeder carrega o CSV -> frontend (Nginx). Backend em `:8081`, frontend em `:8080`, gRPC em `:9090`.
