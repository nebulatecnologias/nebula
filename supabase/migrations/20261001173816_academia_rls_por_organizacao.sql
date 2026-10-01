-- F1a, passo 3b — cada regra de leitura e escrita da Academia passa a exigir
-- que a linha seja da organização do pedido. Junto com o passo 3a (o papel é
-- o da organização do pedido), um administrador de uma organização não vê nem
-- mexe no que é de outra, e um aluno só vê a Academia onde está.
--
-- A regra antiga fica tal como estava, com a condição à frente:
--   (organizacao_id = (select academia_privado.organizacao())) and (<antiga>)
-- O (select …) faz o Postgres calculá-la uma vez por consulta, não por linha.
--
-- perfis e onboarding são da pessoa (chave: utilizador_id), não de uma
-- organização: a pessoa vê os seus em qualquer lado; a equipa só vê os de quem
-- é membro da sua organização.
--
-- Aplicada por execute_sql e registada à mão (ver o passo 3a).

set lock_timeout = '10s';

do $$
declare
  r      record;
  v_cond constant text := '(organizacao_id = (select academia_privado.organizacao()))';
  v_q    text;
  v_c    text;
  n      int := 0;
  total  int;
begin
  select count(*) into total from pg_policies where schemaname = 'academia';

  for r in select * from pg_policies where schemaname = 'academia' order by tablename, policyname loop
    if coalesce(r.qual, '') || coalesce(r.with_check, '') ~ 'organizacao\(\)|e_membro\(' then
      continue;  -- já tratada
    end if;

    if r.tablename in ('perfis', 'onboarding') then
      v_q := replace(r.qual, 'academia_privado.e_equipa()',
                     '(academia_privado.e_equipa() AND academia_privado.e_membro(utilizador_id))');
      if v_q = r.qual then raise exception '%.%: não encontrei e_equipa()', r.tablename, r.policyname; end if;
      v_c := r.with_check;
    else
      v_q := case when r.qual       is not null then v_cond || ' AND (' || r.qual       || ')' end;
      v_c := case when r.with_check is not null then v_cond || ' AND (' || r.with_check || ')' end;
    end if;

    execute format('alter policy %I on academia.%I', r.policyname, r.tablename)
         || case when v_q is not null then format(' using (%s)', v_q) else '' end
         || case when v_c is not null then format(' with check (%s)', v_c) else '' end;
    n := n + 1;
  end loop;

  raise notice '% de % regras alteradas', n, total;
  if n <> total then raise exception 'esperava alterar as % regras, alterei %', total, n; end if;
end $$;
