-- Migração 20260911080849 «academia_conteudo», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- Kingdom Academy — area de membros
-- Schema proprio, ligado ao CRM que ja existe em public.*
-- Nenhuma tabela existente e alterada.
-- ============================================================
create schema if not exists academia;

comment on schema academia is
  'Area de membros da Kingdom Academy. Liga-se a public.ofertas, public.turmas, public.inscricoes e public.utilizadores.';

-- Mantem atualizado_em sem o codigo ter de se lembrar.
create or replace function academia.toque_atualizado()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- Ids em texto: o prototipo ja usa "kt", "kt-m1a3", e assim a
-- importacao nao precisa de remapear nada.
create or replace function academia.novo_id()
returns text
language sql
volatile
as $$ select gen_random_uuid()::text $$;

-- ---------------- Categorias ----------------
create table academia.categorias (
  id            text primary key default academia.novo_id(),
  nome          text not null check (length(trim(nome)) >= 2),
  cor           text not null default '#ff5a1f',
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------- Cursos ----------------
create table academia.cursos (
  id            text primary key default academia.novo_id(),
  -- Ligacao ao produto vendido no CRM. E daqui que vem o acesso.
  oferta_id     bigint references public.ofertas(id) on delete set null,
  titulo        text not null check (length(trim(titulo)) >= 2),
  sigla         text,
  subtitulo     text,
  categoria_id  text references academia.categorias(id) on delete set null,
  capa_url      text,
  url_vendas    text,
  vitrine       boolean not null default true,
  moderacao     boolean not null default false,
  publicado     boolean not null default true,
  certificado   boolean not null default true,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  removido_em   timestamptz
);
create index cursos_categoria_idx on academia.cursos(categoria_id);
create index cursos_oferta_idx    on academia.cursos(oferta_id);
create index cursos_vivos_idx     on academia.cursos(removido_em) where removido_em is null;

-- ---------------- Modulos ----------------
create table academia.modulos (
  id            text primary key default academia.novo_id(),
  curso_id      text not null references academia.cursos(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  removido_em   timestamptz
);
create index modulos_curso_idx on academia.modulos(curso_id, ordem);

-- ---------------- Aulas ----------------
create table academia.aulas (
  id              text primary key default academia.novo_id(),
  modulo_id       text not null references academia.modulos(id) on delete cascade,
  titulo          text not null,
  duracao         text not null default '00:00',
  descricao       text,
  conteudo        text,            -- HTML do editor de texto
  embed           text,            -- codigo de incorporacao do provedor de video
  capa_url        text,
  sem_comentarios boolean not null default false,
  sem_busca_ia    boolean not null default false,
  ordem           integer not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  removido_em     timestamptz
);
create index aulas_modulo_idx on academia.aulas(modulo_id, ordem);

-- ---------------- Materiais da aula ----------------
create table academia.aula_ficheiros (
  id       text primary key default academia.novo_id(),
  aula_id  text not null references academia.aulas(id) on delete cascade,
  nome     text not null,
  url      text not null,
  tipo     text,
  tamanho  text,
  ordem    integer not null default 0,
  criado_em timestamptz not null default now()
);
create index aula_ficheiros_aula_idx on academia.aula_ficheiros(aula_id, ordem);

-- ---------------- Quiz da aula ----------------
create table academia.aula_quiz (
  id       text primary key default academia.novo_id(),
  aula_id  text not null references academia.aulas(id) on delete cascade,
  pergunta text not null,
  opcoes   jsonb not null default '[]'::jsonb,
  certa    smallint not null default 0 check (certa >= 0),
  ordem    integer not null default 0,
  criado_em timestamptz not null default now()
);
create index aula_quiz_aula_idx on academia.aula_quiz(aula_id, ordem);

create trigger t_categorias_toque before update on academia.categorias
  for each row execute function academia.toque_atualizado();
create trigger t_cursos_toque before update on academia.cursos
  for each row execute function academia.toque_atualizado();
create trigger t_modulos_toque before update on academia.modulos
  for each row execute function academia.toque_atualizado();
create trigger t_aulas_toque before update on academia.aulas
  for each row execute function academia.toque_atualizado();
