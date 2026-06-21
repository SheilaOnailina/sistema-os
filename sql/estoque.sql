create extension if not exists pgcrypto;

create table if not exists public.materiais_estoque (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null default 'unidade',
  quantidade_atual numeric(12, 2) not null default 0,
  estoque_minimo numeric(12, 2) not null default 0,
  periodicidade text not null default 'SEM_PREVISAO',
  ultimo_recebimento date,
  proximo_recebimento date,
  ativo boolean not null default true,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now(),
  constraint materiais_estoque_periodicidade_check check (
    periodicidade in (
      'SEM_PREVISAO',
      'MENSAL',
      'BIMESTRAL',
      'TRIMESTRAL',
      'SEMESTRAL',
      'ANUAL'
    )
  ),
  constraint materiais_estoque_quantidade_check check (quantidade_atual >= 0),
  constraint materiais_estoque_minimo_check check (estoque_minimo >= 0)
);

create table if not exists public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais_estoque(id) on delete restrict,
  tipo text not null check (tipo in ('ENTRADA', 'SAIDA')),
  quantidade numeric(12, 2) not null check (quantidade > 0),
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  ordem_servico_id uuid references public.ordens_servico(id) on delete set null,
  motivo text,
  observacao text,
  registrado_por_colaborador_id uuid references public.colaboradores(id) on delete set null,
  criado_em timestamp with time zone not null default now()
);

create index if not exists materiais_estoque_ativo_nome_idx
  on public.materiais_estoque (ativo, nome);

create index if not exists movimentacoes_estoque_material_data_idx
  on public.movimentacoes_estoque (material_id, criado_em desc);

create or replace function public.calcular_proximo_recebimento(
  data_base date,
  periodicidade_input text
)
returns date
language plpgsql
immutable
as $$
begin
  if data_base is null or periodicidade_input = 'SEM_PREVISAO' then
    return null;
  end if;

  if periodicidade_input = 'MENSAL' then
    return (data_base + interval '1 month')::date;
  elsif periodicidade_input = 'BIMESTRAL' then
    return (data_base + interval '2 months')::date;
  elsif periodicidade_input = 'TRIMESTRAL' then
    return (data_base + interval '3 months')::date;
  elsif periodicidade_input = 'SEMESTRAL' then
    return (data_base + interval '6 months')::date;
  elsif periodicidade_input = 'ANUAL' then
    return (data_base + interval '1 year')::date;
  end if;

  return null;
end;
$$;

create or replace function public.cadastrar_material_estoque(
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
  insert into public.materiais_estoque (
    nome,
    unidade,
    estoque_minimo,
    periodicidade,
    ultimo_recebimento,
    proximo_recebimento
  )
  values (
    trim(nome_input),
    coalesce(nullif(trim(unidade_input), ''), 'unidade'),
    greatest(coalesce(estoque_minimo_input, 0), 0),
    coalesce(nullif(periodicidade_input, ''), 'SEM_PREVISAO'),
    ultimo_recebimento_input,
    public.calcular_proximo_recebimento(
      ultimo_recebimento_input,
      coalesce(nullif(periodicidade_input, ''), 'SEM_PREVISAO')
    )
  )
  returning * into material;

  return material;
end;
$$;

create or replace function public.registrar_movimentacao_estoque(
  material_id_input uuid,
  tipo_input text,
  quantidade_input numeric,
  colaborador_id_input uuid default null,
  motivo_input text default null,
  observacao_input text default null,
  ordem_servico_id_input uuid default null,
  registrado_por_colaborador_id_input uuid default null
)
returns public.movimentacoes_estoque
language plpgsql
security definer
set search_path = public
as $$
declare
  material public.materiais_estoque;
  movimento public.movimentacoes_estoque;
  nova_quantidade numeric(12, 2);
begin
  if quantidade_input is null or quantidade_input <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  select *
  into material
  from public.materiais_estoque
  where id = material_id_input
    and ativo = true
  for update;

  if not found then
    raise exception 'Material nao encontrado ou inativo.';
  end if;

  if tipo_input = 'ENTRADA' then
    nova_quantidade := material.quantidade_atual + quantidade_input;
  elsif tipo_input = 'SAIDA' then
    nova_quantidade := material.quantidade_atual - quantidade_input;
  else
    raise exception 'Tipo de movimentacao invalido.';
  end if;

  if nova_quantidade < 0 then
    raise exception 'Estoque insuficiente para registrar esta saida.';
  end if;

  update public.materiais_estoque
  set
    quantidade_atual = nova_quantidade,
    ultimo_recebimento = case
      when tipo_input = 'ENTRADA' then current_date
      else ultimo_recebimento
    end,
    proximo_recebimento = case
      when tipo_input = 'ENTRADA' then public.calcular_proximo_recebimento(
        current_date,
        periodicidade
      )
      else proximo_recebimento
    end,
    atualizado_em = now()
  where id = material_id_input;

  insert into public.movimentacoes_estoque (
    material_id,
    tipo,
    quantidade,
    colaborador_id,
    ordem_servico_id,
    motivo,
    observacao,
    registrado_por_colaborador_id
  )
  values (
    material_id_input,
    tipo_input,
    quantidade_input,
    colaborador_id_input,
    ordem_servico_id_input,
    nullif(trim(coalesce(motivo_input, '')), ''),
    nullif(trim(coalesce(observacao_input, '')), ''),
    registrado_por_colaborador_id_input
  )
  returning * into movimento;

  return movimento;
end;
$$;

grant select, insert, update on public.materiais_estoque to anon;
grant select, insert on public.movimentacoes_estoque to anon;
grant execute on function public.calcular_proximo_recebimento(date, text) to anon;
grant execute on function public.cadastrar_material_estoque(
  text,
  text,
  numeric,
  text,
  date
) to anon;
grant execute on function public.registrar_movimentacao_estoque(
  uuid,
  text,
  numeric,
  uuid,
  text,
  text,
  uuid,
  uuid
) to anon;
