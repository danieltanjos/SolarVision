# SolarVision Backend

Backend único e ativo do projeto SolarVision.

## Stack

- Java 25
- Spring Boot 3.5.12
- Spring Web
- Spring Security com JWT
- Spring Data JPA (Hibernate)
- Flyway (migrations versionadas)
- Spring GraphQL
- gRPC (Spring gRPC) — servidor in-process
- springdoc-openapi (Swagger UI)
- PostgreSQL

## Estrutura

```text
backend/
├── data-seeder/
├── src/main/java/br/com/solarvision/api
│   ├── config            # OpenApiConfig (Swagger)
│   ├── controller        # REST + ponte REST->gRPC + GraphQL
│   ├── exception
│   ├── grpc
│   │   ├── client        # stubs gRPC (cliente)
│   │   └── server        # @GrpcService (servidor)
│   ├── model             # entidades JPA + DTOs
│   ├── repository        # Spring Data JPA
│   ├── security
│   └── service
├── src/main/proto        # contratos gRPC (.proto)
├── src/main/resources
│   ├── application.yml
│   ├── db/migration      # Flyway (V1, V2, ...)
│   └── graphql/schema.graphqls
├── src/test/java         # testes unitários (JUnit 5 + Mockito)
├── Dockerfile
└── pom.xml
```

## Endpoints principais

### Públicos

- `POST /api/auth/register`
- `POST /api/auth/login`

### Protegidos

- `GET /api/users/me`
- `GET/POST /api/groups`
- `GET/PUT/DELETE /api/groups/{groupId}`
- `GET /api/groups/{groupId}/panels`
- `GET/POST /api/panels`
- `GET/PUT/DELETE /api/panels/{panelId}`
- `GET/POST /api/cleanings`
- `GET/PUT/DELETE /api/cleanings/{cleaningId}`
- `GET /api/dashboard/metrics`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/range`
- `POST /api/graphql`
- `POST /api/internal/grpc/panels/{panelId}/check` (ponte REST → gRPC)
- `POST /api/internal/grpc/alerts` (ponte REST → gRPC)
- `POST /api/internal/grpc/alerts/email` (ponte REST → gRPC)

### Documentação / outros

- Swagger UI: `GET /swagger-ui.html` (OpenAPI em `/v3/api-docs`)
- gRPC: servidor in-process na porta `9090` (serviços `grpc.internal.PanelService` e `grpc.internal.AlertService`)

## Observações

- O schema do banco é versionado e criado pelo **Flyway** (`src/main/resources/db/migration`).
- A persistência usa **Spring Data JPA**; `spring.jpa.hibernate.ddl-auto=validate` valida o mapeamento contra o schema do Flyway.
- O endpoint GraphQL ativo é `POST /api/graphql`.
- O backend legado duplicado foi removido; só esta árvore `backend/` deve ser usada.
- **Spring gRPC em versão milestone (`0.9.0`)**: é a linha compatível com o Spring Boot 3.5 (a `1.0.x` exige Boot 4.0). Por ser não-GA, vem do repositório **Spring Milestones** (declarado no `pom.xml`), e o gerador de código está fixado nas versões do BOM 0.9.0 (`protoc` 4.30.2, `protoc-gen-grpc-java` 1.72.0). Detalhes e plano de migração em [`docs/ARQUITETURA.md`](../docs/ARQUITETURA.md) (seção 7).

## Execução isolada

O fluxo preferido é pela raiz do projeto:

```bash
docker compose up --build -d backend
```
