-- Migração 20260918074534 «vitrine_diz_que_ofertas_o_aluno_ve», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* Que ofertas o aluno vê na Vitrine.

   A flag não vai para public.ofertas de propósito: o catálogo é do Payflow, e
   a área de membros não edita o que se vende -- edita o que se MOSTRA. São
   duas perguntas diferentes e quem as responde é gente diferente.

   Por oferta, e não por curso, porque um plano é uma oferta com vários cursos
   lá dentro: mostrar ou esconder um pacote é uma decisão só.

   SEM LINHA = NÃO SE MOSTRA. A Vitrine passou a ter botão de pagar; uma
   oferta que apareça por esquecimento é uma cobrança que ninguém decidiu. */
create table if not exists academia.vitrine (
  oferta_id     bigint primary key references public.ofertas(id) on delete cascade,
  mostrar       boolean not null default true,
  destaque      boolean not null default false,
  chamada       text,            -- uma linha própria, quando a da oferta não serve
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table academia.vitrine enable row level security;

/* Toda a gente lê: é uma montra. Só a equipa escreve. */
drop policy if exists vitrine_leitura on academia.vitrine;
create policy vitrine_leitura on academia.vitrine
  for select using (true);

drop policy if exists vitrine_escrita on academia.vitrine;
create policy vitrine_escrita on academia.vitrine
  for all using (academia_privado.e_equipa())
  with check (academia_privado.e_equipa());

grant select on academia.vitrine to anon, authenticated;
grant insert, update, delete on academia.vitrine to authenticated;
