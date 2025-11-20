# SolarVision
> Clareza que transforma energia em resultado

## 📌 Sobre o Projeto

O **SolarVision** é um painel de monitoramento (dashboard) para a visualização de dados de performance de painéis solares. O projeto foi desenvolvido com uma arquitetura modular inspirada no Grafana, permitindo a exibição de métricas de desempenho, eficiência e produção em tempo real.

O frontend é construído com HTML, CSS e JavaScript (utilizando **Gridstack.js** para o layout modular e **ApexCharts.js** para os gráficos) e é servido por um container **Nginx**.

O ambiente de desenvolvimento e backend é totalmente containerizado com **Docker Compose**, utilizando:
* **PostgreSQL** para dados relacionais (ex: usuários, configurações de dispositivos).
* **InfluxDB** para dados de séries temporais (ex: leituras de sensores, métricas de produção por minuto).

## 🚀 Tecnologias Utilizadas

### Frontend
* HTML5
* CSS3 (com Bootstrap 5)
* JavaScript (ES6+)
* **Gridstack.js**: Para o layout modular do dashboard.
* **ApexCharts.js**: Para a renderização dos gráficos.

### Backend & Infraestrutura
* **Nginx**: Servidor web para o frontend estático.
* **PostgreSQL 16**: Banco de dados relacional.
* **InfluxDB 2.7**: Banco de dados de séries temporais.
* **Docker & Docker Compose**: Para containerização e orquestração do ambiente.

## 🛠️ Pré-requisitos

Antes de começar, garanta que você tenha as seguintes ferramentas instaladas em sua máquina:
* [Docker](https://www.docker.com/get-started)
* [Docker Compose](https://docs.docker.com/compose/install/) (geralmente já vem incluído no Docker Desktop para Windows e macOS)

## ⚙️ Como Rodar o Projeto

Siga estes passos para configurar e executar o ambiente de desenvolvimento local.

### 1. Estrutura de Pastas

Seu projeto deve estar organizado da seguinte maneira na pasta raiz (`/solarvision/`):

* 📁 **app/**: Contém todo o código-fonte do frontend (HTML, CSS, JS).
    * 📁 **monitoramento/**
    * 📁 **home/**
    * 📄 `Dockerfile`
    * 📄 `(seus outros arquivos...)`
* 📁 **nginx/**: Contém os arquivos de configuração do Nginx.
    * 📄 `default.conf`
* 📁 **postgres-data/**: Pasta que armazena os dados persistentes do PostgreSQL.
* 📁 **influxdb-data/**: Pasta que armazena os dados persistentes do InfluxDB.
* 📄 **docker-compose.yml**: O arquivo principal que orquestra todos os serviços.

---

### 2. Ajuste de Permissões (Importante para Linux/macOS)
Os bancos de dados são sensíveis a permissões de pasta. Se você estiver em um ambiente **Linux ou macOS**, você **deve** ajustar o "dono" (owner) das pastas para que os containers tenham permissão de escrita.

bash
# Define as permissões para a pasta do PostgreSQL
sudo chown -R 70:70 ./postgres-data

# Define as permissões para a pasta do InfluxDB
sudo chown -R 1000:1000 ./influxdb-data

---

### 3. Construa e Inicie os Containers
Com tudo configurado, execute o Docker Compose. Este comando irá construir a imagem do Nginx e baixar as imagens do Postgres e InfluxDB.

bash
docker-compose up -d

### 4. Acesse os Serviços
Seu ambiente completo está no ar:

🌐 Aplicação SolarVision: http://localhost:8080/ (Você pode acessar .../monitoramento.html ou qualquer outra página da sua pasta app)

📊 Interface do InfluxDB: http://localhost:8086 (Use as credenciais solarvision_user e your_strong_password definidas no docker-compose.yml para configurar)

🐘 Conexão com o PostgreSQL:

Host: localhost

Porta: 5432

Usuário: solarvision_user

Senha: your_strong_password

Database: solarvision_db (Você pode usar um cliente como DBeaver ou pgAdmin para se conectar)

---

### Parte 5: Fluxo de Desenvolvimento

---

## ⚡ Fluxo de Desenvolvimento (Edição em Tempo Real)

Este ambiente foi configurado para um desenvolvimento ágil.

* **Alterações de Frontend (HTML, CSS, JS):**
    Graças ao volume `volumes: - ./app:/usr/share/nginx/html`, você pode simplesmente editar qualquer arquivo na sua pasta `app` local, salvar e **apenas atualizar a página do navegador (F5)** para ver a mudança instantaneamente.

* **Alterações na Configuração do Nginx:**
    Se você precisar alterar o domínio (ex: `server_name`) ou adicionar regras de redirecionamento, edite o arquivo `./nginx/default.conf`. Como o Nginx só lê a configuração ao iniciar, você precisará reiniciá-lo:
    bash
    docker-compose restart frontend
    

* **Alterações nas Configurações dos Bancos de Dados:**
    Os arquivos de configuração (`postgresql.conf`, etc.) estão visíveis dentro das pastas `./postgres-data` e `./influxdb-data`. Após uma alteração, você deve reiniciar o serviço correspondente:
    bash
    docker-compose restart postgres
     ou
    docker-compose restart influxdb
    

## © direitos autorais

© 2025 Solar Vision. Todos os direitos reservados.
