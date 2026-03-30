# SolarVision API - Spring Boot

Backend Spring Boot criado a partir do diagrama enviado. Ele cobre os contratos REST principais, uma camada GraphQL, endpoint interno de notificação por email e os contratos `.proto` do trecho gRPC do desenho.

## Stack
- Java 21
- Spring Boot 3.5.12
- Spring Web
- Spring Security + JWT
- Spring Data JPA
- Spring GraphQL
- PostgreSQL

Usei Spring Boot 3.5.12 com Java 21 para manter boa compatibilidade com o ecossistema Spring atual e com o ambiente moderno de execução.

## O que foi implementado
### Autenticação
- `POST /auth/google`
- `GET /users/me`

### Grupos
- `GET /groups`
- `POST /groups`
- `GET /groups/{groupId}`
- `PATCH /groups/{groupId}`
- `DELETE /groups/{groupId}`
- `GET /groups/{groupId}/panels`

### Placas
- `GET /panels`
- `POST /panels`
- `GET /panels/{panelId}`
- `PATCH /panels/{panelId}`
- `DELETE /panels/{panelId}`

### Limpezas
- `GET /panels/{panelId}/cleanings`
- `POST /cleanings`
- `PATCH /cleanings/{cleaningId}`
- `DELETE /cleanings/{cleaningId}`

### Dashboard
- `GET /dashboard/summary`
- `GET /dashboard/metrics`

### Interno
- `POST /internal/notifications/email`
- `POST /graphql`
- `GET /graphiql`

## Observações importantes
- O endpoint `/auth/google` está pronto no contrato, mas a validação real do token Google ficou como **stub local** para facilitar seus testes sem depender da integração externa agora.
- O diagrama parecia ter alguns typos, e eu corrigi no código:
  - `access_token` no lugar de `acess_token`
  - `DateTime` no lugar de `DataTime`
  - `DELETE /panels/{panelId}` no lugar de `/panels/{groupId}`
- Existe um seeder (`DataSeederConfig`) para subir o projeto já com dados de exemplo.

## Como rodar
Você vai precisar de Java 21 e Maven.

```bash
cd backend-springboot
mvn spring-boot:run
```

Ou gerar o jar:

```bash
mvn clean package
java -jar target/solarvision-api-0.0.1-SNAPSHOT.jar
```

## Variáveis de ambiente
- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRATION_SECONDS`
- `INTERNAL_API_TOKEN`

## Exemplo de login
```json
POST /auth/google
{
  "google_token": "Daniel|daniel@solarvision.com"
}
```

## Exemplo GraphQL
```graphql
query {
  dashboard {
    totalGroups
    totalPanels
    activeAlerts
  }
}
```
