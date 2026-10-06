-- "Total gerado hoje" passa a ser ENERGIA (Wh) e não a soma das potências.
-- Cada leitura é a potência média (W) de um intervalo de 5 minutos (coluna wats5min do CSV): Wh = W x 5/60.
create or replace function public.dashboard_resumo()
returns json
language sql
stable
set search_path = ''
as $$
    select json_build_object(
        'totalGeradoHoje', (
            select coalesce(sum(wats_gerados), 0) * 5 / 60
            from public.leituras_energia
            where data_hora between (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
                                and now()
        ),
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
