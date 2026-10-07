-- Monitoramento por grupo ou por placa: filtros opcionais e a energia (Wh) de cada balde.
-- Chamadas antigas (só granularidade/data_inicio/data_fim) continuam funcionando: os filtros têm default null.
drop function public.dashboard_metricas(text, timestamptz, timestamptz);

create function public.dashboard_metricas(
    granularidade text default 'dia',
    data_inicio timestamptz default null,
    data_fim timestamptz default null,
    grupo bigint default null, -- null = todos os grupos
    placa bigint default null  -- null = todas as placas (do grupo, se informado)
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

    -- Potência média do conjunto no balde = soma, por placa, da potência média de cada uma.
    -- Energia: leitura de sensor = média de 5 min (Wh = W × 5/60); linha de clima = 1 hora (Wh = W).
    return query
        with alvo as (
            select p.id, p.potencia_wp, p.coef_temperatura
              from public.placas p
             where (grupo is null or p.grupo_id = grupo)
               and (placa is null or p.id = placa)
        ), med as (
            select b, sum(w) as w, sum(wh) as wh
              from (select date_trunc(unidade, l.data_hora at time zone 'America/Sao_Paulo') as b,
                           avg(l.wats_gerados) as w,
                           sum(l.wats_gerados) * 5 / 60 as wh
                      from public.leituras_energia l
                      join alvo on alvo.id = l.placa_id
                     where l.data_hora between inicio and fim
                     group by 1, l.placa_id) por_placa
             group by b
        ), est as (
            select b, sum(w) as w, sum(wh) as wh
              from (select date_trunc(unidade, c.data_hora at time zone 'America/Sao_Paulo') as b,
                           avg(e.w) as w,
                           sum(e.w) as wh
                      from public.clima_horario c
                      join alvo on alvo.id = c.placa_id
                     cross join lateral (
                           select public.potencia_estimada(alvo.potencia_wp, alvo.coef_temperatura, c.irradiancia, c.temperatura) as w
                     ) e
                     where c.data_hora between inicio and fim
                       and alvo.potencia_wp is not null
                     group by 1, c.placa_id) por_placa
             group by b
        )
        select coalesce(med.b, est.b) at time zone 'America/Sao_Paulo',
               round(med.w, 2), round(est.w::numeric, 2),
               round(med.wh, 2), round(est.wh::numeric, 2)
          from med
          full join est on est.b = med.b
         order by 1;
end;
$$;

revoke execute on function public.dashboard_metricas(text, timestamptz, timestamptz, bigint, bigint) from public, anon;
