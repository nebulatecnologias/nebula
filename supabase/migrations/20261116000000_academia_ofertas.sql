-- As ofertas são da escola (pedido do Shelton a 15/11/2026: «a vitrine ainda
-- depende do Payflow sendo que o One Members é um software independente; as
-- ofertas devem ser montadas a partir do próprio painel e apenas conectar com
-- um checkout e webhooks»).
--
-- Até aqui havia três sítios para a mesma coisa: os planos (Assinaturas), os
-- produtos ligados aos cursos (Integrações › Payflow) e a Vitrine, que lia a
-- tabela de ofertas do Payflow (public.ofertas) e só mostrava as que tinham
-- entrega «Academia» ou «Plano» — desde que a Kingdom passou para a integração
-- (entrega «Nada»), a Vitrine dos alunos estava vazia.
--
-- Uma oferta passa a dizer tudo num sítio só, na escola:
--   - o que abre (cursos) e por quanto tempo (dias_de_acesso; nulo = sem prazo);
--   - quanto custa e onde se paga (preco, moeda, recorrencia, link): o link é
--     de qualquer checkout;
--   - que produtos do checkout a entregam (produtos: os prod_… do Payflow): a
--     venda chega pelo webhook e abre os cursos;
--   - se aparece na Vitrine (na_vitrine, destaque, chamada, em_breve, abre_em).
--
-- 1. academia.ofertas, só da equipa (escreve a administração da escola).
-- 2. As ofertas de hoje convertidas: os produtos ligados nas Integrações (uma
--    oferta por nome e cursos, com os produtos todos) e as linhas da Vitrine
--    (com o preço e o link que tinham no Payflow; o curso é o que tem o mesmo
--    nome, quando o há). Uma vez só.
-- 3. A Vitrine do aluno e a pré-venda leem daqui, em todas as escolas.
-- 4. A venda (escola_aplicar_venda) abre os cursos da oferta do produto, com
--    o prazo dela; o convite de quem ainda não tem conta leva o prazo
--    (convites.acesso_dias) e aceitar_convite aplica-o.
-- 5. As Integrações mostram os produtos das ofertas; ligar e tirar produtos
--    por lá acabou. As funções da Vitrine pelo número da oferta do Payflow
--    saem (vitrine_para_equipa, vitrine_mostrar, vitrine_pre_venda). A tabela
--    academia.vitrine fica, para a ponte de origem.

-- 1 -------------------------------------------------------------------------
create table academia.ofertas (
  id             text primary key default academia.novo_id(),
  organizacao_id uuid not null default academia_privado.organizacao() references nucleo.organizacoes(id),
  nome           text not null check (length(trim(nome)) between 2 and 120),
  chamada        text check (chamada is null or length(chamada) <= 240),
  cursos         text[] not null default '{}',
  dias_de_acesso integer check (dias_de_acesso between 1 and 3650),
  preco          numeric(14,2) not null default 0 check (preco >= 0),
  moeda          text not null default 'MZN' check (moeda ~ '^[A-Z]{3}$'),
  recorrencia    text check (recorrencia in ('mes', 'ano')),
  link           text check (link is null or link ~ '^https://'),
  produtos       text[] not null default '{}',
  na_vitrine     boolean not null default false,
  destaque       boolean not null default false,
  em_breve       boolean not null default false,
  abre_em        date,
  ativa          boolean not null default true,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  removido_em    timestamptz
);
create index ofertas_por_organizacao on academia.ofertas (organizacao_id);
create index ofertas_por_produto on academia.ofertas using gin (produtos);

alter table academia.ofertas enable row level security;
create policy ofertas_leitura on academia.ofertas for select to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa());
create policy ofertas_escrita on academia.ofertas for all to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.pode_integrar(organizacao_id))
  with check (organizacao_id = (select academia_privado.organizacao()) and academia_privado.pode_integrar(organizacao_id));
revoke all on academia.ofertas from public, anon;
grant select, insert, update, delete on academia.ofertas to authenticated;
grant all on academia.ofertas to service_role;

-- O que entra arruma-se e confere-se aqui, venha de onde vier.
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
revoke execute on function academia_privado.oferta_validar() from public, anon, authenticated;
create trigger t_oferta_validar before insert or update on academia.ofertas
  for each row execute function academia_privado.oferta_validar();

alter table academia.convites add column if not exists acesso_dias integer check (acesso_dias between 1 and 3650);

-- 2 -------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from academia.ofertas) then return; end if;

  -- Os produtos ligados nas Integrações: uma oferta por nome e cursos. O preço
  -- e o link são os da oferta mais recente do Payflow com um desses produtos.
  insert into academia.ofertas (organizacao_id, nome, cursos, produtos, preco, moeda, recorrencia, link, ordem)
  select g.organizacao_id, g.nome, g.cursos, g.produtos,
         coalesce(pf.preco, 0), coalesce(nullif(pf.moeda, ''), 'MZN'),
         case pf.cobranca::text when 'Recorrente mensal' then 'mes' when 'Recorrente anual' then 'ano' end,
         case when nullif(pf.atalho, '') is not null then 'https://payflow.kingdomcompny.com/' || pf.atalho end,
         row_number() over (partition by g.organizacao_id order by g.primeiro)
    from (select p.organizacao_id, coalesce(nullif(trim(p.nome), ''), 'Produto ligado') nome, p.cursos,
                 array_agg(p.produto_id order by p.criado_em) produtos, min(p.criado_em) primeiro
            from academia.produtos_externos p
           where p.removido_em is null and p.fornecedor = 'payflow'
           group by p.organizacao_id, coalesce(nullif(trim(p.nome), ''), 'Produto ligado'), p.cursos) g
    left join lateral (select o.preco, o.moeda, o.cobranca, o.atalho from public.ofertas o
                        where o.id_publico = any(g.produtos) and o.removido_em is null
                        order by o.id desc limit 1) pf on true;

  -- As linhas da Vitrine: o que estava à vista (ou em pré-venda) continua, com
  -- o preço e o link que tinha. O curso é o que tem o mesmo nome, se o houver;
  -- sem curso, a oferta fica guardada e não aparece até alguém lho dar.
  insert into academia.ofertas (organizacao_id, nome, chamada, cursos, produtos, preco, moeda, recorrencia, link,
                                na_vitrine, destaque, em_breve, abre_em, ordem)
  select v.organizacao_id, o.nome, v.chamada,
         coalesce((select array_agg(c.id order by c.ordem) from academia.cursos c
                    where c.organizacao_id = v.organizacao_id and c.removido_em is null
                      and lower(o.nome) like lower(c.titulo) || '%'), '{}'),
         array[o.id_publico], o.preco, coalesce(nullif(o.moeda, ''), 'MZN'),
         case o.cobranca::text when 'Recorrente mensal' then 'mes' when 'Recorrente anual' then 'ano' end,
         case when nullif(o.atalho, '') is not null then 'https://payflow.kingdomcompny.com/' || o.atalho
              when o.link_vendas ~ '^https://' then o.link_vendas end,
         v.mostrar, coalesce(v.destaque, false), coalesce(v.em_breve, false), v.abre_em,
         100 + coalesce(v.ordem, 0)
    from academia.vitrine v
    join public.ofertas o on o.id = v.oferta_id and o.removido_em is null and o.estado::text = 'Ativa'
   where o.id_publico is not null
     and academia_privado.produto_pela_ponte(v.organizacao_id, o.id_publico) is null
     and not exists (select 1 from academia.ofertas x
                      where x.organizacao_id = v.organizacao_id and o.id_publico = any(x.produtos));
end $$;

-- 3 -------------------------------------------------------------------------
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
      cross join lateral unnest(o.cursos) with ordinality as x(c, o)
      join academia.cursos c on c.id = x.c and c.removido_em is null and c.publicado
  )
  select coalesce(jsonb_agg(t.x order by (t.x->>'ordem')::int, t.x->>'nome'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'ofertaId', o.id, 'nome', o.nome, 'preco', o.preco, 'moeda', o.moeda,
      'cobranca', case o.recorrencia when 'mes' then 'Recorrente mensal' when 'ano' then 'Recorrente anual' else 'Cobrança única' end,
      'entrega', case when count(*) > 1 then 'Plano' else 'Academia' end,
      'linkVendas', o.link,
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
    group by o.id, o.nome, o.preco, o.moeda, o.recorrencia, o.link, o.destaque, o.chamada, o.ordem, o.em_breve, o.abre_em
    -- Só o que ainda não é meu; sem aulas só passa o que a equipa pôs em pré-venda.
    having bool_or(not k.ja_tenho) and (sum(k.aulas) > 0 or o.em_breve)
  ) t;
$function$;
revoke execute on function academia.vitrine_do_aluno() from public, anon;
grant execute on function academia.vitrine_do_aluno() to authenticated;

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
        join academia.cursos c on c.id = any(o.cursos) and c.organizacao_id = o.organizacao_id
       where o.organizacao_id = academia_privado.organizacao()
         and o.removido_em is null and o.em_breve
         and c.removido_em is null and c.publicado
         and academia_privado.tem_acesso(c.id)
       group by c.id
    ) t
$function$;
revoke execute on function academia.pre_venda_dos_meus_cursos() from public, anon;
grant execute on function academia.pre_venda_dos_meus_cursos() to authenticated;

drop function if exists academia.vitrine_para_equipa();
drop function if exists academia.vitrine_mostrar(bigint, boolean, boolean, text);
drop function if exists academia.vitrine_pre_venda(bigint, boolean, date);

-- 4 -------------------------------------------------------------------------
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

    foreach v_curso in array coalesce(v_convite.cursos, '{}'::text[]) loop
      if exists (select 1 from academia.cursos c
                  where c.id = v_curso and c.removido_em is null
                    and c.organizacao_id = v_convite.organizacao_id) then
        -- O prazo do acesso conta do dia em que a pessoa entra.
        insert into academia.acessos (utilizador_id, curso_id, origem, nota, expira_em)
        values (auth.uid(), v_curso, 'convite', 'Convite ' || v_convite.id,
                case when v_convite.acesso_dias is not null then current_date + v_convite.acesso_dias end)
        on conflict (utilizador_id, curso_id) do nothing;
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
  v_ref text := coalesce(nullif(d->'order'->>'reference', ''), nullif(d->'order'->>'id', ''));
  v_email text := lower(trim(coalesce(d->'customer'->>'email', '')));
  v_nome text := nullif(left(trim(coalesce(d->'customer'->>'name', '')), 120), '');
  v_lingua text := case when lower(coalesce(d->>'locale', '')) like 'en%' then 'en' else 'pt' end;
  v_teste boolean := coalesce((p_evento->>'livemode')::boolean, true) = false;
  v_itens text[] := coalesce((select array_agg(it->>'product_id') from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) it
                               where nullif(it->>'product_id', '') is not null), '{}');
  v_cursos text[] := '{}';
  v_dias integer;
  v_ponte text;
  v_utilizador uuid;
  v_convite academia.convites;
  v_alvos jsonb;
  v_alvo jsonb;
  v_resultado text;
  v_modo text;
  v_motivo text;
  v_n integer := 0;
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
    -- Os cursos das ofertas que estes produtos entregam (16/11/2026: as
    -- ofertas são da escola). Os produtos que a ponte de origem ainda entrega
    -- já abrem os cursos por lá: aqui não abrem outra vez (24/10/2026).
    -- Por curso, o prazo: sem prazo se alguma das ofertas o der sem prazo.
    select coalesce(jsonb_agg(jsonb_build_object('curso', x.curso, 'dias', x.dias)), '[]'::jsonb)
      into v_alvos
      from (select c as curso, case when bool_or(o.dias_de_acesso is null) then null else max(o.dias_de_acesso) end as dias
              from academia.ofertas o
              cross join lateral unnest(o.cursos) c
             where o.organizacao_id = p_org and o.removido_em is null and o.ativa
               and exists (select 1 from unnest(o.produtos) pr
                            where pr = any(v_itens) and academia_privado.produto_pela_ponte(p_org, pr) is null)
               and exists (select 1 from academia.cursos k where k.id = c and k.organizacao_id = p_org and k.removido_em is null)
             group by c) x;
    select coalesce(array_agg(a->>'curso'), '{}'),
           case when bool_or(a->>'dias' is null) then null else max((a->>'dias')::integer) end
      into v_cursos, v_dias
      from jsonb_array_elements(v_alvos) a;
    select string_agg(n, ', ') into v_ponte
      from (select distinct academia_privado.produto_pela_ponte(p_org, pr) n from unnest(v_itens) pr) x
     where n is not null;
    if cardinality(v_cursos) = 0 and v_ponte is not null then
      v_resultado := 'ignorado';
      v_motivo := left('Entregue pela ligação de origem (' || v_ponte || '): não abre os cursos duas vezes.', 200);
    elsif cardinality(v_cursos) = 0 then
      v_resultado := 'sem_cursos';
      v_motivo := 'Nenhum produto desta compra está numa oferta com cursos.';
    elsif v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      v_resultado := 'recusado';
      v_motivo := 'A compra não traz um email válido.';
    else
      select u.id into v_utilizador from public.utilizadores u
       where lower(u.email) = v_email and u.removido_em is null and u.estado = 'Ativo' limit 1;
      if v_utilizador is not null then
        -- Já tem conta: o acesso abre já (e o gatilho fá-lo aluno da escola).
        -- Uma compra nunca encurta um acesso que já ia mais longe.
        for v_alvo in select * from jsonb_array_elements(v_alvos) loop
          insert into academia.acessos as a (utilizador_id, curso_id, origem, nota, expira_em)
          values (v_utilizador, v_alvo->>'curso', 'oferta', 'payflow:' || coalesce(v_pedido, v_id),
                  case when v_alvo->>'dias' is not null then current_date + (v_alvo->>'dias')::integer end)
          on conflict (utilizador_id, curso_id) do update
            set expira_em = case
                  when excluded.expira_em is null then null
                  when a.expira_em is null then null
                  else greatest(a.expira_em, excluded.expira_em) end,
                origem = 'oferta', nota = excluded.nota;
          v_n := v_n + 1;
        end loop;
        v_modo := 'acesso';
      else
        insert into academia.convites (email, nome, cursos, expira_em, idioma, origem, organizacao_id, papel, referencia, acesso_dias)
        values (v_email, v_nome, v_cursos, now() + interval '30 days', v_lingua, 'pagamento', p_org, 'aluno',
                'payflow:' || coalesce(v_pedido, v_id), v_dias)
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
      update academia.convites set revogado_em = now()
       where organizacao_id = p_org and referencia = 'payflow:' || coalesce(v_pedido, '-') and aceite_em is null and revogado_em is null;
      v_resultado := 'retirado';
    else
      v_resultado := 'ignorado';
      v_motivo := 'Reembolso parcial: o acesso fica.';
    end if;

  else
    v_resultado := 'ignorado';
  end if;

  insert into academia.vendas_recebidas (organizacao_id, app, evento_id, tipo, resultado, pedido, referencia, email, cursos, modo, teste, motivo)
  values (p_org, 'payflow', v_id, v_tipo, v_resultado, v_pedido, v_ref, nullif(v_email, ''), v_cursos, v_modo, v_teste, v_motivo);

  return jsonb_build_object(
    'resultado', v_resultado, 'modo', v_modo, 'acessos', v_n,
    'email', nullif(v_email, ''), 'nome', v_nome, 'lingua', v_lingua,
    'escola', (select o.slug from nucleo.organizacoes o where o.id = p_org),
    'convite', case when v_convite.id is null then null else jsonb_build_object('token', v_convite.token, 'expiraEm', v_convite.expira_em) end,
    'cursos', coalesce((select jsonb_agg(k.titulo order by k.ordem nulls last) from academia.cursos k where k.id = any(v_cursos)), '[]'::jsonb));
end $function$;
revoke execute on function public.escola_aplicar_venda(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.escola_aplicar_venda(uuid, jsonb) to service_role;

-- 5 -------------------------------------------------------------------------
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
    'produtos', coalesce((select jsonb_agg(jsonb_build_object('produto', pr, 'nome', o.nome, 'oferta', o.id, 'cursos', to_jsonb(o.cursos))
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

-- Uma página antiga em cache ainda pode chamar estas: dizem para onde foi.
create or replace function academia.produto_externo_guardar(p_produto text, p_nome text, p_cursos text[])
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Os produtos passaram para as Ofertas. Recarregue a página e ligue o produto na oferta que o vende.';
end $function$;

create or replace function academia.produto_externo_tirar(p_produto text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Os produtos passaram para as Ofertas. Recarregue a página e tire o produto da oferta.';
end $function$;
