alter table public.colaboradores
  add column if not exists permissao_modulo_manutencao boolean not null default true,
  add column if not exists permissao_modulo_estoque boolean not null default false,
  add column if not exists permissao_modulo_ar_condicionado boolean not null default false;

update public.colaboradores
set
  permissao_modulo_manutencao = true,
  permissao_modulo_estoque = true,
  permissao_modulo_ar_condicionado = true
where perfil = 'GESTOR';

update public.colaboradores
set permissao_modulo_estoque = true
where perfil = 'ENCARREGADO';

create table if not exists public.unidades_medida (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamp with time zone not null default now()
);

insert into public.unidades_medida (nome)
values
  ('Unidade'),
  ('Kg'),
  ('Metro'),
  ('Litro'),
  ('Pacote')
on conflict (nome) do nothing;

create table if not exists public.solicitacoes_materiais (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais_estoque(id) on delete restrict,
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  quantidade numeric(12, 2) not null check (quantidade > 0),
  motivo text not null,
  status text not null default 'PENDENTE' check (
    status in ('PENDENTE', 'AUTORIZADA', 'RECUSADA')
  ),
  observacao_resposta text,
  respondido_por_colaborador_id uuid references public.colaboradores(id) on delete set null,
  movimentacao_id uuid references public.movimentacoes_estoque(id) on delete set null,
  criado_em timestamp with time zone not null default now(),
  respondido_em timestamp with time zone
);

create index if not exists solicitacoes_materiais_status_data_idx
  on public.solicitacoes_materiais (status, criado_em desc);

create index if not exists solicitacoes_materiais_colaborador_data_idx
  on public.solicitacoes_materiais (colaborador_id, criado_em desc);

create or replace function public.atualizar_material_estoque(
  material_id_input uuid,
  nome_input text,
  unidade_input text,
  estoque_minimo_input numeric,
  periodicidade_input text,
  ultimo_recebimento_input date default null
)
returns public.materiais_estoque
language plpgsql
security definer
set search_path = public
as $$
declare
  material public.materiais_estoque;
begin
  update public.materiais_estoque
  set
    nome = trim(nome_input),
    unidade = coalesce(nullif(trim(unidade_input), ''), 'Unidade'),
    estoque_minimo = greatest(coalesce(estoque_minimo_input, 0), 0),
    periodicidade = coalesce(nullif(periodicidade_input, ''), 'SEM_PREVISAO'),
    ultimo_recebimento = ultimo_recebimento_input,
    proximo_recebimento = public.calcular_proximo_recebimento(
      ultimo_recebimento_input,
      coalesce(nullif(periodicidade_input, ''), 'SEM_PREVISAO')
    ),
    atualizado_em = now()
  where id = material_id_input
    and ativo = true
  returning * into material;

  if not found then
    raise exception 'Material nao encontrado.';
  end if;

  return material;
end;
$$;

create or replace function public.solicitar_material_estoque(
  material_id_input uuid,
  colaborador_id_input uuid,
  quantidade_input numeric,
  motivo_input text
)
returns public.solicitacoes_materiais
language plpgsql
security definer
set search_path = public
as $$
declare
  solicitacao public.solicitacoes_materiais;
begin
  if quantidade_input is null or quantidade_input <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  if nullif(trim(coalesce(motivo_input, '')), '') is null then
    raise exception 'Informe o motivo da solicitacao.';
  end if;

  if not exists (
    select 1 from public.materiais_estoque
    where id = material_id_input and ativo = true
  ) then
    raise exception 'Material nao encontrado ou inativo.';
  end if;

  insert into public.solicitacoes_materiais (
    material_id,
    colaborador_id,
    quantidade,
    motivo
  )
  values (
    material_id_input,
    colaborador_id_input,
    quantidade_input,
    trim(motivo_input)
  )
  returning * into solicitacao;

  return solicitacao;
end;
$$;

create or replace function public.responder_solicitacao_material(
  solicitacao_id_input uuid,
  autorizador_id_input uuid,
  autorizar_input boolean,
  observacao_input text default null
)
returns public.solicitacoes_materiais
language plpgsql
security definer
set search_path = public
as $$
declare
  solicitacao public.solicitacoes_materiais;
  movimento public.movimentacoes_estoque;
begin
  select *
  into solicitacao
  from public.solicitacoes_materiais
  where id = solicitacao_id_input
    and status = 'PENDENTE'
  for update;

  if not found then
    raise exception 'Solicitacao pendente nao encontrada.';
  end if;

  if autorizar_input then
    movimento := public.registrar_movimentacao_estoque(
      solicitacao.material_id,
      'SAIDA',
      solicitacao.quantidade,
      solicitacao.colaborador_id,
      solicitacao.motivo,
      coalesce(nullif(trim(coalesce(observacao_input, '')), ''), 'Saida autorizada'),
      null,
      autorizador_id_input
    );

    update public.solicitacoes_materiais
    set
      status = 'AUTORIZADA',
      observacao_resposta = observacao_input,
      respondido_por_colaborador_id = autorizador_id_input,
      movimentacao_id = movimento.id,
      respondido_em = now()
    where id = solicitacao_id_input
    returning * into solicitacao;
  else
    update public.solicitacoes_materiais
    set
      status = 'RECUSADA',
      observacao_resposta = observacao_input,
      respondido_por_colaborador_id = autorizador_id_input,
      respondido_em = now()
    where id = solicitacao_id_input
    returning * into solicitacao;
  end if;

  return solicitacao;
end;
$$;

grant select, insert, update on public.unidades_medida to anon;
grant select, insert, update on public.solicitacoes_materiais to anon;

grant execute on function public.atualizar_material_estoque(
  uuid,
  text,
  text,
  numeric,
  text,
  date
) to anon;

grant execute on function public.solicitar_material_estoque(
  uuid,
  uuid,
  numeric,
  text
) to anon;

grant execute on function public.responder_solicitacao_material(
  uuid,
  uuid,
  boolean,
  text
) to anon;
