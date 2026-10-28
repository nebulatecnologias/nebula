-- Aplicada a 28/10/2026 (versão 20261028050645). Provada antes numa transacção
-- desfeita, como administração da Kingdom e com duas contas inventadas
-- (ensaio-*@exemplo.invalid): 32 verificações — dar, prazo, plano, tirar,
-- suspender (os cursos fecham), reativar, promover, remover (cursos fechados,
-- convite revogado, fora da lista); um aluno, um colaborador e quem não tem
-- sessão são recusados onde devem; ninguém mexe em si próprio; a ponte já não
-- desfaz o papel. Nada ficou gravado.
--
-- A gestão dos membros na própria academia (pedido do Shelton a 28/10/2026:
-- «na aba de membros não tem opções para excluir membros, adicionar membros,
-- promover membros, dar acesso a outros conteúdos, remover de um conteúdo,
-- dar acesso a uma assinatura»).
--
-- Até aqui a aba Membros era só de leitura: editar e remover mandavam para o
-- painel de gestão, que não gere as escolas. Cada escola passa a gerir os
-- seus membros aqui, sempre pela base:
--   - a equipa (admin ou colaborador) vê a ficha de cada membro, dá e tira
--     cursos, muda o prazo de um acesso e dá ou tira um plano;
--   - só a administração da escola muda o papel, suspende, reativa e remove;
--   - ninguém mexe em si próprio nem no dono, e a escola nunca fica sem
--     administração.
--
-- Tirar um curso não apaga a linha do acesso: o prazo passa para ontem e a
-- nota diz porquê, para o rasto (e os reembolsos, que procuram pela nota)
-- ficarem. Um curso que a pessoa tem por uma inscrição no Payflow não se tira
-- daqui: a ficha diz quais são, para se tratar lá.
--
-- Um plano dado à mão abre os cursos dele com a nota «plano:<id>», como o
-- Payflow faz quando vende um plano: o mesmo caminho de acesso para todos.
--
-- Suspender passa a fechar mesmo os cursos (tem_acesso_em): até aqui um
-- membro suspenso deixava de ser equipa, mas continuava a ver os cursos que
-- tinha.
--
-- A ponte do perfil da Kingdom só volta a escrever o papel quando o perfil,
-- o estado ou a remoção mudam de facto (A-04): um UPDATE que repete os mesmos
-- valores já não desfaz o papel dado aqui.

-- O papel do alvo nesta escola (nulo se não for membro).
create or replace function academia_privado.membro_da_escola(p_org uuid, p_utilizador uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select m.papel from nucleo.membros m
   where m.organizacao_id = p_org and m.utilizador_id = p_utilizador and m.app = 'academia'
$$;
revoke execute on function academia_privado.membro_da_escola(uuid, uuid) from public, anon, authenticated;

-- Quem pode mexer no alvo: a equipa (p_so_admin falso) ou só a administração.
-- Devolve o papel do alvo. Nunca em si próprio nem no dono, quando mexe no
-- papel, no estado ou na permanência.
create or replace function academia_privado.membro_pode(p_org uuid, p_utilizador uuid, p_so_admin boolean)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_eu text := academia_privado.papel_em(p_org);
  v_alvo text;
begin
  if p_so_admin and v_eu is distinct from 'admin' then
    raise exception 'Só a administração da escola pode fazer isto.' using errcode = '42501';
  end if;
  if not p_so_admin and coalesce(v_eu in ('admin', 'colaborador'), false) = false then
    raise exception 'Só a equipa da escola pode fazer isto.' using errcode = '42501';
  end if;
  v_alvo := academia_privado.membro_da_escola(p_org, p_utilizador);
  if v_alvo is null then
    raise exception 'Esta pessoa não é membro desta escola.' using errcode = 'P0002';
  end if;
  if p_so_admin and p_utilizador = auth.uid() then
    raise exception 'Não pode fazer isto à sua própria conta.' using errcode = '42501';
  end if;
  if p_so_admin and v_alvo = 'dono' then
    raise exception 'O dono da escola não se altera daqui.' using errcode = '42501';
  end if;
  return v_alvo;
end $$;
revoke execute on function academia_privado.membro_pode(uuid, uuid, boolean) from public, anon, authenticated;

-- A escola fica sempre com alguém na administração.
create or replace function academia_privado.outra_administracao(p_org uuid, p_utilizador uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from nucleo.membros m
                   join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null and u.estado = 'Ativo'
                  where m.organizacao_id = p_org and m.app = 'academia' and m.estado = 'ativo'
                    and m.papel in ('admin', 'dono') and m.utilizador_id <> p_utilizador)
$$;
revoke execute on function academia_privado.outra_administracao(uuid, uuid) from public, anon, authenticated;

-- A lista ganha o dono, a última entrada, quantos cursos abertos e os planos.
drop function if exists academia.membros_da_organizacao();
create function academia.membros_da_organizacao()
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
           where a.utilizador_id = u.id and (a.expira_em is null or a.expira_em >= current_date)),
         (select coalesce(array_agg(distinct substr(a.nota, 7)), '{}') from academia.acessos a
            join academia.cursos c on c.id = a.curso_id and c.organizacao_id = m.organizacao_id
           where a.utilizador_id = u.id and a.nota like 'plano:%'
             and (a.expira_em is null or a.expira_em >= current_date))
    from nucleo.membros m
    join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null
    left join auth.users au on au.id = u.id
   where academia_privado.e_equipa()
     and m.organizacao_id = academia_privado.organizacao()
     and m.app = 'academia'
$$;
revoke execute on function academia.membros_da_organizacao() from public, anon;
grant execute on function academia.membros_da_organizacao() to authenticated;

-- A ficha de um membro: os acessos (abertos e fechados), os cursos que vêm
-- do Payflow e as aulas concluídas por curso.
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
                   'desde', a.criado_em, 'ativo', a.expira_em is null or a.expira_em >= current_date,
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

-- Dar cursos: sem prazo (nulo) ou até uma data. Um acesso que já estava
-- aberto fica com o prazo novo; a origem e a nota dele só mudam se estava
-- fechado.
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
          origem = case when a.expira_em < current_date then excluded.origem else a.origem end,
          nota   = case when a.expira_em < current_date then excluded.nota else a.nota end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Tirar cursos: o prazo passa para ontem. Devolve quantos fechou e os que
-- continuam abertos por uma inscrição no Payflow.
create or replace function academia.membro_tirar_acesso(p_utilizador uuid, p_cursos text[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_n integer;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  update academia.acessos a
     set expira_em = current_date - 1,
         nota = left(coalesce(a.nota, '') || ' · retirado na academia', 200)
   where a.utilizador_id = p_utilizador
     and a.curso_id = any(coalesce(p_cursos, '{}'::text[]))
     and (a.expira_em is null or a.expira_em >= current_date)
     and exists (select 1 from academia.cursos c where c.id = a.curso_id and c.organizacao_id = v_org);
  get diagnostics v_n = row_count;
  return jsonb_build_object('retirados', v_n,
    'pelo_payflow', (select coalesce(jsonb_agg(x), '[]'::jsonb)
                       from jsonb_array_elements_text(academia.membro_ficha(p_utilizador)->'payflow') x
                      where x = any(coalesce(p_cursos, '{}'::text[]))));
end $$;

-- O prazo de um acesso aberto: uma data a partir de hoje, ou nulo (sem prazo).
create or replace function academia.membro_prazo(p_utilizador uuid, p_curso text, p_expira date)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  if p_expira is not null and p_expira < current_date then
    raise exception 'Esse prazo já passou. Para fechar o acesso, tire o curso.' using errcode = '22023';
  end if;
  update academia.acessos a set expira_em = p_expira, concedido_por = auth.uid()
   where a.utilizador_id = p_utilizador and a.curso_id = p_curso
     and (a.expira_em is null or a.expira_em >= current_date)
     and exists (select 1 from academia.cursos c where c.id = a.curso_id and c.organizacao_id = v_org);
  return found;
end $$;

-- Dar um plano: abre os cursos dele, com a nota «plano:<id>». Um curso que
-- a pessoa já tinha aberto por uma compra ou um convite fica como estava,
-- e nunca com menos prazo.
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
            when a.expira_em < current_date then excluded.expira_em
            when a.expira_em is null or excluded.expira_em is null then null
            else greatest(a.expira_em, excluded.expira_em) end,
          origem = case when a.expira_em < current_date then excluded.origem else a.origem end,
          nota = case when a.expira_em < current_date or a.origem = 'manual' then excluded.nota else a.nota end,
          concedido_por = excluded.concedido_por;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Tirar um plano: fecha os cursos que vieram dele.
create or replace function academia.membro_tirar_plano(p_utilizador uuid, p_plano text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_n integer;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  update academia.acessos a
     set expira_em = current_date - 1,
         nota = left(a.nota || ' · retirado na academia', 200)
   where a.utilizador_id = p_utilizador and a.nota = 'plano:' || p_plano
     and (a.expira_em is null or a.expira_em >= current_date)
     and exists (select 1 from academia.cursos c where c.id = a.curso_id and c.organizacao_id = v_org);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- O papel: aluno, colaborador ou admin.
create or replace function academia.membro_papel(p_utilizador uuid, p_papel text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_alvo text;
begin
  if p_papel not in ('aluno', 'colaborador', 'admin') then
    raise exception 'Papel desconhecido.' using errcode = '22023';
  end if;
  v_alvo := academia_privado.membro_pode(v_org, p_utilizador, true);
  if v_alvo = 'admin' and p_papel <> 'admin' and not academia_privado.outra_administracao(v_org, p_utilizador) then
    raise exception 'A escola ficava sem administração.' using errcode = '42501';
  end if;
  update nucleo.membros set papel = p_papel
   where organizacao_id = v_org and utilizador_id = p_utilizador and app = 'academia';
  return p_papel;
end $$;

-- Suspender e reativar. Suspenso, não entra na equipa nem nos cursos.
create or replace function academia.membro_estado(p_utilizador uuid, p_estado text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_alvo text;
begin
  if p_estado not in ('ativo', 'suspenso') then
    raise exception 'Estado desconhecido.' using errcode = '22023';
  end if;
  v_alvo := academia_privado.membro_pode(v_org, p_utilizador, true);
  if v_alvo = 'admin' and p_estado = 'suspenso' and not academia_privado.outra_administracao(v_org, p_utilizador) then
    raise exception 'A escola ficava sem administração.' using errcode = '42501';
  end if;
  update nucleo.membros set estado = p_estado
   where organizacao_id = v_org and utilizador_id = p_utilizador and app = 'academia';
  return p_estado;
end $$;

-- Remover da escola: fecha os cursos, revoga os convites por aceitar e tira
-- a pessoa dos membros. A conta e o histórico ficam; um convite novo traz
-- a pessoa de volta.
create or replace function academia.membro_remover(p_utilizador uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_alvo text;
  v_payflow jsonb;
  v_acessos integer;
  v_convites integer;
begin
  v_alvo := academia_privado.membro_pode(v_org, p_utilizador, true);
  if v_alvo = 'admin' and not academia_privado.outra_administracao(v_org, p_utilizador) then
    raise exception 'A escola ficava sem administração.' using errcode = '42501';
  end if;
  v_payflow := academia.membro_ficha(p_utilizador)->'payflow';

  update academia.acessos a
     set expira_em = current_date - 1,
         nota = left(coalesce(a.nota, '') || ' · removido da escola', 200)
   where a.utilizador_id = p_utilizador
     and (a.expira_em is null or a.expira_em >= current_date)
     and exists (select 1 from academia.cursos c where c.id = a.curso_id and c.organizacao_id = v_org);
  get diagnostics v_acessos = row_count;

  update academia.convites c set revogado_em = now()
   where c.organizacao_id = v_org and c.aceite_em is null and c.revogado_em is null
     and lower(c.email) = (select lower(u.email) from public.utilizadores u where u.id = p_utilizador);
  get diagnostics v_convites = row_count;

  delete from nucleo.membros
   where organizacao_id = v_org and utilizador_id = p_utilizador and app = 'academia';

  return jsonb_build_object('acessos', v_acessos, 'convites', v_convites, 'pelo_payflow', v_payflow);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'academia.membro_ficha(uuid)',
    'academia.membro_dar_acesso(uuid, text[], date)',
    'academia.membro_tirar_acesso(uuid, text[])',
    'academia.membro_prazo(uuid, text, date)',
    'academia.membro_dar_plano(uuid, text, date)',
    'academia.membro_tirar_plano(uuid, text)',
    'academia.membro_papel(uuid, text)',
    'academia.membro_estado(uuid, text)',
    'academia.membro_remover(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Suspenso nesta escola: os cursos fecham (a equipa já deixava de o ser).
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
           exists (
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
      ))
     )
$function$;

-- A ponte do perfil só escreve quando o perfil, o estado ou a remoção mudam.
create or replace function nucleo.ponte_do_perfil()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org uuid := nucleo.organizacao_kingdom();
  v_na_kingdom boolean;
begin
  if v_org is null then return new; end if;
  if tg_op = 'UPDATE'
     and new.perfil is not distinct from old.perfil
     and new.estado is not distinct from old.estado
     and new.removido_em is not distinct from old.removido_em then
    return new;
  end if;
  if new.removido_em is not null then
    update nucleo.membros set estado = 'suspenso'
     where organizacao_id = v_org and utilizador_id = new.id and app = 'academia';
    return new;
  end if;
  if not exists (select 1 from auth.users where id = new.id) then return new; end if;

  v_na_kingdom := exists (select 1 from nucleo.membros
                           where organizacao_id = v_org and utilizador_id = new.id and app = 'academia');

  if not v_na_kingdom then
    /* Uma conta que nasce de um produto (o link de afiliado, um convite da
       equipa do Payflow ou do Tracktor) nao entra na Academia da Kingdom
       sozinha (passo 21, etapa 7). */
    if tg_op = 'INSERT' and exists (select 1 from auth.users au where au.id = new.id
         and au.raw_user_meta_data->>'produto' in ('payflow', 'tracktor')) then
      return new;
    end if;
    if tg_op = 'INSERT' and exists (
         select 1 from academia.convites c
          where lower(c.email) = lower(new.email) and c.aceite_em is null and c.revogado_em is null
            and c.organizacao_id <> v_org)
       and not exists (
         select 1 from academia.convites c
          where lower(c.email) = lower(new.email) and c.aceite_em is null and c.revogado_em is null
            and c.organizacao_id = v_org) then
      return new;
    end if;
    if tg_op = 'UPDATE' and new.perfil::text = 'aluno' then
      return new;
    end if;
  end if;

  insert into nucleo.membros (organizacao_id, utilizador_id, app, papel, estado)
  values (v_org, new.id, 'academia', new.perfil::text,
          case when new.estado::text = 'Ativo' then 'ativo' else 'suspenso' end)
  on conflict (organizacao_id, utilizador_id, app) do update
    set papel = case when nucleo.membros.papel = 'dono' then 'dono' else excluded.papel end,
        estado = excluded.estado;
  return new;
end $function$;
