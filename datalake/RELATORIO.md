# Relatório — uso da plataforma SolarVision

Respostas às quatro perguntas do [enunciado](docs/ENUNCIADO.md), com as tabelas Gold e os números que as sustentam, e a seção "Qualidade do dado".

> **De onde vêm os números.** Uso simulado pelo gerador (`gerador/gerar_eventos.py`, padrões: seed 42, 3000 usuários, 28 dias de setembro de 2026, 3% de sujeira), processado pelas mesmas funções dos jobs (`silver.py`, `gold_*.py`). A plataforma ainda tem poucos usuários reais: os eventos reais (tabela `eventos_coletados`) entram pelo mesmo caminho e substituem a simulação quando houver volume. Com a mesma seed os arquivos são idênticos byte a byte, então `pipeline/rodar_tudo.py --limpar` no Docker reproduz estas tabelas. Os comportamentos (quem ativa, quem volta) são hipóteses codificadas no gerador: o relatório mostra o que o datalake é capaz de responder, não conclusões sobre usuários reais.

Visão geral (`gold/sessoes` e `bi.js`): **6.450 sessões** de **2.997 pessoas**, 4 min 23 s por sessão em média e 2,56 telas por sessão; **1.500 contas novas**, das quais **663 ativaram** (44,2%).

---

## 1. Funil de ativação — onde perdemos usuários?

`gold/funil_ativacao` (total):

| Etapa | Pessoas | Sobre a anterior | Sobre o topo |
| --- | ---: | ---: | ---: |
| Criou a conta (`sign_up`) | 1.500 | — | 100% |
| Cadastrou a usina (`create_group`) | 765 | **51,0%** | 51,0% |
| Cadastrou uma placa (`create_panel`, ativação) | 663 | 86,7% | 44,2% |
| Viu o monitoramento (`view_monitoring`) | 491 | 74,1% | 32,7% |
| Importou leituras (`import_readings`) | 213 | 43,4% | 14,2% |
| Registrou limpeza (`register_cleaning`) | 223 | 104,7% | 14,9% |
| Abriu o relatório (`generate_report`) | 299 | 134,1% | 19,9% |

- **O funil vaza mais entre criar a conta e cadastrar a usina:** metade (49%) das contas novas nunca cria um grupo. Quem cadastra a usina quase sempre cadastra a placa (86,7%).
- As três últimas etapas são opcionais e independentes: como uma etapa conta sem exigir a anterior (enunciado 5.4.5), a conversão passa de 100% (mais gente abre o relatório do que importa leituras).
- **Por dispositivo** (somando os canais): ativam 55,0% das contas criadas no desktop, 41,5% no tablet e só **29,4% no celular**. No celular, só 39,6% chegam a cadastrar a usina.
- **Por canal** (`gold/cadastro_para_ativacao`): indicação 77,5%, newsletter 57,3%, Google orgânico 47,2%, direto 45,6%, LinkedIn 43,9%, Google pago 34,8% e **Instagram 16,3%**.
- **Entrada** (`gold/funil_login`): 74% das sessões que abrem `/login` ou `/register` entram; pelo Instagram, só 42%.
- **Tempo até ativar:** a mediana é de 0,005 dia (~7 minutos). A ativação acontece na primeira visita ou não acontece.

**Recomendação:** atacar o passo conta → usina. Logo depois do cadastro, levar a pessoa para um assistente de primeira usina (coordenadas, potência e orientação numa tela só), com prioridade para o celular, onde a perda é o dobro. Revisar a campanha do Instagram, que traz o tráfego que menos entra e menos ativa.

## 2. Engajamento — o que é usado e o que falta?

`gold/uso_telas`:

| Tela | Visualizações | Tempo médio | Rolagem média |
| --- | ---: | ---: | ---: |
| `/app/home` | 5.267 | 1 min 45 s | 32,7% |
| `/app/monitoramento` | 2.999 | 1 min 37 s | 35,7% |
| `/register` | 2.590 | 1 min 47 s | 33,2% |
| `/login` | 2.580 | 1 min 48 s | 0,6% |
| `/app/cadastro` | 1.301 | **2 min 28 s** | 0% |
| `/app/relatorio` | 836 | 1 min 06 s | 47,3% |
| `/app/limpeza` | 582 | 55 s | 0% |
| `/app/configuracoes` | 342 | 36 s | 0% |

- O Cadastro é a tela em que mais se demora, o que é coerente com o vazamento do funil.
- **Mapa de calor** (`gold/mapa_calor_cliques`): na Início, o link do Monitoramento é o elemento mais clicado (intensidade 1, 57% das sessões); o sino de alertas é aberto em 16% e o Relatório pelo menu em só 3%. No Relatório, 60% das sessões passam da metade da página, mas só **14,7% chegam a 90%** (`gold/mapa_calor_rolagem`).
- **Buscas sem resultado** (`gold/buscas_seletor`): **bateria** (47 buscas), **inversor** (42), **cliente** (35), **consumo** (33) e **fazenda** (33), 190 buscas que não acharam nada. As buscas por nome de usina (galpão, leste, norte, sítio, casa) sempre acham.
- `gold/saidas_downloads`: 279 relatórios impressos (todos de agosto/2026, o mês anterior ao período) e 65 saídas para o Open-Meteo.

**Recomendação:** as buscas sem resultado são o backlog que os usuários escreveram. **Inversor** é a integração automática de leituras (item 5 de `docs/FEATURES-INCOMPLETAS.md`); **bateria** e **consumo** pedem armazenamento e consumo da unidade; **cliente** indica integradores gerenciando usinas de terceiros (compartilhar grupos, item 2). No Relatório, subir para o topo o que está no fim da página.

## 3. Aquisição e retenção — qual canal traz quem fica?

`gold/retencao` (taxa de quem voltou numa sessão iniciada *n* dias ou mais depois do cadastro, entre os elegíveis):

| Canal | D1 | D7 | D14 | Ativação | Abandono |
| --- | ---: | ---: | ---: | ---: | ---: |
| Todos | 45,6% | 31,2% | 19,9% | 44,2% | 7,1% |
| indicação / referral | **76,6%** | **67,7%** | **53,8%** | 77,5% | 7,8% |
| newsletter / email | 61,3% | 41,4% | 41,2% | 57,3% | 8,5% |
| google / organic | 51,6% | 42,9% | 32,2% | 47,2% | **11,8%** |
| direct / (none) | 50,2% | 33,2% | 17,7% | 45,6% | 4,2% |
| linkedin / social | 44,1% | 25,3% | 4,8% | 43,9% | 4,0% |
| google / cpc | 30,9% | 11,4% | 3,4% | 34,8% | 4,8% |
| instagram / social | 18,7% | **4,7%** | 1,0% | 16,3% | 0,0% |

- Elegíveis em D7: 1.125 das 1.500 contas (quem se cadastrou nos últimos 7 dias do período ainda não teve tempo de voltar e não entra).
- **Indicação é o melhor canal em tudo:** ativa 4,8 vezes mais que o Instagram e retém 14 vezes mais em D7.
- O Google pago traz volume (302 contas), mas só 11,4% voltam na semana.
- `gold/taxa_abandono`: 47 das 663 pessoas que ativaram excluíram todas as placas (7,1%), mais no Google orgânico (11,8%). O 0% do Instagram vem de uma base pequena (33 ativações).

**Recomendação:** deslocar verba do Google pago e do Instagram para um programa de indicação (integradores parceiros) e para a newsletter, que retém quatro vezes mais. Acompanhar o abandono do orgânico: quem chega por busca experimenta e sai.

## 4. Previsão — quem está perto de ativar e que perfis existem?

**Propensão de ativação** (`gold/propensao_ativacao`, `gold/metricas_modelo`): regressão logística do Spark ML, uma linha por sessão. As features são só da sessão **antes do primeiro evento de cadastro**: telas, rolagem, cliques, buscas, se viu o Cadastro ou o Monitoramento, alertas, se criou a conta, canal, dispositivo e o histórico da pessoa. Treino e teste são separados **por pessoa**.

| AUC | F1 | Precisão | Recall | Sessões treino / teste | Positivos no teste |
| ---: | ---: | ---: | ---: | ---: | ---: |
| **0,972** | 0,813 | 69,4% | 98,3% | 5.077 / 1.373 | 175 |

- O modelo ordena muito bem quem vai ativar (AUC 0,97) e acha quase todas as sessões que ativam (recall 98%). Mas **as probabilidades não são calibradas**: na faixa de 90–100% a taxa real é 69%, porque o treino dá peso maior à classe rara. O uso certo é o ranking ("as N sessões mais prováveis agora"), não a probabilidade como número absoluto.
- O sinal mais forte é **abrir a tela de Cadastro**. É comportamento legítimo de antes da ação, e não vazamento: o modelo não vê o `create_group` nem o `create_panel`.
- **Ressalva:** no simulador, quem abre o Cadastro quase sempre cadastra, então o AUC alto também reflete o gerador. Com eventos reais o número vai cair, e o primeiro teste honesto é treinar com eles.

**Segmentos** (`gold/segmentos_usuarios`): o K-Means escolheu **K = 2**, com silhueta 0,79.

| Segmento | Pessoas | Sessões | Monitoramentos | Relatórios | Importações | Limpezas | Placas criadas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Exploradores | 2.478 | 1,3 | 0,2 | 0,06 | 0,03 | 0,03 | 0,2 |
| Operadores | 519 | 6,1 | 4,2 | 1,34 | 0,68 | 0,92 | 1,4 |

**Recomendação:** usar a propensão para disparar ajuda no momento certo: um convite para o assistente de primeira usina nas sessões de alta propensão que saíram sem cadastrar. Para os 2.478 exploradores, o objetivo é virar operador; os 519 operadores são a base para entrevistas e para testar as integrações pedidas nas buscas.

---

## Qualidade do dado

`bronze` → `silver` (contagens do pipeline):

| | Eventos |
| --- | ---: |
| Linhas na landing / Bronze | 57.094 |
| **Duplicatas descartadas** (mesmo `event_id`, R5) | **574** |
| Eventos únicos | 56.520 |
| **Rejeitados** (R7) | **1.731** |
| Válidos na Silver | 54.789 |

Rejeitados por motivo (`silver/eventos_rejeitados`):

| Motivo | Eventos | Defeito do gerador que bate |
| --- | ---: | --- |
| timestamp ausente ou futuro | 930 | `ts_nulo` (259) + `ts_futuro` (671) |
| marco fora do padrão | 260 | `scroll_33` (260) |
| evento fora do catálogo | 259 | `evento_fora_catalogo` (259, `share_report`) |
| exclusão órfã | 112 | `exclusao_orfa` (67) + 45 explicados abaixo |
| valor numérico inválido | 90 | `linhas_negativas` (23) + `potencia_zero` (67) |
| ação sem id | 80 | `acao_sem_id` (80) |

As contagens fecham: 56.520 únicos = 54.789 válidos + 1.731 rejeitados, e todo defeito injetado foi encontrado.

**Alguma regra rejeitou dado legítimo? Sim, a da exclusão órfã.** Dos 112 casos, 67 são exclusões de placas que nunca existiram (o defeito injetado). Os outros 45 se dividem assim:
- **35 legítimos:** 15 `delete_panel` e 20 `delete_group` de **usuários antigos**, que já tinham conta e usinas antes do rastreamento começar. O cadastro dessas placas nunca passou pelo datalake, então a exclusão parece órfã sem ser.
- **10 em cascata:** exclusões de placas cujo `create_panel` foi rejeitado (potência zero ou sem id). A placa existe no banco, mas o cadastro não é válido no datalake.

A regra continua útil contra eventos forjados, mas precisa de uma fonte da verdade fora dos eventos. A correção é carregar uma vez o inventário de placas e grupos existentes no início do rastreamento (um *snapshot* do Supabase na landing) e considerar válida a exclusão de qualquer id desse inventário.

**Armadilhas encontradas e como foram tratadas:**

1. **`session_hint` não conta sessões.** São 8.542 valores distintos para 6.450 sessões: ele muda a cada recarga da tela. As sessões são calculadas pela pausa de 30 minutos (R8), e o `session_hint` não entra em cálculo nenhum.
2. **A mesma pessoa em vários navegadores.** 365 pessoas aparecem com 2 a 5 `user_pseudo_id`. O identity stitching (R9) costura por navegador, e as Golds usam `pessoa` (o `user_id` resolvido) para não contar a mesma pessoa várias vezes.
3. **Volta já logada, sem login.** Com a sessão salva do Supabase, o primeiro evento da visita já traz `user_id`. Não dá para exigir `login` antes do `user_id`: o funil de entrada (`funil_login`) só considera as sessões que passaram pelas telas de entrada.
4. **Censura no fim do período.** Quem se cadastrou nos últimos dias parece que não voltou. A retenção só conta como elegíveis em Dn as pessoas com pelo menos *n* dias até o último evento (1.453 em D1, 1.125 em D7, 745 em D14).
5. **Timestamp nulo ou no futuro com partição válida.** A partição é o dia de coleta (o caminho da landing), não o `event_ts`; por isso esses eventos chegam à Silver e são rejeitados com o motivo, em vez de sumirem.
6. **Cascata de rejeição.** Um cadastro inválido invalida a exclusão da mesma placa (os 10 casos acima): a validação da exclusão olha só os cadastros que passaram nas outras regras.
7. **Montagem dupla do React (só nos eventos reais).** Em desenvolvimento, o StrictMode monta os efeitos duas vezes e geraria dois `page_view` com `event_id` diferentes (a deduplicação não pega). O tracker ignora a repetição da mesma tela em menos de 1 segundo.
8. **Eventos de teste.** O teste de ponta a ponta grava na tabela coletora um evento `e2e_teste`, fora do catálogo de propósito: se o coletor o levar, a Silver o rejeita em vez de contaminar as métricas.
