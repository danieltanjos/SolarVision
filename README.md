# SolarVision

Aplicacao web para monitoramento de energia solar. O projeto hoje sobe via Docker com frontend estatico, backend Node.js, PostgreSQL e um seeder de dados.

## Estrutura
```text
SolarVision/
|-- app/                  Frontend estatico servido por Nginx
|-- backend/              Backend Node.js usado pelo docker-compose atual
|-- backend-springboot/   Backend alternativo em Spring Boot
|-- data-seeder/          Carga inicial do CSV no banco
|-- docs/                 Documentacao complementar e arquivos de apoio
|-- nginx/                Configuracao do Nginx
|-- postgres-init/        Scripts de inicializacao do PostgreSQL
`-- docker-compose.yml    Orquestracao local
```

## Componentes ativos
- `app/`: telas HTML/CSS do projeto.
- `backend/`: API Node.js/Express usada no ambiente atual.
- `postgres-init/`: schema inicial do banco.
- `data-seeder/`: importacao do CSV de leituras.

## Componentes auxiliares
- `backend-springboot/`: implementacao alternativa do backend.
- [docs/spring-boot-backend.md](/Users/danielanjos/Documents/Senai/Projeto aplicado III/SolarVision/docs/spring-boot-backend.md): resumo de uso do backend Spring Boot.
- [docs/assets/brand-concept.svg](/Users/danielanjos/Documents/Senai/Projeto aplicado III/SolarVision/docs/assets/brand-concept.svg): arte visual movida da raiz para a pasta de documentacao.

## Como executar
Prerequisitos: Docker e Docker Compose.

```bash
docker-compose up --build -d
```

Aplicacao: `http://localhost:8080`

## Observacoes
- O `docker-compose.yml` ainda aponta para `./backend`, nao para `backend-springboot/`.
- A senha `your_strong_password` em `docker-compose.yml` deve ser trocada antes de uso real.
- Artefatos gerados localmente, como `backend-springboot/target/`, agora ficam fora do versionamento.
