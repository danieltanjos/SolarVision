-- Edição no Cadastro: o clima baixado depende do local do grupo e da inclinação/orientação da placa.
-- Quando eles mudam, zerar clima_historico_em/clima_atualizado_em põe a placa de volta na fila do pg_cron
-- (sincronizar_clima), que recarrega os 5 anos + previsão em ~1 min; o upsert sobrescreve as horas que já existem.
-- ponytail: horas fora da nova janela de 5 anos ficam com o clima antigo; apagar o clima da placa antes de recarregar
--           se isso aparecer nas análises (exige security definer: authenticated não apaga clima_horario).

-- Placa: inclinação, orientação ou troca de grupo (o local vem do grupo).
create function public.recarregar_clima_placa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.clima_historico_em := null;
    new.clima_atualizado_em := null;
    return new;
end;
$$;

create trigger ao_mudar_orientacao_placa
    before update of inclinacao, azimute, grupo_id on public.placas
    for each row
    when (old.inclinacao is distinct from new.inclinacao
          or old.azimute is distinct from new.azimute
          or old.grupo_id is distinct from new.grupo_id)
    execute function public.recarregar_clima_placa();

-- Grupo: latitude/longitude valem para todas as placas dele (roda como o dono, que a RLS deixa alterar as placas).
create function public.recarregar_clima_grupo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    update public.placas
       set clima_historico_em = null, clima_atualizado_em = null
     where grupo_id = new.id;
    return null;
end;
$$;

create trigger ao_mudar_local_grupo
    after update of latitude, longitude on public.grupos_solares
    for each row
    when (old.latitude is distinct from new.latitude or old.longitude is distinct from new.longitude)
    execute function public.recarregar_clima_grupo();
