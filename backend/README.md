# SolarVision Backend

Backend único e ativo do projeto SolarVision.

## Stack

- Java 25
- Spring Boot 3.5.12
- Spring Web
- Spring Security com JWT
- Spring JDBC com DAO
- Spring GraphQL
- PostgreSQL

## Estrutura

```text
backend/
├── data-seeder/
├── postgres-init/
├── src/main/java/br/com/solarvision/api
│   ├── config
│   ├── controller
│   ├── dao
│   ├── exception
│   ├── model
│   ├── security
│   └── service
├── src/main/resources
│   ├── application.yml
│   └── graphql/schema.graphqls
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
- `POST /api/graphql`

## Observações

- O schema do banco é criado pelo script `postgres-init/01-init-schema.sql`.
- O endpoint GraphQL ativo é `POST /api/graphql`.
- O backend legado duplicado foi removido; só esta árvore `backend/` deve ser usada.

## Execução isolada

O fluxo preferido é pela raiz do projeto:

```bash
docker compose up --build -d backend
```
