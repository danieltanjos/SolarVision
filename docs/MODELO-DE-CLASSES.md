# Modelo de Classes - SolarVision

Modelo de domínio do SolarVision. Desde a migração para o Supabase, o domínio é representado diretamente pelas **tabelas do PostgreSQL** (`supabase/migrations/20261006120000_init.sql`); não há mais classes de entidade no backend. O diagrama abaixo mostra cada tabela como uma classe.

> Arquitetura geral do sistema: [ARQUITETURA.md](ARQUITETURA.md).

---

## Diagrama de classes

```mermaid
classDiagram
    direction LR

    class usuarios {
        +uuid id
        +varchar nome
        +varchar email
        +varchar role
        +timestamptz criado_em
    }
    class grupos_solares {
        +bigint id
        +varchar nome
        +varchar status
        +timestamptz criado_em
    }
    class placas {
        +bigint id
        +bigint grupo_id
        +varchar modelo
        +varchar status
        +timestamptz criado_em
    }
    class limpezas {
        +bigint id
        +bigint placa_id
        +timestamptz data_limpeza
        +text observacao
        +timestamptz criado_em
    }
    class leituras_energia {
        +bigint id
        +bigint placa_id
        +timestamptz data_hora
        +numeric wats_gerados
        +timestamptz criado_em
    }
    class auth_users {
        <<Supabase Auth>>
        +uuid id
        +email
        +senha (hash)
    }

    %% Composições (losango cheio) refletem ON DELETE CASCADE:
    %% remover o pai remove os filhos.
    auth_users "1" *-- "1" usuarios : perfil
    grupos_solares "1" *-- "0..*" placas : placas
    placas "1" *-- "0..*" limpezas : limpezas
    placas "1" *-- "0..*" leituras_energia : leituras

    note for usuarios "Perfil criado pelo trigger criar_perfil_usuario; não se relaciona ao domínio solar."
    note for placas "Núcleo do domínio: pertence a um grupo e agrega limpezas e leituras."
```

---

## Tabelas

### `usuarios`
Perfil do usuário. A senha e o login ficam no Supabase Auth (`auth.users`); a linha é criada pelo trigger `criar_perfil_usuario` no cadastro.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid (PK) | FK para `auth.users(id)`, `on delete cascade` |
| nome | varchar(100) | obrigatório; vem de `options.data.nome` no cadastro (ou da parte local do e-mail) |
| email | varchar(255) | único |
| role | varchar(30) | `ADMIN` ou `USER`, padrão `USER` |
| criado_em | timestamptz | padrão `now()` |

### `grupos_solares`
Agrupamento de placas (ex.: uma usina/instalação).

| Coluna | Tipo | Observações |
|---|---|---|
| id | bigint (PK) | identity |
| nome | varchar(120) | obrigatório, não pode ser só espaços |
| status | varchar(30) | `ATIVO`, `INATIVO` ou `MANUTENCAO`, padrão `ATIVO` |
| criado_em | timestamptz | padrão `now()` |

### `placas`
Placa/painel solar, pertencente a um grupo.

| Coluna | Tipo | Observações |
|---|---|---|
| id | bigint (PK) | identity |
| grupo_id | bigint (FK) | `grupos_solares(id)`, obrigatório |
| modelo | varchar(120) | obrigatório, não pode ser só espaços |
| status | varchar(30) | `ATIVA`, `INATIVA` ou `MANUTENCAO`, padrão `ATIVA` |
| criado_em | timestamptz | padrão `now()` |

### `limpezas`
Registro de limpeza de uma placa.

| Coluna | Tipo | Observações |
|---|---|---|
| id | bigint (PK) | identity |
| placa_id | bigint (FK) | `placas(id)`, obrigatório |
| data_limpeza | timestamptz | obrigatório |
| observacao | text | opcional, até 1000 caracteres |
| criado_em | timestamptz | padrão `now()` |

### `leituras_energia`
Leitura de geração de energia de uma placa (série temporal; carregada pelo seeder do CSV).

| Coluna | Tipo | Observações |
|---|---|---|
| id | bigint (PK) | identity |
| placa_id | bigint (FK) | `placas(id)`, obrigatório |
| data_hora | timestamptz | obrigatório; deslocada diariamente pelo pg_cron |
| wats_gerados | numeric(14,4) | obrigatório |
| criado_em | timestamptz | padrão `now()` |

> A tabela `alertas` da versão Spring Boot foi removida: só era usada pelos serviços gRPC.

---

## Domínios de valores (status e papel)

Os antigos enums Java viraram constraints `CHECK` no banco:

| Coluna | Valores |
|---|---|
| `usuarios.role` | ADMIN, USER |
| `grupos_solares.status` | ATIVO, INATIVO, MANUTENCAO |
| `placas.status` | ATIVA, INATIVA, MANUTENCAO |

---

## Relacionamentos

| Origem | Cardinalidade | Destino | Chave estrangeira |
|---|---|---|---|
| auth.users | 1 : 1 | usuarios | `usuarios.id` |
| grupos_solares | 1 : N | placas | `placas.grupo_id` |
| placas | 1 : N | limpezas | `limpezas.placa_id` |
| placas | 1 : N | leituras_energia | `leituras_energia.placa_id` |

A exclusão é em cascata (`on delete cascade`): remover um grupo remove suas placas e, por consequência, limpezas e leituras.

---

## Índices, funções e políticas

- **Índices**: `placas.grupo_id`, `limpezas.placa_id`, `limpezas.data_limpeza desc`, `leituras_energia.placa_id`, `leituras_energia.data_hora`.
- **Funções (RPC)**: `dashboard_metricas(granularidade, data_inicio, data_fim)` e `dashboard_resumo()` - ver [FUNCIONALIDADES.md](FUNCIONALIDADES.md).
- **RLS**: habilitada em todas as tabelas - ver [ARQUITETURA.md](ARQUITETURA.md#4-segurança).
- **Nomes no JSON**: `frontend/src/lib/api.js` usa aliases (`criadoEm:criado_em`, `grupoId:grupo_id`...) para entregar às telas os mesmos campos camelCase da API antiga.
