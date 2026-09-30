-- Migração 20260911081014 «academia_funcoes_de_acesso», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- Funcoes que decidem quem ve o que.
-- Ficam num schema proprio, que NAO e exposto na API: servem as
-- politicas de RLS, nao sao endpoints.
-- ============================================================
create schema if not exists academia_privado;
revoke all on schema academia_privado from anon, authenticated;
grant usage on schema academia_privado to authenticated;

-- Perfil de quem esta autenticado: admin, colaborador ou aluno.
create or replace function academia_privado.perfil()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.perfil::text
  from public.utilizadores u
  where u.id = auth.uid()
    and u.removido_em is null
    and u.estado = 'Ativo'
$$;

-- Equipa da academia: ve e escreve tudo.
create or replace function academia_privado.e_equipa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(academia_privado.perfil() in ('admin','colaborador'), false)
$$;

-- O lead do CRM que corresponde a quem esta autenticado. E por aqui
-- que a inscricao vendida se transforma em acesso.
create or replace function academia_privado.lead_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.lead_id
  from public.utilizadores u
  where u.id = auth.uid()
    and u.removido_em is null
    and u.estado = 'Ativo'
$$;

-- Tem acesso a este curso?
--   1. e da equipa; ou
--   2. tem acesso concedido a mao, ainda dentro da validade; ou
--   3. tem inscricao viva numa turma da oferta a que o curso pertence.
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
      select 1
      from academia.acessos a
      where a.utilizador_id = auth.uid()
        and a.curso_id = p_curso
        and (a.expira_em is null or a.expira_em >= current_date)
    )
    or exists (
      select 1
      from academia.cursos c
      join public.turmas t
        on t.oferta_id = c.oferta_id
       and t.removido_em is null
      join public.inscricoes i
        on i.turma_id = t.id
       and i.removido_em is null
      where c.id = p_curso
        and c.oferta_id is not null
        and c.removido_em is null
        and i.lead_id = academia_privado.lead_id()
        and i.estado::text in ('Não iniciada','Em curso','Concluída')
    )
$$;

-- Acesso a uma aula: depende do curso a que pertence.
create or replace function academia_privado.tem_acesso_aula(p_aula text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select academia_privado.tem_acesso(m.curso_id)
  from academia.aulas a
  join academia.modulos m on m.id = a.modulo_id
  where a.id = p_aula
$$;

-- O interruptor geral do mural, guardado em academia.config.
create or replace function academia_privado.alunos_publicam()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select (valor->>'alunosPublicam')::boolean
                   from academia.config where chave = 'geral'), true)
$$;

revoke all on function
  academia_privado.perfil(),
  academia_privado.e_equipa(),
  academia_privado.lead_id(),
  academia_privado.tem_acesso(text),
  academia_privado.tem_acesso_aula(text),
  academia_privado.alunos_publicam()
from public, anon;

grant execute on function
  academia_privado.perfil(),
  academia_privado.e_equipa(),
  academia_privado.lead_id(),
  academia_privado.tem_acesso(text),
  academia_privado.tem_acesso_aula(text),
  academia_privado.alunos_publicam()
to authenticated;
