-- Migração 20260911081558 «academia_acesso_por_email_do_lead», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- O CRM tem um guarda (privado.impedir_auto_promocao) que reverte
-- utilizadores.lead_id para quem nao e admin — e ainda bem. Por isso
-- a academia nao depende de escrever esse campo: liga o aluno ao lead
-- pelo email, que e o mesmo por onde o convite foi enviado, e aceita
-- tambem o lead_id quando um admin ja o tiver preenchido.
-- ============================================================
create or replace function academia_privado.leads_do_utilizador()
returns setof bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id
  from public.utilizadores u
  join public.leads l
    on (l.id = u.lead_id or lower(l.email) = lower(u.email))
  where u.id = auth.uid()
    and u.removido_em is null
    and u.estado = 'Ativo'
    and l.removido_em is null
$$;

create or replace function academia_privado.tem_acesso(p_curso text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    academia_privado.e_equipa()
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

revoke all on function academia_privado.leads_do_utilizador() from public, anon;
grant execute on function academia_privado.leads_do_utilizador() to authenticated;

-- A funcao lead_id() unica deixa de fazer sentido: um email pode
-- corresponder a mais do que um registo no CRM.
drop function if exists academia_privado.lead_id();
