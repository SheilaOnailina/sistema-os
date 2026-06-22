create extension if not exists pgcrypto with schema extensions;

alter table public.colaboradores
  alter column cpf drop not null;

drop function if exists public.login_colaborador(text, text);
drop function if exists public.resetar_senha_colaborador(uuid);

create or replace function public.senha_inicial_por_telefone(
  telefone_input text,
  cpf_input text default null
)
returns text
language plpgsql
immutable
as $$
declare
  telefone_limpo text;
  cpf_limpo text;
begin
  telefone_limpo := regexp_replace(coalesce(telefone_input, ''), '\D', '', 'g');
  cpf_limpo := regexp_replace(coalesce(cpf_input, ''), '\D', '', 'g');

  if length(telefone_limpo) >= 6 then
    return substring(telefone_limpo from 1 for 6);
  end if;

  if length(cpf_limpo) >= 6 then
    return substring(cpf_limpo from 1 for 6);
  end if;

  raise exception 'Informe um telefone com pelo menos 6 digitos.';
end;
$$;

create or replace function public.login_colaborador(
  cpf_input text,
  senha_input text
)
returns table (
  id uuid,
  nome text,
  cpf text,
  telefone text,
  perfil text,
  ativo boolean,
  precisa_trocar_senha boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  login_texto text;
  login_numeros text;
begin
  login_texto := lower(regexp_replace(trim(coalesce(cpf_input, '')), '\s+', ' ', 'g'));
  login_numeros := regexp_replace(coalesce(cpf_input, ''), '\D', '', 'g');

  return query
  select
    c.id,
    c.nome,
    c.cpf,
    c.telefone,
    c.perfil,
    c.ativo,
    c.precisa_trocar_senha
  from public.colaboradores c
  where c.ativo = true
    and (
      (
        login_numeros <> ''
        and regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = login_numeros
      )
      or lower(regexp_replace(trim(c.nome), '\s+', ' ', 'g')) = login_texto
      or lower(regexp_replace(trim(c.nome), '\s+', ' ', 'g')) like '%' || login_texto || '%'
    )
    and c.senha_hash = extensions.crypt(senha_input, c.senha_hash)
  order by c.criado_em asc
  limit 1;
end;
$$;

drop function if exists public.cadastrar_colaborador(text, text, text, text);

create or replace function public.cadastrar_colaborador(
  nome_input text,
  cpf_input text,
  telefone_input text,
  perfil_input text
)
returns setof public.colaboradores
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  senha_inicial text;
begin
  senha_inicial := public.senha_inicial_por_telefone(
    telefone_input,
    cpf_input
  );

  return query
  insert into public.colaboradores (
    nome,
    cpf,
    telefone,
    perfil,
    ativo,
    senha_hash,
    precisa_trocar_senha
  )
  values (
    trim(nome_input),
    nullif(regexp_replace(coalesce(cpf_input, ''), '\D', '', 'g'), ''),
    nullif(regexp_replace(coalesce(telefone_input, ''), '\D', '', 'g'), ''),
    perfil_input,
    true,
    extensions.crypt(senha_inicial, extensions.gen_salt('bf')),
    true
  )
  returning *;
end;
$$;

create or replace function public.resetar_senha_colaborador(
  colaborador_id_input uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  colaborador public.colaboradores;
  senha_inicial text;
begin
  select *
  into colaborador
  from public.colaboradores
  where id = colaborador_id_input;

  if not found then
    return false;
  end if;

  senha_inicial := public.senha_inicial_por_telefone(
    colaborador.telefone,
    colaborador.cpf
  );

  update public.colaboradores
  set
    senha_hash = extensions.crypt(senha_inicial, extensions.gen_salt('bf')),
    precisa_trocar_senha = true
  where id = colaborador_id_input;

  return found;
end;
$$;

grant execute on function public.senha_inicial_por_telefone(text, text) to anon;
grant execute on function public.login_colaborador(text, text) to anon;
grant execute on function public.cadastrar_colaborador(text, text, text, text) to anon;
grant execute on function public.resetar_senha_colaborador(uuid) to anon;
