-- Migração 20260911081047 «academia_rls», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- RLS: o aluno so ve o que e dele e o que lhe foi aberto.
-- A entrada e so por convite, por isso "anon" nao le nada.
-- ============================================================
grant usage on schema academia to authenticated;
grant select, insert, update, delete on all tables in schema academia to authenticated;
alter default privileges in schema academia
  grant select, insert, update, delete on tables to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'categorias','cursos','modulos','aulas','aula_ficheiros','aula_quiz',
    'acessos','convites','progresso','avaliacoes','onboarding','certificados','perfis',
    'espacos','mensagens','reacoes','eventos','presencas','banners','conquistas',
    'notificacoes','notificacoes_lidas','config'
  ]
  loop
    execute format('alter table academia.%I enable row level security', t);
    execute format('alter table academia.%I force row level security', t);
  end loop;
end $$;

-- ---------------- Conteudo ----------------
-- A Vitrine obriga a que o aluno veja que o curso existe; o que esta
-- la dentro e que depende do acesso.
create policy cursos_leitura on academia.cursos for select to authenticated
  using (academia_privado.e_equipa() or (publicado and removido_em is null));
create policy cursos_escrita on academia.cursos for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy categorias_leitura on academia.categorias for select to authenticated using (true);
create policy categorias_escrita on academia.categorias for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy modulos_leitura on academia.modulos for select to authenticated
  using (removido_em is null and academia_privado.tem_acesso(curso_id));
create policy modulos_escrita on academia.modulos for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy aulas_leitura on academia.aulas for select to authenticated
  using (removido_em is null and exists (
    select 1 from academia.modulos m
    where m.id = modulo_id and academia_privado.tem_acesso(m.curso_id)));
create policy aulas_escrita on academia.aulas for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy ficheiros_leitura on academia.aula_ficheiros for select to authenticated
  using (academia_privado.tem_acesso_aula(aula_id));
create policy ficheiros_escrita on academia.aula_ficheiros for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy quiz_leitura on academia.aula_quiz for select to authenticated
  using (academia_privado.tem_acesso_aula(aula_id));
create policy quiz_escrita on academia.aula_quiz for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

-- ---------------- Acesso e convites ----------------
create policy acessos_leitura on academia.acessos for select to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa());
create policy acessos_escrita on academia.acessos for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

-- Convites so existem para a equipa. Aceitar um convite passa por uma
-- funcao do servidor, nao por leitura directa da tabela.
create policy convites_equipa on academia.convites for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

-- ---------------- Progresso e avaliacoes ----------------
create policy progresso_proprio on academia.progresso for select to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa());
create policy progresso_marcar on academia.progresso for insert to authenticated
  with check (utilizador_id = auth.uid() and academia_privado.tem_acesso_aula(aula_id));
create policy progresso_desmarcar on academia.progresso for delete to authenticated
  using (utilizador_id = auth.uid());

create policy avaliacoes_leitura on academia.avaliacoes for select to authenticated
  using (academia_privado.e_equipa()
         or utilizador_id = auth.uid()
         or (oculto = false and academia_privado.tem_acesso_aula(aula_id)));
create policy avaliacoes_propria on academia.avaliacoes for insert to authenticated
  with check (utilizador_id = auth.uid() and academia_privado.tem_acesso_aula(aula_id));
create policy avaliacoes_editar on academia.avaliacoes for update to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa())
  with check (utilizador_id = auth.uid() or academia_privado.e_equipa());
create policy avaliacoes_apagar on academia.avaliacoes for delete to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa());

create policy onboarding_proprio on academia.onboarding for all to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa())
  with check (utilizador_id = auth.uid());

create policy certificados_leitura on academia.certificados for select to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa());
create policy certificados_escrita on academia.certificados for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy perfis_proprio on academia.perfis for all to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa())
  with check (utilizador_id = auth.uid());

-- ---------------- Comunidade ----------------
create policy espacos_leitura on academia.espacos for select to authenticated
  using (ativo or academia_privado.e_equipa());
create policy espacos_escrita on academia.espacos for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy mensagens_leitura on academia.mensagens for select to authenticated
  using (academia_privado.e_equipa() or oculto = false);
create policy mensagens_publicar on academia.mensagens for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (academia_privado.e_equipa() or (
      academia_privado.alunos_publicam()
      and exists (select 1 from academia.espacos e
                  where e.id = espaco_id and e.ativo and e.so_admin_publica = false)
    ))
  );
create policy mensagens_moderar on academia.mensagens for update to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());
create policy mensagens_apagar on academia.mensagens for delete to authenticated
  using (autor_id = auth.uid() or academia_privado.e_equipa());

create policy reacoes_proprias on academia.reacoes for all to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa())
  with check (utilizador_id = auth.uid());

-- ---------------- Eventos, banners, gamificacao ----------------
create policy eventos_leitura on academia.eventos for select to authenticated using (true);
create policy eventos_escrita on academia.eventos for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy presencas_propria on academia.presencas for all to authenticated
  using (utilizador_id = auth.uid() or academia_privado.e_equipa())
  with check (utilizador_id = auth.uid());

create policy banners_leitura on academia.banners for select to authenticated
  using (ativo or academia_privado.e_equipa());
create policy banners_escrita on academia.banners for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy conquistas_leitura on academia.conquistas for select to authenticated using (true);
create policy conquistas_escrita on academia.conquistas for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

-- ---------------- Notificacoes e configuracao ----------------
create policy notificacoes_leitura on academia.notificacoes for select to authenticated
  using (utilizador_id is null or utilizador_id = auth.uid() or academia_privado.e_equipa());
create policy notificacoes_escrita on academia.notificacoes for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy lidas_proprias on academia.notificacoes_lidas for all to authenticated
  using (utilizador_id = auth.uid()) with check (utilizador_id = auth.uid());

create policy config_leitura on academia.config for select to authenticated using (true);
create policy config_escrita on academia.config for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());
