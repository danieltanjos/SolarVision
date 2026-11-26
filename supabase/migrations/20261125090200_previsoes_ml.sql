-- Previsão da energia dos próximos dias pelo modelo do datalake (datalake/pipeline/gold_previsao_energia.py e
-- prever_energia.py). O modelo corrige a estimativa física do app (potencia_estimada com a previsão do tempo)
-- pela razão real ÷ estimado aprendida com a geração medida; p10/p90 é a faixa em que a geração real ficou
-- 80% das vezes no teste. O datalake grava com a service key; o app lê, cada dono só as próprias placas.

create table public.previsoes_ml (
    placa_id bigint not null references public.placas (id) on delete cascade,
    dia date not null,                          -- no fuso de São Paulo
    estimada_wh double precision not null,      -- a estimativa física do app, para comparar
    prevista_wh double precision not null,      -- estimada × razão prevista pelo modelo
    p10_wh double precision,
    p90_wh double precision,
    modelo text not null,
    gerada_em timestamptz not null default now(),
    primary key (placa_id, dia),
    constraint ck_previsoes_ml_valores check (estimada_wh >= 0 and prevista_wh >= 0)
);

alter table public.previsoes_ml enable row level security;
-- As placas visíveis já passam pela RLS de placas (o dono, ou ADMIN), como em chuvas_que_lavam.
create policy "previsões das placas visíveis" on public.previsoes_ml
    for select to authenticated
    using (placa_id in (select p.id from public.placas p));

revoke all on public.previsoes_ml from anon, authenticated;
grant select on public.previsoes_ml to authenticated;
