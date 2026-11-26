-- BI do datalake de uso no app em produção, só para ADMIN.
-- O datalake (datalake/pipeline/exportar_bi.py e exportar_mapa_calor.py) grava aqui, com a service key,
-- o mesmo JSON que antes ia só para os arquivos frontend/public/bi/bi.js e mapa_calor.js. Esses arquivos
-- ficam fora do git, então a Vercel não os tinha: o painel "Uso da plataforma" e o mapa de calor só
-- funcionavam na máquina de quem rodou o datalake.
--   nome = 'bi'          -> window.SOLARVISION_BI (página /app/uso)
--   nome = 'mapa_calor'  -> window.MAPA_CALOR (overlay do mapa de calor)
-- Só agregados: nenhuma linha por pessoa ou por sessão sai do datalake.

create table public.bi_exportacoes (
    nome text primary key,
    dados jsonb not null,
    gerado_em timestamptz not null default now(),
    constraint ck_bi_exportacoes_nome check (nome in ('bi', 'mapa_calor')),
    constraint ck_bi_exportacoes_objeto check (jsonb_typeof(dados) = 'object')
);

alter table public.bi_exportacoes enable row level security;

-- Leitura só de ADMIN (a mesma e_admin() das outras tabelas); escrita só pela service key, que ignora a RLS.
create policy "admin lê o bi do datalake" on public.bi_exportacoes
    for select to authenticated
    using ((select public.e_admin()));

revoke all on public.bi_exportacoes from anon, authenticated;
grant select on public.bi_exportacoes to authenticated;
