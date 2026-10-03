-- Integrações (pedido do Shelton a 02/10/2026, no modelo da Memberkit): a
-- consola liga-se ao Payflow como a Kingdom Library, e cada organização liga
-- o Payflow dela para as vendas abrirem os cursos.
--
-- Os segredos (`whsec_…`) guardam-se no Vault, cifrados. As tabelas guardam
-- só o id do segredo e os últimos quatro caracteres, para se mostrar qual
-- está posto. Ninguém lê um segredo pela API: só as funções do servidor
-- (service_role), na hora de conferir a assinatura de uma entrega.
--
-- 1. nucleo.integracoes_plataforma — a da consola: o Payflow que cobra a
--    mensalidade das escolas (academia-receber, eventos assinatura.*).
-- 2. academia.integracoes — as de cada escola: o Payflow dela.
-- 3. academia.produtos_externos — que produto do Payflow (prod_…) abre que
--    cursos da escola.
-- 4. academia.vendas_recebidas — o histórico: cada evento recebido, uma vez,
--    com o que se fez com ele.
-- 5. public.escola_aplicar_venda — o que uma venda faz (chamada pelo academia-vendas):
--    - order.paid: os cursos dos produtos comprados. Quem já tem conta (o
--      mesmo email) recebe o acesso logo (origem «oferta», nota payflow:<pedido>; fica
--      aluno da escola pelo gatilho de academia.acessos); quem não tem recebe um convite de 30
--      dias com esses cursos. O limite de alunos do plano não trava uma
--      compra: quem comprou entra sempre.
--    - order.refunded com full_refund: o acesso dessa compra fecha (expira
--      ontem; fica o rasto) e o convite por aceitar dela é revogado.
--    - integration.test: regista, para a escola ver que a ligação funciona.

create table if not exists nucleo.integracoes_plataforma (
  app text primary key check (app in ('payflow')),
  segredo_id uuid,
  segredo_fim text,
  ligado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table nucleo.integracoes_plataforma enable row level security;
revoke all on nucleo.integracoes_plataforma from anon, authenticated;

create table if not exists academia.integracoes (
  organizacao_id uuid not null references nucleo.organizacoes(id),
  app text not null check (app in ('payflow')),
  estado text not null default 'ativa' check (estado in ('ativa', 'desligada')),
  segredo_id uuid,
  segredo_fim text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  primary key (organizacao_id, app)
);
alter table academia.integracoes enable row level security;
alter table academia.integracoes force row level security;
revoke all on academia.integracoes from anon, authenticated;

create table if not exists academia.produtos_externos (
  organizacao_id uuid not null references nucleo.organizacoes(id),
  fornecedor text not null check (fornecedor in ('payflow')),
  produto_id text not null check (produto_id ~ '^prod_[A-Za-z0-9_]{4,64}$'),
  nome text,
  cursos text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  removido_em timestamptz,
  primary key (organizacao_id, fornecedor, produto_id)
);
alter table academia.produtos_externos enable row level security;
alter table academia.produtos_externos force row level security;
revoke all on academia.produtos_externos from anon, authenticated;

create table if not exists academia.vendas_recebidas (
  organizacao_id uuid not null references nucleo.organizacoes(id),
  app text not null,
  evento_id text not null,
  tipo text not null,
  resultado text not null,
  pedido text,
  referencia text,
  email text,
  cursos text[] not null default '{}',
  modo text,
  teste boolean not null default false,
  motivo text,
  recebido_em timestamptz not null default now(),
  primary key (organizacao_id, app, evento_id)
);
alter table academia.vendas_recebidas enable row level security;
alter table academia.vendas_recebidas force row level security;
revoke all on academia.vendas_recebidas from anon, authenticated;
create index if not exists vendas_recebidas_quando on academia.vendas_recebidas (organizacao_id, recebido_em desc);

alter table academia.convites add column if not exists referencia text;

-- Guardar um segredo no Vault (novo ou por cima do que já havia).
create or replace function nucleo.guardar_segredo(p_id uuid, p_segredo text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_id is not null and exists (select 1 from vault.secrets s where s.id = p_id) then
    perform vault.update_secret(p_id, p_segredo);
    return p_id;
  end if;
  return vault.create_secret(p_segredo, p_nome || ' · ' || gen_random_uuid()::text, 'Integração (consola ou escola)');
end $$;
revoke execute on function nucleo.guardar_segredo(uuid, text, text) from public, anon, authenticated;

create or replace function nucleo.segredo_valido(p_segredo text)
returns boolean
language sql
immutable
as $$ select coalesce(p_segredo ~ '^whsec_[A-Za-z0-9+/=_-]{16,200}$', false) $$;

-- ============ A consola ============

create or replace function academia.consola_integracoes()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare i nucleo.integracoes_plataforma;
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  select * into i from nucleo.integracoes_plataforma where app = 'payflow';
  return jsonb_build_object(
    'payflow', jsonb_build_object(
      'ligada', i.segredo_id is not null,
      'segredoFim', i.segredo_fim,
      'ligadaEm', i.ligado_em,
      'atualizadaEm', i.atualizado_em,
      'ultimoEvento', (select jsonb_build_object('tipo', e.tipo, 'resultado', e.resultado, 'recebidoEm', e.recebido_em)
                         from nucleo.eventos_payflow e order by e.recebido_em desc limit 1),
      'eventos', (select count(*) from nucleo.eventos_payflow)));
end $$;
revoke execute on function academia.consola_integracoes() from public, anon;
grant execute on function academia.consola_integracoes() to authenticated;

create or replace function academia.consola_integracao_payflow(p_segredo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare i nucleo.integracoes_plataforma; v_id uuid; v_seg text := trim(coalesce(p_segredo, ''));
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  select * into i from nucleo.integracoes_plataforma where app = 'payflow' for update;
  if v_seg = '' then
    -- Desligar: o segredo é trocado por um aleatório antes de se largar.
    if i.segredo_id is not null then perform nucleo.guardar_segredo(i.segredo_id, encode(extensions.gen_random_bytes(24), 'hex'), 'payflow'); end if;
    update nucleo.integracoes_plataforma set segredo_id = null, segredo_fim = null, atualizado_em = now(), atualizado_por = auth.uid() where app = 'payflow';
    return jsonb_build_object('ligada', false);
  end if;
  if not nucleo.segredo_valido(v_seg) then raise exception 'O segredo do Payflow começa por whsec_. Copie-o outra vez da integração no Payflow.'; end if;
  v_id := nucleo.guardar_segredo(i.segredo_id, v_seg, 'consola · payflow');
  insert into nucleo.integracoes_plataforma (app, segredo_id, segredo_fim, ligado_em, atualizado_em, atualizado_por)
  values ('payflow', v_id, right(v_seg, 4), now(), now(), auth.uid())
  on conflict (app) do update set segredo_id = excluded.segredo_id, segredo_fim = excluded.segredo_fim,
    ligado_em = coalesce(nucleo.integracoes_plataforma.ligado_em, excluded.ligado_em),
    atualizado_em = now(), atualizado_por = auth.uid();
  return jsonb_build_object('ligada', true, 'segredoFim', right(v_seg, 4));
end $$;
revoke execute on function academia.consola_integracao_payflow(text) from public, anon;
grant execute on function academia.consola_integracao_payflow(text) to authenticated;

-- Para o academia-receber (service_role): o segredo posto na consola.
create or replace function public.plataforma_segredo_payflow()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select d.decrypted_secret from nucleo.integracoes_plataforma i
    join vault.decrypted_secrets d on d.id = i.segredo_id
   where i.app = 'payflow'
$$;
revoke execute on function public.plataforma_segredo_payflow() from public, anon, authenticated;
grant execute on function public.plataforma_segredo_payflow() to service_role;

-- ============ A escola ============

create or replace function academia_privado.pode_integrar(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$ select coalesce(academia_privado.papel_em(p_org), '') = 'admin' or nucleo.e_admin_plataforma() $$;

create or replace function academia.integracoes_da_escola()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_org uuid := academia_privado.organizacao(); i academia.integracoes;
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
  select * into i from academia.integracoes where organizacao_id = v_org and app = 'payflow';
  return jsonb_build_object(
    'organizacao', (select jsonb_build_object('id', o.id, 'slug', o.slug, 'kingdom', o.id = nucleo.organizacao_kingdom())
                      from nucleo.organizacoes o where o.id = v_org),
    'payflow', jsonb_build_object(
      'ligada', i.segredo_id is not null and i.estado = 'ativa',
      'segredoFim', i.segredo_fim,
      'ligadaEm', i.criado_em,
      'ultimoEvento', (select jsonb_build_object('tipo', v.tipo, 'resultado', v.resultado, 'recebidoEm', v.recebido_em)
                         from academia.vendas_recebidas v where v.organizacao_id = v_org and v.app = 'payflow'
                        order by v.recebido_em desc limit 1)),
    'produtos', coalesce((select jsonb_agg(jsonb_build_object('produto', p.produto_id, 'nome', p.nome, 'cursos', to_jsonb(p.cursos)) order by p.criado_em)
                            from academia.produtos_externos p
                           where p.organizacao_id = v_org and p.fornecedor = 'payflow' and p.removido_em is null), '[]'::jsonb),
    'cursos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo, 'publicado', c.publicado) order by c.ordem nulls last, c.criado_em)
                          from academia.cursos c where c.organizacao_id = v_org and c.removido_em is null), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', v.evento_id, 'app', v.app, 'tipo', v.tipo, 'resultado', v.resultado,
                              'pedido', v.referencia, 'email', v.email, 'cursos', to_jsonb(v.cursos), 'modo', v.modo, 'teste', v.teste,
                              'motivo', v.motivo, 'recebidoEm', v.recebido_em) order by v.recebido_em desc)
                            from (select * from academia.vendas_recebidas v where v.organizacao_id = v_org
                                   order by v.recebido_em desc limit 200) v), '[]'::jsonb));
end $$;
revoke execute on function academia.integracoes_da_escola() from public, anon;
grant execute on function academia.integracoes_da_escola() to authenticated;

create or replace function academia.integracao_payflow_guardar(p_segredo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_org uuid := academia_privado.organizacao(); i academia.integracoes; v_id uuid; v_seg text := trim(coalesce(p_segredo, ''));
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
  if v_org = nucleo.organizacao_kingdom() then
    raise exception 'Na Kingdom, as vendas do Payflow chegam pela ponte de sempre até à migração dos alunos.';
  end if;
  select * into i from academia.integracoes where organizacao_id = v_org and app = 'payflow' for update;
  if v_seg = '' then
    if i.segredo_id is not null then perform nucleo.guardar_segredo(i.segredo_id, encode(extensions.gen_random_bytes(24), 'hex'), 'payflow'); end if;
    update academia.integracoes set estado = 'desligada', segredo_id = null, segredo_fim = null, atualizado_em = now(), atualizado_por = auth.uid()
     where organizacao_id = v_org and app = 'payflow';
    return jsonb_build_object('ligada', false);
  end if;
  if not nucleo.segredo_valido(v_seg) then raise exception 'O segredo do Payflow começa por whsec_. Copie-o outra vez da integração no Payflow.'; end if;
  v_id := nucleo.guardar_segredo(i.segredo_id, v_seg, 'escola ' || v_org::text || ' · payflow');
  insert into academia.integracoes (organizacao_id, app, estado, segredo_id, segredo_fim, atualizado_por)
  values (v_org, 'payflow', 'ativa', v_id, right(v_seg, 4), auth.uid())
  on conflict (organizacao_id, app) do update set estado = 'ativa', segredo_id = excluded.segredo_id, segredo_fim = excluded.segredo_fim,
    atualizado_em = now(), atualizado_por = auth.uid();
  return jsonb_build_object('ligada', true, 'segredoFim', right(v_seg, 4));
end $$;
revoke execute on function academia.integracao_payflow_guardar(text) from public, anon;
grant execute on function academia.integracao_payflow_guardar(text) to authenticated;

create or replace function academia.produto_externo_guardar(p_produto text, p_nome text, p_cursos text[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_org uuid := academia_privado.organizacao(); v_prod text := trim(coalesce(p_produto, ''));
        v_cursos text[] := array(select distinct c from unnest(coalesce(p_cursos, '{}')) c
                                  where exists (select 1 from academia.cursos k where k.id = c and k.organizacao_id = v_org and k.removido_em is null));
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
  if v_prod !~ '^prod_[A-Za-z0-9_]{4,64}$' then raise exception 'O ID do produto começa por prod_. Copie-o do Payflow, em Integrações › IDs dos produtos.'; end if;
  if cardinality(v_cursos) = 0 then raise exception 'Escolha pelo menos um curso para este produto abrir.'; end if;
  insert into academia.produtos_externos (organizacao_id, fornecedor, produto_id, nome, cursos)
  values (v_org, 'payflow', v_prod, nullif(left(trim(coalesce(p_nome, '')), 120), ''), v_cursos)
  on conflict (organizacao_id, fornecedor, produto_id) do update set nome = excluded.nome, cursos = excluded.cursos,
    atualizado_em = now(), removido_em = null;
end $$;
revoke execute on function academia.produto_externo_guardar(text, text, text[]) from public, anon;
grant execute on function academia.produto_externo_guardar(text, text, text[]) to authenticated;

create or replace function academia.produto_externo_tirar(p_produto text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_org uuid := academia_privado.organizacao();
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
  update academia.produtos_externos set removido_em = now(), atualizado_em = now()
   where organizacao_id = v_org and fornecedor = 'payflow' and produto_id = p_produto and removido_em is null;
end $$;
revoke execute on function academia.produto_externo_tirar(text) from public, anon;
grant execute on function academia.produto_externo_tirar(text) to authenticated;

-- ============ O servidor (academia-vendas, service_role) ============

create or replace function public.escola_segredo_payflow(p_org uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select d.decrypted_secret from academia.integracoes i
    join vault.decrypted_secrets d on d.id = i.segredo_id
   where i.organizacao_id = p_org and i.app = 'payflow' and i.estado = 'ativa'
$$;
revoke execute on function public.escola_segredo_payflow(uuid) from public, anon, authenticated;
grant execute on function public.escola_segredo_payflow(uuid) to service_role;

create or replace function public.escola_aplicar_venda(p_org uuid, p_evento jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
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
  v_cursos text[] := '{}';
  v_utilizador uuid;
  v_convite academia.convites;
  v_curso text;
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
    select coalesce(array_agg(distinct c), '{}') into v_cursos
      from academia.produtos_externos p
      cross join lateral unnest(p.cursos) c
     where p.organizacao_id = p_org and p.fornecedor = 'payflow' and p.removido_em is null
       and p.produto_id in (select it->>'product_id' from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) it)
       and exists (select 1 from academia.cursos k where k.id = c and k.organizacao_id = p_org and k.removido_em is null);
    if cardinality(v_cursos) = 0 then
      v_resultado := 'sem_cursos';
      v_motivo := 'Nenhum produto desta compra está ligado a um curso.';
    elsif v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      v_resultado := 'recusado';
      v_motivo := 'A compra não traz um email válido.';
    else
      select u.id into v_utilizador from public.utilizadores u
       where lower(u.email) = v_email and u.removido_em is null and u.estado = 'Ativo' limit 1;
      if v_utilizador is not null then
        -- Já tem conta: o acesso abre já (e o gatilho fá-lo aluno da escola).
        foreach v_curso in array v_cursos loop
          insert into academia.acessos (utilizador_id, curso_id, origem, nota, expira_em)
          values (v_utilizador, v_curso, 'oferta', 'payflow:' || coalesce(v_pedido, v_id), null)
          on conflict (utilizador_id, curso_id) do update
            set expira_em = null, origem = 'oferta', nota = excluded.nota;
          v_n := v_n + 1;
        end loop;
        v_modo := 'acesso';
      else
        insert into academia.convites (email, nome, cursos, expira_em, idioma, origem, organizacao_id, papel, referencia)
        values (v_email, v_nome, v_cursos, now() + interval '30 days', v_lingua, 'pagamento', p_org, 'aluno', 'payflow:' || coalesce(v_pedido, v_id))
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
end $$;
revoke execute on function public.escola_aplicar_venda(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.escola_aplicar_venda(uuid, jsonb) to service_role;
