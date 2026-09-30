-- Migração 20260911223716 «academia_plano_geral_e_eventos», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- 1) Plano geral: cursos abertos a quem entra na academia
--    sem precisar de uma inscricao ou convite que os nomeie.
-- ============================================================
alter table academia.cursos
  add column if not exists aberto_a_todos boolean not null default false;

comment on column academia.cursos.aberto_a_todos is
  'Curso do plano geral: qualquer aluno da academia o ve, mesmo sem plano especifico.';

create or replace function academia_privado.tem_acesso(p_curso text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    academia_privado.e_equipa()
    or exists (
      select 1 from academia.cursos c
      where c.id = p_curso and c.aberto_a_todos
        and c.publicado and c.removido_em is null
    )
    or exists (
      select 1 from academia.acessos a
      where a.utilizador_id = auth.uid()
        and a.curso_id = p_curso
        and (a.expira_em is null or a.expira_em >= current_date)
    )
    or exists (
      select 1
      from academia.cursos c
      join public.turmas t
        on t.oferta_id = c.oferta_id and t.removido_em is null
      join public.inscricoes i
        on i.turma_id = t.id and i.removido_em is null
      where c.id = p_curso
        and c.oferta_id is not null
        and c.removido_em is null
        and i.lead_id in (select academia_privado.leads_do_utilizador())
        and i.estado::text in ('Não iniciada','Em curso','Concluída')
    )
$$;

-- O ecra precisa de saber a que cursos esta pessoa tem mesmo acesso.
-- Sem isto o browser adivinha, e adivinhava mal: mostrava cartoes de
-- cursos que depois abriam vazios.
create or replace function academia.meus_cursos()
returns setof text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select c.id
  from academia.cursos c
  where c.removido_em is null
    and (academia_privado.e_equipa() or c.publicado)
    and academia_privado.tem_acesso(c.id)
$$;

revoke all on function academia.meus_cursos() from public, anon;
grant execute on function academia.meus_cursos() to authenticated;

-- ============================================================
-- 2) Eventos: local, tipo de acesso e para quem sao visiveis
-- ============================================================
alter table academia.eventos
  add column if not exists local      text,
  add column if not exists acesso     text not null default 'gratuito',
  add column if not exists oferta_id  bigint references public.ofertas(id) on delete set null,
  add column if not exists cursos     text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_acesso_check') then
    alter table academia.eventos
      add constraint eventos_acesso_check check (acesso in ('gratuito','exclusivo','pago'));
  end if;
end $$;

comment on column academia.eventos.local   is 'Morada, para os encontros presenciais.';
comment on column academia.eventos.acesso  is 'gratuito | exclusivo | pago';
comment on column academia.eventos.cursos  is 'Se vazio e sem oferta, o evento e para toda a academia.';

-- Quem ve o quê. Sem restricao nenhuma, o evento e de toda a academia.
create or replace function academia_privado.ve_evento(p_oferta bigint, p_cursos text[])
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    academia_privado.e_equipa()
    or (p_oferta is null and coalesce(array_length(p_cursos, 1), 0) = 0)
    or exists (
      select 1 from unnest(coalesce(p_cursos, '{}'::text[])) as curso
      where academia_privado.tem_acesso(curso)
    )
    or (p_oferta is not null and exists (
      select 1
      from public.turmas t
      join public.inscricoes i on i.turma_id = t.id and i.removido_em is null
      where t.oferta_id = p_oferta and t.removido_em is null
        and i.lead_id in (select academia_privado.leads_do_utilizador())
        and i.estado::text in ('Não iniciada','Em curso','Concluída')
    ))
$$;

drop policy if exists eventos_leitura on academia.eventos;
create policy eventos_leitura on academia.eventos
  for select using (academia_privado.ve_evento(oferta_id, cursos));
