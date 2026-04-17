# SolarVision
> Clareza que transforma energia em resultado

## ☀️ SolarVision: Monitoramento de Energia Solar

O **SolarVision** é uma aplicação web full-stack desenvolvida para monitoramento e análise de dados de geração de energia solar. A arquitetura é baseada em microsserviços e utiliza o Docker Compose para orquestração, garantindo um ambiente de desenvolvimento e produção consistente e de fácil implantação.

## 🚀 Tecnologias Utilizadas

Este projeto é construído com as seguintes tecnologias:

| Componente | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Bootstrap | Interface de usuário para visualização e interação. |
| **Servidor Web** | Nginx | Servidor web leve e eficiente, atua como proxy reverso. |
| **Backend (API)** | Java 21, Spring Boot | API REST, GraphQL, autenticação JWT e acesso ao banco de dados. |
| **Banco de Dados** | PostgreSQL | Armazenamento persistente para dados de usuários e leituras de energia. |
| **Orquestração** | Docker, Docker Compose | Containerização e gerenciamento de todos os serviços. |
| **Autenticação** | JWT | Token Bearer para proteger as rotas da API. |

## 📦 Estrutura do Projeto

O projeto está organizado em diretórios modulares:

```
SolarVision/
├── app/                  # Código do Frontend (HTML, CSS, JS)
│   ├── css/              # Arquivos CSS do Bootstrap
│   ├── home/             # Páginas internas (home, cadastro, configurações, limpeza)
│   ├── img/              # Imagens e logotipos
│   ├── index.html        # Página inicial
│   └── login.html        # Página de login
├── backend/              # Código do Backend Spring Boot
│   ├── src/main/java/.../controller
│   ├── src/main/java/.../service
│   ├── src/main/java/.../repository
│   ├── src/main/java/.../model
│   ├── src/main/java/.../dto
│   └── src/main/resources
├── data-seeder/          # Script Python para carga inicial via CSV
├── postgres-init/        # Scripts de inicialização do PostgreSQL
│   └── 01-init-schema.sql# Criação das tabelas `usuarios` e `leituras_energia`
├── nginx/                # Configuração do Nginx
│   └── default.conf      # Configuração do proxy reverso
└── docker-compose.yml    # Definição e orquestração dos serviços
```

## ⚙️ Instalação e Execução

Para rodar o projeto localmente, você precisa ter o **Docker** e o **Docker Compose** instalados em sua máquina.

### 1. Clonar o Repositório

```bash
git clone [URL_DO_SEU_REPOSITORIO]
cd SolarVision
```

### 2. Configurar Variáveis de Ambiente

O arquivo `docker-compose.yml` já contém as variáveis de ambiente necessárias. **É altamente recomendável que você altere a senha padrão** `your_strong_password` para uma senha segura em ambos os serviços (`backend` e `postgres`).

### 3. Iniciar os Serviços

Execute o comando abaixo para construir as imagens e iniciar todos os containers em modo *detached* (segundo plano):

```bash
docker-compose up --build -d
```

Aguarde alguns instantes até que todos os serviços estejam prontos (o banco de dados e a API precisam iniciar).

### 4. Acessar a Aplicação

A aplicação estará acessível no seu navegador através da porta `8080`:

[http://localhost:8080](http://localhost:8080)

Basta o usuário criar seu cadastro e fazer o login em seguida.

## 🔑 Rotas da API (Backend)

O backend Spring Boot expõe as rotas principais descritas no diagrama:

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/google` | Autentica usuário e retorna `access_token`. |
| `GET` | `/api/users/me` | Retorna o usuário autenticado. |
| `GET` | `/api/groups` | Lista grupos de placas. |
| `POST` | `/api/groups` | Cadastra grupo de placas. |
| `GET` | `/api/groups/{groupId}/panels` | Lista placas de um grupo. |
| `GET` | `/api/panels` | Lista placas solares. |
| `POST` | `/api/panels` | Cadastra placa solar. |
| `GET` | `/api/panels/{panelId}/cleanings` | Lista histórico de limpezas. |
| `POST` | `/api/cleanings` | Registra limpeza. |
| `GET` | `/api/dashboard/summary` | Retorna resumo do dashboard. |
| `GET` | `/api/dashboard/metrics` | Retorna séries de métricas do dashboard. |
| `POST` | `/api/graphql` | Executa consultas GraphQL. |

## 📊 Banco de Dados (PostgreSQL)

O banco de dados é usado pelo backend Spring Boot com entidades para usuários, grupos solares, placas, leituras, limpezas e alertas. O projeto também mantém scripts de inicialização em `postgres-init/`.

### População Inicial de Dados

O projeto inclui um container chamado seed-data, uma solução efêmera (transitória) projetada para realizar a carga inicial dos dados do arquivo .csv para o banco de dados e encerrar sua execução logo em seguida.

## 🛑 Parar e Remover os Serviços

Para parar os containers:

```bash
docker-compose stop
```

Para parar e remover os containers, redes e volumes (incluindo os dados do banco):

```bash
docker-compose down -v
```

**Atenção:** O comando `down -v` irá deletar o volume de dados (`./postgres-data`), removendo permanentemente todos os dados do banco de dados.

---

## © direitos autorais

© 2025 Solar Vision. Todos os direitos reservados.
