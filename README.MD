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
| **Backend (API)** | Node.js (Express) | API RESTful para lógica de negócio, autenticação e acesso ao banco de dados. |
| **Banco de Dados** | PostgreSQL | Armazenamento persistente para dados de usuários e leituras de energia. |
| **Orquestração** | Docker, Docker Compose | Containerização e gerenciamento de todos os serviços. |
| **Autenticação** | `bcryptjs` | Criptografia de senhas para segurança do usuário. |

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
├── backend/              # Código do Backend (API Node.js)
│   ├── Dados_Tratados... # Exemplo de arquivo CSV para importação de dados
│   ├── inserirCSV.py     # Script Python para popular o banco de dados
│   └── server.js         # Lógica principal da API (rotas de login, registro e dados)
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

Basta o usuário criar seu cliente e fazer o login em seguida.

## 🔑 Rotas da API (Backend)

O backend em Node.js expõe as seguintes rotas principais:

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/register` | Cria um novo usuário no banco de dados. |
| `POST` | `/api/login` | Autentica um usuário e retorna dados básicos. |
| `GET` | `/api/leituras` | Retorna os dados de leitura de energia. Aceita `inicio` e `fim` como parâmetros de query para filtragem por data. |

## 📊 Banco de Dados (PostgreSQL)

O banco de dados é inicializado com duas tabelas principais:

1.  **`usuarios`**: Armazena informações de login (`nome`, `email`, `senha_hash`).
2.  **`leituras_energia`**: Armazena os dados de monitoramento, com colunas para `dia`, `hora` e `wats5min` (valor em Watts medido a cada 5 minutos).

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
