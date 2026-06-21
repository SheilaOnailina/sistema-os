create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  numero_ocorrencia integer not null,
  registrado_por_colaborador_id uuid not null references public.colaboradores(id),
  tipo text not null default 'MANUTENCAO',
  local text not null,
  descricao text not null,
  status text not null default 'AGUARDANDO_AVALIACAO',
  prioridade_sugerida text not null default 'NORMAL',
  ordem_servico_id uuid references public.ordens_servico(id),
  criado_em timestamp with time zone not null default now(),
  avaliado_em timestamp with time zone,
  avaliado_por_gestor_id uuid references public.colaboradores(id),
  observacao_gestor text
);

create unique index if not exists ocorrencias_numero_ocorrencia_key
on public.ocorrencias (numero_ocorrencia);

create index if not exists ocorrencias_status_idx
on public.ocorrencias (status);

create index if not exists ocorrencias_colaborador_idx
on public.ocorrencias (registrado_por_colaborador_id);

alter table public.ocorrencias enable row level security;

drop policy if exists "Permitir leitura de ocorrencias" on public.ocorrencias;
drop policy if exists "Permitir inserir ocorrencias" on public.ocorrencias;
drop policy if exists "Permitir atualizar ocorrencias" on public.ocorrencias;

create policy "Permitir leitura de ocorrencias"
on public.ocorrencias
for select
to anon
using (true);

create policy "Permitir inserir ocorrencias"
on public.ocorrencias
for insert
to anon
with check (true);

create policy "Permitir atualizar ocorrencias"
on public.ocorrencias
for update
to anon
using (true)
with check (true);

grant select, insert, update on public.ocorrencias to anon;

create or replace function public.registrar_ocorrencia(
  colaborador_id_input uuid,
  tipo_input text,
  local_input text,
  descricao_input text,
  prioridade_input text default 'NORMAL'
)
returns public.ocorrencias
language plpgsql
security definer
set search_path = public
as $$
declare
  nova_ocorrencia public.ocorrencias;
begin
  insert into public.ocorrencias (
    numero_ocorrencia,
    registrado_por_colaborador_id,
    tipo,
    local,
    descricao,
    prioridade_sugerida,
    status
  )
  values (
    coalesce((select max(numero_ocorrencia) + 1 from public.ocorrencias), 1),
    colaborador_id_input,
    coalesce(nullif(trim(tipo_input), ''), 'MANUTENCAO'),
    trim(local_input),
    trim(descricao_input),
    case
      when upper(coalesce(prioridade_input, 'NORMAL')) in ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE')
      then upper(coalesce(prioridade_input, 'NORMAL'))
      else 'NORMAL'
    end,
    'AGUARDANDO_AVALIACAO'
  )
  returning * into nova_ocorrencia;

  return nova_ocorrencia;
end;
$$;

grant execute on function public.registrar_ocorrencia(uuid, text, text, text, text) to anon;

create or replace function public.transformar_ocorrencia_em_os(
  ocorrencia_id_input uuid,
  gestor_id_input uuid,
  colaborador_id_input uuid,
  prioridade_input text default 'NORMAL'
)
returns public.ordens_servico
language plpgsql
security definer
set search_path = public
as $$
declare
  ocorrencia_registro public.ocorrencias;
  nova_os public.ordens_servico;
begin
  select *
  into ocorrencia_registro
  from public.ocorrencias
  where id = ocorrencia_id_input
    and status = 'AGUARDANDO_AVALIACAO'
  for update;

  if not found then
    raise exception 'Ocorrencia nao encontrada ou ja avaliada.';
  end if;

  insert into public.ordens_servico (
    id,
    numero_os,
    solicitante,
    local,
    descricao,
    status,
    colaborador_id,
    prioridade,
    data_abertura
  )
  values (
    gen_random_uuid(),
    coalesce((select max(numero_os) + 1 from public.ordens_servico), 1),
    coalesce(
      (select nome from public.colaboradores where id = ocorrencia_registro.registrado_por_colaborador_id),
      'Ocorrencia'
    ),
    ocorrencia_registro.local,
    ocorrencia_registro.descricao,
    'ABERTA',
    colaborador_id_input,
    case
      when upper(coalesce(prioridade_input, ocorrencia_registro.prioridade_sugerida, 'NORMAL')) in ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE')
      then upper(coalesce(prioridade_input, ocorrencia_registro.prioridade_sugerida, 'NORMAL'))
      else 'NORMAL'
    end,
    now()
  )
  returning * into nova_os;

  update public.ocorrencias
  set
    status = 'GEROU_OS',
    ordem_servico_id = nova_os.id,
    avaliado_em = now(),
    avaliado_por_gestor_id = gestor_id_input
  where id = ocorrencia_id_input;

  return nova_os;
end;
$$;

grant execute on function public.transformar_ocorrencia_em_os(uuid, uuid, uuid, text) to anon;

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
    status = 'ARQUIVADA',
    avaliado_em = now(),
    avaliado_por_gestor_id = gestor_id_input,
    observacao_gestor = observacao_input
  where id = ocorrencia_id_input
    and status = 'AGUARDANDO_AVALIACAO';

  return found;
end;
$$;

grant execute on function public.arquivar_ocorrencia(uuid, uuid, text) to anon;

create or replace function public.cadastrar_colaborador(
  nome_input text,
  cpf_input text,
  telefone_input text,
  perfil_input text
)
returns setof public.colaboradores
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.colaboradores (
    id,
    nome,
    cpf,
    telefone,
    perfil,
    ativo,
    senha_hash,
    precisa_trocar_senha,
    criado_em
  )
  values (
    gen_random_uuid(),
    trim(nome_input),
    regexp_replace(cpf_input, '\D', '', 'g'),
    nullif(regexp_replace(coalesce(telefone_input, ''), '\D', '', 'g'), ''),
    case
      when upper(perfil_input) in ('GESTOR', 'TECNICO', 'SOLICITANTE')
      then upper(perfil_input)
      else 'SOLICITANTE'
    end,
    true,
    crypt(regexp_replace(cpf_input, '\D', '', 'g'), gen_salt('bf')),
    true,
    now()
  )
  returning *;
end;
$$;

grant execute on function public.cadastrar_colaborador(text, text, text, text) to anon;
