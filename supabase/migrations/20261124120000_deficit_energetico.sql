-- Déficit energético: queda repentina da geração MEDIDA (leituras importadas/sensor) com sol.
-- 1. dois tipos novos de alerta e a preferência alerta_deficit;
-- 2. modelo_deficit: o modelo de ML treinado fora do banco;
-- 3. gerar_alertas_deficit(): classifica as horas de sol com leitura de cada placa;
-- 4. roda de hora em hora (pg_cron) e logo após cada importação de leituras (RPC do dono).
--
-- O estimado de cada hora já vem da irradiância e da temperatura daquela hora (Open-Meteo), então o tempo nublado
-- já baixa o esperado. Mesmo assim o clima horário é grosso (nuvem local passa despercebida); por isso a queda parcial
-- é comparada também com as outras placas do grupo na mesma hora (mesmo céu):
--   FALHA           real ≤ 5 % do estimado numa hora de sol (2 h ou mais no dia): placa queimada, inversor
--                   ou disjuntor desligado. Alerta mesmo que o grupo todo caia (pode ser o inversor/rede).
--   QUEDA_REPENTINA real/esperado abaixo do habitual da própria placa (2 h ou mais no dia): objeto, sombra, sujeira
--                   localizada (folha, fezes). Com vizinhas medidas: < 70 % enquanto alguma outra placa do grupo segue
--                   ≥ 85 % do habitual dela (o grupo inteiro caiu junto = tempo: não alerta). Placa sem vizinhas: abaixo
--                   do limite aprendido pelo modelo de ML para a faixa de irradiância (modelo_deficit.limiar).
-- Esperado = estimado físico × razão prevista pelo modelo de ML (gradient boosting treinado em ml/treinar_deficit.py
-- com 4 anos de leituras reais): corrige o que a física fixa erra por hora, mês e irradiância.
-- Hora de sol = estimado ≥ 10 % da potência nominal (~100 W/m²): amanhecer, entardecer e noite ficam de fora.
-- Habitual = mediana de real/estimado da placa nas horas de sol medidas da janela e dos 7 dias antes (sem as de falha):
-- absorve o PR real (~0,71–0,77 contra 0,82 do modelo) e a sujeira gradual, que já tem alerta próprio.
-- Horas sem leitura (simuladas) nunca contam: a simulação não tem falhas.
-- Avaliação do modelo e dos limites: ml/resultados/ e ml/COMPARACAO.md (scikit-learn x Spark MLlib). Sem o modelo carregado, razão 1 e limite 70 %.
-- ponytail: placa sozinha no grupo só tem o clima horário de reanálise para separar nuvem de obstrução; a nebulosidade
--           (análise meteorológica) entra como variável nova do modelo.

-- 1. Tipos e preferência.
alter table public.alertas drop constraint ck_alertas_tipo;
alter table public.alertas add constraint ck_alertas_tipo
    check (tipo in ('LIMPEZA', 'PREVISAO_BAIXA', 'DESEMPENHO', 'FALHA', 'QUEDA_REPENTINA'));

alter table public.usuarios add column alerta_deficit boolean not null default true;
grant update (alerta_deficit) on public.usuarios to authenticated;

-- 2. Modelo de ML exportado (gerado por ml/treinar_deficit.py numa migration própria): para cada mês, hora de
--    São Paulo e faixa de 100 W/m² de irradiância no plano da placa, a razão real ÷ estimado físico prevista
--    (≈ 1 em média) e o limite de queda aprendido. Só gerar_alertas_deficit (security definer) lê.
create table public.modelo_deficit (
    mes smallint not null check (mes between 1 and 12),
    hora smallint not null check (hora between 0 and 23),
    faixa smallint not null check (faixa between 0 and 11), -- floor(irradiância / 100), 11 = ≥ 1100 W/m²
    razao real not null check (razao > 0),
    limiar real not null check (limiar between 0 and 1),
    primary key (mes, hora, faixa)
);
alter table public.modelo_deficit enable row level security;
revoke all on public.modelo_deficit from anon, authenticated;

-- 3. Classificação. referencia = o dia (São Paulo) das horas: no máximo um alerta de cada tipo por placa e dia.
-- placa: só o grupo dela (chamada do dono após importar); null: todos os grupos (pg_cron).
-- Devolve quantos alertas novos foram gravados.
create function public.gerar_alertas_deficit(data_inicio timestamptz, data_fim timestamptz, placa bigint default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    grupo_alvo bigint;
    inseridos integer;
begin
    if data_inicio is null or data_fim is null or data_inicio > data_fim then
        raise exception 'Período inválido.' using errcode = '22023';
    end if;
    if data_fim - data_inicio > interval '62 days' then
        raise exception 'Período de no máximo 62 dias.' using errcode = '22023';
    end if;

    if placa is not null then
        select p.grupo_id into grupo_alvo
          from public.placas p
          join public.grupos_solares g on g.id = p.grupo_id
         where p.id = gerar_alertas_deficit.placa
           and (auth.uid() is null or g.dono_id = auth.uid() or public.e_admin());
        if grupo_alvo is null then
            raise exception 'Placa não encontrada.' using errcode = '42501';
        end if;
    elsif auth.uid() is not null then
        -- só o pg_cron (sem JWT) varre todos os grupos
        raise exception 'Informe a placa.' using errcode = '42501';
    end if;

    with horas as (
        select g.placa_id, g.grupo_id, g.data_hora, g.real_wh, g.estimada_wh,
               g.real_wh / g.estimada_wh as razao_bruta,                      -- para a FALHA (física pura)
               g.real_wh / g.estimada_wh / coalesce(m.razao, 1) as razao,     -- real ÷ esperado pelo modelo
               m.limiar
          from public.geracao_horaria g
          join public.placas p on p.id = g.placa_id
          join public.grupos_solares gs on gs.id = g.grupo_id
          join public.clima_horario c on c.placa_id = g.placa_id and c.data_hora = g.data_hora
          left join public.modelo_deficit m
                 on m.mes = extract(month from g.data_hora at time zone 'America/Sao_Paulo')
                and m.hora = extract(hour from g.data_hora at time zone 'America/Sao_Paulo')
                and m.faixa = least(floor(c.irradiancia / 100), 11)
         where g.data_hora >= data_inicio - interval '7 days'
           and g.data_hora < data_fim
           and (grupo_alvo is null or g.grupo_id = grupo_alvo)
           and p.status = 'ATIVA' and gs.status = 'ATIVO'
           and g.real_medido
           and g.estimada_wh >= 0.10 * p.potencia_wp
    ), habitual as (
        select h.placa_id, percentile_cont(0.5) within group (order by h.razao) as razao
          from horas h
         where h.razao_bruta > 0.05
         group by h.placa_id
    ), avaliadas as (
        select h.*, h.razao / coalesce(nullif(hab.razao, 0), 1) as relativa
          from horas h
          left join habitual hab on hab.placa_id = h.placa_id
         where h.data_hora >= data_inicio
    ), comparadas as (
        select a.*,
               -- a melhor das outras: uma placa vizinha gerando normal prova que o céu estava bom
               (select max(o.relativa)
                  from avaliadas o
                 where o.grupo_id = a.grupo_id and o.data_hora = a.data_hora and o.placa_id <> a.placa_id) as relativa_grupo
          from avaliadas a
    ), classificadas as (
        select c.*,
               (c.data_hora at time zone 'America/Sao_Paulo')::date as dia,
               case
                   when c.razao_bruta <= 0.05 then 'FALHA'
                   when c.relativa_grupo is not null and c.relativa < 0.70 and c.relativa_grupo >= 0.85 then 'QUEDA_REPENTINA'
                   when c.relativa_grupo is null and c.relativa < coalesce(c.limiar, 0.70) then 'QUEDA_REPENTINA'
               end as tipo
          from comparadas c
    ), por_dia as (
        select c.placa_id, c.grupo_id, c.dia, c.tipo,
               count(*) as horas,
               min(c.data_hora) as primeira,
               max(c.data_hora) + interval '1 hour' as ultima,
               sum(c.estimada_wh) as estimada_wh,
               avg(c.relativa) as relativa,
               bool_or(c.relativa_grupo is not null) as com_grupo
          from classificadas c
         where c.tipo is not null
         group by c.placa_id, c.grupo_id, c.dia, c.tipo
        having count(*) >= 2
    )
    insert into public.alertas (grupo_id, placa_id, tipo, mensagem, referencia)
    select d.grupo_id, d.placa_id, d.tipo,
           case d.tipo
               when 'FALHA' then format(
                   '%s sem geração com sol em %s h de %s (das %s às %s; esperado %s kWh): possível queima da placa, '
                   'falha do inversor ou disjuntor desligado',
                   p.modelo, d.horas, to_char(d.dia, 'DD/MM'),
                   to_char(d.primeira at time zone 'America/Sao_Paulo', 'HH24"h"'),
                   to_char(d.ultima at time zone 'America/Sao_Paulo', 'HH24"h"'),
                   replace(round((d.estimada_wh / 1000)::numeric, 1)::text, '.', ','))
               else format(
                   '%s caiu de repente para %s%% do habitual em %s h de %s (das %s às %s) enquanto %s: '
                   'possível objeto ou sombra sobre a placa',
                   p.modelo, round((d.relativa * 100)::numeric), d.horas, to_char(d.dia, 'DD/MM'),
                   to_char(d.primeira at time zone 'America/Sao_Paulo', 'HH24"h"'),
                   to_char(d.ultima at time zone 'America/Sao_Paulo', 'HH24"h"'),
                   case when d.com_grupo then 'as outras placas do grupo seguiram normais' else 'o esperado para o clima da hora não caiu' end)
           end,
           d.dia
      from por_dia d
      join public.placas p on p.id = d.placa_id
      join public.grupos_solares gs on gs.id = d.grupo_id
      join public.usuarios u on u.id = gs.dono_id
     where u.alerta_deficit
       -- no dia em que a placa parou, a queda parcial é a mesma história
       and not (d.tipo = 'QUEDA_REPENTINA'
                and exists (select 1 from por_dia f
                             where f.placa_id = d.placa_id and f.dia = d.dia and f.tipo = 'FALHA'))
    on conflict do nothing;

    get diagnostics inseridos = row_count;
    return inseridos;
end;
$$;

revoke execute on function public.gerar_alertas_deficit(timestamptz, timestamptz, bigint) from public, anon;
grant execute on function public.gerar_alertas_deficit(timestamptz, timestamptz, bigint) to authenticated;

-- 4. De hora em hora (minuto 15: a hora anterior já fechou): olha desde ontem, para pegar leituras que chegaram atrasadas.
select cron.schedule(
    'gerar-alertas-deficit',
    '15 * * * *',
    $$select public.gerar_alertas_deficit(
          date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '1 day',
          now())$$
);
