-- Aplicada a 17/11/2026 (versão 20261117105620). Provada antes numa transacção
-- desfeita, como administração da Kingdom e com uma conta inventada
-- (ensaio-aluno@exemplo.invalid), em 12 verificações: num módulo que abre aos
-- 30 dias, a aula com «Acesso livre» lê-se e marca-se como concluída, e as
-- outras cinco ficam por abrir; num módulo oculto, a aula livre aparece e as
-- outras não; «livre» num módulo não se grava (é não ter regra); uma regra
-- que não existe é recusada; guardar a lista vazia limpa tudo. Zero regras
-- antes e depois.
--
-- A aula com «Acesso livre» próprio (passo 2 da especificação «Convites,
-- Assinaturas e Turmas», Shelton, 17/11/2026).
--
-- A regra de uma aula vale mais do que a do módulo dela. Faltava poder dizer
-- o caso mais simples: «o módulo abre daqui a 30 dias, mas esta aula de
-- boas-vindas é livre». Até aqui «livre» era só a ausência de regra, e uma
-- aula não conseguia fugir à regra do módulo sem inventar uma («0 dias»).
-- A conta de quem lê (liberacao_da_aula) não muda: uma regra que não é
-- nenhuma das outras já dava a aula por liberada.

-- 1 «Acesso livre» passa a ser uma regra que uma aula pode ter ----------------
alter table academia.regras_de_liberacao drop constraint regras_de_liberacao_regra_check;
alter table academia.regras_de_liberacao add constraint regras_de_liberacao_regra_check
  check (regra in ('livre', 'data', 'dias', 'oculto', 'bloqueado', 'curso', 'modulo', 'aula'));
alter table academia.regras_de_liberacao add constraint regra_livre
  check (regra <> 'livre' or alvo_tipo = 'aula');

-- 2 Guardar: a regra livre de uma aula fica gravada ---------------------------
create or replace function academia.turma_regras_guardar(p_turma text, p_regras jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_curso text;
  x jsonb;
  v_tipo text;
  v_alvo text;
  v_regra text;
  v_n integer := 0;
begin
  if v_org is null or not academia_privado.e_equipa() then
    raise exception 'Só a equipa da escola define as regras de liberação.';
  end if;
  select t.curso_id into v_curso from academia.turmas t
   where t.id = p_turma and t.organizacao_id = v_org and t.removido_em is null;
  if v_curso is null then raise exception 'Esta turma não é desta escola.'; end if;

  delete from academia.regras_de_liberacao r where r.turma_id = p_turma;

  for x in select * from jsonb_array_elements(coalesce(p_regras, '[]'::jsonb)) loop
    v_tipo := x->>'alvoTipo'; v_alvo := x->>'alvoId'; v_regra := x->>'regra';
    -- «Acesso livre» num módulo é não ter regra; numa aula é uma regra a sério:
    -- abre a aula mesmo que o módulo dela esteja oculto, bloqueado ou programado.
    continue when v_regra is null or (v_regra = 'livre' and v_tipo = 'modulo');
    if v_tipo = 'modulo' then
      if not exists (select 1 from academia.modulos m where m.id = v_alvo and m.curso_id = v_curso and m.removido_em is null) then
        raise exception 'Um dos módulos não é do curso desta turma.';
      end if;
    elsif v_tipo = 'aula' then
      if not exists (select 1 from academia.aulas a join academia.modulos m on m.id = a.modulo_id
                      where a.id = v_alvo and m.curso_id = v_curso and a.removido_em is null and m.removido_em is null) then
        raise exception 'Uma das aulas não é do curso desta turma.';
      end if;
    else
      raise exception 'Uma regra tem de ser de um módulo ou de uma aula.';
    end if;
    if v_regra = 'data' and nullif(x->>'abreEm', '') is null then
      raise exception 'Uma regra de data programada precisa da data de liberação.';
    end if;
    if v_regra = 'dias' and nullif(x->>'dias', '') is null then
      raise exception 'Uma regra de dias após a compra precisa do número de dias.';
    end if;
    if v_regra = 'curso' and not exists (select 1 from academia.cursos c where c.id = x->>'cursoConcluido' and c.organizacao_id = v_org and c.removido_em is null) then
      raise exception 'Escolha o curso que tem de estar concluído.';
    end if;
    if v_regra = 'modulo' and not exists (select 1 from academia.modulos m where m.id = x->>'moduloConcluido' and m.organizacao_id = v_org and m.removido_em is null) then
      raise exception 'Escolha o módulo que tem de estar concluído.';
    end if;
    if v_regra = 'aula' and not exists (select 1 from academia.aulas a where a.id = x->>'aulaConcluida' and a.organizacao_id = v_org and a.removido_em is null) then
      raise exception 'Escolha a aula que tem de estar concluída.';
    end if;
    if v_regra = 'aula' and v_tipo = 'aula' and x->>'aulaConcluida' = v_alvo then
      raise exception 'Uma aula não pode depender de si própria.';
    end if;

    insert into academia.regras_de_liberacao (organizacao_id, turma_id, alvo_tipo, alvo_id, regra, abre_em, fecha_em, dias,
                                              curso_concluido, modulo_concluido, aula_concluida)
    values (v_org, p_turma, v_tipo, v_alvo, v_regra,
            case when v_regra = 'data' then nullif(x->>'abreEm', '')::date end,
            case when v_regra = 'data' then nullif(x->>'fechaEm', '')::date end,
            case when v_regra = 'dias' then (x->>'dias')::integer end,
            case when v_regra = 'curso' then x->>'cursoConcluido' end,
            case when v_regra = 'modulo' then x->>'moduloConcluido' end,
            case when v_regra = 'aula' then x->>'aulaConcluida' end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function academia.turma_regras_guardar(text, jsonb) from public, anon;
grant execute on function academia.turma_regras_guardar(text, jsonb) to authenticated;
