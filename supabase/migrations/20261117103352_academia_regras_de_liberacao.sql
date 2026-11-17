-- Aplicada a 17/11/2026 (versão 20261117103352). Provada antes numa transacção
-- desfeita, como administração da Kingdom e com duas contas inventadas
-- (ensaio-*@exemplo.invalid), em 20 verificações: sem regras, o aluno lê as
-- 38 aulas do curso; com seis regras lê 25 e recebe as outras como «por
-- abrir», cada uma com a sua razão; uma aula bloqueada não se lê nem se marca
-- como concluída; a que depende de outra abre quando a outra se conclui; um
-- módulo oculto desaparece; outra turma do mesmo curso, sem regras, lê tudo;
-- um aluno real do Escala Previsivel continua a ler as suas aulas; um aluno
-- não lê nem guarda regras; outra escola não vê nada disto. Contagens iguais
-- antes e depois (22 acessos abertos, 9 turmas, 69 aulas).
--
-- Regras de liberação das aulas (passo 2 da especificação «Convites,
-- Assinaturas e Turmas», Shelton, 17/11/2026).
--
-- Cada turma pode dizer, por módulo e por aula, quando o conteúdo abre:
--   data       entre duas datas (a de fecho é opcional);
--   dias       N dias depois de a matrícula começar;
--   oculto     não aparece;
--   bloqueado  aparece com cadeado e não se abre;
--   curso / modulo / aula   quando a pessoa conclui outro curso, módulo ou aula.
-- Sem regra, o acesso é livre. A regra de uma aula vale mais do que a do
-- módulo dela. («Pontuação mínima» fica para depois: os pontos do Ranking
-- ainda se calculam no browser.)
--
-- A turma que vale para cada pessoa é a da matrícula ativa dela no curso;
-- quem abre o curso por outra via (aberto a todos os membros) usa a turma
-- padrão. Os dias contam do início da matrícula.
--
-- É A BASE QUE APLICA AS REGRAS, não o ecrã: uma aula oculta ou bloqueada
-- deixa de ser lida pelo aluno (nem o vídeo, nem os ficheiros, nem o quiz),
-- e não se pode marcar como concluída. Do que está bloqueado, o aluno
-- recebe só o título e a razão, por academia.aulas_por_abrir(). A equipa vê
-- tudo, como sempre. Uma turma sem regras não muda nada: é o caso de todas
-- as que existem hoje.

-- 1 As regras ----------------------------------------------------------------
create table academia.regras_de_liberacao (
  id               text primary key default academia.novo_id(),
  organizacao_id   uuid not null references nucleo.organizacoes(id),
  turma_id         text not null references academia.turmas(id) on delete cascade,
  alvo_tipo        text not null check (alvo_tipo in ('modulo', 'aula')),
  alvo_id          text not null,
  regra            text not null check (regra in ('data', 'dias', 'oculto', 'bloqueado', 'curso', 'modulo', 'aula')),
  abre_em          date,
  fecha_em         date,
  dias             integer check (dias between 0 and 36500),
  curso_concluido  text references academia.cursos(id) on delete cascade,
  modulo_concluido text references academia.modulos(id) on delete cascade,
  aula_concluida   text references academia.aulas(id) on delete cascade,
  criado_em        timestamptz not null default now(),
  unique (turma_id, alvo_tipo, alvo_id),
  constraint regra_data   check (regra <> 'data' or abre_em is not null),
  constraint regra_datas  check (fecha_em is null or abre_em is null or fecha_em >= abre_em),
  constraint regra_dias   check (regra <> 'dias' or dias is not null),
  constraint regra_curso  check (regra <> 'curso' or curso_concluido is not null),
  constraint regra_modulo check (regra <> 'modulo' or modulo_concluido is not null),
  constraint regra_aula   check (regra <> 'aula' or aula_concluida is not null)
);
create index regras_por_alvo on academia.regras_de_liberacao (alvo_tipo, alvo_id);

create trigger t_0_organizacao before insert or update of turma_id, organizacao_id on academia.regras_de_liberacao
  for each row execute function academia_privado.organizacao_da_mae('turmas', 'turma_id');

-- A equipa lê; escreve-se pela função, que confere tudo de uma vez.
alter table academia.regras_de_liberacao enable row level security;
create policy regras_leitura on academia.regras_de_liberacao for select to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa());
revoke all on academia.regras_de_liberacao from public, anon;
grant select on academia.regras_de_liberacao to authenticated;
grant all on academia.regras_de_liberacao to service_role;

-- 2 Como se decide -----------------------------------------------------------
-- A turma e o início que valem para uma pessoa num curso: os da matrícula
-- ativa; sem ela, a turma padrão e o dia em que entrou na escola.
create or replace function academia_privado.turma_efetiva(p_utilizador uuid, p_curso text, out turma text, out inicio date)
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(a.turma_id, t.id), coalesce(a.iniciado_em::date, m.criado_em::date, current_date)
    from academia.cursos c
    left join academia.turmas t on t.curso_id = c.id and t.padrao and t.removido_em is null
    left join academia.acessos a on a.curso_id = c.id and a.utilizador_id = p_utilizador
                                and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)
    left join nucleo.membros m on m.organizacao_id = c.organizacao_id and m.utilizador_id = p_utilizador and m.app = 'academia'
   where c.id = p_curso
$$;
revoke execute on function academia_privado.turma_efetiva(uuid, text) from public, anon, authenticated;

-- O estado de uma aula para uma pessoa: liberada, bloqueada (com a razão) ou
-- oculta.
create or replace function academia_privado.liberacao_da_aula(p_utilizador uuid, p_aula text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_modulo text;
  v_curso text;
  v_turma text;
  v_inicio date;
  r academia.regras_de_liberacao;
  v_abre date;
begin
  select a.modulo_id, m.curso_id into v_modulo, v_curso
    from academia.aulas a join academia.modulos m on m.id = a.modulo_id
   where a.id = p_aula;
  if v_curso is null then return jsonb_build_object('estado', 'oculta'); end if;

  select e.turma, e.inicio into v_turma, v_inicio from academia_privado.turma_efetiva(p_utilizador, v_curso) e;
  if v_turma is null then return jsonb_build_object('estado', 'liberada'); end if;

  -- A regra da aula vale mais do que a do módulo.
  select * into r from academia.regras_de_liberacao x
   where x.turma_id = v_turma and x.alvo_tipo = 'aula' and x.alvo_id = p_aula;
  if r.id is null then
    select * into r from academia.regras_de_liberacao x
     where x.turma_id = v_turma and x.alvo_tipo = 'modulo' and x.alvo_id = v_modulo;
  end if;
  if r.id is null then return jsonb_build_object('estado', 'liberada'); end if;

  if r.regra = 'oculto' then
    return jsonb_build_object('estado', 'oculta');
  elsif r.regra = 'bloqueado' then
    return jsonb_build_object('estado', 'bloqueada', 'regra', 'bloqueado');
  elsif r.regra = 'data' then
    if current_date < r.abre_em then
      return jsonb_build_object('estado', 'bloqueada', 'regra', 'data', 'abreEm', r.abre_em);
    elsif r.fecha_em is not null and current_date > r.fecha_em then
      return jsonb_build_object('estado', 'bloqueada', 'regra', 'data', 'fechouEm', r.fecha_em);
    end if;
    return jsonb_build_object('estado', 'liberada', 'fechaEm', r.fecha_em);
  elsif r.regra = 'dias' then
    v_abre := v_inicio + r.dias;
    if current_date < v_abre then
      return jsonb_build_object('estado', 'bloqueada', 'regra', 'dias', 'abreEm', v_abre, 'dias', r.dias);
    end if;
  elsif r.regra = 'curso' then
    if not (exists (select 1 from academia.aulas l join academia.modulos m on m.id = l.modulo_id and m.removido_em is null
                     where m.curso_id = r.curso_concluido and l.removido_em is null)
            and not exists (select 1 from academia.aulas l join academia.modulos m on m.id = l.modulo_id and m.removido_em is null
                             where m.curso_id = r.curso_concluido and l.removido_em is null
                               and not exists (select 1 from academia.progresso p where p.aula_id = l.id and p.utilizador_id = p_utilizador))) then
      return jsonb_build_object('estado', 'bloqueada', 'regra', 'curso',
               'nome', (select c.titulo from academia.cursos c where c.id = r.curso_concluido));
    end if;
  elsif r.regra = 'modulo' then
    if not (exists (select 1 from academia.aulas l where l.modulo_id = r.modulo_concluido and l.removido_em is null)
            and not exists (select 1 from academia.aulas l
                             where l.modulo_id = r.modulo_concluido and l.removido_em is null
                               and not exists (select 1 from academia.progresso p where p.aula_id = l.id and p.utilizador_id = p_utilizador))) then
      return jsonb_build_object('estado', 'bloqueada', 'regra', 'modulo',
               'nome', (select m.titulo from academia.modulos m where m.id = r.modulo_concluido));
    end if;
  elsif r.regra = 'aula' then
    if not exists (select 1 from academia.progresso p where p.aula_id = r.aula_concluida and p.utilizador_id = p_utilizador) then
      return jsonb_build_object('estado', 'bloqueada', 'regra', 'aula',
               'nome', (select l.titulo from academia.aulas l where l.id = r.aula_concluida));
    end if;
  end if;
  return jsonb_build_object('estado', 'liberada');
end $$;
revoke execute on function academia_privado.liberacao_da_aula(uuid, text) from public, anon, authenticated;

-- A aula está liberada para quem pede? A equipa vê tudo; um curso sem regra
-- nenhuma nem chega a fazer contas.
create or replace function academia_privado.aula_liberada(p_aula text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select academia_privado.e_equipa()
      or not exists (select 1
                       from academia.aulas a
                       join academia.modulos m on m.id = a.modulo_id
                       join academia.turmas t on t.curso_id = m.curso_id
                       join academia.regras_de_liberacao r on r.turma_id = t.id
                      where a.id = p_aula)
      or (academia_privado.liberacao_da_aula(auth.uid(), p_aula)->>'estado') = 'liberada'
$$;
revoke execute on function academia_privado.aula_liberada(text) from public, anon;
grant execute on function academia_privado.aula_liberada(text) to authenticated;

-- Um módulo oculto não aparece, salvo se alguma aula dele tiver regra própria
-- que não seja a de ocultar.
create or replace function academia_privado.modulo_oculto(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select not academia_privado.e_equipa() and exists (
    select 1
      from academia.modulos m
      cross join lateral academia_privado.turma_efetiva(auth.uid(), m.curso_id) e
      join academia.regras_de_liberacao r on r.turma_id = e.turma and r.alvo_tipo = 'modulo' and r.alvo_id = m.id and r.regra = 'oculto'
     where m.id = p_modulo
       and not exists (select 1 from academia.aulas a
                         join academia.regras_de_liberacao ra on ra.turma_id = e.turma and ra.alvo_tipo = 'aula' and ra.alvo_id = a.id
                        where a.modulo_id = m.id and a.removido_em is null and ra.regra <> 'oculto'))
$$;
revoke execute on function academia_privado.modulo_oculto(text) from public, anon;
grant execute on function academia_privado.modulo_oculto(text) to authenticated;

-- 3 Onde se aplica -----------------------------------------------------------
-- Tudo o que é de uma aula (ficheiros, quiz, comentários, marcar como
-- concluída) já perguntava por tem_acesso_aula: passa a exigir a aula liberada.
create or replace function academia_privado.tem_acesso_aula(p_aula text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select academia_privado.tem_acesso(m.curso_id) and academia_privado.aula_liberada(a.id)
  from academia.aulas a
  join academia.modulos m on m.id = a.modulo_id
  where a.id = p_aula
$$;

alter policy aulas_leitura on academia.aulas
  using (organizacao_id = (select academia_privado.organizacao())
         and removido_em is null
         and exists (select 1 from academia.modulos m
                      where m.id = aulas.modulo_id and academia_privado.tem_acesso(m.curso_id))
         and academia_privado.aula_liberada(id));

alter policy modulos_leitura on academia.modulos
  using (organizacao_id = (select academia_privado.organizacao())
         and removido_em is null
         and academia_privado.tem_acesso(curso_id)
         and not academia_privado.modulo_oculto(id));

-- O que está bloqueado, para o aluno ver com cadeado: só o título, a duração
-- e a razão. Nada do conteúdo.
create or replace function academia.aulas_por_abrir()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(x.j order by x.curso, x.ordem_modulo, x.ordem), '[]'::jsonb)
    from (select m.curso_id as curso, m.ordem as ordem_modulo, a.ordem,
                 jsonb_build_object('id', a.id, 'moduloId', a.modulo_id, 'cursoId', m.curso_id, 'titulo', a.titulo,
                                    'duracao', a.duracao, 'ordem', a.ordem) || l.estado as j
            from academia.cursos c
            join academia.modulos m on m.curso_id = c.id and m.removido_em is null
            join academia.aulas a on a.modulo_id = m.id and a.removido_em is null
            cross join lateral (select academia_privado.liberacao_da_aula(auth.uid(), a.id) as estado) l
           where c.organizacao_id = academia_privado.organizacao() and c.removido_em is null and c.publicado
             and not academia_privado.e_equipa()
             and exists (select 1 from academia.turmas t join academia.regras_de_liberacao r on r.turma_id = t.id
                          where t.curso_id = c.id)
             and academia_privado.tem_acesso(c.id)
             and l.estado->>'estado' = 'bloqueada') x
$$;
revoke execute on function academia.aulas_por_abrir() from public, anon;
grant execute on function academia.aulas_por_abrir() to authenticated;

-- O certificado conta as aulas que a pessoa pode ver: uma aula oculta para a
-- turma dela não a impede de concluir o curso.
create or replace function academia_privado.emitir_certificado(p_utilizador uuid, p_curso text, p_quando timestamp with time zone default now())
returns academia.certificados
language plpgsql
security definer
set search_path to ''
as $function$
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

  select valor->>'regraPct' into v_bruto from academia.config where chave = 'certificado' and organizacao_id = (select organizacao_id from academia.cursos where id = p_curso);
  if v_bruto ~ '^\s*\d+(\.\d+)?\s*$' then
    v_regra := least(100, greatest(1, round(v_bruto::numeric)::int));
  end if;

  select count(*), count(p.aula_id) into v_total, v_feitas
    from academia.aulas a
    join academia.modulos m on m.id = a.modulo_id and m.removido_em is null
    left join academia.progresso p on p.aula_id = a.id and p.utilizador_id = p_utilizador
   where m.curso_id = p_curso and a.removido_em is null
     and (not exists (select 1 from academia.turmas t join academia.regras_de_liberacao r on r.turma_id = t.id
                       where t.curso_id = p_curso)
          or (academia_privado.liberacao_da_aula(p_utilizador, a.id)->>'estado') <> 'oculta');

  if v_total = 0 or round(v_feitas * 100.0 / v_total) < v_regra then
    return null;
  end if;

  select nullif(trim(nome), '') into v_nome from public.utilizadores where id = p_utilizador;

  insert into academia.certificados (utilizador_id, curso_id, nome, curso_titulo, emitido_em)
  values (p_utilizador, p_curso, v_nome, v_curso.titulo, coalesce(p_quando, now()))
  on conflict (utilizador_id, curso_id) do nothing
  returning * into v_cert;

  return v_cert;
end $function$;

-- 4 Guardar as regras de uma turma, todas de uma vez -------------------------
-- Recebe a lista inteira: o que não vier deixa de existir (volta a «acesso
-- livre»). Confere que cada alvo é do curso da turma.
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
    continue when v_regra is null or v_regra = 'livre';
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
