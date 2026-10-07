-- Separa "o clima foi ruim" de "a placa está ruim":
-- 1. dashboard_historico: o estimado da mesma janela nos 5 anos anteriores (média, mínimo e máximo), alinhado ao gráfico;
-- 2. acerto da previsão: a previsão de amanhã é guardada todo dia e depois comparada com o clima que aconteceu.

-- 1. Média histórica. Só o estimado (o clima): o real carrega a sujeira, que é justamente o que se quer separar.
-- ponytail: recalcula até 5 anos × placas a cada chamada (~1,2 s na visão Ano com 4 placas, cresce com o número
--           de placas); pré-agregar o estimado por placa e dia numa tabela se a visão Ano ficar lenta.
create function public.dashboard_historico(
    granularidade text default 'dia',
    data_inicio timestamptz default null,
    data_fim timestamptz default null,
    grupo bigint default null,
    placa bigint default null
)
returns table (x timestamptz, media_w numeric, media_wh numeric, min_wh numeric, max_wh numeric, anos int)
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

    -- A janela recua k anos no relógio de SP e cada hora volta k anos para frente antes do balde,
    -- então os x batem com os do dashboard_metricas (inclusive os baldes de semana).
    -- Um ano só entra se todas as placas com clima cobrem a janela inteira (o 5º ano costuma ser parcial).
    return query
        with alvo as (
            select p.id,
                   (select min(c.data_hora) from public.clima_horario c where c.placa_id = p.id) as desde,
                   (select max(c.data_hora) from public.clima_horario c where c.placa_id = p.id) as ate
              from public.placas p
             where (grupo is null or p.grupo_id = grupo)
               and (placa is null or p.id = placa)
               and p.potencia_wp is not null
        ), ano as (
            select j.k, j.ini, j.fim_k
              from (select k.k,
                           (inicio at time zone 'America/Sao_Paulo' - make_interval(years => k.k)) at time zone 'America/Sao_Paulo' as ini,
                           (fim at time zone 'America/Sao_Paulo' - make_interval(years => k.k)) at time zone 'America/Sao_Paulo' as fim_k
                      from generate_series(1, 5) k) j
             where not exists (select 1 from alvo a where a.desde > j.ini or a.ate < j.fim_k - interval '1 hour')
        ), por_ano as (
            -- Potência do conjunto no balde = soma da média de cada placa. Agregar dentro do lateral
            -- faz uma busca no índice (placa_id, data_hora) por placa e ano, em vez de varrer o clima todo.
            select a.k, pp.b, sum(pp.est_w) as w, sum(pp.est_wh) as wh
              from ano a
             cross join alvo
             cross join lateral (
                   select date_trunc(unidade, h.local + make_interval(years => a.k)) as b,
                          avg(g.estimada_wh) as est_w,
                          sum(g.estimada_wh) as est_wh
                     from public.geracao_horaria g
                    cross join lateral (select g.data_hora at time zone 'America/Sao_Paulo' as local) h
                    where g.placa_id = alvo.id
                      and g.data_hora between a.ini and a.fim_k
                      -- 29/02 não vira um segundo 28/02 num ano que não é bissexto
                      and extract(day from h.local + make_interval(years => a.k)) = extract(day from h.local)
                    group by 1
             ) pp
             group by 1, 2
        )
        select pa.b at time zone 'America/Sao_Paulo',
               round(avg(pa.w)::numeric, 2), round(avg(pa.wh)::numeric, 2),
               round(min(pa.wh)::numeric, 2), round(max(pa.wh)::numeric, 2),
               count(*)::int
          from por_ano pa
         group by pa.b
         order by 1;
end;
$$;

revoke execute on function public.dashboard_historico(text, timestamptz, timestamptz, bigint, bigint) from public, anon;

-- 2. Acerto da previsão. O clima_horario é sobrescrito de hora em hora (com os últimos 3 dias observados),
--    então a previsão precisa ser guardada antes, para comparar depois.
create table public.previsoes_diarias (
    placa_id bigint not null references public.placas (id) on delete cascade,
    dia date not null, -- dia no fuso de São Paulo
    estimada_wh numeric not null,
    feita_em timestamptz not null default now(),
    primary key (placa_id, dia)
);

alter table public.previsoes_diarias enable row level security;
create policy "previsoes das placas visiveis" on public.previsoes_diarias
    for select to authenticated
    using (placa_id in (select p.id from public.placas p));
grant select on public.previsoes_diarias to authenticated;

-- Rodado pelo pg_cron às 21:00 de São Paulo: guarda a energia estimada de amanhã de cada placa.
create function public.guardar_previsao()
returns void
language sql
security definer
set search_path = ''
as $$
    with amanha as (
        select (now() at time zone 'America/Sao_Paulo')::date + 1 as dia
    )
    insert into public.previsoes_diarias (placa_id, dia, estimada_wh)
    select g.placa_id, amanha.dia, round(sum(g.estimada_wh)::numeric, 2)
      from public.geracao_horaria g
     cross join amanha
     where g.data_hora >= amanha.dia at time zone 'America/Sao_Paulo'
       and g.data_hora < (amanha.dia + 1) at time zone 'America/Sao_Paulo'
     group by g.placa_id, amanha.dia
    on conflict (placa_id, dia) do update
        set estimada_wh = excluded.estimada_wh, feita_em = excluded.feita_em;
$$;

revoke execute on function public.guardar_previsao() from public, anon, authenticated;

select cron.schedule('guardar-previsao', '0 0 * * *', 'select public.guardar_previsao()');

-- Por dia já encerrado: a previsão guardada x o estimado com o clima que aconteceu, das mesmas placas.
create function public.acerto_previsao(
    dias int default 7,
    grupo bigint default null,
    placa bigint default null
)
returns table (dia date, previsto_wh numeric, ocorrido_wh numeric)
language sql
stable
set search_path = ''
as $$
    select pd.dia, round(sum(pd.estimada_wh), 2), round(sum(o.wh)::numeric, 2)
      from public.previsoes_diarias pd
      join public.placas p on p.id = pd.placa_id
     cross join lateral (
           select sum(g.estimada_wh) as wh
             from public.geracao_horaria g
            where g.placa_id = pd.placa_id
              and g.data_hora >= pd.dia at time zone 'America/Sao_Paulo'
              and g.data_hora < (pd.dia + 1) at time zone 'America/Sao_Paulo'
     ) o
     where pd.dia >= (now() at time zone 'America/Sao_Paulo')::date - dias
       and pd.dia < (now() at time zone 'America/Sao_Paulo')::date
       and (grupo is null or p.grupo_id = grupo)
       and (placa is null or pd.placa_id = placa)
     group by pd.dia
     order by pd.dia;
$$;

revoke execute on function public.acerto_previsao(int, bigint, bigint) from public, anon;
