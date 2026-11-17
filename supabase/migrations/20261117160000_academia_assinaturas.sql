-- AINDA POR APLICAR (17/11/2026): o Supabase pediu confirmação ao Shelton e o
-- pedido expirou. Já provada em duas transacções desfeitas, como administração
-- da Kingdom e com duas contas inventadas (ensaio-*@exemplo.invalid), em 43
-- verificações: cada membro real em cada curso abre o mesmo antes e depois
-- (238 pares, 40 abertos, zero diferenças); a assinatura ativa abre os cursos
-- do nível, e pendente, expirada ou com o curso tirado do nível não abre; a
-- turma do nível é a que vale para as regras de liberação, e a matrícula
-- própria vale mais; o acesso ilimitado abre os publicados e não um rascunho;
-- um membro suspenso não abre nada; um nível com membros só se exclui
-- passando-os para outro; uma turma que um nível usa não se apaga; um aluno
-- não cria níveis nem dá a si próprio acesso ilimitado; outra escola não vê
-- nada disto; o relógio marca o que passou da data e não mexe em mais nada.
-- Quando se aplicar, este ficheiro passa a ter a versão que a base lhe der.
--
-- Assinaturas (passo 3 da especificação «Convites, Assinaturas e Turmas»,
-- Shelton, 17/11/2026).
--
-- Um NÍVEL de assinatura (academia.niveis) leva vários cursos, cada um numa
-- turma. A ASSINATURA de um membro (academia.assinaturas) liga-o a um nível,
-- com um estado (ativo, pendente, expirado, desativado) e uma data de
-- expiração só. É uma ligação viva: pôr um curso no nível abre-o a todos os
-- assinantes; tirá-lo fecha-o. O ACESSO ILIMITADO abre a uma pessoa tudo o
-- que a escola tem publicado, hoje e depois.
--
-- Substitui os Planos (academia.planos), que eram um pacote copiado: dar um
-- plano criava um acesso solto a cada curso. Em produção não há nada para
-- converter: o único plano que existiu era de ensaio e já estava apagado, e
-- nenhum acesso veio de um plano. As tabelas e as funções dos Planos ficam
-- onde estão, sem uso, até à limpeza do último passo.
--
-- Quando uma pessoa abre um curso por mais de uma via, a matrícula própria
-- vale mais; entre assinaturas, a que começou primeiro.
--
-- Só acrescenta: como ninguém tem assinatura nem acesso ilimitado, o acesso
-- de ninguém muda quando isto se aplica.

-- 1 Os níveis de assinatura ---------------------------------------------------
create table academia.niveis (
  id             text primary key default academia.novo_id(),
  organizacao_id uuid not null references nucleo.organizacoes(id),
  nome           text not null check (length(trim(nome)) between 1 and 120),
  trial_dias     integer check (trial_dias between 1 and 36500),
  extensao_dias  integer check (extensao_dias between 1 and 36500),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  removido_em    timestamptz
);
create index niveis_por_organizacao on academia.niveis (organizacao_id);

-- O que cada nível leva dentro: os cursos, cada um numa turma (uma por curso).
create table academia.nivel_turmas (
  nivel_id       text not null references academia.niveis(id) on delete cascade,
  curso_id       text not null references academia.cursos(id) on delete cascade,
  turma_id       text not null references academia.turmas(id) on delete cascade,
  organizacao_id uuid not null references nucleo.organizacoes(id),
  primary key (nivel_id, curso_id)
);
create index nivel_turmas_por_turma on academia.nivel_turmas (turma_id);
create index nivel_turmas_por_curso on academia.nivel_turmas (curso_id);

-- A assinatura de um membro: uma por nível, com um estado e uma data só.
create table academia.assinaturas (
  id             text primary key default academia.novo_id(),
  organizacao_id uuid not null references nucleo.organizacoes(id),
  utilizador_id  uuid not null references auth.users(id) on delete cascade,
  nivel_id       text not null references academia.niveis(id),
  estado         text not null default 'ativo' check (estado in ('ativo', 'pendente', 'expirado', 'desativado')),
  expira_em      date,
  iniciado_em    timestamptz not null default now(),
  origem         text not null default 'manual' check (origem in ('manual', 'convite', 'oferta')),
  concedido_por  uuid,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (utilizador_id, nivel_id)
);
create index assinaturas_por_nivel on academia.assinaturas (nivel_id);
create index assinaturas_por_organizacao on academia.assinaturas (organizacao_id);

-- Acesso ilimitado: a pessoa abre tudo o que a escola tem publicado.
create table academia.acessos_ilimitados (
  organizacao_id uuid not null references nucleo.organizacoes(id),
  utilizador_id  uuid not null references auth.users(id) on delete cascade,
  concedido_por  uuid,
  criado_em      timestamptz not null default now(),
  primary key (organizacao_id, utilizador_id)
);
create index acessos_ilimitados_por_utilizador on academia.acessos_ilimitados (utilizador_id);

-- A equipa lê tudo; cada pessoa lê o que é seu. Escreve-se pelas funções,
-- que conferem quem pede e respondem em português.
alter table academia.niveis enable row level security;
alter table academia.nivel_turmas enable row level security;
alter table academia.assinaturas enable row level security;
alter table academia.acessos_ilimitados enable row level security;
create policy niveis_leitura on academia.niveis for select to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa());
create policy nivel_turmas_leitura on academia.nivel_turmas for select to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa());
create policy assinaturas_leitura on academia.assinaturas for select to authenticated
  using (organizacao_id = (select academia_privado.organizacao())
         and (academia_privado.e_equipa() or utilizador_id = (select auth.uid())));
create policy acessos_ilimitados_leitura on academia.acessos_ilimitados for select to authenticated
  using (organizacao_id = (select academia_privado.organizacao())
         and (academia_privado.e_equipa() or utilizador_id = (select auth.uid())));
revoke all on academia.niveis, academia.nivel_turmas, academia.assinaturas, academia.acessos_ilimitados from public, anon, authenticated;
grant select on academia.niveis, academia.nivel_turmas, academia.assinaturas, academia.acessos_ilimitados to authenticated;
grant all on academia.niveis, academia.nivel_turmas, academia.assinaturas, academia.acessos_ilimitados to service_role;

-- 2 Quem abre um curso: também a assinatura ativa e o acesso ilimitado ---------
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
        -- Uma assinatura ativa cujo nível leva este curso.
        or exists (
             select 1
               from academia.assinaturas s
               join academia.niveis n        on n.id = s.nivel_id and n.removido_em is null and n.organizacao_id = p_organizacao
               join academia.nivel_turmas nt on nt.nivel_id = n.id and nt.curso_id = p_curso
              where s.utilizador_id = auth.uid()
                and s.estado = 'ativo'
                and (s.expira_em is null or s.expira_em >= current_date)
           )
        -- Acesso ilimitado: tudo o que a escola tem publicado, hoje e depois.
        or (exists (
             select 1 from academia.acessos_ilimitados u
              where u.organizacao_id = p_organizacao and u.utilizador_id = auth.uid()
            )
            and exists (
             select 1 from academia.cursos c
              where c.id = p_curso and c.publicado and c.removido_em is null
            )
            and exists (
             select 1 from nucleo.membros mm
              where mm.organizacao_id = p_organizacao
                and mm.utilizador_id = auth.uid()
                and mm.app = 'academia'
                and mm.estado = 'ativo'
            ))
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

-- A turma e o início que valem para uma pessoa num curso (decisão 3): a
-- matrícula ativa primeiro; depois a assinatura ativa que leva o curso (a que
-- começou primeiro); por fim a turma padrão e o dia em que entrou na escola
-- (acesso ilimitado ou curso aberto a todos).
create or replace function academia_privado.turma_efetiva(p_utilizador uuid, p_curso text, out turma text, out inicio date)
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(a.turma_id, s.turma_id, t.id),
         coalesce(a.iniciado_em::date, s.iniciado_em::date, m.criado_em::date, current_date)
    from academia.cursos c
    left join academia.turmas t on t.curso_id = c.id and t.padrao and t.removido_em is null
    left join academia.acessos a on a.curso_id = c.id and a.utilizador_id = p_utilizador
                                and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)
    left join lateral (
      select nt.turma_id, x.iniciado_em
        from academia.assinaturas x
        join academia.niveis n        on n.id = x.nivel_id and n.removido_em is null
        join academia.nivel_turmas nt on nt.nivel_id = n.id and nt.curso_id = c.id
        join academia.turmas tt       on tt.id = nt.turma_id and tt.removido_em is null
       where x.utilizador_id = p_utilizador and x.estado = 'ativo'
         and (x.expira_em is null or x.expira_em >= current_date)
       order by x.iniciado_em, x.id
       limit 1) s on true
    left join nucleo.membros m on m.organizacao_id = c.organizacao_id and m.utilizador_id = p_utilizador and m.app = 'academia'
   where c.id = p_curso
$$;
revoke execute on function academia_privado.turma_efetiva(uuid, text) from public, anon, authenticated;

-- Quem está numa turma: quem tem a matrícula ativa nela, e quem abre o curso
-- por uma assinatura que o entrega nesta turma (sem matrícula própria ativa).
create or replace function academia_privado.pessoas_da_turma(p_turma text)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $$
  select a.utilizador_id from academia.acessos a
   where a.turma_id = p_turma and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)
  union
  select s.utilizador_id
    from academia.nivel_turmas nt
    join academia.niveis n      on n.id = nt.nivel_id and n.removido_em is null
    join academia.assinaturas s on s.nivel_id = n.id and s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date)
   where nt.turma_id = p_turma
     and not exists (select 1 from academia.acessos a
                      where a.utilizador_id = s.utilizador_id and a.curso_id = nt.curso_id and a.estado = 'ativo'
                        and (a.expira_em is null or a.expira_em >= current_date))
$$;
revoke execute on function academia_privado.pessoas_da_turma(text) from public, anon, authenticated;

-- 3 As turmas contam também quem lá está por assinatura ------------------------
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
      -- Uma assinatura que entrega o curso nesta turma ficava a apontar para nada.
      if exists (select 1 from academia.nivel_turmas nt join academia.niveis n on n.id = nt.nivel_id and n.removido_em is null
                  where nt.turma_id = new.id) then
        raise exception 'A assinatura «%» entrega o curso nesta turma. Escolha lá outra turma antes de apagar esta.',
          (select n.nome from academia.nivel_turmas nt join academia.niveis n on n.id = nt.nivel_id and n.removido_em is null
            where nt.turma_id = new.id order by n.criado_em limit 1);
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
                   and av.utilizador_id in (select academia_privado.pessoas_da_turma(t.id))) as comentarios,
               coalesce(round(avg(case when au.total > 0 then least(1.0, pr.feitas::numeric / au.total) else 0 end) * 100), 0) as progresso
          from (select academia_privado.pessoas_da_turma(t.id) as utilizador_id) a
          cross join lateral (select count(*) as total from academia.aulas l
                               join academia.modulos m on m.id = l.modulo_id and m.removido_em is null
                              where m.curso_id = t.curso_id and l.removido_em is null) au
          cross join lateral (select count(*) as feitas from academia.progresso p
                               join academia.aulas l on l.id = p.aula_id and l.removido_em is null
                               join academia.modulos m on m.id = l.modulo_id and m.removido_em is null
                              where p.utilizador_id = a.utilizador_id and m.curso_id = t.curso_id) pr
      ) x
     where t.organizacao_id = v_org and t.removido_em is null
  );
end $$;

-- 4 O que a equipa lê -----------------------------------------------------------
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
    -- Quem abre este curso por uma assinatura ativa (e não tem matrícula
    -- própria ativa nele): trata-se na assinatura, não aqui.
    'assinantes', (select coalesce(jsonb_agg(jsonb_build_object(
                            'id', u.id, 'nome', u.nome, 'email', u.email,
                            'papel', case m.papel when 'dono' then 'admin' else coalesce(m.papel, 'aluno') end,
                            'suspenso', not (coalesce(m.estado, 'ativo') = 'ativo' and u.estado::text = 'Ativo'),
                            'nivel', n.id, 'nivelNome', n.nome, 'turma', nt.turma_id,
                            'expira', s.expira_em, 'desde', s.iniciado_em) order by s.iniciado_em desc), '[]'::jsonb)
                     from academia.assinaturas s
                     join academia.niveis n        on n.id = s.nivel_id and n.removido_em is null and n.organizacao_id = v_org
                     join academia.nivel_turmas nt on nt.nivel_id = n.id and nt.curso_id = p_curso
                     join public.utilizadores u    on u.id = s.utilizador_id and u.removido_em is null
                     left join nucleo.membros m    on m.organizacao_id = v_org and m.utilizador_id = u.id and m.app = 'academia'
                    where s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date)
                      and not exists (select 1 from academia.acessos a
                                       where a.utilizador_id = s.utilizador_id and a.curso_id = p_curso and a.estado = 'ativo'
                                         and (a.expira_em is null or a.expira_em >= current_date))),
    -- Quantos membros têm acesso ilimitado (abrem todos os cursos publicados).
    'ilimitados', (select count(*) from academia.acessos_ilimitados i
                     join nucleo.membros m on m.organizacao_id = v_org and m.utilizador_id = i.utilizador_id and m.app = 'academia' and m.estado = 'ativo'
                    where i.organizacao_id = v_org),
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
                         'membros', (select count(*) from academia_privado.pessoas_da_turma(t.id)))
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
    -- As assinaturas que esta pessoa tem ou já teve, e o acesso ilimitado.
    'assinaturas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'nivel', s.nivel_id, 'expira', s.expira_em, 'iniciado', s.iniciado_em, 'origem', s.origem,
                      'estado', case when s.estado = 'ativo' and s.expira_em < current_date then 'expirado' else s.estado end)
                      order by s.criado_em), '[]'::jsonb)
                      from academia.assinaturas s
                      join academia.niveis n on n.id = s.nivel_id and n.removido_em is null and n.organizacao_id = v_org
                     where s.utilizador_id = p_utilizador),
    'ilimitado', exists (select 1 from academia.acessos_ilimitados i
                          where i.organizacao_id = v_org and i.utilizador_id = p_utilizador),
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

-- A assinatura de quem pede, para a página de Definições do aluno.
create or replace function academia.minhas_assinaturas()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'ilimitado', exists (select 1 from academia.acessos_ilimitados i
                          where i.organizacao_id = academia_privado.organizacao() and i.utilizador_id = auth.uid()),
    'assinaturas', (select coalesce(jsonb_agg(jsonb_build_object('nome', n.nome, 'expira', s.expira_em) order by s.iniciado_em), '[]'::jsonb)
                      from academia.assinaturas s
                      join academia.niveis n on n.id = s.nivel_id and n.removido_em is null
                     where s.utilizador_id = auth.uid() and s.organizacao_id = academia_privado.organizacao()
                       and s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date)))
$$;
revoke execute on function academia.minhas_assinaturas() from public, anon;
grant execute on function academia.minhas_assinaturas() to authenticated;

-- 5 O que a equipa escreve ------------------------------------------------------
-- Criar ou editar um nível: o nome, os dias de trial e de extensão, e os
-- cursos que leva, cada um numa turma. A lista vem inteira: o que não vier
-- deixa de fazer parte.
create or replace function academia.nivel_guardar(p_id text, p_nome text, p_trial integer, p_extensao integer, p_turmas jsonb)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_id text := nullif(p_id, '');
  x jsonb;
  v_curso text;
  v_turma text;
begin
  if v_org is null or not academia_privado.e_equipa() then
    raise exception 'Só a equipa da escola define as assinaturas.';
  end if;
  if nullif(trim(coalesce(p_nome, '')), '') is null then raise exception 'Dê um nome à assinatura.'; end if;
  if length(trim(p_nome)) > 120 then raise exception 'O nome é demasiado comprido.'; end if;
  if p_trial is not null and p_trial not between 1 and 36500 then
    raise exception 'O trial é um número de dias, a partir de 1. Vazio é sem trial.';
  end if;
  if p_extensao is not null and p_extensao not between 1 and 36500 then
    raise exception 'A extensão é um número de dias, a partir de 1. Vazio é sem prazo.';
  end if;

  if v_id is null then
    insert into academia.niveis (organizacao_id, nome, trial_dias, extensao_dias)
    values (v_org, trim(p_nome), p_trial, p_extensao) returning id into v_id;
  else
    update academia.niveis n set nome = trim(p_nome), trial_dias = p_trial, extensao_dias = p_extensao, atualizado_em = now()
     where n.id = v_id and n.organizacao_id = v_org and n.removido_em is null;
    if not found then raise exception 'Esta assinatura não é desta escola.'; end if;
  end if;

  delete from academia.nivel_turmas nt where nt.nivel_id = v_id;
  for x in select * from jsonb_array_elements(coalesce(p_turmas, '[]'::jsonb)) loop
    v_curso := x->>'cursoId'; v_turma := x->>'turmaId';
    if not exists (select 1 from academia.cursos c where c.id = v_curso and c.organizacao_id = v_org and c.removido_em is null) then
      raise exception 'Um dos cursos não é desta escola.';
    end if;
    if not exists (select 1 from academia.turmas t where t.id = v_turma and t.curso_id = v_curso and t.removido_em is null) then
      raise exception 'Uma das turmas não é do curso escolhido.';
    end if;
    insert into academia.nivel_turmas (nivel_id, curso_id, turma_id, organizacao_id) values (v_id, v_curso, v_turma, v_org);
  end loop;
  return v_id;
end $$;
revoke execute on function academia.nivel_guardar(text, text, integer, integer, jsonb) from public, anon;
grant execute on function academia.nivel_guardar(text, text, integer, integer, jsonb) to authenticated;

-- Excluir um nível. Com membros ativos ou pendentes não se exclui (decisão 5):
-- ou se dá outro nível para onde passam, ou se trata deles primeiro.
create or replace function academia.nivel_apagar(p_id text, p_mover_para text default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_n integer;
  s academia.assinaturas;
begin
  if v_org is null or not academia_privado.e_equipa() then
    raise exception 'Só a equipa da escola define as assinaturas.';
  end if;
  if not exists (select 1 from academia.niveis n where n.id = p_id and n.organizacao_id = v_org and n.removido_em is null) then
    raise exception 'Esta assinatura não é desta escola.';
  end if;
  select count(*) into v_n from academia.assinaturas x
   where x.nivel_id = p_id and (x.estado = 'pendente' or (x.estado = 'ativo' and (x.expira_em is null or x.expira_em >= current_date)));
  if v_n > 0 and p_mover_para is null then
    raise exception 'Há % com esta assinatura ativa ou pendente. Passe-os para outra assinatura antes de a excluir.',
      case when v_n = 1 then '1 membro' else v_n || ' membros' end;
  end if;
  if v_n > 0 then
    if p_mover_para = p_id or not exists (select 1 from academia.niveis n where n.id = p_mover_para and n.organizacao_id = v_org and n.removido_em is null) then
      raise exception 'Escolha outra assinatura desta escola para onde passar os membros.';
    end if;
    for s in select * from academia.assinaturas x
              where x.nivel_id = p_id and (x.estado = 'pendente' or (x.estado = 'ativo' and (x.expira_em is null or x.expira_em >= current_date))) loop
      -- Quem já tem a outra ativa fica como está; os restantes passam com o
      -- estado, a data e o início que tinham.
      insert into academia.assinaturas as d (organizacao_id, utilizador_id, nivel_id, estado, expira_em, iniciado_em, origem, concedido_por)
      values (v_org, s.utilizador_id, p_mover_para, s.estado, s.expira_em, s.iniciado_em, s.origem, auth.uid())
      on conflict (utilizador_id, nivel_id) do update
        set estado = excluded.estado, expira_em = excluded.expira_em, iniciado_em = excluded.iniciado_em, atualizado_em = now()
        where not (d.estado = 'ativo' and (d.expira_em is null or d.expira_em >= current_date));
      update academia.assinaturas x set estado = 'desativado', atualizado_em = now() where x.id = s.id;
    end loop;
  end if;
  update academia.niveis n set removido_em = now(), atualizado_em = now() where n.id = p_id;
  return v_n;
end $$;
revoke execute on function academia.nivel_apagar(text, text) from public, anon;
grant execute on function academia.nivel_apagar(text, text) to authenticated;

-- A assinatura de um membro num nível, de uma vez: o estado e a expiração (o
-- «Controle de Assinaturas» da ficha do membro). Sem estado, deixa de a ter.
create or replace function academia.assinatura_definir(p_utilizador uuid, p_nivel text, p_estado text, p_expira date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_estado text := nullif(p_estado, '');
  v_s academia.assinaturas;
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  if not exists (select 1 from academia.niveis n where n.id = p_nivel and n.organizacao_id = v_org and n.removido_em is null) then
    raise exception 'Essa assinatura não existe nesta escola.';
  end if;
  if v_estado is null then
    delete from academia.assinaturas x where x.utilizador_id = p_utilizador and x.nivel_id = p_nivel;
    return jsonb_build_object('nivel', p_nivel, 'estado', null);
  end if;
  if v_estado not in ('ativo', 'pendente', 'expirado', 'desativado') then
    raise exception 'Estado desconhecido.';
  end if;
  -- Ativa com a data já passada é uma assinatura expirada.
  if v_estado = 'ativo' and p_expira is not null and p_expira < current_date then v_estado := 'expirado'; end if;

  insert into academia.assinaturas as x (organizacao_id, utilizador_id, nivel_id, estado, expira_em, origem, concedido_por)
  values (v_org, p_utilizador, p_nivel, v_estado, p_expira, 'manual', auth.uid())
  on conflict (utilizador_id, nivel_id) do update
    set estado = excluded.estado, expira_em = excluded.expira_em, atualizado_em = now(),
        -- Voltar a estar ativa recomeça a contagem dos dias.
        iniciado_em = case when excluded.estado = 'ativo' and x.estado <> 'ativo' then now() else x.iniciado_em end
  returning * into v_s;
  return jsonb_build_object('nivel', v_s.nivel_id, 'estado', v_s.estado, 'expira', v_s.expira_em, 'iniciado', v_s.iniciado_em);
end $$;
revoke execute on function academia.assinatura_definir(uuid, text, text, date) from public, anon;
grant execute on function academia.assinatura_definir(uuid, text, text, date) to authenticated;

-- Dar ou tirar o acesso ilimitado a um membro.
create or replace function academia.membro_ilimitado(p_utilizador uuid, p_ligado boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
begin
  perform academia_privado.membro_pode(v_org, p_utilizador, false);
  if coalesce(p_ligado, false) then
    insert into academia.acessos_ilimitados (organizacao_id, utilizador_id, concedido_por)
    values (v_org, p_utilizador, auth.uid()) on conflict do nothing;
  else
    delete from academia.acessos_ilimitados i where i.organizacao_id = v_org and i.utilizador_id = p_utilizador;
  end if;
  return coalesce(p_ligado, false);
end $$;
revoke execute on function academia.membro_ilimitado(uuid, boolean) from public, anon;
grant execute on function academia.membro_ilimitado(uuid, boolean) to authenticated;

-- 6 O relógio: o que passou da data fica «expirado» -----------------------------
-- O acesso já fecha pela data, sem esperar por isto; o que muda é o estado
-- que a equipa vê, e os filtros que dele dependem.
create or replace function academia_privado.expirar_acessos()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_a integer;
  v_s integer;
begin
  update academia.acessos a set estado = 'expirado'
   where a.estado = 'ativo' and a.expira_em < current_date;
  get diagnostics v_a = row_count;
  update academia.assinaturas s set estado = 'expirado', atualizado_em = now()
   where s.estado = 'ativo' and s.expira_em < current_date;
  get diagnostics v_s = row_count;
  return v_a + v_s;
end $$;
revoke execute on function academia_privado.expirar_acessos() from public, anon, authenticated;

select cron.schedule('academia-expirar-acessos', '10 0 * * *', $cron$select academia_privado.expirar_acessos()$cron$);
