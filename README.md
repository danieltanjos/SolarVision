# SolarVision

SolarVision e uma aplicacao web para monitoramento de operacao e limpeza de paineis solares. O repositório contem o frontend estatico, um backend Node.js usado pela orquestracao atual, uma implementacao alternativa em Spring Boot, os scripts de banco de dados e o seeder de carga inicial.

## Visao Geral

Hoje o fluxo principal do projeto continua baseado em:

- `app/` para o frontend HTML/CSS servido por Nginx
- `backend/` para a API Node.js usada pelo `docker-compose.yml`
- `postgres-init/` para a criacao inicial do schema
- `data-seeder/` para importacao do CSV no banco

O projeto tambem contem um backend alternativo em Java dentro de `backend/springboot/`, organizado como modulo independente do backend Node.

## Estrutura Do Projeto

```text
SolarVision/
|-- app/                    Frontend estatico
|-- backend/                Backend Node.js principal
|   |-- package.json
|   |-- server.js
|   `-- springboot/         Backend alternativo em Spring Boot
|       |-- pom.xml
|       |-- mvnw
|       |-- Dockerfile
|       `-- src/
|-- data-seeder/            Seeder do banco a partir do CSV
|-- docs/                   Materiais de apoio e arquivos visuais
|-- nginx/                  Configuracao do Nginx
|-- postgres-init/          Scripts SQL de inicializacao
`-- docker-compose.yml      Ambiente local com Docker
```

## Pastas E Responsabilidades

### `app/`

Frontend estatico do projeto.

- Contem as paginas de autenticacao, home, cadastro, configuracoes, monitoramento e limpeza
- E servido pelo container Nginx definido em `app/Dockerfile`
- Usa os arquivos de `nginx/default.conf` no ambiente Docker

### `backend/`

Backend Node.js/Express atualmente conectado ao `docker-compose.yml`.

- Arquivos principais:
  - `backend/server.js`
  - `backend/package.json`
  - `backend/package-lock.json`
  - `backend/Dockerfile`
- E o backend que sobe por padrao quando voce executa `docker-compose up`
- O volume `backend/node_modules/` fica ignorado no Git

### `backend/springboot/`

Implementacao alternativa e mais estruturada do backend em Java com Spring Boot.

- Stack principal:
  - Java 21+
  - Spring Boot 3.5
  - Spring Web
  - Spring Validation
  - Spring Security + JWT
  - Spring Data JPA
  - Spring GraphQL
  - PostgreSQL
- O modulo contem:
  - endpoints REST para autenticacao, grupos, placas, limpezas e dashboard
  - endpoint interno para notificacoes
  - camada GraphQL
  - contratos `.proto`
  - seeder de dados de exemplo
  - testes JUnit
- Esse backend ainda nao e o backend padrao da orquestracao Docker atual

### `postgres-init/`

Scripts SQL executados automaticamente pelo PostgreSQL no primeiro boot do banco.

- Arquivo principal: `postgres-init/01-init-schema.sql`

### `data-seeder/`

Responsavel por popular a base com dados iniciais a partir do CSV tratado.

- Arquivos principais:
  - `data-seeder/inserirCSV.py`
  - `data-seeder/Dados_Tratados_CDTE-PSI.csv`
  - `data-seeder/Dockerfile`

### `docs/`

Materiais de apoio do projeto.

- Exemplo: `docs/assets/brand-concept.svg`

## Como Rodar O Projeto Completo Com Docker

### Pre-requisitos

- Docker
- Docker Compose

### Subir o ambiente

```bash
docker-compose up --build -d
```

### Servicos esperados

- Frontend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

### Observacoes sobre a orquestracao atual

- O `docker-compose.yml` usa o backend Node em `./backend`
- O backend Spring Boot em `backend/springboot/` nao esta ligado ao compose por padrao
- A senha `your_strong_password` no compose e apenas placeholder e deve ser trocada em uso real

## Como Rodar Apenas O Backend Node

### Pre-requisitos

- Node.js
- npm

### Comandos

```bash
cd backend
npm install
npm start
```

## Como Rodar Apenas O Backend Spring Boot

### Pre-requisitos

- Java 21 ou superior
- Maven 3.9+ ou Maven Wrapper funcional
- PostgreSQL disponivel

### Rodando em desenvolvimento

```bash
cd backend/springboot
mvn spring-boot:run
```

Se preferir usar o wrapper:

```bash
cd backend/springboot
./mvnw spring-boot:run
```

### Build do jar

```bash
cd backend/springboot
mvn clean package
java -jar target/solarvision-api-0.0.1-SNAPSHOT.jar
```

### Testes do backend Spring Boot

```bash
cd backend/springboot
mvn test
```

## Variaveis De Ambiente

### Backend Node

- `DB_USER`
- `DB_HOST`
- `DB_DATABASE`
- `DB_PASSWORD`

### Backend Spring Boot

- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRATION_SECONDS`
- `INTERNAL_API_TOKEN`

## Contratos E Endpoints Do Backend Spring Boot

### Autenticacao

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

### Interno E GraphQL

- `POST /internal/notifications/email`
- `POST /graphql`
- `GET /graphiql`

## Banco De Dados E Carga Inicial

O banco usado pelo ambiente principal e PostgreSQL.

- `postgres-init/` prepara o schema inicial
- `data-seeder/` carrega dados iniciais do CSV tratado
- O volume `postgres-data/` fica fora do versionamento

## Dockerfiles Do Projeto

- `app/Dockerfile`: frontend
- `backend/Dockerfile`: backend Node.js
- `backend/springboot/Dockerfile`: backend Spring Boot
- `data-seeder/Dockerfile`: seeder

## Estado Atual Da Arquitetura

O repositorio agora esta organizado com uma estrutura mais coerente:

- existe um unico README global na raiz
- o backend Spring Boot foi movido para dentro de `backend/` como `backend/springboot/`
- o backend Node continua sendo a implementacao usada pelo `docker-compose.yml`
- o backend Spring Boot permanece como alternativa/evolucao da API

## Notas De Manutencao

- Artefatos de build do Spring Boot em `backend/springboot/target/` ficam ignorados no Git
- Dependencias do Node em `backend/node_modules/` ficam ignoradas no Git
- Se futuramente o Spring Boot passar a ser o backend principal do projeto, o `docker-compose.yml` deve ser ajustado numa mudanca separada
