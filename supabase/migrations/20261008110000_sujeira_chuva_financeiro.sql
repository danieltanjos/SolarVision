-- Chuva limpando as placas, sujeira desde a instalação, valores em R$/CO₂ e recomendação de limpeza.

-- 1. Dias em que a chuva lava as placas: ≥ 5 mm no dia (fuso de São Paulo), a placa fica limpa no fim do dia.
-- Tabela à parte porque perda_sujeira_em roda por hora e por placa: aqui a última chuva é uma busca no índice.
-- ponytail: 5 mm fixos e limpeza total; viram limpeza parcial (proporcional à chuva) quando houver dado para calibrar.
create table public.chuvas_que_lavam (
    placa_id bigint not null references public.placas (id) on delete cascade,
    dia date not null,          -- no fuso de São Paulo
    precipitacao real not null, -- mm no dia
    primary key (placa_id, dia)
);

alter table public.chuvas_que_lavam enable row level security;
create policy "chuvas das placas visiveis" on public.chuvas_que_lavam
    for select to authenticated
    using (placa_id in (select p.id from public.placas p));
revoke all on public.chuvas_que_lavam from anon, authenticated;
grant select on public.chuvas_que_lavam to authenticated;

-- 2. O clima passa a trazer a chuva (mm na hora) e recalcula os dias que lavam a partir do 1º dia recebido.
create or replace function public.atualizar_clima_placa(p_placa_id bigint, historico boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    p record;
    url text;
    resposta record;
    dados jsonb;
    desde date;
begin
    select g.latitude, g.longitude, pl.inclinacao, pl.azimute
      into p
      from public.placas pl
      join public.grupos_solares g on g.id = pl.grupo_id
     where pl.id = p_placa_id;

    -- No Open-Meteo o azimute é 0 = Sul, -90 = Leste, 90 = Oeste, ±180 = Norte; o nosso é 0 = Norte, 90 = Leste.
    url := format(
        '%s?latitude=%s&longitude=%s&tilt=%s&azimuth=%s&hourly=global_tilted_irradiance,temperature_2m,precipitation&timezone=UTC&%s',
        case when historico then 'https://archive-api.open-meteo.com/v1/archive' else 'https://api.open-meteo.com/v1/forecast' end,
        p.latitude, p.longitude, p.inclinacao, p.azimute - 180,
        case when historico
             then format('start_date=%s&end_date=%s', (current_date - interval '5 years')::date, current_date)
             else 'past_days=3&forecast_days=7'
        end
    );

    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');
    select status, content into resposta from extensions.http_get(url);
    if resposta.status <> 200 then
        raise exception 'Open-Meteo respondeu %: %', resposta.status, left(resposta.content, 300);
    end if;
    dados := resposta.content::jsonb;

    -- O Open-Meteo marca cada hora pelo FIM do intervalo (média da hora anterior); guardamos o início.
    insert into public.clima_horario (placa_id, data_hora, irradiancia, temperatura, precipitacao)
    select p_placa_id, (h.t || 'Z')::timestamptz - interval '1 hour', g.v::real, tp.v::real, pr.v::real
      from jsonb_array_elements_text(dados -> 'hourly' -> 'time') with ordinality h(t, i)
      join jsonb_array_elements_text(dados -> 'hourly' -> 'global_tilted_irradiance') with ordinality g(v, i) using (i)
      join jsonb_array_elements_text(dados -> 'hourly' -> 'temperature_2m') with ordinality tp(v, i) using (i)
      left join jsonb_array_elements_text(dados -> 'hourly' -> 'precipitation') with ordinality pr(v, i) using (i)
     where g.v is not null and tp.v is not null
    on conflict (placa_id, data_hora) do update
        set irradiancia = excluded.irradiancia, temperatura = excluded.temperatura, precipitacao = excluded.precipitacao;

    -- Horas sem chuva informada (null) não contam: sum ignora null e o dia sem nenhum valor fica de fora.
    desde := (((dados #>> '{hourly,time,0}') || 'Z')::timestamptz - interval '1 hour') at time zone 'America/Sao_Paulo';
    delete from public.chuvas_que_lavam where placa_id = p_placa_id and dia >= desde;
    insert into public.chuvas_que_lavam (placa_id, dia, precipitacao)
    select p_placa_id, (c.data_hora at time zone 'America/Sao_Paulo')::date, sum(c.precipitacao)
      from public.clima_horario c
     where c.placa_id = p_placa_id
       and c.data_hora >= desde::timestamp at time zone 'America/Sao_Paulo'
     group by 2
    having sum(c.precipitacao) >= 5;
end;
$$;

-- Recarrega o histórico das placas que já tinham clima, agora com a chuva: clima_atualizado_em null
-- passa pela espera de 10 min do sincronizar_clima e entra primeiro na fila (5 placas por minuto).
update public.placas
   set clima_historico_em = null, clima_atualizado_em = null
 where clima_historico_em is not null;

-- 3. Perda por sujeira (0 a 0,20) num instante: cresce 0,2 %/dia desde o evento mais recente que limpou a placa
--    (limpeza registrada, chuva que lava ou instalação); sem nenhum, está no limite. Mesma assinatura de antes.
-- Roda por hora e por placa em geracao_horaria e, com RLS, cada busca refazia placas → grupos → e_admin()
-- (visão Ano de todas as placas: 14 s). Security definer com a regra de "dono gerencia seus grupos" repetida
-- abaixo; placa de outro dono devolve null. Se a política dos grupos mudar, mude aqui também.
-- Sem usuário no JWT só chegam pg_cron/postgres e service_role (anon não executa), que já veem tudo.
create or replace function public.perda_sujeira_em(p_placa_id bigint, instante timestamptz)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
    select least(0.20, coalesce(0.002 * extract(epoch from instante - greatest(
        (select max(l.data_limpeza)
           from public.limpezas l
          where l.placa_id = p.id and l.data_limpeza <= instante),
        (select (max(c.dia) + 1)::timestamp at time zone 'America/Sao_Paulo' -- fim do dia da chuva
           from public.chuvas_que_lavam c
          where c.placa_id = p.id and c.dia < (instante at time zone 'America/Sao_Paulo')::date),
        case when p.instalada_em::timestamp at time zone 'America/Sao_Paulo' <= instante
             then p.instalada_em::timestamp at time zone 'America/Sao_Paulo'
        end
    )) / 86400, 0.20))::float8
      from public.placas p
      join public.grupos_solares g on g.id = p.grupo_id
     where p.id = p_placa_id
       and ((select auth.uid()) is null or g.dono_id = (select auth.uid()) or (select public.e_admin()));
$$;

-- 4. Valores do período (seleção do Monitoramento): energia real, economia em R$, perda por sujeira e CO₂ evitado.
-- CO₂: fator médio anual do SIN de 2023, 0,0385 tCO₂/MWh = kgCO₂/kWh (MCTI, "Fator de emissão de CO2 na geração
-- de energia elétrica no Brasil em 2023 é o menor em 12 anos", gov.br/mcti, fev/2024).
-- ponytail: fator fixo; trocar pelo do ano mais recente publicado pelo MCTI (ou pelo fator mensal) quando atualizar.
create function public.dashboard_financeiro(
    data_inicio timestamptz,
    data_fim timestamptz,
    grupo bigint default null,
    placa bigint default null
)
returns json
language sql
stable
set search_path = ''
as $$
    -- materialized: o real (com a sujeira) é calculado uma vez por hora, não uma vez por soma
    with horas as materialized (
        select g.estimada_wh, g.real_wh, gs.tarifa_kwh
          from public.geracao_horaria g
          join public.grupos_solares gs on gs.id = g.grupo_id
         where g.data_hora between data_inicio and data_fim
           and (grupo is null or g.grupo_id = grupo)
           and (placa is null or g.placa_id = placa)
    )
    select json_build_object(
        'realWh', round(coalesce(sum(h.real_wh), 0)::numeric, 2),
        -- R$ só dos grupos com tarifa (sum ignora as horas sem tarifa)
        'economia', round(coalesce(sum(h.real_wh * h.tarifa_kwh / 1000), 0)::numeric, 2),
        -- perda = estimado − real, só nas horas que já têm real
        'perdaSujeiraWh', round(coalesce(sum(h.estimada_wh - h.real_wh), 0)::numeric, 2),
        'perdaSujeira', round(coalesce(sum((h.estimada_wh - h.real_wh) * h.tarifa_kwh / 1000), 0)::numeric, 2),
        'co2EvitadoKg', round((coalesce(sum(h.real_wh), 0) / 1000 * 0.0385)::numeric, 2),
        'placasSemTarifa', (
            select count(*)
              from public.placas p
              join public.grupos_solares gs on gs.id = p.grupo_id
             where gs.tarifa_kwh is null
               and (grupo is null or p.grupo_id = grupo)
               and (placa is null or p.id = placa)
        )
    )
      from horas h;
$$;

-- 5. Recomendação de limpeza por placa visível: quanto se perde na próxima semana sem limpar
--    (estimado da previsão × perda atual), se vem chuva que lava e em quantos dias a limpeza se paga.
-- limpar: perda ≥ 10 % (LIMPAR_A_PARTIR em lib/placas.js), sem chuva que lava nos próximos 3 dias
--         e sem custo informado ou pagando-se em até 30 dias.
-- ponytail: perda constante na semana (cresce 0,2 %/dia de verdade); basta para decidir limpar ou esperar.
create function public.recomendacoes_limpeza()
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
           d.perda >= 0.10 and coalesce(d.dias_ate_chuva >= 3, true) and coalesce(d.dias <= 30, true),
           case
               when d.perda < 0.10 then format('Perda de %s%%: ainda não precisa limpar', round((d.perda * 100)::numeric))
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

revoke execute on function public.dashboard_financeiro(timestamptz, timestamptz, bigint, bigint) from public, anon;
revoke execute on function public.recomendacoes_limpeza() from public, anon;
