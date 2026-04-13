# Backend Spring Boot

O backend em `backend-springboot/` foi mantido como uma implementacao alternativa/evolucao do backend principal em Node.js.

## Stack
- Java 21
- Spring Boot 3.5
- Spring Web
- Spring Security + JWT
- Spring Data JPA
- Spring GraphQL
- PostgreSQL

## O que existe nele
- Endpoints REST para autenticacao, grupos, placas, limpezas e dashboard
- Endpoint interno de notificacao por email
- Camada GraphQL
- Contratos `.proto`
- Seeder de dados de exemplo

## Como executar
```bash
cd backend-springboot
./mvnw spring-boot:run
```

Ou:

```bash
cd backend-springboot
./mvnw clean package
java -jar target/solarvision-api-0.0.1-SNAPSHOT.jar
```

## Variaveis de ambiente
- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRATION_SECONDS`
- `INTERNAL_API_TOKEN`

## Observacao
O `docker-compose.yml` atual continua apontando para o backend Node em `backend/`. Se quiser migrar a orquestracao para Spring Boot, isso deve ser feito como uma mudanca separada.
