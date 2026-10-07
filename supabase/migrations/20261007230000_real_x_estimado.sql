-- Real x estimado por placa.
-- Estimado: potência pelo clima do Open-Meteo (5 anos + previsão de 7 dias) - o que a placa deveria gerar.
-- Real (simulado, só até a última hora completa): o estimado menos a perda por sujeira desde a última limpeza.
-- ponytail: sem sensores integrados o real é simulado; quando houver, ele passa a vir de leituras_energia.

-- 1. Previsão de 7 dias (antes 3). Igual à versão anterior, só muda forecast_days.
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
begin
    select g.latitude, g.longitude, pl.inclinacao, pl.azimute
      into p
      from public.placas pl
      join public.grupos_solares g on g.id = pl.grupo_id
     where pl.id = p_placa_id;

    -- No Open-Meteo o azimute é 0 = Sul, -90 = Leste, 90 = Oeste, ±180 = Norte; o nosso é 0 = Norte, 90 = Leste.
    url := format(
        '%s?latitude=%s&longitude=%s&tilt=%s&azimuth=%s&hourly=global_tilted_irradiance,temperature_2m&timezone=UTC&%s',
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
    insert into public.clima_horario (placa_id, data_hora, irradiancia, temperatura)
    select p_placa_id, (h.t || 'Z')::timestamptz - interval '1 hour', g.v::real, tp.v::real
      from jsonb_array_elements_text(dados -> 'hourly' -> 'time') with ordinality h(t, i)
      join jsonb_array_elements_text(dados -> 'hourly' -> 'global_tilted_irradiance') with ordinality g(v, i) using (i)
      join jsonb_array_elements_text(dados -> 'hourly' -> 'temperature_2m') with ordinality tp(v, i) using (i)
     where g.v is not null and tp.v is not null
    on conflict (placa_id, data_hora) do update
        set irradiancia = excluded.irradiancia, temperatura = excluded.temperatura;
end;
$$;

-- 2. Perda por sujeira (0 a 0,20) num instante: cresce 0,2 %/dia desde a última limpeza; sem limpeza, está no limite.
-- ponytail: taxa e limite fixos e sem chuva limpando; viram colunas da placa (ou entram no modelo) quando houver dado para calibrar.
create function public.perda_sujeira_em(p_placa_id bigint, instante timestamptz)
returns double precision
language sql
stable
set search_path = ''
as $$
    select least(0.20, coalesce(0.002 * extract(epoch from instante - max(l.data_limpeza)) / 86400, 0.20))::float8
      from public.limpezas l
     where l.placa_id = p_placa_id
       and l.data_limpeza <= instante;
$$;

-- Coluna calculada na API: placas?select=...,perda_sujeira (perda agora).
create function public.perda_sujeira(placa public.placas)
returns double precision
language sql
stable
set search_path = ''
as $$
    select public.perda_sujeira_em(placa.id, now());
$$;

-- 3. Gráfico: medida = real (simulado) e estimada, com a mesma assinatura e as mesmas colunas de antes.
-- No balde que ainda não terminou, o real conta só as horas completas (energia até agora).
-- ponytail: uma busca de limpeza por hora; pré-calcular a perda por dia se a visão Ano ficar lenta.
create or replace function public.dashboard_metricas(
    granularidade text default 'dia',
    data_inicio timestamptz default null,
    data_fim timestamptz default null,
    grupo bigint default null,
    placa bigint default null
)
returns table (x timestamptz, medida numeric, estimada numeric, medida_wh numeric, estimada_wh numeric)
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

    -- Cada linha de clima é 1 hora: W médio da hora = Wh. Potência do conjunto = soma da média de cada placa.
    return query
        with alvo as (
            select p.id, p.potencia_wp, p.coef_temperatura
              from public.placas p
             where (grupo is null or p.grupo_id = grupo)
               and (placa is null or p.id = placa)
               and p.potencia_wp is not null
        ), horas as (
            select date_trunc(unidade, c.data_hora at time zone 'America/Sao_Paulo') as b,
                   c.placa_id,
                   e.w,
                   case when c.data_hora < date_trunc('hour', now())
                        then e.w * (1 - public.perda_sujeira_em(c.placa_id, c.data_hora))
                   end as r
              from public.clima_horario c
              join alvo on alvo.id = c.placa_id
             cross join lateral (
                   select public.potencia_estimada(alvo.potencia_wp, alvo.coef_temperatura, c.irradiancia, c.temperatura) as w
             ) e
             where c.data_hora between inicio and fim
        ), por_placa as (
            select b,
                   avg(w) as est_w,
                   sum(w) as est_wh,
                   case when count(r) > 0 then sum(r) / count(*) end as real_w,
                   sum(r) as real_wh
              from horas
             group by b, placa_id
        )
        select b at time zone 'America/Sao_Paulo',
               round(sum(real_w)::numeric, 2), round(sum(est_w)::numeric, 2),
               round(sum(real_wh)::numeric, 2), round(sum(est_wh)::numeric, 2)
          from por_placa
         group by b
         order by 1;
end;
$$;

-- 4. Cards da Home: real de hoje (simulado) e o estimado das mesmas horas, para comparar.
create or replace function public.dashboard_resumo()
returns json
language sql
stable
set search_path = ''
as $$
    with hoje as (
        select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as inicio
    ), estimado as (
        -- cada linha de clima_horario é 1 hora: soma de W × 1 h = Wh
        select c.placa_id, c.data_hora, public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura) as w
          from public.clima_horario c
          join public.placas p on p.id = c.placa_id
         cross join hoje
         where p.potencia_wp is not null
           and c.data_hora >= hoje.inicio
           and c.data_hora < hoje.inicio + interval '2 days'
    ), ate_agora as (
        select e.* from estimado e where e.data_hora < date_trunc('hour', now())
    )
    select json_build_object(
        'totalGeradoHoje', (select coalesce(sum(a.w * (1 - public.perda_sujeira_em(a.placa_id, a.data_hora))), 0) from ate_agora a),
        'estimadoAteAgora', (select coalesce(sum(a.w), 0) from ate_agora a),
        'estimadoHoje', (select coalesce(sum(e.w), 0) from estimado e cross join hoje where e.data_hora < hoje.inicio + interval '1 day'),
        'previsaoAmanha', (select coalesce(sum(e.w), 0) from estimado e cross join hoje where e.data_hora >= hoje.inicio + interval '1 day'),
        'potenciaAgora', (select coalesce(sum(e.w), 0) from estimado e where e.data_hora = date_trunc('hour', now())),
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

revoke execute on function public.perda_sujeira_em(bigint, timestamptz) from public, anon;
revoke execute on function public.perda_sujeira(public.placas) from public, anon;
