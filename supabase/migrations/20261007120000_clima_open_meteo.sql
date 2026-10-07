-- Geração ESTIMADA a partir do clima real (Open-Meteo): 5 anos de histórico + previsão de 3 dias por placa.
-- Substitui os dados mocados do CSV (o arquivo continua no repo só como referência).

-- 1. Remove os dados mocados: grupo/placa do seeder (as leituras vão em cascata) e o job que os deslocava para "hoje".
select cron.unschedule('deslocar-leituras-para-hoje');
delete from public.grupos_solares where nome = 'Grupo Seeder SolarVision';

-- 2. Local (no grupo) e especificações da placa, com os mesmos nomes da branch feat/muda-aba-cadastro.
alter table public.grupos_solares
    add column latitude double precision check (latitude between -90 and 90),
    add column longitude double precision check (longitude between -180 and 180);

alter table public.placas
    add column potencia_wp numeric(10, 2) check (potencia_wp > 0),
    add column inclinacao double precision check (inclinacao between 0 and 90),
    add column azimute double precision check (azimute >= 0 and azimute < 360), -- 0 = Norte, 90 = Leste, 180 = Sul
    add column coef_temperatura double precision not null default -0.40,         -- %/°C
    add column clima_historico_em timestamptz,  -- quando os 5 anos foram carregados (null = pendente)
    add column clima_atualizado_em timestamptz; -- última busca no Open-Meteo

-- 3. Clima horário por placa: a irradiância no plano depende da inclinação e da orientação de cada placa.
-- ponytail: uma série por placa (~3,5 MB por 5 anos); deduplicar por local+inclinação+azimute se houver muitas placas.
create table public.clima_horario (
    placa_id bigint not null references public.placas (id) on delete cascade,
    data_hora timestamptz not null, -- início da hora
    irradiancia real not null,      -- W/m² no plano da placa (GTI), média da hora
    temperatura real not null,      -- °C do ar a 2 m
    primary key (placa_id, data_hora)
);

alter table public.clima_horario enable row level security;
create policy "autenticados leem clima" on public.clima_horario
    for select to authenticated using (true);
grant select on public.clima_horario to authenticated;

-- 4. Potência estimada (W): P = Wp × G/1000 × PR × [1 + γ(T_célula − 25)], com T_célula ≈ T_ar + G × (NOCT − 20)/800.
-- ponytail: PR 0,82 e NOCT 45 °C fixos; viram colunas da placa quando houver dado medido para calibrar.
create function public.potencia_estimada(
    potencia_wp numeric,
    coef_temperatura double precision,
    irradiancia real,
    temperatura real
)
returns double precision
language sql
immutable
set search_path = ''
as $$
    select greatest(0, potencia_wp::float8 * irradiancia / 1000 * 0.82
        * (1 + coef_temperatura / 100 * (temperatura + irradiancia * (45 - 20) / 800.0 - 25)));
$$;

-- 5. Busca o clima de uma placa no Open-Meteo e grava (upsert).
--    historico = true: arquivo de reanálise dos últimos 5 anos; false: últimos 3 dias + previsão de 3 dias.
create extension if not exists http with schema extensions;

create function public.atualizar_clima_placa(p_placa_id bigint, historico boolean)
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
             else 'past_days=3&forecast_days=3'
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

-- 6. Rodado pelo pg_cron a cada minuto: carrega os 5 anos das placas novas (em até ~1 min após o cadastro)
--    e atualiza a previsão das que estão há mais de 1 hora sem atualizar.
-- ponytail: mudar local/inclinação/azimute de uma placa já sincronizada não recarrega o histórico
--           (não há tela de edição ainda); quando houver, zerar clima_historico_em nesses updates.
create function public.sincronizar_clima()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    alvo record;
begin
    for alvo in
        select pl.id, pl.clima_historico_em is null as historico
          from public.placas pl
          join public.grupos_solares g on g.id = pl.grupo_id
         where g.latitude is not null and g.longitude is not null
           and pl.potencia_wp is not null and pl.inclinacao is not null and pl.azimute is not null
           and (
               -- histórico pendente: tenta já e, se falhar, de novo a cada 10 min
               (pl.clima_historico_em is null and coalesce(pl.clima_atualizado_em, '-infinity') < now() - interval '10 minutes')
               or pl.clima_atualizado_em < now() - interval '1 hour'
           )
         order by pl.clima_atualizado_em nulls first
         limit 5
    loop
        begin
            if alvo.historico then
                perform public.atualizar_clima_placa(alvo.id, true);
            end if;
            perform public.atualizar_clima_placa(alvo.id, false);
            update public.placas
               set clima_atualizado_em = now(),
                   clima_historico_em = coalesce(clima_historico_em, now())
             where id = alvo.id;
        exception when others then
            -- não trava a fila: registra e tenta de novo depois
            raise warning 'clima da placa %: %', alvo.id, sqlerrm;
            update public.placas set clima_atualizado_em = now() where id = alvo.id;
        end;
    end loop;
end;
$$;

revoke execute on function public.atualizar_clima_placa(bigint, boolean) from public, anon, authenticated;
revoke execute on function public.sincronizar_clima() from public, anon, authenticated;

select cron.schedule('sincronizar-clima', '* * * * *', 'select public.sincronizar_clima()');

-- 7. Dashboard: séries medida (sensores) e estimada (clima) e cards de estimativa/previsão.
drop function public.dashboard_metricas(text, timestamptz, timestamptz);

create function public.dashboard_metricas(
    granularidade text default 'dia',
    data_inicio timestamptz default null,
    data_fim timestamptz default null
)
returns table (x timestamptz, medida numeric, estimada numeric)
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
    return query
        with med as (
            select b, sum(w) as w
              from (select date_trunc(unidade, l.data_hora at time zone 'America/Sao_Paulo') as b, avg(l.wats_gerados) as w
                      from public.leituras_energia l
                     where l.data_hora between inicio and fim
                     group by 1, l.placa_id) por_placa
             group by b
        ), est as (
            select b, sum(w) as w
              from (select date_trunc(unidade, c.data_hora at time zone 'America/Sao_Paulo') as b,
                           avg(public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura)) as w
                      from public.clima_horario c
                      join public.placas p on p.id = c.placa_id
                     where c.data_hora between inicio and fim
                       and p.potencia_wp is not null
                     group by 1, c.placa_id) por_placa
             group by b
        )
        select coalesce(med.b, est.b) at time zone 'America/Sao_Paulo', round(med.w, 2), round(est.w::numeric, 2)
          from med
          full join est on est.b = med.b
         order by 1;
end;
$$;

revoke execute on function public.dashboard_metricas(text, timestamptz, timestamptz) from public, anon;

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
        select c.data_hora, public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura) as w
          from public.clima_horario c
          join public.placas p on p.id = c.placa_id
         cross join hoje
         where p.potencia_wp is not null
           and c.data_hora >= hoje.inicio
           and c.data_hora < hoje.inicio + interval '2 days'
    )
    select json_build_object(
        -- Medido: cada leitura é a potência média (W) de 5 minutos, Wh = W × 5/60.
        'totalGeradoHoje', (
            select coalesce(sum(l.wats_gerados), 0) * 5 / 60
              from public.leituras_energia l
             cross join hoje
             where l.data_hora between hoje.inicio and now()
        ),
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
