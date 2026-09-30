-- Migração 20260911080930 «academia_comunidade_eventos_config», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- Comunidade, eventos, banners, gamificacao e configuracao.
-- ============================================================

create table academia.espacos (
  id               text primary key default academia.novo_id(),
  nome             text not null,
  descricao        text,
  cor              text not null default '#ff5a1f',
  ativo            boolean not null default true,
  so_admin_publica boolean not null default false,
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create table academia.mensagens (
  id         text primary key default academia.novo_id(),
  espaco_id  text not null references academia.espacos(id) on delete cascade,
  autor_id   uuid not null references public.utilizadores(id) on delete cascade,
  texto      text,
  resposta_a text references academia.mensagens(id) on delete set null,
  ficheiro   jsonb,                      -- {nome,url,tipo,tamanho}
  categoria_id text references academia.categorias(id) on delete set null,
  fixado     boolean not null default false,
  oculto     boolean not null default false,
  criado_em  timestamptz not null default now(),
  -- Uma mensagem sem texto e sem ficheiro nao diz nada a ninguem.
  check (coalesce(trim(texto), '') <> '' or ficheiro is not null)
);
create index mensagens_espaco_idx on academia.mensagens(espaco_id, criado_em desc);

-- Gostos por pessoa, em vez de um contador que qualquer um podia inflacionar.
create table academia.reacoes (
  mensagem_id   text not null references academia.mensagens(id) on delete cascade,
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (mensagem_id, utilizador_id)
);

create table academia.eventos (
  id           text primary key default academia.novo_id(),
  titulo       text not null,
  descricao    text,
  data         date not null,
  hora         time not null default '19:00',
  tipo         text not null default 'Ao vivo',
  categoria_id text references academia.categorias(id) on delete set null,
  link         text,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index eventos_data_idx on academia.eventos(data);

create table academia.presencas (
  evento_id     text not null references academia.eventos(id) on delete cascade,
  utilizador_id uuid not null references public.utilizadores(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (evento_id, utilizador_id)
);

create table academia.banners (
  id         text primary key default academia.novo_id(),
  eyebrow    text,
  titulo     text not null,
  cta        text not null default 'Saber mais',
  link       text,
  imagem_url text,
  gradiente  text,
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table academia.conquistas (
  id        text primary key default academia.novo_id(),
  titulo    text not null,
  descricao text,
  regra     jsonb not null default '{"tipo":"manual","valor":0}'::jsonb,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);

-- Notificacoes: utilizador_id nulo significa "para todos os alunos".
create table academia.notificacoes (
  id            text primary key default academia.novo_id(),
  utilizador_id uuid references public.utilizadores(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  tipo          text not null default 'geral',
  link          text,
  criado_em     timestamptz not null default now()
);
create index notificacoes_utilizador_idx on academia.notificacoes(utilizador_id, criado_em desc);

create table academia.notificacoes_lidas (
  notificacao_id text not null references academia.notificacoes(id) on delete cascade,
  utilizador_id  uuid not null references public.utilizadores(id) on delete cascade,
  lida_em        timestamptz not null default now(),
  primary key (notificacao_id, utilizador_id)
);

-- Configuracao da academia: aparencia, gamificacao, certificado,
-- integracoes e as abas ligadas. Uma chave por area.
create table academia.config (
  chave         text primary key,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create trigger t_espacos_toque before update on academia.espacos
  for each row execute function academia.toque_atualizado();
create trigger t_eventos_toque before update on academia.eventos
  for each row execute function academia.toque_atualizado();
create trigger t_banners_toque before update on academia.banners
  for each row execute function academia.toque_atualizado();
create trigger t_config_toque before update on academia.config
  for each row execute function academia.toque_atualizado();
