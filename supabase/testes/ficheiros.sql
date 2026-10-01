-- Teste das regras do Storage por organização. Como o isolamento.sql: corre no
-- editor SQL ou por execute_sql, acaba num erro de propósito (nada fica
-- gravado — nem os objectos de teste, que nunca chegam a existir no Storage)
-- e usa só a conta de administrador do Shelton.
--
-- Não usa `delete`: o MCP do Supabase pede confirmação para isso e expira.
-- Para «deixar de ser membro» suspende-se a pertença.
--
-- Resultado esperado (01/10/2026):
--   B_pub=ok B_priv=ok K_prefixo=ok K_antigo=ok org_falsa=recusado prefixo_lixo=recusado
--   | aluno_B_capa=recusado aluno_B_foto=ok aluno_ve_material_sem_acesso=0
--   | suspenso_ve_B=0 suspenso_anexa=recusado K_antigos_privados_visiveis=1

do $$
declare
  v_eu uuid := '7f2bcba7-34cb-4273-aa00-70549fd472b2';
  v_k uuid := nucleo.organizacao_kingdom();
  v_b uuid; v_n int; res text := '';
begin
  insert into nucleo.organizacoes (slug, nome) values ('teste-ficheiros', 'Teste') returning id into v_b;
  insert into nucleo.membros (organizacao_id, utilizador_id, app, papel) values (v_b, v_eu, 'academia', 'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', v_eu, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', '', true);

  -- Equipa de B (e da Kingdom): escreve na pasta de cada uma; prefixos falsos não.
  execute 'set local role authenticated';
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'o/'||v_b||'/capas/t.png'); res := res || 'B_pub=ok';
  exception when insufficient_privilege then res := res || 'B_pub=recusado(MAU)'; end;
  begin insert into storage.objects (bucket_id, name) values ('academia-privado', 'o/'||v_b||'/materiais/x/t.pdf'); res := res || ' B_priv=ok';
  exception when insufficient_privilege then res := res || ' B_priv=recusado(MAU)'; end;
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'o/'||v_k||'/capas/t.png'); res := res || ' K_prefixo=ok';
  exception when insufficient_privilege then res := res || ' K_prefixo=recusado(MAU)'; end;
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'capas/antigo-teste.png'); res := res || ' K_antigo=ok';
  exception when insufficient_privilege then res := res || ' K_antigo=recusado(MAU)'; end;
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'o/00000000-0000-0000-0000-000000000000/capas/t.png'); res := res || ' org_falsa=ENTROU(MAU)';
  exception when insufficient_privilege then res := res || ' org_falsa=recusado'; end;
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'o/lixo/capas/t.png'); res := res || ' prefixo_lixo=ENTROU(MAU)';
  exception when insufficient_privilege then res := res || ' prefixo_lixo=recusado'; end;
  execute 'reset role';

  -- Aluno de B: trata da sua foto, não mexe nas capas, não vê material sem acesso.
  update nucleo.membros set papel = 'aluno' where organizacao_id = v_b and utilizador_id = v_eu;
  execute 'set local role authenticated';
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'o/'||v_b||'/capas/t2.png'); res := res || ' | aluno_B_capa=ENTROU(MAU)';
  exception when insufficient_privilege then res := res || ' | aluno_B_capa=recusado'; end;
  begin insert into storage.objects (bucket_id, name) values ('academia-publico', 'o/'||v_b||'/perfis/'||v_eu||'/f.png'); res := res || ' aluno_B_foto=ok';
  exception when insufficient_privilege then res := res || ' aluno_B_foto=recusado(MAU)'; end;
  select count(*) into v_n from storage.objects where bucket_id='academia-privado' and name like 'o/'||v_b||'/materiais/%';
  res := res || format(' aluno_ve_material_sem_acesso=%s', v_n);
  execute 'reset role';

  -- Suspenso em B: nada de B; os ficheiros antigos da Kingdom continuam.
  update nucleo.membros set estado = 'suspenso' where organizacao_id = v_b and utilizador_id = v_eu;
  execute 'set local role authenticated';
  select count(*) into v_n from storage.objects where bucket_id='academia-privado' and name like 'o/'||v_b||'/%';
  res := res || format(' | suspenso_ve_B=%s', v_n);
  begin insert into storage.objects (bucket_id, name) values ('academia-privado', 'o/'||v_b||'/comunidade/'||v_eu||'/a.pdf'); res := res || ' suspenso_anexa=ENTROU(MAU)';
  exception when insufficient_privilege then res := res || ' suspenso_anexa=recusado'; end;
  select count(*) into v_n from storage.objects where bucket_id = 'academia-privado' and name not like 'o/%';
  res := res || format(' K_antigos_privados_visiveis=%s', v_n);
  execute 'reset role';
  raise exception 'TESTE (revertido): %', res;
end $$;
