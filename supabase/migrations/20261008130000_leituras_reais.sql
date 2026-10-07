-- Geração REAL medida: o dono importa as leituras (CSV do inversor/datalogger) e elas substituem o real simulado.
-- 1. leituras_energia: uma leitura por placa e instante (reimportar o mesmo arquivo não duplica) e escrita pelo dono;
-- 2. geracao_horaria: nas horas com leituras, real = energia medida; senão, o simulado de antes;
-- 3. dashboard_metricas/dashboard_resumo dizem quanto do real veio do sensor;
-- 4. ranking_placas: kWh/kWp e desempenho de cada placa contra a mediana do grupo (anomalias).

-- 1. Leituras. O unique (placa_id, data_hora) é o índice composto usado por geracao_horaria e o alvo do upsert;
-- os índices de uma coluna só ficaram redundantes.
alter table public.leituras_energia add constraint uq_leituras_energia_placa_data_hora unique (placa_id, data_hora);
drop index public.idx_leituras_energia_placa_id;
drop index public.idx_leituras_energia_data_hora;

drop policy "leituras das placas visiveis" on public.leituras_energia;
create policy "leituras das placas visiveis" on public.leituras_energia
    for all to authenticated
    using (placa_id in (select p.id from public.placas p))
    with check (placa_id in (select p.id from public.placas p));

grant select, insert, update, delete on public.leituras_energia to authenticated;

-- 2. Geração por hora: mesmas colunas de antes + real_medido no fim.
-- Cada leitura é a potência média (W) do intervalo que começa no seu instante; energia da hora = Σ W × intervalo.
-- O intervalo é o espaçamento das leituras dentro da hora (5 min no CSV de referência), limitado a 60 min ÷ nº de leituras
-- (hora inteira coberta): assim leituras de 1, 5 ou 15 min dão a mesma energia, e uma única leitura vale pela hora.
-- ponytail: intervalo inferido por hora; lacuna no meio da hora é preenchida pela média das demais e uma leitura isolada
--           conta a hora inteira. Gravar o intervalo de cada leitura se aparecer datalogger irregular.
create or replace view public.geracao_horaria with (security_invoker = true) as
select c.placa_id,
       p.grupo_id,
       c.data_hora,
       public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura) as estimada_wh,
       case when c.data_hora < date_trunc('hour', now())
            then coalesce(m.wh::float8,
                          public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura)
                          * (1 - public.perda_sujeira_em(c.placa_id, c.data_hora)))
       end as real_wh,
       c.precipitacao,
       c.data_hora < date_trunc('hour', now()) and m.wh is not null as real_medido
  from public.clima_horario c
  join public.placas p on p.id = c.placa_id
  left join lateral (
        select sum(l.wats_gerados)
               * least(60.0 / nullif(count(*), 0),
                       extract(epoch from max(l.data_hora) - min(l.data_hora)) / 60 / nullif(count(*) - 1, 0))
               / 60 as wh
          from public.leituras_energia l
         where l.placa_id = c.placa_id
           and l.data_hora >= c.data_hora
           and l.data_hora < c.data_hora + interval '1 hour'
       ) m on true
 where p.potencia_wp is not null;

-- 3. Gráfico: colunas de antes + medida_sensor_wh (parte do real que veio de leituras; = medida_wh se tudo foi medido).
-- Mudar o tipo de retorno exige drop + create.
drop function public.dashboard_metricas(text, timestamptz, timestamptz, bigint, bigint);

create function public.dashboard_metricas(
    granularidade text default 'dia',
    data_inicio timestamptz default null,
    data_fim timestamptz default null,
    grupo bigint default null,
    placa bigint default null
)
returns table (x timestamptz, medida numeric, estimada numeric, medida_wh numeric, estimada_wh numeric, medida_sensor_wh numeric)
language plpgsql
stable
set search_path = ''
as $$
declare
    unidade text := case lower(coalesce(nullif(btrim(granularidade), ''), 'dia'))
        when 'hora' then 'hour'
        when 'dia' then 'day'
        when 'semana' then 'week'
        when 'mes' then 'month'
    end;
    inicio timestamptz := coalesce(data_inicio, now() - interval '7 days');
    fim timestamptz := coalesce(data_fim, now());
begin
    if unidade is null then
        raise exception 'Granularidade inválida. Use hora, dia, semana ou mes.' using errcode = '22023';
    end if;
    if inicio > fim then
        raise exception 'dataInicio deve ser anterior ou igual a dataFim.' using errcode = '22023';
    end if;

    -- Potência do conjunto no balde = soma da potência média de cada placa.
    -- No balde que ainda não terminou, o real conta só as horas completas (energia até agora).
    -- Agregados idênticos são calculados uma vez só: sum(real_wh) não reavalia a sujeira; no filter, o real_wh
    -- só é avaliado nas horas medidas (sem chamar perda_sujeira_em).
    return query
        with por_placa as (
            select date_trunc(unidade, g.data_hora at time zone 'America/Sao_Paulo') as b,
                   avg(g.estimada_wh) as est_w,
                   sum(g.estimada_wh) as est_wh,
                   sum(g.real_wh) / count(*) as real_w,
                   sum(g.real_wh) as real_wh,
                   sum(g.real_wh) filter (where g.real_medido) as sensor_wh
              from public.geracao_horaria g
             where g.data_hora between inicio and fim
               and (grupo is null or g.grupo_id = grupo)
               and (placa is null or g.placa_id = placa)
             group by 1, g.placa_id
        )
        select pp.b at time zone 'America/Sao_Paulo',
               round(sum(pp.real_w)::numeric, 2), round(sum(pp.est_w)::numeric, 2),
               round(sum(pp.real_wh)::numeric, 2), round(sum(pp.est_wh)::numeric, 2),
               round(sum(pp.sensor_wh)::numeric, 2)
          from por_placa pp
         group by pp.b
         order by 1;
end;
$$;

revoke execute on function public.dashboard_metricas(text, timestamptz, timestamptz, bigint, bigint) from public, anon;

-- Cards da Home: chaves de antes + geradoHojeSensor (parte de totalGeradoHoje que veio de leituras).
create or replace function public.dashboard_resumo()
returns json
language sql
stable
set search_path = ''
as $$
    with hoje as (
        select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as inicio
    ), dois_dias as (
        select g.data_hora, g.estimada_wh, g.real_wh, g.real_medido, g.data_hora < hoje.inicio + interval '1 day' as e_hoje
          from public.geracao_horaria g
         cross join hoje
         where g.data_hora >= hoje.inicio
           and g.data_hora < hoje.inicio + interval '2 days'
    )
    select json_build_object(
        'totalGeradoHoje', (select coalesce(sum(d.real_wh), 0) from dois_dias d where d.e_hoje),
        'geradoHojeSensor', (select coalesce(sum(d.real_wh), 0) from dois_dias d where d.e_hoje and d.real_medido),
        'estimadoAteAgora', (select coalesce(sum(d.estimada_wh), 0) from dois_dias d where d.e_hoje and d.real_wh is not null),
        'estimadoHoje', (select coalesce(sum(d.estimada_wh), 0) from dois_dias d where d.e_hoje),
        'previsaoAmanha', (select coalesce(sum(d.estimada_wh), 0) from dois_dias d where not d.e_hoje),
        'potenciaAgora', (select coalesce(sum(d.estimada_wh), 0) from dois_dias d where d.data_hora = date_trunc('hour', now())),
        'placasAtivas', (select count(*) from public.placas where status = 'ATIVA'),
        'ultimaLimpeza', (
            select json_build_object(
                'id', l.id,
                'placaId', l.placa_id,
                'placaModelo', p.modelo,
                'dataLimpeza', l.data_limpeza,
                'observacao', l.observacao
            )
              from public.limpezas l
              join public.placas p on p.id = l.placa_id
             order by l.data_limpeza desc, l.id desc
             limit 1
        )
    );
$$;

-- 4. Ranking das placas no período.
-- kwh_kwp = energia real ÷ potência instalada (Wh/Wp = kWh/kWp): compara placas de tamanhos diferentes.
-- desempenho = real ÷ estimado nas horas com real (estimada_wh devolvido é o dessas horas).
-- No mesmo grupo o clima é o mesmo: quem rende mais de 10 p.p. abaixo da mediana tem sombra, defeito ou sujeira.
create function public.ranking_placas(data_inicio timestamptz, data_fim timestamptz, grupo bigint default null)
returns table (
    placa_id bigint,
    real_wh numeric,
    estimada_wh numeric,
    kwh_kwp numeric,
    desempenho numeric,
    desempenho_grupo numeric,
    anomalia boolean
)
language sql
stable
set search_path = ''
as $$
    with por_placa as (
        select g.placa_id, g.grupo_id,
               sum(g.real_wh) as real_wh,
               sum(g.estimada_wh) filter (where g.real_wh is not null) as estimada_wh,
               sum(g.real_wh) / nullif(sum(g.estimada_wh) filter (where g.real_wh is not null), 0) as desempenho
          from public.geracao_horaria g
         where g.data_hora between ranking_placas.data_inicio and ranking_placas.data_fim
           and (ranking_placas.grupo is null or g.grupo_id = ranking_placas.grupo)
         group by g.placa_id, g.grupo_id
    ), mediana as (
        select pp.grupo_id, percentile_cont(0.5) within group (order by pp.desempenho) as desempenho, count(pp.desempenho) as placas
          from por_placa pp
         group by pp.grupo_id
    )
    select pp.placa_id,
           round(pp.real_wh::numeric, 2),
           round(pp.estimada_wh::numeric, 2),
           round(pp.real_wh::numeric / p.potencia_wp, 3),
           round(pp.desempenho::numeric, 4),
           round(m.desempenho::numeric, 4),
           coalesce(m.placas >= 2 and pp.desempenho < m.desempenho - 0.10, false)
      from por_placa pp
      join public.placas p on p.id = pp.placa_id
      join mediana m on m.grupo_id = pp.grupo_id
     order by 4 desc nulls last;
$$;

revoke execute on function public.ranking_placas(timestamptz, timestamptz, bigint) from public, anon;
