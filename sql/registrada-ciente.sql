create or replace function public.arquivar_ocorrencia(
  ocorrencia_id_input uuid,
  gestor_id_input uuid,
  observacao_input text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ocorrencias
  set
    status = 'REGISTRADA_CIENTE',
    avaliado_em = now(),
    avaliado_por_gestor_id = gestor_id_input,
    observacao_gestor = observacao_input
  where id = ocorrencia_id_input
    and status = 'AGUARDANDO_AVALIACAO';

  return found;
end;
$$;

grant execute on function public.arquivar_ocorrencia(uuid, uuid, text) to anon;

update public.ocorrencias
set status = 'REGISTRADA_CIENTE'
where status = 'ARQUIVADA';
