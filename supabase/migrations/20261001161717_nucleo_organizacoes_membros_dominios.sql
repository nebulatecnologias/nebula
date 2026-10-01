-- F1a, passo 1 — o núcleo: organizações (inquilinos), membros e domínios.
-- (Plano: «Avaliação — a Academia como área de membros whitelabel», 01/10/2026.)
-- Só acrescenta; a ponte e os dados da Kingdom estão em nucleo_ponte_e_kingdom.

create schema if not exists nucleo;
revoke all on schema nucleo from public, anon, authenticated;

create table nucleo.organizacoes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  nome       text not null check (length(trim(nome)) > 0),
  estado     text not null default 'ativa' check (estado in ('ativa', 'suspensa', 'encerrada')),
  criado_em  timestamptz not null default now()
);

create table nucleo.membros (
  organizacao_id uuid not null references nucleo.organizacoes(id) on delete cascade,
  utilizador_id  uuid not null references auth.users(id) on delete cascade,
  app            text not null check (app in ('academia', 'payflow', 'painel')),
  papel          text not null check (papel in ('dono', 'admin', 'colaborador', 'aluno')),
  estado         text not null default 'ativo' check (estado in ('ativo', 'suspenso')),
  criado_em      timestamptz not null default now(),
  primary key (organizacao_id, utilizador_id, app)
);
create index membros_por_utilizador on nucleo.membros (utilizador_id);

create table nucleo.dominios (
  dominio        text primary key check (dominio = lower(dominio) and dominio ~ '^[a-z0-9.-]+$'),
  organizacao_id uuid not null references nucleo.organizacoes(id) on delete cascade,
  app            text not null check (app in ('academia', 'payflow', 'painel')),
  principal      boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index dominios_por_organizacao on nucleo.dominios (organizacao_id);

alter table nucleo.organizacoes enable row level security;
alter table nucleo.organizacoes force row level security;
alter table nucleo.membros      enable row level security;
alter table nucleo.membros      force row level security;
alter table nucleo.dominios     enable row level security;
alter table nucleo.dominios     force row level security;

create or replace function nucleo.organizacao_kingdom()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from nucleo.organizacoes where slug = 'kingdom' $$;

create or replace function nucleo.papel(p_organizacao uuid, p_app text)
returns text language sql stable security definer set search_path = ''
as $$
  select m.papel
    from nucleo.membros m
    join nucleo.organizacoes o on o.id = m.organizacao_id and o.estado = 'ativa'
   where m.organizacao_id = p_organizacao
     and m.utilizador_id = auth.uid()
     and m.app = p_app
     and m.estado = 'ativo'
$$;

create or replace function nucleo.organizacao_do_dominio(p_dominio text, p_app text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select d.organizacao_id
    from nucleo.dominios d
    join nucleo.organizacoes o on o.id = d.organizacao_id and o.estado = 'ativa'
   where d.dominio = lower(trim(p_dominio)) and d.app = p_app
$$;

revoke all on all functions in schema nucleo from public, anon;
grant usage on schema nucleo to authenticated, service_role;
grant execute on function nucleo.papel(uuid, text) to authenticated;
grant execute on function nucleo.organizacao_kingdom() to authenticated;
grant all on all tables in schema nucleo to service_role;
