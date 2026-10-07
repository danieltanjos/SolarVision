-- Base das análises:
-- 1. cada usuário só vê (e altera) as próprias usinas; ADMIN vê todas;
-- 2. colunas novas usadas pelas análises (tarifa, custo de limpeza, instalação, chuva);
-- 3. geracao_horaria: a fonte única da geração por hora e por placa (estimada e real), usada por todas as funções do dashboard.

-- 1. Dono do grupo. Placas, limpezas, clima e leituras herdam o acesso pelo grupo.
create function public.e_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
    select exists (select 1 from public.usuarios where id = (select auth.uid()) and role = 'ADMIN');
$$;

revoke execute on function public.e_admin() from public, anon;

alter table public.grupos_solares
    add column dono_id uuid default auth.uid() references auth.users (id) on delete cascade;

-- Os grupos que já existiam ficam com o primeiro usuário cadastrado.
update public.grupos_solares
   set dono_id = (select id from auth.users order by created_at limit 1)
 where dono_id is null;

alter table public.grupos_solares alter column dono_id set not null;
create index idx_grupos_solares_dono_id on public.grupos_solares (dono_id);

-- "x in (select id ...)" em vez de exists: a subconsulta não depende da linha e é calculada uma vez só.
drop policy "autenticados gerenciam grupos" on public.grupos_solares;
create policy "dono gerencia seus grupos" on public.grupos_solares
    for all to authenticated
    using (dono_id = (select auth.uid()) or (select public.e_admin()))
    with check (dono_id = (select auth.uid()) or (select public.e_admin()));

drop policy "autenticados gerenciam placas" on public.placas;
create policy "placas dos grupos visiveis" on public.placas
    for all to authenticated
    using (grupo_id in (select g.id from public.grupos_solares g))
    with check (grupo_id in (select g.id from public.grupos_solares g));

drop policy "autenticados gerenciam limpezas" on public.limpezas;
create policy "limpezas das placas visiveis" on public.limpezas
    for all to authenticated
    using (placa_id in (select p.id from public.placas p))
    with check (placa_id in (select p.id from public.placas p));

drop policy "autenticados leem leituras" on public.leituras_energia;
create policy "leituras das placas visiveis" on public.leituras_energia
    for select to authenticated
    using (placa_id in (select p.id from public.placas p));

drop policy "autenticados leem clima" on public.clima_horario;
create policy "clima das placas visiveis" on public.clima_horario
    for select to authenticated
    using (placa_id in (select p.id from public.placas p));

-- 2. Colunas novas.
alter table public.grupos_solares
    add column tarifa_kwh numeric(8, 4) check (tarifa_kwh > 0),         -- R$/kWh, para valorar a energia
    add column custo_limpeza numeric(10, 2) check (custo_limpeza >= 0); -- R$ para limpar uma placa

alter table public.placas
    add column instalada_em date; -- sem limpeza registrada, a sujeira passa a contar a partir daqui

alter table public.clima_horario
    add column precipitacao real; -- mm na hora (null nas linhas carregadas antes desta coluna)

-- 3. Geração por hora e por placa. Cada linha de clima é 1 hora, então o W médio da hora = Wh.
-- real: só até a última hora completa; por enquanto simulado = estimado × (1 − perda por sujeira).
-- As colunas não usadas por quem consulta não são calculadas (a view é expandida na consulta),
-- então quem só precisa do estimado não paga o cálculo da sujeira.
create view public.geracao_horaria with (security_invoker = true) as
select c.placa_id,
       p.grupo_id,
       c.data_hora,
       public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura) as estimada_wh,
       case when c.data_hora < date_trunc('hour', now())
            then public.potencia_estimada(p.potencia_wp, p.coef_temperatura, c.irradiancia, c.temperatura)
                 * (1 - public.perda_sujeira_em(c.placa_id, c.data_hora))
       end as real_wh,
       c.precipitacao
  from public.clima_horario c
  join public.placas p on p.id = c.placa_id
 where p.potencia_wp is not null;

revoke all on public.geracao_horaria from anon;
grant select on public.geracao_horaria to authenticated;

-- Gráfico: mesma assinatura e mesmas colunas, agora sobre geracao_horaria.
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

    -- Potência do conjunto no balde = soma da potência média de cada placa.
    -- No balde que ainda não terminou, o real conta só as horas completas (energia até agora).
    return query
        with por_placa as (
            select date_trunc(unidade, g.data_hora at time zone 'America/Sao_Paulo') as b,
                   avg(g.estimada_wh) as est_w,
                   sum(g.estimada_wh) as est_wh,
                   case when count(g.real_wh) > 0 then sum(g.real_wh) / count(*) end as real_w,
                   sum(g.real_wh) as real_wh
              from public.geracao_horaria g
             where g.data_hora between inicio and fim
               and (grupo is null or g.grupo_id = grupo)
               and (placa is null or g.placa_id = placa)
             group by 1, g.placa_id
        )
        select pp.b at time zone 'America/Sao_Paulo',
               round(sum(pp.real_w)::numeric, 2), round(sum(pp.est_w)::numeric, 2),
               round(sum(pp.real_wh)::numeric, 2), round(sum(pp.est_wh)::numeric, 2)
          from por_placa pp
         group by pp.b
         order by 1;
end;
$$;

-- Cards da Home: mesmas chaves, agora sobre geracao_horaria.
create or replace function public.dashboard_resumo()
returns json
language sql
stable
set search_path = ''
as $$
    with hoje as (
        select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as inicio
    ), dois_dias as (
        select g.data_hora, g.estimada_wh, g.real_wh, g.data_hora < hoje.inicio + interval '1 day' as e_hoje
          from public.geracao_horaria g
         cross join hoje
         where g.data_hora >= hoje.inicio
           and g.data_hora < hoje.inicio + interval '2 days'
    )
    select json_build_object(
        'totalGeradoHoje', (select coalesce(sum(d.real_wh), 0) from dois_dias d where d.e_hoje),
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
