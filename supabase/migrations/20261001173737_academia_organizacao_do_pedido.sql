-- F1a, passo 3a — as funções da Academia passam a saber de que organização é
-- o pedido. Para a Kingdom nada muda: sem cabeçalho, a organização é a única
-- de que a pessoa é membro, e na falta disso a Kingdom.
--
--   organizacao()      a organização do pedido: o cabeçalho x-organizacao
--                      (domínio ou slug, enviado pela app — passo 4); senão a
--                      única organização da pessoa; senão a Kingdom.
--   perfil()           o papel nessa organização, lido de nucleo.membros (o
--                      `dono` conta como admin). e_equipa() usa-o, por isso
--                      «é da equipa» passa a ser «da equipa desta organização».
--   tem_acesso()       só a cursos desta organização.
--   tabelas filhas     copiam a organização da mãe (a aula do módulo, o
--                      progresso da aula, …): a linha fica sempre com a mãe,
--                      mesmo que quem escreve mande outra.
--   acessos            dar um acesso faz da pessoa aluna dessa organização.
--   valor por omissão  o que nasce é da organização do pedido.
--   Vitrine            liga-se às ofertas do Payflow, que até ao F1b são só da
--                      Kingdom: fora da Kingdom fica vazia.
--
-- As regras de leitura (RLS) passam a filtrar pela organização no passo 3b.
--
-- Aplicada por execute_sql em quatro partes (o apply_migration fica à espera
-- de uma confirmação que não chega quando há `drop`; esta versão não tem) e
-- registada à mão em schema_migrations. Conferido depois, simulando a sessão
-- de cada pessoa: para a Kingdom, o papel e os cursos não mudam.

set lock_timeout = '10s';

grant usage on schema academia_privado to service_role;

create or replace function academia_privado.organizacao()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cab text := lower(trim(nullif(current_setting('request.headers', true), '')::json ->> 'x-organizacao'));
  v_org uuid;
begin
  if v_cab <> '' then
    select o.id into v_org
      from nucleo.organizacoes o
     where o.estado = 'ativa'
       and (o.slug = v_cab
            or exists (select 1 from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia' and d.dominio = v_cab));
    if v_org is not null then return v_org; end if;
  end if;

  if auth.uid() is not null then
    select case when count(*) = 1 then (array_agg(m.organizacao_id))[1] end into v_org
      from nucleo.membros m
      join nucleo.organizacoes o on o.id = m.organizacao_id and o.estado = 'ativa'
     where m.utilizador_id = auth.uid() and m.app = 'academia' and m.estado = 'ativo';
    if v_org is not null then return v_org; end if;
  end if;

  return nucleo.organizacao_kingdom();
end $$;
revoke all on function academia_privado.organizacao() from public, anon;
grant execute on function academia_privado.organizacao() to authenticated, service_role;

create or replace function academia_privado.perfil()
returns text language sql stable security definer set search_path = ''
as $$
  select case x.p when 'dono' then 'admin' else x.p end
    from (select nucleo.papel(academia_privado.organizacao(), 'academia') as p) x
   where exists (select 1 from public.utilizadores u
                  where u.id = auth.uid() and u.removido_em is null and u.estado = 'Ativo')
$$;

/* A pessoa é membro activo da organização do pedido (para a equipa ver os
   perfis e o questionário de quem é seu, e não os de outras organizações). */
create or replace function academia_privado.e_membro(p_utilizador uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from nucleo.membros m
                  where m.organizacao_id = academia_privado.organizacao()
                    and m.utilizador_id = p_utilizador
                    and m.app = 'academia' and m.estado = 'ativo')
$$;
revoke all on function academia_privado.e_membro(uuid) from public, anon;
grant execute on function academia_privado.e_membro(uuid) to authenticated;

/* Até ao F1b, o Payflow (ofertas, inscrições, Vitrine) é só da Kingdom. */
create or replace function academia_privado.payflow_ligado()
returns boolean language sql stable security definer set search_path = ''
as $$ select academia_privado.organizacao() = nucleo.organizacao_kingdom() $$;
revoke all on function academia_privado.payflow_ligado() from public, anon;
grant execute on function academia_privado.payflow_ligado() to authenticated;

create or replace function academia_privado.tem_acesso(p_curso text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from academia.cursos c0
                  where c0.id = p_curso and c0.organizacao_id = academia_privado.organizacao())
     and (
         academia_privado.e_equipa()
      or exists (
           select 1 from academia.cursos c
            where c.id = p_curso and c.aberto_a_todos and c.publicado and c.removido_em is null
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
             join public.turmas t     on t.oferta_id = c.oferta_id and t.removido_em is null
             join public.inscricoes i on i.turma_id  = t.id        and i.removido_em is null
            where c.id = p_curso
              and c.oferta_id is not null
              and c.removido_em is null
              and i.lead_id in (select academia_privado.leads_do_utilizador())
              and i.estado::text in ('Não iniciada','Em curso','Concluída')
              and not exists (
                    select 1 from public.lancamentos l
                     where l.inscricao_id = i.id
                       and l.tipo   = 'Entrada'
                       and l.estado = 'Pendente'
                       and l.removido_em is null
                       and l.vencimento_acordado
                       and l.data < current_date - 7
                  )
         )
     )
$$;

create or replace function academia_privado.alunos_publicam()
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select coalesce((select (valor->>'alunosPublicam')::boolean
                   from academia.config
                  where chave = 'geral' and organizacao_id = academia_privado.organizacao()), true)
$$;

/* Os avisos automáticos ficam na organização do que os fez nascer. A versão
   de quatro argumentos fica, e passa a usar a organização do pedido. */
create or replace function academia_privado.anunciar(p_organizacao uuid, p_titulo text, p_descricao text, p_tipo text, p_link text)
returns void language sql security definer set search_path to 'public', 'pg_temp'
as $$
  insert into academia.notificacoes (organizacao_id, titulo, descricao, tipo, link)
  values (p_organizacao, p_titulo, p_descricao, p_tipo, p_link)
$$;
revoke all on function academia_privado.anunciar(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function academia_privado.anunciar(p_titulo text, p_descricao text, p_tipo text, p_link text)
returns void language sql security definer set search_path to 'public', 'pg_temp'
as $$ select academia_privado.anunciar(academia_privado.organizacao(), p_titulo, p_descricao, p_tipo, p_link) $$;

create or replace function academia_privado.anunciar_aula()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_curso academia.cursos%rowtype;
begin
  select c.* into v_curso
  from academia.modulos m
  join academia.cursos c on c.id = m.curso_id
  where m.id = new.modulo_id;

  if found and v_curso.publicado and v_curso.removido_em is null then
    perform academia_privado.anunciar(
      v_curso.organizacao_id,
      'Nova aula em ' || v_curso.titulo,
      new.titulo,
      'aula', v_curso.id);
  end if;
  return new;
end;
$$;

create or replace function academia_privado.anunciar_curso()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if new.publicado and not coalesce(old.publicado, false) and new.removido_em is null then
    perform academia_privado.anunciar(
      new.organizacao_id,
      'Novo curso: ' || new.titulo,
      coalesce(nullif(new.subtitulo, ''), 'Já pode começar.'),
      'curso', new.id);
  end if;
  return new;
end;
$$;

create or replace function academia_privado.anunciar_evento()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  perform academia_privado.anunciar(
    new.organizacao_id,
    new.titulo,
    to_char(new.data, 'DD/MM') || ' às ' || to_char(new.hora, 'HH24:MI'),
    'evento', new.id);
  return new;
end;
$$;

/* A linha filha fica com a organização da mãe. */
create or replace function academia_privado.organizacao_da_mae()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_id  text := to_jsonb(new) ->> tg_argv[1];
  v_org uuid;
begin
  if v_id is not null then
    execute format('select organizacao_id from academia.%I where id = $1', tg_argv[0])
       into v_org using v_id;
    if v_org is not null then new.organizacao_id := v_org; end if;
  end if;
  return new;
end $$;
revoke all on function academia_privado.organizacao_da_mae() from public, anon, authenticated;

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select * from (values
      ('modulos',            'cursos',       'curso_id'),
      ('aulas',              'modulos',      'modulo_id'),
      ('aula_ficheiros',     'aulas',        'aula_id'),
      ('aula_quiz',          'aulas',        'aula_id'),
      ('progresso',          'aulas',        'aula_id'),
      ('avaliacoes',         'aulas',        'aula_id'),
      ('certificados',       'cursos',       'curso_id'),
      ('acessos',            'cursos',       'curso_id'),
      ('mensagens',          'espacos',      'espaco_id'),
      ('reacoes',            'mensagens',    'mensagem_id'),
      ('notificacoes_lidas', 'notificacoes', 'notificacao_id'),
      ('presencas',          'eventos',      'evento_id'),
      ('salas',              'eventos',      'evento_id'),
      ('plano_cursos',       'planos',       'plano_id')
    ) as t(filha, mae, coluna)
  loop
    -- «t_0_…»: corre antes dos outros triggers da tabela (vão por ordem de nome).
    execute format('create trigger t_0_organizacao before insert or update of %I, organizacao_id on academia.%I
                      for each row execute function academia_privado.organizacao_da_mae(%L, %L)',
                   r.coluna, r.filha, r.mae, r.coluna);
    n := n + 1;
  end loop;
  if n <> 14 then raise exception 'esperava 14 triggers, ficaram %', n; end if;
end $$;

/* Dar um acesso faz da pessoa aluna da organização do curso. */
create or replace function academia_privado.membro_ao_dar_acesso()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from auth.users where id = new.utilizador_id) then
    insert into nucleo.membros (organizacao_id, utilizador_id, app, papel)
    values (new.organizacao_id, new.utilizador_id, 'academia', 'aluno')
    on conflict (organizacao_id, utilizador_id, app) do nothing;
  end if;
  return null;
end $$;
revoke all on function academia_privado.membro_ao_dar_acesso() from public, anon, authenticated;
create trigger t_membro_ao_dar_acesso after insert on academia.acessos
  for each row execute function academia_privado.membro_ao_dar_acesso();

/* O que nasce é da organização do pedido. */
do $$
declare
  t text;
  n int := 0;
begin
  for t in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'academia' and c.relkind = 'r' order by 1
  loop
    execute format('alter table academia.%I alter column organizacao_id set default academia_privado.organizacao()', t);
    n := n + 1;
  end loop;
  if n <> 28 then raise exception 'esperava 28 tabelas, foram %', n; end if;
end $$;

/* Remendos pontuais: cada um tem de encontrar o seu texto exactamente uma vez. */
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select * from (values
      ('academia_privado.emitir_certificado(uuid,text,timestamp with time zone)'::regprocedure,
       $a$from academia.config where chave = 'certificado'$a$,
       $a$from academia.config where chave = 'certificado' and organizacao_id = (select organizacao_id from academia.cursos where id = p_curso)$a$),
      ('academia.vitrine_mostrar(bigint,boolean,boolean,text)'::regprocedure,
       $a$if not academia_privado.e_equipa() then$a$,
       $a$if not academia_privado.e_equipa() or not academia_privado.payflow_ligado() then$a$),
      ('academia.vitrine_pre_venda(bigint,boolean,date)'::regprocedure,
       $a$if not academia_privado.e_equipa() then$a$,
       $a$if not academia_privado.e_equipa() or not academia_privado.payflow_ligado() then$a$),
      ('academia.vitrine_para_equipa()'::regprocedure,
       $a$where o.removido_em is null
      and o.entrega in ('Academia', 'Plano')$a$,
       $a$where o.removido_em is null
      and o.entrega in ('Academia', 'Plano')
      and academia_privado.payflow_ligado()$a$),
      ('academia.vitrine_do_aluno()'::regprocedure,
       $a$where o.removido_em is null and o.estado = 'Ativa'$a$,
       $a$where o.removido_em is null and o.estado = 'Ativa' and academia_privado.payflow_ligado()$a$),
      ('academia.pre_venda_dos_meus_cursos()'::regprocedure,
       $a$join public.ofertas o on o.removido_em is null$a$,
       $a$join public.ofertas o on o.removido_em is null and academia_privado.payflow_ligado()$a$)
    ) as t(fn, de, para)
  loop
    v_def := pg_get_functiondef(r.fn);
    if (length(v_def) - length(replace(v_def, r.de, ''))) / length(r.de) <> 1 then
      raise exception 'remendo de %: o texto não aparece exactamente uma vez', r.fn;
    end if;
    execute replace(v_def, r.de, r.para);
  end loop;
end $$;
