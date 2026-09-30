-- Os certificados gravam-se quando o aluno conclui o curso, e ficam guardados
-- (decidido pelo Shelton a 30/09/2026).
--
-- Até aqui academia.certificados tinha zero linhas e nada lhe escrevia: o ecrã
-- calculava o certificado a cada visita, com a data de hoje. Um certificado que
-- muda de data sempre que se abre não é um certificado. Agora:
--
--   1. Quem grava é a base. Um trigger em academia.progresso, depois de cada
--      aula concluída, vê se o curso chegou à regra (config «certificado»,
--      regraPct, 100 por omissão) e, se sim, grava o certificado. O browser
--      não escreve nada: a regra de escrita continua a ser só da equipa.
--   2. O que se grava fica. O nome do aluno e o título do curso guardam-se no
--      momento, com a data e o código; mudar a regra, tirar aulas, mudar o
--      nome do curso ou fechá-lo depois não mexe num certificado já passado.
--   3. academia.verificar_certificados() grava os que faltam a quem está na
--      sessão — para quem já tinha chegado à regra antes de ela baixar, por
--      exemplo. A app chama-a ao entrar. Não dá nada a ninguém que não tenha
--      concluído: só repete a mesma conta.
--
-- A conta é a do ecrã (progressoCurso): aulas não removidas, de módulos não
-- removidos, concluídas sobre o total, arredondado.

alter table academia.certificados
  add column if not exists nome text,
  add column if not exists curso_titulo text;

comment on column academia.certificados.nome is
  'O nome do aluno no momento em que o certificado se gravou. Não acompanha mudanças posteriores.';
comment on column academia.certificados.curso_titulo is
  'O título do curso no momento em que o certificado se gravou.';

create or replace function academia_privado.emitir_certificado(
  p_utilizador uuid, p_curso text, p_quando timestamptz default now()
) returns academia.certificados
language plpgsql security definer set search_path = ''
as $$
declare
  v_curso  record;
  v_bruto  text;
  v_regra  int := 100;
  v_total  int;
  v_feitas int;
  v_nome   text;
  v_cert   academia.certificados;
begin
  select id, titulo, certificado, removido_em into v_curso
    from academia.cursos where id = p_curso;
  if v_curso.id is null or v_curso.removido_em is not null or v_curso.certificado is false then
    return null;
  end if;

  select valor->>'regraPct' into v_bruto from academia.config where chave = 'certificado';
  if v_bruto ~ '^\s*\d+(\.\d+)?\s*$' then
    v_regra := least(100, greatest(1, round(v_bruto::numeric)::int));
  end if;

  select count(*), count(p.aula_id) into v_total, v_feitas
    from academia.aulas a
    join academia.modulos m on m.id = a.modulo_id and m.removido_em is null
    left join academia.progresso p on p.aula_id = a.id and p.utilizador_id = p_utilizador
   where m.curso_id = p_curso and a.removido_em is null;

  if v_total = 0 or round(v_feitas * 100.0 / v_total) < v_regra then
    return null;
  end if;

  select nullif(trim(nome), '') into v_nome from public.utilizadores where id = p_utilizador;

  insert into academia.certificados (utilizador_id, curso_id, nome, curso_titulo, emitido_em)
  values (p_utilizador, p_curso, v_nome, v_curso.titulo, coalesce(p_quando, now()))
  on conflict (utilizador_id, curso_id) do nothing
  returning * into v_cert;

  return v_cert;
end $$;

revoke all on function academia_privado.emitir_certificado(uuid, text, timestamptz) from public, anon, authenticated;

-- Depois de cada aula concluída. Um problema aqui nunca impede a aula de
-- ficar concluída: o certificado volta a tentar-se na próxima entrada.
create or replace function academia_privado.certificar_ao_concluir()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_curso text;
begin
  select m.curso_id into v_curso
    from academia.aulas a join academia.modulos m on m.id = a.modulo_id
   where a.id = new.aula_id;
  if v_curso is not null then
    perform academia_privado.emitir_certificado(new.utilizador_id, v_curso, now());
  end if;
  return null;
exception when others then
  raise warning 'certificado nao gravado (%, %): %', new.utilizador_id, new.aula_id, sqlerrm;
  return null;
end $$;

revoke all on function academia_privado.certificar_ao_concluir() from public, anon, authenticated;

drop trigger if exists certificar_ao_concluir on academia.progresso;
create trigger certificar_ao_concluir
  after insert or update on academia.progresso
  for each row execute function academia_privado.certificar_ao_concluir();

-- Os que faltam a quem está na sessão. Devolve quantos gravou.
create or replace function academia.verificar_certificados()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_eu uuid := auth.uid();
  v_curso text;
  v_n int := 0;
begin
  if v_eu is null then return 0; end if;
  for v_curso in
    select distinct m.curso_id
      from academia.progresso p
      join academia.aulas a on a.id = p.aula_id
      join academia.modulos m on m.id = a.modulo_id
     where p.utilizador_id = v_eu
       and not exists (select 1 from academia.certificados c
                        where c.utilizador_id = v_eu and c.curso_id = m.curso_id)
  loop
    if academia_privado.emitir_certificado(v_eu, v_curso, now()) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

revoke all on function academia.verificar_certificados() from public, anon;
grant execute on function academia.verificar_certificados() to authenticated;

-- Quem já tinha concluído antes disto: grava-se com a data da última aula,
-- que é quando concluiu. A tabela tem FORCE ROW LEVEL SECURITY: confere-se a
-- contagem antes e depois, para um insert que não grave nada não passar em
-- silêncio.
do $$
declare
  v_antes int;
  v_esperados int;
  v_depois int;
  r record;
begin
  select count(*) into v_antes from academia.certificados;

  create temporary table _concluidos on commit drop as
  with regra as (
    select case when valor->>'regraPct' ~ '^\s*\d+(\.\d+)?\s*$'
                then least(100, greatest(1, round((valor->>'regraPct')::numeric)::int)) else 100 end as pct
      from academia.config where chave = 'certificado'
  ), total as (
    select m.curso_id, count(*) as n
      from academia.aulas a join academia.modulos m on m.id = a.modulo_id and m.removido_em is null
     where a.removido_em is null group by 1
  ), feitas as (
    select p.utilizador_id, m.curso_id, count(*) as n, max(p.concluida_em) as ultima
      from academia.progresso p
      join academia.aulas a on a.id = p.aula_id and a.removido_em is null
      join academia.modulos m on m.id = a.modulo_id and m.removido_em is null
     group by 1, 2
  )
  select f.utilizador_id, f.curso_id, f.ultima
    from feitas f
    join total t using (curso_id)
    join academia.cursos c on c.id = f.curso_id and c.removido_em is null and c.certificado is not false
   where round(f.n * 100.0 / t.n) >= coalesce((select pct from regra), 100)
     and not exists (select 1 from academia.certificados x
                      where x.utilizador_id = f.utilizador_id and x.curso_id = f.curso_id);

  select count(*) into v_esperados from _concluidos;

  for r in select * from _concluidos loop
    perform academia_privado.emitir_certificado(r.utilizador_id, r.curso_id, r.ultima);
  end loop;

  select count(*) into v_depois from academia.certificados;
  raise notice 'certificados: % antes, % esperados, % depois', v_antes, v_esperados, v_depois;
  if v_depois <> v_antes + v_esperados then
    raise exception 'esperava % certificados novos, gravaram-se %', v_esperados, v_depois - v_antes;
  end if;
end $$;
