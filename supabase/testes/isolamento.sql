-- Teste de isolamento entre organizações (F1a, passo 3). Corre-se no editor SQL
-- do Supabase, ou por execute_sql. Acaba sempre num erro de propósito: o erro
-- desfaz a transacção, por isso nada fica gravado e não sai email nenhum. O
-- resultado vem na mensagem de erro.
--
-- Usa só a conta de administrador do Shelton (a regra do CLAUDE.md: testes só
-- com dados dele). Monta uma organização de teste, faz dele administrador lá
-- e depois aluno, e confirma que nenhum lado vê ou mexe no outro.
--
-- Resultado esperado (01/10/2026):
--   S1 equipa=t cursos_visiveis=0 curso_novo_em_B=t modulo_em_B=t
--      modulo_em_curso_K=recusado editar_curso_K=0 acesso_curso_K=f avisos_de_K=0
--      aviso_de_aula_em_B=1
--   S2 cursos=<os da Kingdom>/<os da Kingdom> ve_curso_B=0 aviso_B=0 editar_curso_B=0
--   S3 org_kingdom=t
--   S4 equipa=f cursos=1 acesso_curso_B=f config=0 aluno_cria_curso=recusado

do $$
declare
  v_eu  uuid := '7f2bcba7-34cb-4273-aa00-70549fd472b2';
  v_k   uuid := nucleo.organizacao_kingdom();
  v_b   uuid;
  v_nk  int;
  v_cb  text; v_ob uuid; v_om uuid; v_m text;
  v_ck  text;
  v_n   int;
  res   text := '';
begin
  select count(*) into v_nk from academia.cursos where organizacao_id = v_k;
  select id into v_ck from academia.cursos where organizacao_id = v_k limit 1;
  insert into nucleo.organizacoes (slug, nome) values ('teste-isolamento', 'Teste de isolamento') returning id into v_b;
  insert into nucleo.membros (organizacao_id, utilizador_id, app, papel) values (v_b, v_eu, 'academia', 'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', v_eu, 'role', 'authenticated')::text, true);

  -- S1: equipa de B, no endereço de B
  perform set_config('request.headers', '{"x-organizacao":"teste-isolamento"}', true);
  execute 'set local role authenticated';
  res := res || format('S1 equipa=%s', academia_privado.e_equipa());
  select count(*) into v_n from academia.cursos; res := res || format(' cursos_visiveis=%s', v_n);
  insert into academia.cursos (titulo, publicado) values ('Curso de teste B', true) returning id, organizacao_id into v_cb, v_ob;
  res := res || format(' curso_novo_em_B=%s', v_ob = v_b);
  insert into academia.modulos (curso_id, titulo) values (v_cb, 'M1') returning id, organizacao_id into v_m, v_om;
  res := res || format(' modulo_em_B=%s', v_om = v_b);
  begin
    insert into academia.modulos (curso_id, titulo) values (v_ck, 'Intruso');
    res := res || ' modulo_em_curso_K=ENTROU(MAU)';
  exception when insufficient_privilege then res := res || ' modulo_em_curso_K=recusado';
  end;
  update academia.cursos set titulo = titulo where id = v_ck; get diagnostics v_n = row_count;
  res := res || format(' editar_curso_K=%s', v_n);
  res := res || format(' acesso_curso_K=%s', academia_privado.tem_acesso(v_ck));
  select count(*) into v_n from academia.notificacoes where organizacao_id <> v_b; res := res || format(' avisos_de_K=%s', v_n);
  insert into academia.aulas (modulo_id, titulo) values (v_m, 'A1');
  select count(*) into v_n from academia.notificacoes where link = v_cb; res := res || format(' aviso_de_aula_em_B=%s', v_n);
  execute 'reset role';

  -- S2: a mesma pessoa no endereço da Kingdom
  perform set_config('request.headers', '{"x-organizacao":"membros.kingdomcompny.com"}', true);
  execute 'set local role authenticated';
  select count(*) into v_n from academia.cursos; res := res || format(' | S2 cursos=%s/%s', v_n, v_nk);
  select count(*) into v_n from academia.cursos where id = v_cb; res := res || format(' ve_curso_B=%s', v_n);
  select count(*) into v_n from academia.notificacoes where link = v_cb; res := res || format(' aviso_B=%s', v_n);
  update academia.cursos set titulo = titulo where id = v_cb; get diagnostics v_n = row_count;
  res := res || format(' editar_curso_B=%s', v_n);
  execute 'reset role';

  -- S3: sem cabeçalho e com duas organizações: cai na Kingdom
  perform set_config('request.headers', '', true);
  execute 'set local role authenticated';
  res := res || format(' | S3 org_kingdom=%s', academia_privado.organizacao() = v_k);
  execute 'reset role';

  -- S4: em B como aluno
  update nucleo.membros set papel = 'aluno' where organizacao_id = v_b and utilizador_id = v_eu;
  perform set_config('request.headers', '{"x-organizacao":"teste-isolamento"}', true);
  execute 'set local role authenticated';
  res := res || format(' | S4 equipa=%s', academia_privado.e_equipa());
  select count(*) into v_n from academia.cursos; res := res || format(' cursos=%s', v_n);
  res := res || format(' acesso_curso_B=%s', academia_privado.tem_acesso(v_cb));
  select count(*) into v_n from academia.config; res := res || format(' config=%s', v_n);
  begin
    insert into academia.cursos (titulo) values ('Aluno a criar');
    res := res || ' aluno_cria_curso=ENTROU(MAU)';
  exception when insufficient_privilege then res := res || ' aluno_cria_curso=recusado';
  end;
  execute 'reset role';

  raise exception 'TESTE (revertido): %', res;
end $$;
