-- Configurações do usuário: editar o nome e as preferências (alertas, limiares e padrões do cadastro).
-- 1. colunas em usuarios, com os valores que antes eram fixos como padrão;
-- 2. o usuário altera só o próprio nome e as preferências (nunca role nem email);
-- 3. recomendacoes_limpeza e gerar_alertas passam a usar as preferências do dono do grupo.

-- 1. Preferências. Os limiares são frações (0,10 = 10 %).
alter table public.usuarios
    add constraint ck_usuarios_nome check (btrim(nome) <> ''),
    add column alerta_limpeza boolean not null default true,
    add column alerta_previsao boolean not null default true,
    add column alerta_desempenho boolean not null default true,
    -- perda por sujeira (vai de 0 a 20 %) a partir da qual a limpeza é recomendada
    add column limiar_limpeza numeric(3, 2) not null default 0.10 check (limiar_limpeza between 0.01 and 0.20),
    -- previsão baixa: amanhã abaixo desta fração da média de 5 anos
    add column limiar_previsao numeric(3, 2) not null default 0.60 check (limiar_previsao between 0.10 and 0.95),
    -- pré-preenchem tarifa_kwh e custo_limpeza do "Novo grupo"
    add column tarifa_padrao numeric(8, 4) check (tarifa_padrao > 0),
    add column custo_limpeza_padrao numeric(10, 2) check (custo_limpeza_padrao >= 0);

-- 2. O grant por coluna é o que impede trocar role/email (a política só limita a linha).
--    Os grants padrão do Supabase davam update na tabela toda; sem política de update ele não valia até aqui.
revoke all on public.usuarios from anon, authenticated;
grant select on public.usuarios to authenticated;
grant update (nome, alerta_limpeza, alerta_previsao, alerta_desempenho, limiar_limpeza, limiar_previsao,
              tarifa_padrao, custo_limpeza_padrao) on public.usuarios to authenticated;

create policy "usuario altera o proprio perfil" on public.usuarios
    for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

-- 3a. Recomendação de limpeza: igual à de 20261008110000, mas o "limpar a partir de" é o limiar_limpeza do dono.
-- A RLS de usuarios só mostra a própria linha: o ADMIN vendo grupo de outro dono usa o padrão (10 %).
create or replace function public.recomendacoes_limpeza()
returns table (
    placa_id bigint,
    perda double precision,
    perda_kwh_semana numeric,
    perda_rs_semana numeric,
    custo_limpeza numeric,
    chuva_prevista_em date,
    dias_para_compensar numeric,
    limpar boolean,
    motivo text
)
language sql
stable
set search_path = ''
as $$
    with hoje as (
        select (now() at time zone 'America/Sao_Paulo')::date as dia
    ), base as (
        select p.id,
               public.perda_sujeira_em(p.id, now()) as perda,
               coalesce(u.limiar_limpeza, 0.10) as limiar,
               gs.custo_limpeza,
               (select sum(g.estimada_wh)
                  from public.geracao_horaria g
                 where g.placa_id = p.id
                   and g.data_hora >= date_trunc('hour', now())
                   and g.data_hora < now() + interval '7 days') as estimada_wh,
               gs.tarifa_kwh,
               chuva.dia as chuva_dia,
               chuva.precipitacao as chuva_mm,
               chuva.dia - hoje.dia as dias_ate_chuva
          from public.placas p
          join public.grupos_solares gs on gs.id = p.grupo_id
          left join public.usuarios u on u.id = gs.dono_id
         cross join hoje
          left join lateral (
                select c.dia, c.precipitacao
                  from public.chuvas_que_lavam c
                 where c.placa_id = p.id and c.dia >= hoje.dia and c.dia < hoje.dia + 7
                 order by c.dia
                 limit 1
          ) chuva on true
    ), valores as (
        select b.*,
               round((b.estimada_wh * b.perda / 1000)::numeric, 1) as kwh,
               round((b.estimada_wh * b.perda / 1000 * b.tarifa_kwh)::numeric, 2) as rs
          from base b
         where b.estimada_wh is not null -- só placas com previsão
    ), decisao as (
        select v.*,
               ceil(nullif(v.custo_limpeza, 0) * 7 / nullif(v.rs, 0)) as dias -- limpeza grátis: não precisa se pagar
          from valores v
    )
    select d.id,
           d.perda,
           d.kwh,
           d.rs,
           d.custo_limpeza,
           d.chuva_dia,
           d.dias,
           d.perda >= d.limiar and coalesce(d.dias_ate_chuva >= 3, true) and coalesce(d.dias <= 30, true),
           case
               when d.perda < d.limiar then format('Perda de %s%%: ainda não precisa limpar', round((d.perda * 100)::numeric))
               when d.dias_ate_chuva < 3 then format(
                   'Chuva prevista para %s (%s mm): espere',
                   case d.dias_ate_chuva
                       when 0 then 'hoje'
                       when 1 then 'amanhã'
                       else (array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'])[extract(dow from d.chuva_dia)::int + 1]
                   end,
                   round(d.chuva_mm::numeric))
               when d.dias > 30 then format('Limpeza (R$ %s) só se paga em %s dias: espere', replace(d.custo_limpeza::text, '.', ','), d.dias)
               else 'Limpar recupera ~' || replace(d.kwh::text, '.', ',') || ' kWh/semana'
                    || coalesce(' (R$ ' || replace(d.rs::text, '.', ',') || ')', '')
                    || coalesce('; paga-se em ' || d.dias || case when d.dias = 1 then ' dia' else ' dias' end, '')
           end
      from decisao d
     order by d.perda desc, d.id;
$$;

-- 3b. Alertas: igual a 20261008140000, mas só os tipos que o dono deixou ligados e a previsão baixa
--     pelo limiar_previsao dele (security definer: vê a linha de usuarios de todos os donos).
create or replace function public.gerar_alertas()
returns void
language sql
security definer
set search_path = ''
as $$
    with hoje as (
        select (now() at time zone 'America/Sao_Paulo')::date as dia
    ), ref as (
        select hoje.dia + 1 as amanha,
               (hoje.dia + 1)::timestamp at time zone 'America/Sao_Paulo' as inicio,
               (hoje.dia + 2)::timestamp at time zone 'America/Sao_Paulo' as fim,
               date_trunc('week', hoje.dia)::date as semana
          from hoje
    ), donos as (
        select g.id as grupo_id, u.alerta_limpeza, u.alerta_previsao, u.alerta_desempenho, u.limiar_previsao
          from public.grupos_solares g
          join public.usuarios u on u.id = g.dono_id
    )
    insert into public.alertas (grupo_id, placa_id, tipo, mensagem, referencia)
    select p.grupo_id, p.id, 'LIMPEZA', r.motivo, ref.semana
      from public.recomendacoes_limpeza() r
      join public.placas p on p.id = r.placa_id
      join donos d on d.grupo_id = p.grupo_id
     cross join ref
     where r.limpar and p.status = 'ATIVA' and d.alerta_limpeza
    union all
    select p.grupo_id, p.id, 'DESEMPENHO',
           format('%s rendeu %s%% do estimado nos últimos 7 dias; o grupo, %s%%',
                  p.modelo, round(r.desempenho * 100), round(r.desempenho_grupo * 100)),
           ref.semana
      from public.ranking_placas(now() - interval '7 days', now()) r
      join public.placas p on p.id = r.placa_id
      join donos d on d.grupo_id = p.grupo_id
     cross join ref
     where r.anomalia and p.status = 'ATIVA' and d.alerta_desempenho
    union all
    select g.id, null, 'PREVISAO_BAIXA',
           format('Amanhã (%s) a previsão é de %s kWh: %s%% da média de %s %s para o dia (%s kWh)',
                  to_char(ref.amanha, 'DD/MM'), replace(round((prev.wh / 1000)::numeric, 1)::text, '.', ','),
                  round((prev.wh / h.media_wh * 100)::numeric), h.anos, case h.anos when 1 then 'ano' else 'anos' end,
                  replace(round(h.media_wh / 1000, 1)::text, '.', ',')),
           ref.amanha
      from public.grupos_solares g
      join donos d on d.grupo_id = g.id
     cross join ref
     cross join lateral (
           select sum(gh.estimada_wh) as wh
             from public.geracao_horaria gh
            where gh.grupo_id = g.id and gh.data_hora >= ref.inicio and gh.data_hora < ref.fim
     ) prev
     cross join lateral public.dashboard_historico('dia', ref.inicio, ref.fim - interval '1 millisecond', g.id) h
     where g.status = 'ATIVO' and d.alerta_previsao and prev.wh < d.limiar_previsao * h.media_wh
    on conflict do nothing;
$$;
