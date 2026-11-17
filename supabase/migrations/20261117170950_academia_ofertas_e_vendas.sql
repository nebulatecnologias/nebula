-- Aplicada a 17/11/2026 (versão 20261117170950), pelo Shelton, no editor de SQL
-- (o pedido de confirmação do Supabase expira antes de ele o ver). Conferida
-- depois: as 9 funções são as deste ficheiro, as 5 colunas novas existem e as
-- contagens ficaram iguais (24 acessos, 39 convites, 5 ofertas).
-- Provada antes numa transacção desfeita, como administração da Kingdom e com
-- contas inventadas (ensaio-*@exemplo.invalid), em 28 verificações: a oferta
-- real do 10X dá o mesmo antes e depois, com e sem conta; a Vitrine de um
-- aluno real fica igual; turma de 90 dias dá 90 dias e a recompra 180, sem
-- nunca pôr prazo a quem não o tinha; o reembolso fecha; a oferta de
-- assinatura dá a extensão, a renovação soma-a, a falta de pagamento deixa
-- pendente, o pagamento reabre e o cancelamento acaba no fim do período pago.
--
-- Ofertas e vendas no modelo das turmas e das assinaturas (passo 4 da
-- especificação «Convites, Assinaturas e Turmas», Shelton, 17/11/2026).
--
-- Uma oferta entrega CURSOS, cada um numa turma, ou UMA ASSINATURA. O prazo
-- deixa de ser da oferta: é o da turma (matrícula) ou a extensão do nível
-- (assinatura). A coluna dias_de_acesso fica só para as ofertas de antes que
-- a tenham (nenhuma em produção); sai na limpeza do último passo.
--
-- A venda continua a chegar só pelo webhook da integração com o checkout
-- (regra do Shelton: tudo o que é do Payflow é por Integração, API ou
-- Webhooks). O que muda no que ela faz:
--   order.paid          abre os cursos na turma da oferta, ou dá a assinatura.
--                       Comprar outra vez soma os dias ao que a pessoa já tem.
--                       Quem não tem conta recebe o convite, que leva o mesmo.
--   order.refunded      (total) fecha os cursos e desativa a assinatura.
--   subscription.updated / subscription.canceled
--                       suspensa por falta de pagamento fica pendente; cancelada
--                       acaba no fim do período pago; ativa de novo reabre.
--
-- As três ofertas que existem não têm prazo nem turma escolhida: continuam a
-- abrir o mesmo curso, sem prazo, na turma padrão.

-- 1 O que a oferta e o convite passam a levar ---------------------------------
-- A oferta entrega cursos, cada um numa turma (turmas: curso → turma; sem
-- turma, a padrão), ou uma assinatura (nivel_id). O convite que nasce de uma
-- compra leva o mesmo. A assinatura guarda de que compra veio, para o
-- reembolso a encontrar.
alter table academia.ofertas
  add column turmas   jsonb not null default '{}'::jsonb,
  add column nivel_id text references academia.niveis(id);
create index ofertas_por_nivel on academia.ofertas (nivel_id) where nivel_id is not null;
alter table academia.convites
  add column turmas jsonb  not null default '{}'::jsonb,
  add column niveis text[] not null default '{}';
alter table academia.assinaturas add column nota text;

-- Os cursos que uma oferta abre: os dela, ou os que a assinatura leva.
create or replace function academia_privado.cursos_da_oferta(p_cursos text[], p_nivel text)
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select case when p_nivel is null then coalesce(p_cursos, '{}'::text[])
              else coalesce((select array_agg(nt.curso_id order by c.ordem nulls last, c.criado_em, c.id)
                               from academia.nivel_turmas nt
                               join academia.niveis n on n.id = nt.nivel_id and n.removido_em is null
                               join academia.cursos c on c.id = nt.curso_id and c.removido_em is null
                              where nt.nivel_id = p_nivel), '{}'::text[]) end
$$;
revoke execute on function academia_privado.cursos_da_oferta(text[], text) from public, anon, authenticated;

-- 2 Guardar uma oferta ----------------------------------------------------------
create or replace function academia_privado.oferta_validar()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_prod text;
  v_ponte text;
  v_outra text;
begin
  new.nome := trim(new.nome);
  new.chamada := nullif(trim(coalesce(new.chamada, '')), '');
  new.link := nullif(trim(coalesce(new.link, '')), '');
  -- Só cursos desta escola, sem repetidos, pela ordem em que vieram.
  new.cursos := array(
    select s.c from (select x.c, min(x.o) o
                       from unnest(coalesce(new.cursos, '{}'::text[])) with ordinality as x(c, o)
                      where exists (select 1 from academia.cursos k
                                     where k.id = x.c and k.organizacao_id = new.organizacao_id and k.removido_em is null)
                      group by x.c) s
     order by s.o);
  -- Uma oferta entrega cursos (cada um numa turma) ou uma assinatura.
  if new.nivel_id is not null then
    if new.removido_em is null and not exists (select 1 from academia.niveis n
                    where n.id = new.nivel_id and n.organizacao_id = new.organizacao_id and n.removido_em is null) then
      raise exception 'Essa assinatura não existe nesta escola.';
    end if;
    new.cursos := '{}'::text[];
    new.turmas := '{}'::jsonb;
  else
    -- Só a turma dos cursos da oferta, e só se for mesmo desse curso: sem
    -- turma escolhida, vale a padrão do curso.
    new.turmas := coalesce((select jsonb_object_agg(e.key, e.value)
                              from jsonb_each_text(case when jsonb_typeof(new.turmas) = 'object' then new.turmas else '{}'::jsonb end) e
                             where e.key = any(new.cursos)
                               and exists (select 1 from academia.turmas t
                                            where t.id = e.value and t.curso_id = e.key and t.removido_em is null)), '{}'::jsonb);
  end if;
  new.produtos := array(
    select s.p from (select trim(x.p) p, min(x.o) o
                       from unnest(coalesce(new.produtos, '{}'::text[])) with ordinality as x(p, o)
                      where trim(x.p) <> ''
                      group by trim(x.p)) s
     order by s.o);
  if new.removido_em is null then
    foreach v_prod in array new.produtos loop
      if v_prod !~ '^[A-Za-z0-9_.:-]{3,80}$' then
        raise exception 'O ID de produto «%» não parece válido. Copie-o do checkout (no Payflow, em Integrações › IDs dos produtos).', v_prod;
      end if;
      v_ponte := academia_privado.produto_pela_ponte(new.organizacao_id, v_prod);
      if v_ponte is not null then
        raise exception '«%» ainda abre os cursos pela ligação de origem. No Payflow, mude a entrega desta oferta para «Nada» e ligue-a aqui: assim cada compra abre os cursos uma só vez.', v_ponte;
      end if;
      select o.nome into v_outra from academia.ofertas o
       where o.organizacao_id = new.organizacao_id and o.removido_em is null
         and o.id <> new.id and v_prod = any(o.produtos)
       limit 1;
      if v_outra is not null then
        raise exception 'O produto % já está na oferta «%». Um produto entrega uma só oferta.', v_prod, v_outra;
      end if;
    end loop;
  end if;
  if not new.em_breve then new.abre_em := null; end if;
  new.atualizado_em := now();
  return new;
end $$;

-- 3 O que se lê das ofertas -----------------------------------------------------
create or replace function academia.vitrine_do_aluno()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with minhas as (
    select o.* from academia.ofertas o
     where o.organizacao_id = academia_privado.organizacao()
       and academia_privado.perfil() is not null
       and o.removido_em is null and o.ativa and o.na_vitrine
       and (o.link is not null or o.em_breve)
  ),
  contadas as (
    select o.id as oferta_id, c.id as curso_id, x.o as posicao,
           (select count(*) from academia.aulas a join academia.modulos m on m.id = a.modulo_id
             where m.curso_id = c.id and a.removido_em is null and m.removido_em is null) as aulas,
           (select coalesce(sum(academia_privado.segundos_de(a.duracao)), 0) from academia.aulas a join academia.modulos m on m.id = a.modulo_id
             where m.curso_id = c.id and a.removido_em is null and m.removido_em is null) as segundos,
           (select round(avg(av.estrelas)::numeric, 1) from academia.avaliacoes av
             where av.curso_id = c.id and not av.oculto and av.estrelas > 0) as nota,
           (select count(*) from academia.avaliacoes av
             where av.curso_id = c.id and not av.oculto and av.estrelas > 0) as avaliacoes,
           academia_privado.tem_acesso(c.id) as ja_tenho
      from minhas o
      cross join lateral unnest(academia_privado.cursos_da_oferta(o.cursos, o.nivel_id)) with ordinality as x(c, o)
      join academia.cursos c on c.id = x.c and c.removido_em is null and c.publicado
  )
  select coalesce(jsonb_agg(t.x order by (t.x->>'ordem')::int, t.x->>'nome'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'ofertaId', o.id, 'nome', o.nome, 'preco', o.preco, 'moeda', o.moeda,
      'cobranca', case o.recorrencia when 'mes' then 'Recorrente mensal' when 'ano' then 'Recorrente anual' else 'Cobrança única' end,
      'entrega', case when count(*) > 1 then 'Plano' else 'Academia' end,
      'linkVendas', o.link,
      'assinatura', (select n.nome from academia.niveis n where n.id = o.nivel_id),
      'destaque', o.destaque, 'chamada', o.chamada, 'ordem', o.ordem,
      'emBreve', o.em_breve, 'abreEm', o.abre_em,
      'aulas', sum(k.aulas), 'segundos', sum(k.segundos),
      'cursos', jsonb_agg(jsonb_build_object(
                     'id', c.id, 'titulo', c.titulo, 'subtitulo', c.subtitulo, 'sigla', c.sigla,
                     'capa', c.capa_url, 'categoria', c.categoria_id,
                     'facilitador', c.facilitador, 'facilitadorFoto', c.facilitador_foto_url,
                     'aulas', k.aulas, 'segundos', k.segundos, 'nota', k.nota, 'avaliacoes', k.avaliacoes,
                     'modulos', (select count(*) from academia.modulos m where m.curso_id = c.id and m.removido_em is null))
                     order by k.posicao)
    ) as x
    from contadas k
    join minhas o on o.id = k.oferta_id
    join academia.cursos c on c.id = k.curso_id
    group by o.id, o.nome, o.preco, o.moeda, o.recorrencia, o.link, o.destaque, o.chamada, o.ordem, o.em_breve, o.abre_em, o.nivel_id
    -- Só o que ainda não é meu; sem aulas só passa o que a equipa pôs em pré-venda.
    having bool_or(not k.ja_tenho) and (sum(k.aulas) > 0 or o.em_breve)
  ) t;
$function$;

create or replace function academia.pre_venda_dos_meus_cursos()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('cursoId', t.curso_id, 'abreEm', t.abre_em)), '[]'::jsonb)
    from (
      select c.id as curso_id, min(o.abre_em) as abre_em
        from academia.ofertas o
        join academia.cursos c on c.id = any(academia_privado.cursos_da_oferta(o.cursos, o.nivel_id)) and c.organizacao_id = o.organizacao_id
       where o.organizacao_id = academia_privado.organizacao()
         and o.removido_em is null and o.em_breve
         and c.removido_em is null and c.publicado
         and academia_privado.tem_acesso(c.id)
       group by c.id
    ) t
$function$;

create or replace function academia.integracoes_da_escola()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_org uuid := academia_privado.organizacao(); i academia.integracoes;
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
  select * into i from academia.integracoes where organizacao_id = v_org and app = 'payflow';
  return jsonb_build_object(
    'organizacao', (select jsonb_build_object('id', o.id, 'slug', o.slug, 'vendasPelaPonte', false)
                      from nucleo.organizacoes o where o.id = v_org),
    'payflow', jsonb_build_object(
      'ligada', i.segredo_id is not null and i.estado = 'ativa',
      'segredoFim', i.segredo_fim,
      'ligadaEm', i.criado_em,
      'ultimoEvento', (select jsonb_build_object('tipo', v.tipo, 'resultado', v.resultado, 'recebidoEm', v.recebido_em)
                         from academia.vendas_recebidas v where v.organizacao_id = v_org and v.app = 'payflow'
                        order by v.recebido_em desc limit 1)),
    -- Os produtos do checkout que as ofertas da escola entregam (16/11/2026).
    'produtos', coalesce((select jsonb_agg(jsonb_build_object('produto', pr, 'nome', o.nome, 'oferta', o.id,
                                             'cursos', to_jsonb(academia_privado.cursos_da_oferta(o.cursos, o.nivel_id)),
                                             'assinatura', (select n.nome from academia.niveis n where n.id = o.nivel_id))
                                           order by o.ordem, o.criado_em)
                            from academia.ofertas o cross join lateral unnest(o.produtos) pr
                           where o.organizacao_id = v_org and o.removido_em is null and o.ativa), '[]'::jsonb),
    -- Os produtos que a ponte de origem ainda entrega (só na Kingdom).
    'pelaPonte', coalesce((select jsonb_agg(jsonb_build_object('produto', o.id_publico, 'nome', o.nome) order by o.nome)
                             from public.ofertas o
                            where v_org = nucleo.organizacao_kingdom() and o.removido_em is null
                              and o.entrega::text in ('Academia', 'Plano') and o.estado::text = 'Ativa'), '[]'::jsonb),
    'cursos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo, 'publicado', c.publicado) order by c.ordem nulls last, c.criado_em)
                          from academia.cursos c where c.organizacao_id = v_org and c.removido_em is null), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', v.evento_id, 'app', v.app, 'tipo', v.tipo, 'resultado', v.resultado,
                              'pedido', v.referencia, 'email', v.email, 'cursos', to_jsonb(v.cursos), 'modo', v.modo, 'teste', v.teste,
                              'motivo', v.motivo, 'recebidoEm', v.recebido_em) order by v.recebido_em desc)
                            from (select * from academia.vendas_recebidas v where v.organizacao_id = v_org
                                   order by v.recebido_em desc limit 200) v), '[]'::jsonb));
end $function$;

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
                          'produtos', cardinality(o.produtos), 'temLink', o.link is not null,
                          'turma', o.turmas->>p_curso,
                          'assinatura', (select n.nome from academia.niveis n where n.id = o.nivel_id))
                          order by o.ordem, o.criado_em), '[]'::jsonb)
                  from academia.ofertas o
                 where o.organizacao_id = v_org and o.removido_em is null
                   and p_curso = any(academia_privado.cursos_da_oferta(o.cursos, o.nivel_id)))
  );
end $$;

-- Um nível que uma oferta vende não se exclui.
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
  if exists (select 1 from academia.ofertas o where o.nivel_id = p_id and o.removido_em is null) then
    raise exception 'A oferta «%» vende esta assinatura. Mude a oferta antes de excluir a assinatura.',
      (select o.nome from academia.ofertas o where o.nivel_id = p_id and o.removido_em is null order by o.criado_em limit 1);
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

-- 4 Entrar por um convite -------------------------------------------------------
create or replace function academia.aceitar_convite()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email   text;
  v_convite academia.convites%rowtype;
  v_curso   text;
  v_nivel   text;
  v_turma   academia.turmas%rowtype;
  v_dias    integer;
  v_n       integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(u.email) into v_email
  from public.utilizadores u
  where u.id = auth.uid() and u.removido_em is null and u.estado = 'Ativo';

  if v_email is null then
    return 0;
  end if;

  for v_convite in
    select * from academia.convites
    where lower(email) = v_email
      and aceite_em is null
      and revogado_em is null
      and expira_em >= now()
  loop
    insert into nucleo.membros (organizacao_id, utilizador_id, app, papel)
    values (v_convite.organizacao_id, auth.uid(), 'academia', v_convite.papel)
    on conflict (organizacao_id, utilizador_id, app) do update
      set papel = case
            when nucleo.membros.papel = 'dono' then 'dono'
            when excluded.papel = 'aluno' then nucleo.membros.papel
            else excluded.papel end,
          estado = 'ativo';

    -- Os cursos: cada um na turma que o convite leva (sem ela, a padrão).
    foreach v_curso in array coalesce(v_convite.cursos, '{}'::text[]) loop
      if exists (select 1 from academia.cursos c
                  where c.id = v_curso and c.removido_em is null
                    and c.organizacao_id = v_convite.organizacao_id) then
        select t.* into v_turma from academia.turmas t
         where t.curso_id = v_curso and t.removido_em is null
           and (t.id = v_convite.turmas->>v_curso or t.padrao)
         order by coalesce(t.id = v_convite.turmas->>v_curso, false) desc
         limit 1;
        -- O prazo conta do dia em que a pessoa entra: o que o convite disser
        -- (os de antes); senão, o da turma.
        v_dias := coalesce(v_convite.acesso_dias, v_turma.prazo_dias);
        insert into academia.acessos (utilizador_id, curso_id, origem, nota, turma_id, expira_em)
        values (auth.uid(), v_curso, 'convite', 'Convite ' || v_convite.id, v_turma.id,
                case when v_dias is not null then current_date + v_dias end)
        on conflict (utilizador_id, curso_id) do nothing;
        v_n := v_n + 1;
      end if;
    end loop;

    -- As assinaturas. Num convite que veio de uma compra, a data é a da
    -- extensão do nível; num convite dado pela equipa, o trial se houver,
    -- senão a extensão, senão sem prazo. Quem já a tem ativa fica como está.
    foreach v_nivel in array coalesce(v_convite.niveis, '{}'::text[]) loop
      select case when v_convite.origem = 'pagamento' then n.extensao_dias
                  else coalesce(n.trial_dias, n.extensao_dias) end
        into v_dias
        from academia.niveis n
       where n.id = v_nivel and n.organizacao_id = v_convite.organizacao_id and n.removido_em is null;
      if found then
        insert into academia.assinaturas as s (organizacao_id, utilizador_id, nivel_id, estado, expira_em, origem, nota)
        values (v_convite.organizacao_id, auth.uid(), v_nivel, 'ativo',
                case when v_dias is not null then current_date + v_dias end, 'convite', 'Convite ' || v_convite.id)
        on conflict (utilizador_id, nivel_id) do update
          set estado = 'ativo', expira_em = excluded.expira_em, iniciado_em = now(),
              origem = 'convite', nota = excluded.nota, atualizado_em = now()
          where not (s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date));
        v_n := v_n + 1;
      end if;
    end loop;

    update academia.convites
       set aceite_em = now(), aceite_por = auth.uid()
     where id = v_convite.id;
  end loop;

  return v_n;
end;
$function$;

-- 5 A venda, a renovação, o reembolso e o estado da assinatura no checkout -----
-- Tudo chega pelo webhook da integração (academia-vendas): nada aqui lê o
-- checkout por dentro.
create or replace function public.escola_aplicar_venda(p_org uuid, p_evento jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id text := nullif(trim(p_evento->>'id'), '');
  v_tipo text := coalesce(p_evento->>'type', '');
  d jsonb := coalesce(p_evento->'data', '{}'::jsonb);
  v_pedido text := nullif(d->'order'->>'id', '');
  v_ref text := coalesce(nullif(d->'order'->>'reference', ''), nullif(d->'order'->>'id', ''), nullif(d->'subscription'->>'id', ''));
  v_email text := lower(trim(coalesce(d->'customer'->>'email', d->'subscription'->'customer'->>'email', '')));
  v_nome text := nullif(left(trim(coalesce(d->'customer'->>'name', d->'subscription'->'customer'->>'name', '')), 120), '');
  v_lingua text := case when lower(coalesce(d->>'locale', '')) like 'en%' then 'en' else 'pt' end;
  v_teste boolean := coalesce((p_evento->>'livemode')::boolean, true) = false;
  v_itens text[] := coalesce((select array_agg(it->>'product_id') from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) it
                               where nullif(it->>'product_id', '') is not null), '{}');
  v_cursos text[] := '{}';
  v_mostra text[] := '{}';
  v_turmas jsonb := '{}'::jsonb;
  v_niveis text[] := '{}';
  v_nivel text;
  v_dias integer;
  v_d integer;
  v_nota text;
  v_ponte text;
  v_utilizador uuid;
  v_convite academia.convites;
  v_alvos jsonb;
  v_alvo jsonb;
  v_resultado text;
  v_modo text;
  v_motivo text;
  v_n integer := 0;
  v_m integer := 0;
  v_novo boolean := false;
  v_produto text;
  v_estado_ass text;
  v_para text;
  v_ate date;
begin
  if v_id is null then raise exception 'Evento sem id.'; end if;
  if not exists (select 1 from nucleo.organizacoes o where o.id = p_org) then raise exception 'Escola desconhecida.'; end if;
  if exists (select 1 from academia.vendas_recebidas v where v.organizacao_id = p_org and v.app = 'payflow' and v.evento_id = v_id) then
    return jsonb_build_object('resultado', 'repetido');
  end if;

  if v_tipo = 'integration.test' then
    v_resultado := 'teste';
    v_motivo := left(coalesce(d->>'message', ''), 200);

  elsif v_tipo = 'order.paid' then
    -- O que as ofertas destes produtos entregam (17/11/2026, passo 4): cursos,
    -- cada um numa turma, ou uma assinatura. Os produtos que a ponte de origem
    -- ainda entrega já abrem os cursos por lá: aqui não abrem outra vez.
    -- Por curso: a turma da oferta (sem ela, a padrão) e o prazo dessa turma;
    -- sem prazo se alguma das ofertas o der sem prazo.
    select coalesce(jsonb_agg(jsonb_build_object('curso', x.curso, 'turma', x.turma, 'dias', x.dias, 'legado', x.legado)), '[]'::jsonb)
      into v_alvos
      from (select c as curso,
                   (array_agg(tt.id order by o.criado_em, o.id))[1] as turma,
                   case when bool_or(coalesce(o.dias_de_acesso, tt.prazo_dias) is null) then null
                        else max(coalesce(o.dias_de_acesso, tt.prazo_dias)) end as dias,
                   case when bool_or(o.dias_de_acesso is null) then null else max(o.dias_de_acesso) end as legado
              from academia.ofertas o
              cross join lateral unnest(o.cursos) c
              join academia.cursos k on k.id = c and k.organizacao_id = p_org and k.removido_em is null
              left join lateral (select t.id, t.prazo_dias from academia.turmas t
                                  where t.curso_id = c and t.removido_em is null
                                    and (t.id = o.turmas->>c or t.padrao)
                                  order by coalesce(t.id = o.turmas->>c, false) desc
                                  limit 1) tt on true
             where o.organizacao_id = p_org and o.removido_em is null and o.ativa and o.nivel_id is null
               and exists (select 1 from unnest(o.produtos) pr
                            where pr = any(v_itens) and academia_privado.produto_pela_ponte(p_org, pr) is null)
             group by c) x;
    select coalesce(array_agg(a->>'curso'), '{}'),
           case when bool_or(a->>'legado' is null) then null else max((a->>'legado')::integer) end,
           coalesce(jsonb_object_agg(a->>'curso', a->>'turma') filter (where a->>'turma' is not null), '{}'::jsonb)
      into v_cursos, v_dias, v_turmas
      from jsonb_array_elements(v_alvos) a;
    select coalesce(array_agg(distinct n.id), '{}') into v_niveis
      from academia.ofertas o
      join academia.niveis n on n.id = o.nivel_id and n.removido_em is null and n.organizacao_id = p_org
     where o.organizacao_id = p_org and o.removido_em is null and o.ativa
       and exists (select 1 from unnest(o.produtos) pr
                    where pr = any(v_itens) and academia_privado.produto_pela_ponte(p_org, pr) is null);
    -- Os cursos que a compra abre, para o registo e para a carta: os das
    -- ofertas e os que as assinaturas levam.
    v_mostra := v_cursos || coalesce((select array_agg(distinct nt.curso_id)
                                        from academia.nivel_turmas nt
                                        join academia.cursos k on k.id = nt.curso_id and k.removido_em is null
                                       where nt.nivel_id = any(v_niveis) and nt.curso_id <> all(v_cursos)), '{}');
    select string_agg(n, ', ') into v_ponte
      from (select distinct academia_privado.produto_pela_ponte(p_org, pr) n from unnest(v_itens) pr) x
     where n is not null;
    if cardinality(v_cursos) = 0 and cardinality(v_niveis) = 0 and v_ponte is not null then
      v_resultado := 'ignorado';
      v_motivo := left('Entregue pela ligação de origem (' || v_ponte || '): não abre os cursos duas vezes.', 200);
    elsif cardinality(v_cursos) = 0 and cardinality(v_niveis) = 0 then
      v_resultado := 'sem_cursos';
      v_motivo := 'Nenhum produto desta compra está numa oferta com cursos ou com uma assinatura.';
    elsif v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      v_resultado := 'recusado';
      v_motivo := 'A compra não traz um email válido.';
    else
      v_nota := 'payflow:' || coalesce(v_pedido, v_id);
      select u.id into v_utilizador from public.utilizadores u
       where lower(u.email) = v_email and u.removido_em is null and u.estado = 'Ativo' limit 1;
      if v_utilizador is not null then
        -- Já tem conta: o acesso abre já (e o gatilho fá-lo aluno da escola).
        -- Comprar outra vez soma os dias ao que já tinha; nunca encurta nem
        -- põe prazo a um acesso que não o tinha.
        for v_alvo in select * from jsonb_array_elements(v_alvos) loop
          v_d := (v_alvo->>'dias')::integer;
          if not exists (select 1 from academia.acessos a
                          where a.utilizador_id = v_utilizador and a.curso_id = v_alvo->>'curso'
                            and a.estado = 'ativo' and (a.expira_em is null or a.expira_em >= current_date)) then
            v_novo := true;
          end if;
          insert into academia.acessos as a (utilizador_id, curso_id, origem, nota, turma_id, estado, expira_em)
          values (v_utilizador, v_alvo->>'curso', 'oferta', v_nota, v_alvo->>'turma', 'ativo',
                  case when v_d is not null then current_date + v_d end)
          on conflict (utilizador_id, curso_id) do update
            set expira_em = case
                  when v_d is null then null
                  when a.estado = 'ativo' and a.expira_em is null then null
                  when a.estado = 'ativo' and a.expira_em >= current_date then a.expira_em + v_d
                  else current_date + v_d end,
                turma_id = coalesce(excluded.turma_id, a.turma_id),
                estado = 'ativo', origem = 'oferta', nota = excluded.nota;
          v_n := v_n + 1;
        end loop;
        foreach v_nivel in array v_niveis loop
          select n.extensao_dias into v_d from academia.niveis n where n.id = v_nivel;
          if not exists (select 1 from academia.assinaturas s
                          where s.utilizador_id = v_utilizador and s.nivel_id = v_nivel
                            and s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date)) then
            v_novo := true;
          end if;
          insert into nucleo.membros (organizacao_id, utilizador_id, app, papel)
          values (p_org, v_utilizador, 'academia', 'aluno')
          on conflict (organizacao_id, utilizador_id, app) do nothing;
          insert into academia.assinaturas as s (organizacao_id, utilizador_id, nivel_id, estado, expira_em, origem, nota)
          values (p_org, v_utilizador, v_nivel, 'ativo', case when v_d is not null then current_date + v_d end, 'oferta', v_nota)
          on conflict (utilizador_id, nivel_id) do update
            set expira_em = case
                  when v_d is null then null
                  when s.estado = 'ativo' and s.expira_em is null then null
                  when s.estado = 'ativo' and s.expira_em >= current_date then s.expira_em + v_d
                  else current_date + v_d end,
                iniciado_em = case when s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date)
                                   then s.iniciado_em else now() end,
                estado = 'ativo', origem = 'oferta', nota = excluded.nota, atualizado_em = now();
          v_n := v_n + 1;
        end loop;
        -- Uma renovação não manda outra carta: a pessoa já lá estava.
        v_modo := case when v_novo then 'acesso' else 'renovacao' end;
      else
        insert into academia.convites (email, nome, cursos, turmas, niveis, expira_em, idioma, origem, organizacao_id, papel, referencia, acesso_dias)
        values (v_email, v_nome, v_cursos, v_turmas, v_niveis, now() + interval '30 days', v_lingua, 'pagamento', p_org, 'aluno',
                v_nota, v_dias)
        returning * into v_convite;
        v_modo := 'convite';
      end if;
      v_resultado := 'aplicado';
    end if;

  elsif v_tipo = 'order.refunded' then
    if coalesce((d->'order'->>'full_refund')::boolean, false) then
      update academia.acessos a set expira_em = current_date - 1, nota = left(coalesce(a.nota, '') || ' · reembolsado', 200)
       where a.organizacao_id = p_org and a.origem in ('oferta', 'convite')
         and (a.nota = 'payflow:' || coalesce(v_pedido, '-')
              or a.nota in (select 'Convite ' || c.id from academia.convites c
                             where c.organizacao_id = p_org and c.referencia = 'payflow:' || coalesce(v_pedido, '-')));
      get diagnostics v_n = row_count;
      update academia.assinaturas s set estado = 'desativado', atualizado_em = now(),
             nota = left(coalesce(s.nota, '') || ' · reembolsado', 200)
       where s.organizacao_id = p_org and s.origem in ('oferta', 'convite') and s.estado in ('ativo', 'pendente')
         and (s.nota = 'payflow:' || coalesce(v_pedido, '-')
              or s.nota in (select 'Convite ' || c.id from academia.convites c
                             where c.organizacao_id = p_org and c.referencia = 'payflow:' || coalesce(v_pedido, '-')));
      get diagnostics v_m = row_count;
      v_n := v_n + v_m;
      update academia.convites set revogado_em = now()
       where organizacao_id = p_org and referencia = 'payflow:' || coalesce(v_pedido, '-') and aceite_em is null and revogado_em is null;
      v_resultado := 'retirado';
    else
      v_resultado := 'ignorado';
      v_motivo := 'Reembolso parcial: o acesso fica.';
    end if;

  elsif v_tipo in ('subscription.updated', 'subscription.canceled') then
    -- A assinatura recorrente no checkout mudou de estado. Suspensa por falta
    -- de pagamento: fica pendente (sem acesso) até pagar. Cancelada: acaba no
    -- fim do período já pago, ou já, se não houver nenhum. Voltou a estar
    -- ativa: o que estava pendente reabre. Só mexe no que veio de uma compra.
    v_produto := nullif(d->'subscription'->>'product', '');
    v_estado_ass := coalesce(d->'subscription'->>'status', '');
    v_ate := case when d->'subscription'->>'paid_through' ~ '^\d{4}-\d{2}-\d{2}'
                  then left(d->'subscription'->>'paid_through', 10)::date end;
    v_para := case when v_tipo = 'subscription.canceled' or v_estado_ass in ('canceled', 'incomplete_expired') then 'desativado'
                   when v_estado_ass = 'unpaid' then 'pendente'
                   when v_estado_ass in ('active', 'trialing') then 'ativo' end;
    select u.id into v_utilizador from public.utilizadores u
     where lower(u.email) = v_email and u.removido_em is null limit 1;
    if v_para is null then
      v_resultado := 'ignorado';
      v_motivo := left('O estado «' || v_estado_ass || '» da assinatura não muda o acesso.', 200);
    elsif v_produto is null or v_utilizador is null then
      v_resultado := 'ignorado';
      v_motivo := 'O evento não traz o produto, ou não há conta com este email.';
    else
      if v_para = 'desativado' and v_ate is not null and v_ate >= current_date then
        -- Cancelada com dias pagos pela frente: acaba nesse dia.
        update academia.assinaturas s set expira_em = v_ate, atualizado_em = now()
         where s.organizacao_id = p_org and s.utilizador_id = v_utilizador and s.origem = 'oferta' and s.estado = 'ativo'
           and s.nivel_id in (select o.nivel_id from academia.ofertas o
                               where o.organizacao_id = p_org and o.removido_em is null and o.nivel_id is not null and v_produto = any(o.produtos));
        get diagnostics v_n = row_count;
        update academia.acessos a set expira_em = v_ate
         where a.organizacao_id = p_org and a.utilizador_id = v_utilizador and a.origem = 'oferta' and a.estado = 'ativo'
           and a.curso_id in (select c from academia.ofertas o cross join lateral unnest(o.cursos) c
                               where o.organizacao_id = p_org and o.removido_em is null and o.nivel_id is null and v_produto = any(o.produtos));
        get diagnostics v_m = row_count;
        v_resultado := 'ate_ao_fim';
        v_motivo := 'Cancelada: o acesso fica até ' || to_char(v_ate, 'DD/MM/YYYY') || ', o fim do período pago.';
      else
        update academia.assinaturas s set estado = v_para, atualizado_em = now()
         where s.organizacao_id = p_org and s.utilizador_id = v_utilizador and s.origem = 'oferta'
           and case when v_para = 'ativo' then s.estado = 'pendente' else s.estado in ('ativo', 'pendente') and s.estado <> v_para end
           and s.nivel_id in (select o.nivel_id from academia.ofertas o
                               where o.organizacao_id = p_org and o.removido_em is null and o.nivel_id is not null and v_produto = any(o.produtos));
        get diagnostics v_n = row_count;
        update academia.acessos a set estado = v_para
         where a.organizacao_id = p_org and a.utilizador_id = v_utilizador and a.origem = 'oferta'
           and case when v_para = 'ativo' then a.estado = 'pendente' else a.estado in ('ativo', 'pendente') and a.estado <> v_para end
           and a.curso_id in (select c from academia.ofertas o cross join lateral unnest(o.cursos) c
                               where o.organizacao_id = p_org and o.removido_em is null and o.nivel_id is null and v_produto = any(o.produtos));
        get diagnostics v_m = row_count;
        v_resultado := case v_para when 'ativo' then 'reativado' when 'pendente' then 'pendente' else 'retirado' end;
      end if;
      v_n := v_n + v_m;
      if v_n = 0 then
        v_resultado := 'ignorado';
        v_motivo := 'Nada a mudar: esta pessoa não tem um acesso comprado por este produto nesse estado.';
      end if;
    end if;

  else
    v_resultado := 'ignorado';
  end if;

  insert into academia.vendas_recebidas (organizacao_id, app, evento_id, tipo, resultado, pedido, referencia, email, cursos, modo, teste, motivo)
  values (p_org, 'payflow', v_id, v_tipo, v_resultado, v_pedido, v_ref, nullif(v_email, ''), v_mostra, v_modo, v_teste, v_motivo);

  return jsonb_build_object(
    'resultado', v_resultado, 'modo', v_modo, 'acessos', v_n,
    'email', nullif(v_email, ''), 'nome', v_nome, 'lingua', v_lingua,
    'escola', (select o.slug from nucleo.organizacoes o where o.id = p_org),
    'convite', case when v_convite.id is null then null else jsonb_build_object('token', v_convite.token, 'expiraEm', v_convite.expira_em) end,
    'cursos', coalesce((select jsonb_agg(k.titulo order by k.ordem nulls last) from academia.cursos k where k.id = any(v_mostra)), '[]'::jsonb),
    'assinaturas', coalesce((select jsonb_agg(n.nome order by n.nome) from academia.niveis n where n.id = any(v_niveis)), '[]'::jsonb));
end $function$;

revoke execute on function public.escola_aplicar_venda(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.escola_aplicar_venda(uuid, jsonb) to service_role;
