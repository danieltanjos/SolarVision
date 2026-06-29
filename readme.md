# SolarVision

Sistema full-stack para monitoramento de energia solar com microsserviços em Docker, backend em Spring Boot, banco PostgreSQL, carga inicial por CSV em Python e frontend SPA em React + Vite.

## Estrutura

```text
SolarVision/
├── backend/          # API Spring Boot + JWT + GraphQL + schema + seeder
├── frontend/         # SPA React + Vite + ApexCharts
└── docker-compose.yml
```

## Arquitetura (visão geral)

```mermaid
flowchart LR
    browser["Navegador (usuário)"]

    subgraph compose["Docker Compose — rede solarvision-net"]
        frontend["frontend<br/>React + Vite + Nginx<br/>porta 8080"]
        backend["backend<br/>Spring Boot<br/>REST/GraphQL 8081 · gRPC 9090"]
        db[("postgres<br/>PostgreSQL 17<br/>porta 5432")]
        seeder["seed-data<br/>carga inicial (Python)<br/>executa uma vez e encerra"]
    end

    browser -->|HTTP 8080| frontend
    frontend -->|proxy reverso /api| backend
    backend -->|JDBC + pool de conexões| db
    seeder -->|INSERT em lote do CSV| db
    backend -.->|Flyway aplica as migrations no startup| db
```

Detalhes de arquitetura (camadas, fluxos, stack e decisões) em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e o modelo de domínio em [`docs/MODELO-DE-CLASSES.md`](docs/MODELO-DE-CLASSES.md).

## Stack

- Backend: Java 25, Spring Boot 3.5.12, Spring Security (JWT), Spring Data JPA, Flyway, GraphQL, gRPC (Spring gRPC), springdoc-openapi (Swagger)
- Frontend: React, Vite, React Router, Axios, ApexCharts, Bootstrap
- Banco: PostgreSQL 17
- Seeder: Python 3.12 + psycopg2
- Infra: Docker Compose + Nginx

## Serviços

- `postgres`: banco principal
- `backend`: API em `http://localhost:8081`
- `frontend`: SPA em `http://localhost:8080`
- `seed-data`: carga efêmera do CSV na tabela `leituras_energia`

## Execução

```bash
docker compose up --build -d
```

## Parar

```bash
docker compose down
```

Para remover também o volume do PostgreSQL:

```bash
docker compose down -v
```

## Fluxo principal da aplicação

1. O PostgreSQL sobe vazio; o backend aplica as **migrations Flyway** (`backend/src/main/resources/db/migration`) criando o schema.
2. O backend conecta no banco e expõe REST + GraphQL em `/api/graphql`, Swagger em `/swagger-ui.html` e um servidor gRPC in-process na porta `9090`.
3. O container `seed-data` usa `backend/data-seeder/`, aguarda o schema, importa o CSV e encerra automaticamente.
4. O frontend React consome a API via Nginx reverse proxy em `/api`.

## Documentação

- Arquitetura (infra, camadas, fluxos): [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- Modelo de classes (domínio): [`docs/MODELO-DE-CLASSES.md`](docs/MODELO-DE-CLASSES.md)
- Funcionalidades e endpoints: [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md)
- Decisões técnicas e justificativas: [`docs/DECISOES-TECNICAS.md`](docs/DECISOES-TECNICAS.md)
- Por módulo: [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md)

## Performance Ratio (visão futura)

**To-do:** "Ingerir clima/irradiância em tempo real por site, calcular a geração esperada (via PVLib) e o Performance Ratio (gerado real ÷ esperado), e diagnosticar a causa da baixa geração — nuvem, temperatura, sujeira, sombra ou falha — recomendando limpeza por ROI."

Mapa dos dados que precisam ser cruzados para chegar no **Performance Ratio (PR = gerado real ÷ gerado esperado)** e na atribuição de causa.

### A. Cadastro do site/placa (estático — define o "esperado")

| Dado | Unidade | Para quê | Fonte |
|---|---|---|---|
| Latitude / longitude | graus | Posição do sol, irradiância do local | Cadastro |
| Fuso horário | — | Alinhar timestamps | Cadastro/derivado |
| Potência nominal (STC) | Wp/kWp | Base do cálculo do esperado | Ficha da placa |
| (alt.) Área + eficiência | m² / % | Alternativa ao Wp | Ficha da placa |
| Inclinação (tilt) | graus | Transposição da irradiância p/ o plano da placa | Cadastro |
| Orientação (azimute) | graus | Idem | Cadastro |
| Coef. de temperatura (γ) | %/°C (~ -0,35) | Perda por calor | Datasheet |
| Perdas do sistema | % (~14 default) | Inversor, cabos, mismatch | Estimativa/cadastro |
| Data de instalação | data | Degradação anual (~0,5%/ano) | Cadastro |
| Tipo de montagem | telhado/solo | Afeta temperatura da célula | Cadastro (opcional) |

### B. Telemetria da placa (medido — o "real")

| Dado | Unidade | Para quê | Fonte |
|---|---|---|---|
| Timestamp | ISO | Alinhar com clima | Telemetria |
| Potência gerada / energia no intervalo | W / Wh | O "real" do PR | Telemetria (CSV hoje) |
| ID da placa/string | — | Granularidade do diagnóstico | Telemetria |
| (ideal) Tensão/corrente por string | V / A | Detectar falha/sombra | Telemetria |
| (ideal) Temp. do módulo medida | °C | Melhora o derating térmico | Sensor |

### C. Clima/ambiente em tempo real (o que cruza)

| Dado | Unidade | Para quê | Fonte |
|---|---|---|---|
| Irradiância GHI/DNI/DHI | W/m² | Driver nº 1 do esperado | API solar (Open-Meteo/Solcast/PVGIS) |
| Cobertura de nuvens | % | Diagnóstico "nublado" + modular céu claro | API de clima |
| Temperatura ambiente | °C | Temperatura da célula → derating | API de clima |
| Velocidade do vento | m/s | Resfriamento da célula | API de clima |
| Precipitação | mm | Detectar chuva → "limpeza natural" (assinatura de sujeira) | API de clima |
| (opcional) Umidade/pressão | % / hPa | Refino | API de clima |

### D. Derivados/calculados (o resultado — via PVLib)

| Cálculo | Como | Usa |
|---|---|---|
| Posição solar | PVLib | lat/long + tempo |
| Irradiância no plano (POA) | transposição | GHI/DNI/DHI + tilt/azimute |
| Irradiância de céu claro | modelo clear-sky | lat/long + tempo |
| Temperatura da célula | modelo térmico | temp ambiente + irradiância + vento |
| **P_esperado** | modelo PV | POA + Wp + γ + perdas |
| **PR** | real ÷ esperado | B ÷ D |
| Índice de soiling / déficit | resíduo inexplicado | PR + clima + histórico |
| Causa | regras/ML | nuvem / temperatura / sujeira / sombra / falha |

### Mínimo viável vs ideal

- **Mínimo para um PR básico:** localização, Wp, tilt/azimute, GHI, temperatura ambiente, energia real, timestamps.
- **Desbloqueia o diagnóstico:** + cobertura de nuvens + precipitação (separa "nublado" de "sujeira" e detecta recuperação pós-chuva).
- **Ideal (localizar falha/sujeira na placa):** dado por string + temperatura/irradiância medidas no local.

### Integração

Tudo gira em torno de **alinhar timestamp + fuso + granularidade**: o clima é reamostrado para casar com o intervalo da telemetria (ex.: 5 min), unindo tudo pela **geolocalização do site**. Esse *join* tempo × local é o que viabiliza o cruzamento.
