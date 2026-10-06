# Documentação - SolarVision

Índice da documentação técnica do projeto (versão Supabase + Vercel).

| Documento | Conteúdo |
|---|---|
| [ARQUITETURA.md](ARQUITETURA.md) | Arquitetura do sistema: visão de implantação (Vercel + Supabase), camadas, fluxo de consulta, segurança (Auth + RLS), stack e decisões de projeto. |
| [MODELO-DE-CLASSES.md](MODELO-DE-CLASSES.md) | Modelo de domínio: diagrama das tabelas, colunas, domínios de valores, relacionamentos e índices. |
| [FUNCIONALIDADES.md](FUNCIONALIDADES.md) | Compilado das funcionalidades por módulo, com as tabelas e funções RPC usadas por cada tela. |
| [DECISOES-TECNICAS.md](DECISOES-TECNICAS.md) | Justificativa das escolhas (plataforma, framework x ferramenta x biblioteca, dimensões técnica/legal/institucional/ética, migração para Supabase + Vercel e trade-offs). |
| [FEATURES-INCOMPLETAS.md](FEATURES-INCOMPLETAS.md) | Funcionalidades parciais ou ainda não implementadas (perfil/senha, papéis, editar/excluir na UI, QA separado, alertas etc.), priorizadas. |

## Histórico (versão Spring Boot/Docker)

Documentos produzidos antes da migração, mantidos como registro:

| Documento | Conteúdo |
|---|---|
| [QUALIDADE-E-TESTES.md](QUALIDADE-E-TESTES.md) | Estratégia, riscos, casos automatizados e funcionais, resultados e limitações. |
| [Relatório PDF](../SolarVision_Qualidade_e_Testes.pdf) | Relatório acadêmico de qualidade e testes, seguindo a apresentação do exemplo fornecido. |
| [evidencias/](evidencias/) e [testes-integrados.cjs](testes-integrados.cjs) | Resultados das execuções e roteiro funcional integrado. |
