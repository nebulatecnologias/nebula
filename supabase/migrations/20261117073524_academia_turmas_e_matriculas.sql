-- Aplicada a 17/11/2026 (versão 20261117073524). Provada antes numa transacção
-- desfeita, como administração da Kingdom e com duas contas inventadas
-- (ensaio-*@exemplo.invalid), em mais de 40 verificações: 22 acessos abertos
-- antes e 22 depois, sem uma diferença; os 18 alunos do Escala Previsivel
-- continuam a abrir o curso; um aluno não lê turmas nem define matrículas;
-- pendente não abre; dar, tirar, prazo, venda, reembolso, nova compra e
-- convite (os caminhos antigos) deixam a matrícula no estado certo; um curso
-- tem sempre uma turma padrão; uma turma com membros ativos não se apaga;
-- um curso novo nasce com a «Turma A»; outra escola não vê nada disto.
-- Contagens iguais antes e depois (23 acessos, 38 convites, 35 membros).
--
-- Turmas e matrículas (passo 1 da especificação «Convites, Assinaturas e
-- Turmas», entregue pelo Shelton a 17/11/2026 e planeada com ele nesse dia).
--
-- Uma TURMA passa a ser uma edição de um curso: tem nome, prazo de acesso
-- (dias; vazio = sem prazo) e, no passo 2, as regras de liberação das aulas.
-- Todo o curso tem pelo menos uma, a «Turma A», que é a turma padrão dele;
-- um curso tem sempre uma e uma só turma padrão.
--
-- Uma MATRÍCULA é o que até aqui se chamava acesso (academia.acessos: uma
-- linha por pessoa e curso). Ganha a turma, um estado (ativo, pendente,
-- expirado, desativado) e a data em que começou. A tabela e o nome ficam:
-- mudar-lhes o nome obrigava a tocar em tudo o que lê e escreve acessos, sem
-- ganho nenhum para quem usa.
--
-- O que muda em quem abre um curso: a matrícula tem de estar ATIVA e dentro
-- do prazo. Os 23 acessos de hoje passam a matrículas na turma padrão do seu
-- curso, com o mesmo prazo: os abertos ficam ativos, o fechado fica
-- desativado. Ninguém ganha nem perde acesso.
--
-- O que escreve acessos à moda antiga (a venda, o convite, dar e tirar na
-- ficha do membro) continua a funcionar sem ser reescrito já: um gatilho dá a
-- turma padrão a quem não a traz e mantém o estado certo quando alguém fecha
-- pondo o prazo em ontem ou reabre tirando-o. Esses caminhos passam para o
-- modelo novo nos passos 4 e 5.

-- 1 Turmas ------------------------------------------------------------------
create table academia.turmas (
  id             text primary key default academia.novo_id(),
  organizacao_id uuid not null references nucleo.organizacoes(id),
  curso_id       text not null references academia.cursos(id) on delete cascade,
  nome           text not null check (length(trim(nome)) between 1 and 120),
  prazo_dias     integer check (prazo_dias between 1 and 36500),
  padrao         boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  removido_em    timestamptz
);
create index turmas_por_curso on academia.turmas (curso_id);
create index turmas_por_organizacao on academia.turmas (organizacao_id);
create unique index turmas_uma_padrao_por_curso on academia.turmas (curso_id) where padrao and removido_em is null;

create trigger t_0_organizacao before insert or update of curso_id, organizacao_id on academia.turmas
  for each row execute function academia_privado.organizacao_da_mae('cursos', 'curso_id');

alter table academia.turmas enable row level security;
create policy turmas_equipa on academia.turmas for all to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa())
  with check (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa());
revoke all on academia.turmas from public, anon;
grant select, insert, update, delete on academia.turmas to authenticated;
grant all on academia.turmas to service_role;

-- 2 A matrícula: o acesso ganha turma, estado e início ------------------------
alter table academia.acessos
  add column turma_id text references academia.turmas(id) on delete set null,
  add column estado text not null default 'ativo' check (estado in ('ativo', 'pendente', 'expirado', 'desativado')),
  add column iniciado_em timestamptz not null default now();
create index acessos_por_turma on academia.acessos (turma_id);

-- Cada curso com a sua «Turma A», padrão; cada acesso na turma do seu curso.
insert into academia.turmas (organizacao_id, curso_id, nome, padrao, criado_em)
select c.organizacao_id, c.id, 'Turma A', true, c.criado_em from academia.cursos c;

update academia.acessos a
   set turma_id = t.id,
       iniciado_em = a.criado_em,
       estado = case when a.expira_em is not null and a.expira_em < current_date then 'desativado' else 'ativo' end
  from academia.turmas t
 where t.curso_id = a.curso_id and t.padrao;

-- 3 As regras das turmas -----------------------------------------------------
create or replace function academia_privado.turma_validar()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_n integer;
begin
  new.nome := trim(new.nome);
  new.atualizado_em := now();
  if tg_op = 'UPDATE' and new.curso_id is distinct from old.curso_id then
    raise exception 'Uma turma não muda de curso. Crie uma turma no outro curso.';
  end if;

  if new.removido_em is not null then
    if tg_op = 'UPDATE' and old.removido_em is null then
      if old.padrao then
        raise exception 'Esta é a turma padrão do curso. Marque outra como padrão antes de a apagar.';
      end if;
      select count(*) into v_n from academia.acessos a
       where a.turma_id = new.id and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date);
      if v_n > 0 then
        raise exception 'Esta turma tem % com a matrícula ativa. Passe-os para outra turma antes de a apagar.',
          case when v_n = 1 then '1 membro' else v_n || ' membros' end;
      end if;
    end if;
    new.padrao := false;
    return new;
  end if;

  -- Um curso tem sempre uma turma padrão, e só uma: a primeira turma do
  -- curso é-o; marcar outra desmarca a anterior; desmarcar a única não dá.
  if not exists (select 1 from academia.turmas t
                  where t.curso_id = new.curso_id and t.padrao and t.removido_em is null and t.id <> new.id) then
    if tg_op = 'UPDATE' and old.padrao and not new.padrao and pg_trigger_depth() = 1 then
      raise exception 'Um curso tem sempre uma turma padrão. Marque outra como padrão em vez de desmarcar esta.';
    end if;
    if pg_trigger_depth() = 1 then new.padrao := true; end if;
  elsif new.padrao then
    update academia.turmas t set padrao = false
     where t.curso_id = new.curso_id and t.padrao and t.removido_em is null and t.id <> new.id;
  end if;
  return new;
end $$;
revoke execute on function academia_privado.turma_validar() from public, anon, authenticated;
create trigger t_turma_validar before insert or update on academia.turmas
  for each row execute function academia_privado.turma_validar();

-- Um curso novo nasce com a sua «Turma A».
create or replace function academia_privado.turma_do_curso_novo()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into academia.turmas (organizacao_id, curso_id, nome, padrao)
  values (new.organizacao_id, new.id, 'Turma A', true);
  return null;
end $$;
revoke execute on function academia_privado.turma_do_curso_novo() from public, anon, authenticated;
create trigger t_turma_do_curso_novo after insert on academia.cursos
  for each row execute function academia_privado.turma_do_curso_novo();

-- A matrícula coerente, venha de onde vier.
create or replace function academia_privado.matricula_coerente()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_aberto_antes boolean;
  v_aberto_agora boolean := new.expira_em is null or new.expira_em >= current_date;
begin
  if tg_op = 'INSERT' then
    if new.turma_id is null then
      select t.id into new.turma_id from academia.turmas t
       where t.curso_id = new.curso_id and t.padrao and t.removido_em is null;
    end if;
    -- Quem grava um acesso já com o prazo passado está a gravá-lo fechado.
    if new.estado = 'ativo' and not v_aberto_agora then new.estado := 'desativado'; end if;
  else
    v_aberto_antes := old.expira_em is null or old.expira_em >= current_date;
    if new.turma_id is null and new.curso_id = old.curso_id then new.turma_id := old.turma_id; end if;
    -- Quem escreve à moda antiga não fala em estado: fecha pondo o prazo em
    -- ontem, e reabre tirando-o ou voltando a dar o acesso (muda a origem ou
    -- a nota). O estado acompanha.
    if new.estado = old.estado then
      if old.estado = 'ativo' and v_aberto_antes and not v_aberto_agora then
        new.estado := 'desativado';
      elsif old.estado in ('desativado', 'expirado') and v_aberto_agora
            and (not v_aberto_antes or new.origem is distinct from old.origem or new.nota is distinct from old.nota) then
        new.estado := 'ativo';
      end if;
    end if;
    -- Voltar a estar ativa recomeça a contagem dos dias da matrícula.
    if new.estado = 'ativo' and old.estado <> 'ativo' and new.iniciado_em = old.iniciado_em then
      new.iniciado_em := now();
    end if;
  end if;
  if new.turma_id is not null
     and not exists (select 1 from academia.turmas t where t.id = new.turma_id and t.curso_id = new.curso_id) then
    raise exception 'A turma não é deste curso.';
  end if;
  return new;
end $$;
revoke execute on function academia_privado.matricula_coerente() from public, anon, authenticated;
create trigger t_matricula_coerente before insert or update on academia.acessos
  for each row execute function academia_privado.matricula_coerente();

-- 4 Quem abre um curso: a matrícula ativa e dentro do prazo -------------------
create or replace function academia_privado.tem_acesso_em(p_organizacao uuid, p_curso text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from academia.cursos c0
                  where c0.id = p_curso and c0.organizacao_id = p_organizacao)
     and (
         academia_privado.e_equipa_em(p_organizacao)
      or (nucleo.conta_em_dia(p_organizacao)
          and not exists (
             select 1 from nucleo.membros ms
              where ms.organizacao_id = p_organizacao
                and ms.utilizador_id = auth.uid()
                and ms.app = 'academia'
                and ms.estado <> 'ativo'
          )
          and (
           (exists (
             select 1 from academia.cursos c
              where c.id = p_curso and c.aberto_a_todos and c.publicado and c.removido_em is null
            )
            and exists (
             select 1 from nucleo.membros mm
              where mm.organizacao_id = p_organizacao
                and mm.utilizador_id = auth.uid()
                and mm.app = 'academia'
                and mm.estado = 'ativo'
            ))
        or exists (
             select 1 from academia.acessos a
              where a.utilizador_id = auth.uid()
                and a.curso_id = p_curso
                and a.estado = 'ativo'
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
      ))
     )
$function$;

-- 5 O que a equipa lê ---------------------------------------------------------
-- As turmas da escola, para os cartões: os membros com a matrícula ativa, os
-- comentários que eles deixaram nas aulas e o progresso médio deles.
create or replace function academia.turmas_da_escola()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
begin
  if v_org is null or not academia_privado.e_equipa() then
    raise exception 'Só a equipa da escola vê as turmas.';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'nome', t.nome, 'cursoId', t.curso_id, 'prazoDias', t.prazo_dias,
             'padrao', t.padrao, 'criadoEm', t.criado_em,
             'membros', x.membros, 'comentarios', x.comentarios, 'progresso', x.progresso)
             order by t.criado_em desc, t.id), '[]'::jsonb)
      from academia.turmas t
      join academia.cursos c on c.id = t.curso_id and c.removido_em is null
      cross join lateral (
        select count(*) as membros,
               (select count(*) from academia.avaliacoes av
                 where av.curso_id = t.curso_id and nullif(trim(coalesce(av.comentario, '')), '') is not null
                   and av.utilizador_id in (select a2.utilizador_id from academia.acessos a2
                                             where a2.turma_id = t.id and a2.estado = 'ativo'
                                               and (a2.expira_em is null or a2.expira_em >= current_date))) as comentarios,
               coalesce(round(avg(case when au.total > 0 then least(1.0, pr.feitas::numeric / au.total) else 0 end) * 100), 0) as progresso
          from academia.acessos a
          cross join lateral (select count(*) as total from academia.aulas l
                               join academia.modulos m on m.id = l.modulo_id and m.removido_em is null
                              where m.curso_id = t.curso_id and l.removido_em is null) au
          cross join lateral (select count(*) as feitas from academia.progresso p
                               join academia.aulas l on l.id = p.aula_id and l.removido_em is null
                               join academia.modulos m on m.id = l.modulo_id and m.removido_em is null
                              where p.utilizador_id = a.utilizador_id and m.curso_id = t.curso_id) pr
         where a.turma_id = t.id and a.estado = 'ativo'
           and (a.expira_em is null or a.expira_em >= current_date)
      ) x
     where t.organizacao_id = v_org and t.removido_em is null
  );
end $$;
revoke execute on function academia.turmas_da_escola() from public, anon;
grant execute on function academia.turmas_da_escola() to authenticated;

-- A matrícula de um membro num curso, de uma vez: a turma, o estado e a
-- expiração (o «Controle de Matrículas» da ficha do membro). Sem turma, vale
-- a padrão do curso. Ativa sem data nenhuma, vale o prazo da turma.
create or replace function academia.matricula_definir(p_utilizador uuid, p_curso text, p_turma text, p_estado text, p_expira date, p_prazo_da_turma boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_turma academia.turmas;
  v_estado text := coalesce(nullif(p_estado, ''), 'ativo');
  v_expira date := p_expira;
  v_a academia.acessos;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  if not exists (select 1 from academia.cursos c where c.id = p_curso and c.organizacao_id = v_org and c.removido_em is null) then
    raise exception 'Este curso não é desta escola.';
  end if;
  if v_estado not in ('ativo', 'pendente', 'expirado', 'desativado') then
    raise exception 'Estado desconhecido.';
  end if;
  select * into v_turma from academia.turmas t
   where t.curso_id = p_curso and t.removido_em is null
     and (t.id = p_turma or (p_turma is null and t.padrao));
  if v_turma.id is null then raise exception 'Essa turma não é deste curso.'; end if;
  if p_prazo_da_turma then
    v_expira := case when v_turma.prazo_dias is not null then current_date + v_turma.prazo_dias end;
  end if;
  -- Ativa com a data já passada é uma matrícula expirada.
  if v_estado = 'ativo' and v_expira is not null and v_expira < current_date then v_estado := 'expirado'; end if;

  insert into academia.acessos as a (utilizador_id, curso_id, origem, turma_id, estado, expira_em, concedido_por)
  values (p_utilizador, p_curso, 'manual', v_turma.id, v_estado, v_expira, auth.uid())
  on conflict (utilizador_id, curso_id) do update
    set turma_id = excluded.turma_id, estado = excluded.estado, expira_em = excluded.expira_em
  returning * into v_a;

  return jsonb_build_object('curso', v_a.curso_id, 'turma', v_a.turma_id, 'estado', v_a.estado,
                            'expira', v_a.expira_em, 'iniciado', v_a.iniciado_em);
end $$;
revoke execute on function academia.matricula_definir(uuid, text, text, text, date, boolean) from public, anon;
grant execute on function academia.matricula_definir(uuid, text, text, text, date, boolean) to authenticated;

create or replace function academia.membro_ficha(p_utilizador uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_m nucleo.membros;
  v_u record;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  select * into v_m from nucleo.membros m
   where m.organizacao_id = v_org and m.utilizador_id = p_utilizador and m.app = 'academia';
  select u.id, u.nome, u.email, u.estado::text as estado, u.lead_id, u.criado_em, au.last_sign_in_at
    into v_u
    from public.utilizadores u left join auth.users au on au.id = u.id
   where u.id = p_utilizador;

  return jsonb_build_object(
    'id', v_u.id, 'nome', v_u.nome, 'email', v_u.email,
    'papel', case v_m.papel when 'dono' then 'admin' else v_m.papel end,
    'dono', v_m.papel = 'dono',
    'estado', case when v_m.estado = 'ativo' and v_u.estado = 'Ativo' then 'ativo' else 'suspenso' end,
    'contaAtiva', v_u.estado = 'Ativo',
    'desde', case when v_org = nucleo.organizacao_kingdom() then v_u.criado_em else v_m.criado_em end,
    'ultimoAcesso', v_u.last_sign_in_at,
    'acessos', (select coalesce(jsonb_agg(jsonb_build_object(
                   'curso', a.curso_id, 'origem', a.origem, 'expira', a.expira_em, 'nota', a.nota,
                   'desde', a.criado_em,
                   'ativo', a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date),
                   'turma', a.turma_id, 'iniciado', a.iniciado_em,
                   'estado', case when a.estado = 'ativo' and a.expira_em < current_date then 'expirado' else a.estado end,
                   'plano', case when a.nota like 'plano:%' then substr(a.nota, 7) end)
                   order by a.criado_em), '[]'::jsonb)
                  from academia.acessos a
                  join academia.cursos c on c.id = a.curso_id and c.organizacao_id = v_org and c.removido_em is null
                 where a.utilizador_id = p_utilizador),
    'payflow', (select coalesce(jsonb_agg(distinct c.id), '[]'::jsonb)
                  from academia.cursos c
                  join public.turmas t     on t.oferta_id = c.oferta_id and t.removido_em is null
                  join public.inscricoes i on i.turma_id = t.id and i.removido_em is null
                  join public.leads l      on l.id = i.lead_id and l.removido_em is null
                 where c.organizacao_id = v_org and c.removido_em is null and c.oferta_id is not null
                   and (l.id = v_u.lead_id or lower(l.email) = lower(v_u.email))
                   and i.estado::text in ('Não iniciada', 'Em curso', 'Concluída')),
    'concluidas', (select coalesce(jsonb_object_agg(x.curso, x.n), '{}'::jsonb)
                     from (select mo.curso_id as curso, count(*) as n
                             from academia.progresso p
                             join academia.aulas au   on au.id = p.aula_id and au.removido_em is null
                             join academia.modulos mo on mo.id = au.modulo_id and mo.removido_em is null
                            where p.utilizador_id = p_utilizador and mo.organizacao_id = v_org
                            group by mo.curso_id) x)
  );
end $$;

create or replace function academia.membros_da_organizacao()
returns table(id uuid, nome text, email text, perfil text, estado text, criado_em timestamptz, lead_id bigint,
              dono boolean, ultimo_acesso timestamptz, cursos integer, planos text[])
language sql
stable
security definer
set search_path to ''
as $$
  select u.id, u.nome, u.email,
         case m.papel when 'dono' then 'admin' else m.papel end,
         case when m.estado = 'ativo' and u.estado = 'Ativo' then 'Ativo' else 'Suspenso' end,
         case when m.organizacao_id = nucleo.organizacao_kingdom() then u.criado_em else m.criado_em end,
         u.lead_id,
         m.papel = 'dono',
         au.last_sign_in_at,
         (select count(*)::integer from academia.acessos a
            join academia.cursos c on c.id = a.curso_id and c.organizacao_id = m.organizacao_id and c.removido_em is null
           where a.utilizador_id = u.id and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)),
         (select coalesce(array_agg(distinct substr(a.nota, 7)), '{}') from academia.acessos a
            join academia.cursos c on c.id = a.curso_id and c.organizacao_id = m.organizacao_id
           where a.utilizador_id = u.id and a.nota like 'plano:%'
             and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date))
    from nucleo.membros m
    join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null
    left join auth.users au on au.id = u.id
   where academia_privado.e_equipa()
     and m.organizacao_id = academia_privado.organizacao()
     and m.app = 'academia'
$$;

create or replace function academia.curso_acessos(p_curso text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_c academia.cursos;
begin
  if v_org is null or not academia_privado.e_equipa() then
    raise exception 'Só a equipa da escola vê quem tem acesso a um curso.';
  end if;
  select * into v_c from academia.cursos c
   where c.id = p_curso and c.organizacao_id = v_org and c.removido_em is null;
  if v_c.id is null then raise exception 'Este curso não é desta escola.'; end if;

  return jsonb_build_object(
    'curso', v_c.id,
    'abertoATodos', v_c.aberto_a_todos,
    'publicado', v_c.publicado,
    'alunosAtivos', (select count(*) from nucleo.membros m
                       join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null and u.estado::text = 'Ativo'
                      where m.organizacao_id = v_org and m.app = 'academia' and m.estado = 'ativo' and m.papel = 'aluno'),
    'equipa', (select count(*) from nucleo.membros m
                 join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null and u.estado::text = 'Ativo'
                where m.organizacao_id = v_org and m.app = 'academia' and m.estado = 'ativo' and m.papel <> 'aluno'),
    -- Quem tem um acesso próprio a este curso: os abertos primeiro.
    'pessoas', (select coalesce(jsonb_agg(x.j order by x.ativo desc, x.desde desc), '[]'::jsonb)
                  from (select jsonb_build_object(
                                 'id', u.id, 'nome', u.nome, 'email', u.email,
                                 'papel', case m.papel when 'dono' then 'admin' else coalesce(m.papel, 'aluno') end,
                                 'suspenso', not (coalesce(m.estado, 'ativo') = 'ativo' and u.estado::text = 'Ativo'),
                                 'origem', a.origem, 'nota', a.nota,
                                 'plano', case when a.nota like 'plano:%' then substr(a.nota, 7) end,
                                 'expira', a.expira_em, 'desde', a.criado_em,
                                 'turma', a.turma_id, 'iniciado', a.iniciado_em,
                                 'estado', case when a.estado = 'ativo' and a.expira_em < current_date then 'expirado' else a.estado end,
                                 'ativo', a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)) as j,
                               (a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)) as ativo, a.criado_em as desde
                          from academia.acessos a
                          join public.utilizadores u on u.id = a.utilizador_id and u.removido_em is null
                          left join nucleo.membros m on m.organizacao_id = v_org and m.utilizador_id = u.id and m.app = 'academia'
                         where a.curso_id = p_curso
                         order by (a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)) desc, a.criado_em desc
                         limit 2000) x),
    -- Quem entra por uma inscrição no Payflow (só onde o curso está ligado a
    -- uma oferta de lá): não se tira daqui, trata-se lá.
    'payflow', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email)), '[]'::jsonb)
                  from public.turmas t
                  join public.inscricoes i on i.turma_id = t.id and i.removido_em is null
                  join public.leads l      on l.id = i.lead_id and l.removido_em is null
                  join public.utilizadores u on u.removido_em is null and (u.lead_id = l.id or lower(u.email) = lower(l.email))
                  join nucleo.membros m on m.organizacao_id = v_org and m.utilizador_id = u.id and m.app = 'academia'
                 where v_c.oferta_id is not null and t.oferta_id = v_c.oferta_id and t.removido_em is null
                   and i.estado::text in ('Não iniciada', 'Em curso', 'Concluída')),
    'convites', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', c.id, 'email', c.email, 'nome', c.nome, 'origem', c.origem,
                          'expiraEm', c.expira_em, 'acessoDias', c.acesso_dias, 'criadoEm', c.criado_em)
                          order by c.criado_em desc), '[]'::jsonb)
                   from academia.convites c
                  where c.organizacao_id = v_org and p_curso = any(c.cursos)
                    and c.aceite_em is null and c.revogado_em is null and c.expira_em >= now()),
    -- As turmas deste curso, com quantos membros têm a matrícula ativa em cada uma.
    'turmas', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', t.id, 'nome', t.nome, 'padrao', t.padrao, 'prazoDias', t.prazo_dias,
                         'membros', (select count(*) from academia.acessos a
                                      where a.turma_id = t.id and a.estado = 'ativo'
                                        and (a.expira_em is null or a.expira_em >= current_date)))
                         order by t.padrao desc, t.criado_em), '[]'::jsonb)
                 from academia.turmas t where t.curso_id = p_curso and t.removido_em is null),
    'ofertas', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', o.id, 'nome', o.nome, 'ativa', o.ativa, 'naVitrine', o.na_vitrine,
                          'dias', o.dias_de_acesso, 'preco', o.preco, 'moeda', o.moeda,
                          'produtos', cardinality(o.produtos), 'temLink', o.link is not null)
                          order by o.ordem, o.criado_em), '[]'::jsonb)
                  from academia.ofertas o
                 where o.organizacao_id = v_org and o.removido_em is null and p_curso = any(o.cursos))
  );
end $$;

-- Dar um curso ou um plano na ficha do membro ativa a matrícula, esteja ela
-- como estiver (uma pendente ou desativada com a data ainda por passar não
-- se abria só por lhe mudar o prazo).
create or replace function academia.membro_dar_acesso(p_utilizador uuid, p_cursos text[], p_expira date default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_curso text;
  v_n integer := 0;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  if p_expira is not null and p_expira < current_date then
    raise exception 'Esse prazo já passou.' using errcode = '22023';
  end if;
  foreach v_curso in array coalesce(p_cursos, '{}'::text[]) loop
    continue when not exists (select 1 from academia.cursos c
                               where c.id = v_curso and c.organizacao_id = v_org and c.removido_em is null);
    insert into academia.acessos as a (utilizador_id, curso_id, origem, concedido_por, expira_em, nota, organizacao_id)
    values (p_utilizador, v_curso, 'manual', auth.uid(), p_expira, 'Dado na academia', v_org)
    on conflict (utilizador_id, curso_id) do update
      set expira_em     = excluded.expira_em,
          concedido_por = excluded.concedido_por,
          estado = 'ativo',
          origem = case when a.expira_em < current_date or a.estado <> 'ativo' then excluded.origem else a.origem end,
          nota   = case when a.expira_em < current_date or a.estado <> 'ativo' then excluded.nota else a.nota end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function academia.membro_dar_plano(p_utilizador uuid, p_plano text, p_expira date default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_curso text;
  v_n integer := 0;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  if not exists (select 1 from academia.planos p
                  where p.id = p_plano and p.organizacao_id = v_org and p.removido_em is null) then
    raise exception 'Esse plano não existe nesta escola.' using errcode = 'P0002';
  end if;
  if p_expira is not null and p_expira < current_date then
    raise exception 'Esse prazo já passou.' using errcode = '22023';
  end if;
  for v_curso in
    select pc.curso_id from academia.plano_cursos pc
      join academia.cursos c on c.id = pc.curso_id and c.organizacao_id = v_org and c.removido_em is null
     where pc.plano_id = p_plano
  loop
    insert into academia.acessos as a (utilizador_id, curso_id, origem, concedido_por, expira_em, nota, organizacao_id)
    values (p_utilizador, v_curso, 'manual', auth.uid(), p_expira, 'plano:' || p_plano, v_org)
    on conflict (utilizador_id, curso_id) do update
      set expira_em = case
            when a.expira_em < current_date or a.estado <> 'ativo' then excluded.expira_em
            when a.expira_em is null or excluded.expira_em is null then null
            else greatest(a.expira_em, excluded.expira_em) end,
          estado = 'ativo',
          origem = case when a.expira_em < current_date or a.estado <> 'ativo' then excluded.origem else a.origem end,
          nota = case when a.expira_em < current_date or a.estado <> 'ativo' or a.origem = 'manual' then excluded.nota else a.nota end,
          concedido_por = excluded.concedido_por;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
