-- Migração 20260911080910 «academia_acesso_e_progresso», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- Quem entra, a que tem acesso, e o que ja fez.
-- ============================================================

-- Acesso concedido a mao: bolsa, equipa, vitalicio, corrigir um caso.
-- O acesso normal vem das inscricoes do CRM e nao precisa de linha aqui.
create table academia.acessos (
  id            text primary key default academia.novo_id(),
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  curso_id      text not null references academia.cursos(id) on delete cascade,
  origem        text not null default 'manual' check (origem in ('manual','convite','oferta')),
  inscricao_id  bigint references public.inscricoes(id) on delete set null,
  concedido_por uuid references public.utilizadores(id) on delete set null,
  expira_em     date,
  nota          text,
  criado_em     timestamptz not null default now(),
  unique (utilizador_id, curso_id)
);
create index acessos_utilizador_idx on academia.acessos(utilizador_id);

-- Convites: a unica porta de entrada de um aluno novo.
create table academia.convites (
  id          text primary key default academia.novo_id(),
  email       text not null,
  nome        text,
  oferta_id   bigint references public.ofertas(id) on delete set null,
  cursos      text[] not null default '{}',
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  expira_em   timestamptz not null default now() + interval '30 days',
  aceite_em   timestamptz,
  aceite_por  uuid references public.utilizadores(id) on delete set null,
  criado_por  uuid references public.utilizadores(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create unique index convites_email_pendente_idx
  on academia.convites (lower(email)) where aceite_em is null;

-- Progresso: uma linha por aula concluida.
create table academia.progresso (
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  aula_id       text not null references academia.aulas(id) on delete cascade,
  concluida_em  timestamptz not null default now(),
  primary key (utilizador_id, aula_id)
);
create index progresso_aula_idx on academia.progresso(aula_id);

-- Avaliacoes das aulas. Uma por aluno por aula.
create table academia.avaliacoes (
  id            text primary key default academia.novo_id(),
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  aula_id       text not null references academia.aulas(id) on delete cascade,
  curso_id      text references academia.cursos(id) on delete cascade,
  estrelas      smallint not null default 0 check (estrelas between 0 and 5),
  comentario    text,
  oculto        boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (utilizador_id, aula_id)
);
create index avaliacoes_curso_idx on academia.avaliacoes(curso_id) where oculto = false;

-- Respostas do questionario de entrada.
create table academia.onboarding (
  utilizador_id uuid primary key references public.utilizadores(id) on delete cascade,
  objetivos     text[] not null default '{}',
  ritmo         text,
  momento       text,
  saltado       boolean not null default false,
  respondido_em timestamptz not null default now()
);

-- Certificados emitidos, com codigo para verificacao.
create table academia.certificados (
  id            text primary key default academia.novo_id(),
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  curso_id      text not null references academia.cursos(id) on delete cascade,
  codigo        text not null unique default upper(encode(gen_random_bytes(6), 'hex')),
  emitido_em    timestamptz not null default now(),
  unique (utilizador_id, curso_id)
);

-- Preferencias do aluno na area de membros (foto, tema, notificacoes).
create table academia.perfis (
  utilizador_id uuid primary key references public.utilizadores(id) on delete cascade,
  foto_url      text,
  tema          text check (tema in ('dark','light')),
  streak_dias   integer not null default 0,
  notificacoes  jsonb not null default '{"email":true,"lembretes":true,"comunidade":false}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create trigger t_avaliacoes_toque before update on academia.avaliacoes
  for each row execute function academia.toque_atualizado();
create trigger t_perfis_toque before update on academia.perfis
  for each row execute function academia.toque_atualizado();
