# Decisões Técnicas e Justificativas - SolarVision

Este documento registra **as escolhas tecnológicas e as decisões de projeto**, justificando-as sob diferentes referenciais (técnico, legal/normativo, institucional/acadêmico e ético/social).

> Arquitetura e mecanismos de segurança: [ARQUITETURA.md](ARQUITETURA.md).

---

## 1. Contexto e critério condutor

O SolarVision é um **trabalho acadêmico da disciplina de Desenvolvimento Web**. Por isso, o critério que mais pesou nas escolhas foi **institucional/acadêmico**: **atender aos critérios de avaliação da matéria** e **utilizar as tecnologias lecionadas em Desenvolvimento Web**, demonstrando domínio dos padrões trabalhados em aula e presentes no código de referência do professor (projeto `LojaProduto`) - **Spring Data JPA, Spring Security/JWT, Flyway, Swagger/OpenAPI** -, somando um diferencial (**GraphQL** e **gRPC**) para evidenciar repertório.

As justificativas técnicas abaixo são reais, mas o **driver principal foi atender à avaliação técnica e ao conteúdo da disciplina de Desenvolvimento Web**, não requisitos de um cliente de produção.

---

## 2. Linguagem e plataforma

**Plataforma do sistema:** serviço **back-end web** (API REST/GraphQL/gRPC) + **SPA** no navegador.

**Linguagem do back-end: Java 25 (LTS mais recente)**
- Linguagem **compilada e fortemente tipada** sobre a JVM - detecta erros em tempo de compilação e é referência no mercado corporativo de back-end.
- Ecossistema maduro para APIs web (Spring), com forte empregabilidade - adequado ao objetivo de aprendizado.
- Java 25 por ser a versão **LTS** mais atual, demonstrando uso de tecnologia vigente.

**Front-end: JavaScript (React + Vite)** - plataforma navegador, onde JS é a linguagem nativa; React é o padrão de mercado para SPAs.

> Reconhecimento da adequação linguagem x plataforma: Java/JVM para o serviço de back-end; JavaScript/browser para a interface. Cada linguagem foi escolhida conforme a plataforma-alvo.

---

## 3. Framework x ferramenta x biblioteca

Distinção conceitual usada no projeto:

- **Framework**: impõe a estrutura e o fluxo da aplicação (inversão de controle - "ele chama o seu código"). Você preenche os pontos de extensão.
- **Biblioteca**: você chama quando precisa; não dita a estrutura.
- **Ferramenta**: utilitário externo ao código, usado no build, na infraestrutura ou na operação.

| Tecnologia | Categoria | Papel |
|---|---|---|
| Spring Boot | Framework | Base da aplicação, auto-configuração, servidor embutido |
| Spring Web / Data JPA / Security / GraphQL / gRPC | Framework | Camadas web, persistência, segurança, APIs |
| React | Framework | SPA do front-end |
| Hibernate | Framework (ORM) | Implementação JPA |
| jjwt, ApexCharts, Axios, Bootstrap, protobuf-java | Biblioteca | Funções pontuais (JWT, gráfico, HTTP, UI, serialização) |
| JUnit, Mockito | Biblioteca (teste) | Testes automatizados |
| Maven | Ferramenta | Build e dependências |
| Docker / Docker Compose | Ferramenta | Empacotamento e orquestração |
| Flyway | Ferramenta/lib | Migrations versionadas do banco |
| Nginx | Ferramenta | Servidor web / proxy reverso |
| protoc / protoc-gen-grpc-java | Ferramenta | Geração de código a partir dos `.proto` |
| Swagger UI | Ferramenta | Documentação interativa da API |
| Git / GitHub | Ferramenta | Versionamento e colaboração |

---

## 4. Justificativas por dimensão

### Técnica
- **Spring Data JPA** (em vez de JDBC manual): menos código, mapeamento objeto-relacional, e é o padrão **ativo** no código do professor. Onde o JPA é fraco (agregações), usamos **SQL nativo** pontual (`@Query`) - abordagem híbrida de mercado.
- **Flyway**: schema versionado e reprodutível ("schema as code"), em vez de script manual no contêiner.
- **JWT stateless + BCrypt**: autenticação sem sessão (escala horizontal) e senha protegida por hash com salt.
- **Swagger/OpenAPI**: documentação viva e testável da API.
- **gRPC in-process**: demonstra RPC binário/HTTP-2 sem introduzir um contêiner extra.
- Detalhes e trade-offs em [ARQUITETURA.md](ARQUITETURA.md) (seções 8).

### Legal / Normativa
- **LGPD**: o sistema trata dados pessoais (nome, e-mail, senha). A senha é armazenada apenas como **hash BCrypt** (irreversível); o token JWT **não** carrega a senha - boas práticas de proteção e minimização de dados.
- **Licenças open-source**: as dependências usadas são predominantemente **Apache 2.0** (Spring, gRPC), **MIT** (React) e a licença do **PostgreSQL** - compatíveis com uso acadêmico e comercial, sem cláusulas restritivas (copyleft forte).
- **Boas práticas de segurança**: consultas parametrizadas (proteção contra SQL injection) e recomendação de HTTPS em produção.

### Institucional / Acadêmica
- **Alinhamento ao stack e aos padrões da disciplina de Desenvolvimento Web** (código de referência do professor, `LojaProduto`) - é o critério condutor do trabalho: usar as tecnologias lecionadas e atender aos critérios de avaliação da matéria.
- **Convenções de engenharia**: versionamento com Git, fluxo de **branches + Pull Requests**, mensagens de commit objetivas e documentação no diretório `docs/`.

### Ética / Social
- **Proteção dos dados do usuário** (hash de senha; mensagens de erro que não expõem detalhes internos sensíveis).
- **Usabilidade**: mensagens de validação claras por campo (ex.: requisito de senha), reduzindo frustração do usuário.
- **Software livre**: uso de tecnologias open-source, acessíveis e auditáveis.

---

## 5. Principais trade-offs assumidos

| Decisão | Alternativa | Por que escolhemos |
|---|---|---|
| JPA | JDBC/DAO manual | Produtividade + padrão ativo do professor (DAO fica como conceito apresentado) |
| gRPC `0.9.0` (milestone) | `1.0.x` GA | A 1.0.x exige Spring Boot 4.0; mantivemos Boot 3.5 estável (ver ARQUITETURA, seção 8) |
| gRPC in-process | Microsserviço separado | Demonstra o padrão sem custo de mais um contêiner |
| Flyway | `ddl-auto` do Hibernate criar o schema | Schema versionado e auditável; Hibernate apenas valida |
| Spring Boot 3.5.12 | Spring Boot 4.0 | Ecossistema (springdoc, gRPC) estável no 3.5; migração para 4.0 é evolução futura |
