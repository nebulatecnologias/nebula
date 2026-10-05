-- W4·8·5 (A5) — a Academia, cliente do Payflow.
--
-- Decisão do Shelton a 04/10/2026 (PLANO, «W4·8 — Fase A»): o que a Academia faz
-- com o Payflow, qualquer empresa com uma chave `sk_` faz igual. A Academia deixa
-- de entrar pela porta interna (`plataforma-assinatura`, com a chave mestra) e
-- passa a falar pela API pública:
--
--   - guarda a chave `sk_live_…`/`sk_test_…` cifrada no Vault (posta na consola,
--     Integrações › Payflow), que só o servidor lê;
--   - por plano, ciclo e moeda, o produto do Payflow que se vende (uma oferta
--     «Recorrente mensal»/«Recorrente anual»); o preço, a validação e os dias
--     grátis que mostra vêm desse produto, lidos pela API (`GET /v1/products`);
--   - a escola guarda o id da assinatura (`sub_…`) e o modo; o estado chega pelos
--     eventos `subscription.*`/`invoice.*` (o academia-receber) e, enquanto a
--     escola espera, pela API (`GET /v1/subscriptions/{id}`).
--
-- Enquanto não houver chave na consola, nada muda: os preços continuam os da
-- tabela dos planos e a criar-escola continua pela porta interna. É o A6 que
-- liga a chave, os produtos e o webhook da Kingdom, e retira a porta.
--
-- Nota: a ferramenta de SQL fica à espera de confirmação com certas palavras;
-- este ficheiro só acrescenta (se ainda não existe) e substitui funções.

-- ============ A chave da API ============

create table if not exists nucleo.payflow_cliente (
  id boolean primary key default true check (id),
  chave_id uuid,
  chave_fim text,
  modo text check (modo in ('live', 'test')),
  ligada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table nucleo.payflow_cliente enable row level security;
revoke all on nucleo.payflow_cliente from anon, authenticated;

create or replace function nucleo.payflow_ligado()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$ select exists (select 1 from nucleo.payflow_cliente where chave_id is not null) $$;
revoke execute on function nucleo.payflow_ligado() from public, anon;

-- A consola: liga, troca ou desliga a chave. '' desliga.
create or replace function academia.consola_chave_payflow(p_chave text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare k nucleo.payflow_cliente; v_id uuid; v text := trim(coalesce(p_chave, ''));
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  select * into k from nucleo.payflow_cliente where id for update;
  if v = '' then
    -- Desligar: a chave é trocada por texto aleatório no Vault antes de se largar.
    if k.chave_id is not null then perform nucleo.guardar_segredo(k.chave_id, encode(extensions.gen_random_bytes(24), 'hex'), 'payflow-api'); end if;
    update nucleo.payflow_cliente set chave_id = null, chave_fim = null, modo = null, atualizado_em = now(), atualizado_por = auth.uid() where id;
    return jsonb_build_object('ligada', false);
  end if;
  if v !~ '^sk_(live|test)_[0-9a-f]{48}$' then
    raise exception 'A chave da API do Payflow começa por sk_live_ ou sk_test_. Copie-a outra vez do Payflow (Integrações › Chaves da API).';
  end if;
  v_id := nucleo.guardar_segredo(k.chave_id, v, 'consola · payflow-api');
  insert into nucleo.payflow_cliente (id, chave_id, chave_fim, modo, ligada_em, atualizado_em, atualizado_por)
  values (true, v_id, right(v, 4), case when v like 'sk_live_%' then 'live' else 'test' end, now(), now(), auth.uid())
  on conflict (id) do update set chave_id = excluded.chave_id, chave_fim = excluded.chave_fim, modo = excluded.modo,
    ligada_em = coalesce(nucleo.payflow_cliente.ligada_em, excluded.ligada_em), atualizado_em = now(), atualizado_por = auth.uid();
  return jsonb_build_object('ligada', true, 'chaveFim', right(v, 4), 'modo', case when v like 'sk_live_%' then 'live' else 'test' end);
end $$;
revoke execute on function academia.consola_chave_payflow(text) from public, anon;
grant execute on function academia.consola_chave_payflow(text) to authenticated;

-- Para a criar-escola (service_role): a chave posta na consola.
create or replace function public.plataforma_chave_payflow()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select d.decrypted_secret from nucleo.payflow_cliente k
    join vault.decrypted_secrets d on d.id = k.chave_id
   where k.id
$$;
revoke execute on function public.plataforma_chave_payflow() from public, anon, authenticated;
grant execute on function public.plataforma_chave_payflow() to service_role;

-- ============ O produto de cada plano ============

create table if not exists nucleo.planos_produtos (
  plano_id text not null references nucleo.planos_plataforma(id),
  ciclo text not null check (ciclo in ('mensal', 'anual')),
  moeda text not null check (moeda in ('MZN', 'ZAR')),
  produto text check (produto ~ '^prod_[0-9A-HJKMNP-TV-Z]{26}$'),
  -- O que a API disse do produto, da última vez que se leu.
  nome text,
  preco numeric,
  validacao numeric,
  dias_gratis int,
  a_venda boolean not null default false,
  motivo text,
  lido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  primary key (plano_id, ciclo, moeda)
);
alter table nucleo.planos_produtos enable row level security;
revoke all on nucleo.planos_produtos from anon, authenticated;

-- A consola escolhe o produto de cada célula: [{plano, ciclo, moeda, produto|null}].
-- Fica por ler (a_venda falso) até a criar-escola o ler pela API.
create or replace function academia.consola_produtos_payflow(p_mapa jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare e jsonb; v_prod text; n int := 0;
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if jsonb_typeof(p_mapa) <> 'array' then raise exception 'Mapa inválido.'; end if;
  for e in select * from jsonb_array_elements(p_mapa) loop
    if not exists (select 1 from nucleo.planos_plataforma p where p.id = e->>'plano') then raise exception 'Plano inválido.'; end if;
    if coalesce(e->>'ciclo', '') not in ('mensal', 'anual') then raise exception 'Ciclo inválido.'; end if;
    if coalesce(e->>'moeda', '') not in ('MZN', 'ZAR') then raise exception 'Moeda inválida.'; end if;
    v_prod := nullif(trim(coalesce(e->>'produto', '')), '');
    if v_prod is not null and v_prod !~ '^prod_[0-9A-HJKMNP-TV-Z]{26}$' then
      raise exception 'O produto do Payflow escreve-se prod_ seguido de 26 letras e números.';
    end if;
    insert into nucleo.planos_produtos as pp (plano_id, ciclo, moeda, produto, a_venda, atualizado_em, atualizado_por)
    values (e->>'plano', e->>'ciclo', e->>'moeda', v_prod, false, now(), auth.uid())
    on conflict (plano_id, ciclo, moeda) do update set
      produto = excluded.produto,
      -- O mesmo produto mantém o que já se leu; um produto novo fica por ler.
      a_venda = case when pp.produto is not distinct from excluded.produto then pp.a_venda else false end,
      nome = case when pp.produto is not distinct from excluded.produto then pp.nome end,
      preco = case when pp.produto is not distinct from excluded.produto then pp.preco end,
      validacao = case when pp.produto is not distinct from excluded.produto then pp.validacao end,
      dias_gratis = case when pp.produto is not distinct from excluded.produto then pp.dias_gratis end,
      motivo = case when pp.produto is not distinct from excluded.produto then pp.motivo end,
      lido_em = case when pp.produto is not distinct from excluded.produto then pp.lido_em end,
      atualizado_em = now(), atualizado_por = auth.uid();
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'celulas', n);
end $$;
revoke execute on function academia.consola_produtos_payflow(jsonb) from public, anon;
grant execute on function academia.consola_produtos_payflow(jsonb) to authenticated;

-- A criar-escola leu os produtos pela API (a lista de GET /v1/products): cada
-- célula fica à venda só se o produto existe, está activo, é recorrente com o
-- ciclo da célula, na moeda da célula, e tem preço.
create or replace function public.plataforma_produtos_lidos(p_produtos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare r nucleo.planos_produtos; p jsonb; v_motivo text; n_venda int := 0; n int := 0;
begin
  if jsonb_typeof(p_produtos) <> 'array' then raise exception 'Lista de produtos inválida.'; end if;
  for r in select * from nucleo.planos_produtos where produto is not null for update loop
    select x into p from jsonb_array_elements(p_produtos) x where x->>'id' = r.produto limit 1;
    v_motivo := case
      when p is null then 'O Payflow não deu este produto: confirme que existe e que a chave o vê.'
      when p->>'status' is distinct from 'active' then 'O produto não está à venda no Payflow.'
      when jsonb_typeof(p->'recurring') is distinct from 'object' then 'O produto não é uma assinatura (a cobrança não é recorrente).'
      when (p#>>'{recurring,interval}') is distinct from (case r.ciclo when 'anual' then 'year' else 'month' end)
        then format('O produto é %s; esta coluna é %s.', case p#>>'{recurring,interval}' when 'year' then 'anual' else 'mensal' end, r.ciclo)
      when (p#>>'{price,currency}') is distinct from r.moeda then format('O produto cobra em %s; esta coluna é em %s.', p#>>'{price,currency}', r.moeda)
      when coalesce((p#>>'{price,amount}')::bigint, 0) <= 0 then 'O produto não tem preço.'
    end;
    update nucleo.planos_produtos set
      nome = left(p->>'name', 120),
      preco = case when p is not null then round((p#>>'{price,amount}')::numeric / 100, 2) end,
      validacao = case when p is not null then round(coalesce((p#>>'{recurring,setup_amount}')::numeric, 0) / 100, 2) end,
      dias_gratis = case when p is not null then coalesce((p#>>'{recurring,trial_days}')::int, 0) end,
      a_venda = v_motivo is null, motivo = v_motivo, lido_em = now()
     where plano_id = r.plano_id and ciclo = r.ciclo and moeda = r.moeda;
    n := n + 1;
    if v_motivo is null then n_venda := n_venda + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'celulas', n, 'aVenda', n_venda);
end $$;
revoke execute on function public.plataforma_produtos_lidos(jsonb) from public, anon, authenticated;
grant execute on function public.plataforma_produtos_lidos(jsonb) to service_role;

-- Para a criar-escola: o produto que se vende neste plano, ciclo e moeda.
create or replace function public.plataforma_produto_do_plano(p_plano text, p_ciclo text, p_moeda text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select pp.produto from nucleo.planos_produtos pp
   where pp.plano_id = p_plano and pp.ciclo = p_ciclo and pp.moeda = p_moeda and pp.a_venda and pp.produto is not null
$$;
revoke execute on function public.plataforma_produto_do_plano(text, text, text) from public, anon, authenticated;
grant execute on function public.plataforma_produto_do_plano(text, text, text) to service_role;

-- Há algum plano que precisa de ser lido outra vez? (o relógio da criar-escola)
create or replace function public.plataforma_produtos_por_ler(p_minutos int default 15)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select nucleo.payflow_ligado() and exists (
    select 1 from nucleo.planos_produtos pp
     where pp.produto is not null and (pp.lido_em is null or pp.lido_em < now() - make_interval(mins => greatest(p_minutos, 1))))
$$;
revoke execute on function public.plataforma_produtos_por_ler(int) from public, anon, authenticated;
grant execute on function public.plataforma_produtos_por_ler(int) to service_role;

-- O plano está à venda nesta moeda e ciclo? Com a chave ligada, só pelo produto
-- do Payflow; sem ela, pelo preço da tabela (até ao A6).
create or replace function nucleo.plano_a_venda(p_plano text, p_moeda text, p_ciclo text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case when nucleo.payflow_ligado()
    then exists (select 1 from nucleo.planos_produtos pp
                  where pp.plano_id = p_plano and pp.moeda = p_moeda and pp.ciclo = p_ciclo and pp.a_venda)
    else nucleo.preco_do_plano(p_plano, p_moeda, p_ciclo) is not null end
$$;
revoke execute on function nucleo.plano_a_venda(text, text, text) from public, anon;

-- Os planos que o site e a /criar mostram. Com a chave ligada, o preço, a
-- validação e os dias grátis são os do produto do Payflow.
create or replace function public.planos_da_plataforma()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with celulas as (
    select p.id, m.moeda, c.ciclo,
           case when nucleo.payflow_ligado() then pp.preco else nucleo.preco_do_plano(p.id, m.moeda, c.ciclo) end as preco,
           case when nucleo.payflow_ligado() then pp.a_venda else nucleo.preco_do_plano(p.id, m.moeda, c.ciclo) is not null end as a_venda,
           pp.validacao, pp.dias_gratis
      from nucleo.planos_plataforma p
     cross join (values ('MZN'), ('ZAR')) m(moeda)
     cross join (values ('mensal'), ('anual')) c(ciclo)
      left join nucleo.planos_produtos pp on pp.plano_id = p.id and pp.moeda = m.moeda and pp.ciclo = c.ciclo
     where p.ativo
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'nome', p.nome, 'alunosMax', p.alunos_max,
           'precos', (select jsonb_object_agg(m.moeda, jsonb_build_object(
                        'mensal', (select case when x.a_venda then x.preco end from celulas x where x.id = p.id and x.moeda = m.moeda and x.ciclo = 'mensal'),
                        'anual', (select case when x.a_venda then x.preco end from celulas x where x.id = p.id and x.moeda = m.moeda and x.ciclo = 'anual'),
                        'simbolo', nucleo.simbolo_da_moeda(m.moeda)))
                        from (values ('MZN'), ('ZAR')) m(moeda)),
           -- Só com o Payflow ligado: o que o produto diz da entrada.
           'regras', case when nucleo.payflow_ligado() then (select jsonb_object_agg(m.moeda, (
                        select jsonb_object_agg(x.ciclo, jsonb_build_object('validacao', x.validacao, 'diasGratis', x.dias_gratis))
                          from celulas x where x.id = p.id and x.moeda = m.moeda and x.a_venda))
                        from (values ('MZN'), ('ZAR')) m(moeda)) end,
           'aVenda', exists (select 1 from celulas x where x.id = p.id and x.a_venda))
         order by p.ordem), '[]'::jsonb)
    from nucleo.planos_plataforma p where p.ativo
$$;

-- ============ A escola guarda a assinatura do Payflow ============

alter table nucleo.assinaturas add column if not exists payflow_id text;
alter table nucleo.assinaturas add column if not exists livemode boolean;
create unique index if not exists assinaturas_payflow_id on nucleo.assinaturas (payflow_id) where payflow_id is not null;

-- A criação da escola confere a venda pelo produto, quando a chave está ligada.
do $$
declare v text := pg_get_functiondef('public.plataforma_criar_escola(text,text,text,text,uuid,text)'::regprocedure);
begin
  if position('nucleo.plano_a_venda' in v) = 0 then
    v := replace(v, 'if nucleo.preco_do_plano(p.id, p_moeda, p_ciclo) is null then', 'if not nucleo.plano_a_venda(p.id, p_moeda, p_ciclo) then');
    if position('nucleo.plano_a_venda' in v) = 0 then raise exception 'plataforma_criar_escola: o trecho do preço mudou.'; end if;
    execute v;
  end if;
end $$;

-- Mudar de plano a meio fica fora da Fase A: com uma assinatura do Payflow, não.
do $$
declare v text := pg_get_functiondef('academia.mudar_plano(text,text)'::regprocedure);
begin
  if position('payflow_id' in v) = 0 then
    v := replace(v, '  if p_ciclo not in (''mensal'', ''anual'') then raise exception ''Ciclo inválido.''; end if;',
      '  if exists (select 1 from nucleo.assinaturas a where a.organizacao_id = v_org and a.payflow_id is not null) then
    raise exception ''Mudar de plano ainda não se faz por aqui. Fale connosco e mudamos por si.'';
  end if;
  if p_ciclo not in (''mensal'', ''anual'') then raise exception ''Ciclo inválido.''; end if;');
    if position('payflow_id' in v) = 0 then raise exception 'mudar_plano: o trecho do ciclo mudou.'; end if;
    execute v;
  end if;
end $$;

-- ============ Aplicar o que o Payflow diz ============
--
-- Recebe um evento `subscription.*`/`invoice.*` da API pública (todos trazem
-- data.subscription e, quase todos, data.invoice) ou, com id `pull-…`, o que a
-- criar-escola leu em GET /v1/subscriptions/{id} (não fica no registo).
--
-- A escola encontra-se pelo id da assinatura (`sub_…`) e, na primeira vez, pela
-- metadata.organizacao que a criar-escola pôs ao criar. Uma assinatura que não
-- é de nenhuma escola (o Payflow vende outras) ignora-se, sem erro.
--
-- Estados do Payflow → os da escola (os que nucleo.conta_em_dia já sabe ler):
--   incomplete → pendente (com o link da validação)
--   incomplete_expired → pendente, sem validação por pagar (não se retoma)
--   trialing → teste até trial_end      active → ativa, paga até paid_through
--   past_due → em_atraso (a tolerância conta de paid_through)
--   unpaid → em_atraso, já fora da tolerância (fechada)
--   canceled → cancelada (aberta até paid_through)
create or replace function public.escola_aplicar_assinatura(p_evento jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id text := nullif(trim(p_evento->>'id'), '');
  v_tipo text := coalesce(p_evento->>'type', '');
  v_puxado boolean := coalesce(p_evento->>'id', '') like 'pull-%';
  v_quando timestamptz := coalesce(nullif(p_evento->>'created_at', '')::timestamptz, now());
  s jsonb := p_evento#>'{data,subscription}';
  f jsonb := coalesce(p_evento#>'{data,invoice}', case when jsonb_typeof(p_evento#>'{data,subscription,latest_invoice}') = 'object' then p_evento#>'{data,subscription,latest_invoice}' end);
  v_sub text; v_org uuid; a nucleo.assinaturas; v_estado text; v_pago timestamptz; v_teste timestamptz;
  v_tol int := coalesce((public.plataforma_definicoes()->>'diasTolerancia')::int, 3);
  v_resultado text := 'aplicado'; v_link text;
begin
  if v_id is null then raise exception 'Evento sem id.'; end if;
  if not v_puxado and exists (select 1 from nucleo.eventos_payflow where id = v_id) then
    return jsonb_build_object('resultado', 'repetido');
  end if;
  v_sub := s->>'id';
  if jsonb_typeof(s) <> 'object' or coalesce(v_sub, '') !~ '^sub_' then
    if not v_puxado then
      insert into nucleo.eventos_payflow (id, tipo, resultado, corpo) values (v_id, v_tipo, 'ignorado', p_evento) on conflict (id) do nothing;
    end if;
    return jsonb_build_object('resultado', 'ignorado');
  end if;

  select * into a from nucleo.assinaturas where payflow_id = v_sub for update;
  if not found and s#>>'{metadata,organizacao}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if not exists (select 1 from nucleo.organizacoes o where o.id = (s#>>'{metadata,organizacao}')::uuid) then
      raise exception 'Escola desconhecida.';
    end if;
    select * into a from nucleo.assinaturas where organizacao_id = (s#>>'{metadata,organizacao}')::uuid for update;
    -- A escola já está ligada a outra assinatura: esta é antiga (ou de outra tentativa).
    if found and a.payflow_id is not null and a.payflow_id <> v_sub then v_resultado := 'outra assinatura'; end if;
  end if;
  if a.organizacao_id is null then
    if not v_puxado then
      insert into nucleo.eventos_payflow (id, tipo, resultado, corpo) values (v_id, v_tipo, 'ignorado', p_evento) on conflict (id) do nothing;
    end if;
    return jsonb_build_object('resultado', 'ignorado');
  end if;
  v_org := a.organizacao_id;

  if v_resultado = 'outra assinatura' then
    null;
  elsif a.estado = 'isenta' then
    v_resultado := 'isenta';
  elsif a.livemode is not null and a.livemode is distinct from (s->>'livemode')::boolean then
    v_resultado := 'outro modo';
  elsif not v_puxado and a.ultimo_evento_em is not null and v_quando < a.ultimo_evento_em then
    v_resultado := 'antigo';
  else
    v_estado := s->>'status';
    v_pago := nullif(s->>'paid_through', '')::timestamptz;
    v_teste := nullif(s->>'trial_end', '')::timestamptz;
    if v_estado = 'unpaid' then
      v_pago := least(coalesce(v_pago, now()), now() - make_interval(days => v_tol + 1));
    end if;
    v_link := case when v_estado = 'incomplete' and jsonb_typeof(s->'latest_invoice') = 'object'
                    and s#>>'{latest_invoice,status}' = 'open' then s#>>'{latest_invoice,hosted_invoice_url}' end;
    update nucleo.assinaturas set
      payflow_id = v_sub,
      livemode = (s->>'livemode')::boolean,
      estado = case v_estado when 'trialing' then 'teste' when 'active' then 'ativa'
                             when 'past_due' then 'em_atraso' when 'unpaid' then 'em_atraso'
                             when 'canceled' then 'cancelada'
                             when 'incomplete' then 'pendente' when 'incomplete_expired' then 'pendente' else estado end,
      teste_ate = case when v_estado = 'unpaid' then least(coalesce(v_teste, v_pago), v_pago) else coalesce(v_teste, teste_ate) end,
      pago_ate = case when v_estado in ('incomplete', 'incomplete_expired') then pago_ate
                      when v_estado = 'active' then coalesce(v_pago, nullif(s->>'current_period_end', '')::timestamptz, pago_ate)
                      else coalesce(v_pago, pago_ate) end,
      plano_id = case when s#>>'{metadata,plano}' in (select p.id from nucleo.planos_plataforma p) then s#>>'{metadata,plano}' else plano_id end,
      ciclo = case s#>>'{price,interval}' when 'year' then 'anual' when 'month' then 'mensal' else ciclo end,
      moeda = case when s#>>'{price,currency}' in ('MZN', 'ZAR') then s#>>'{price,currency}' else moeda end,
      cancela_no_fim = coalesce((s->>'cancel_at_period_end')::boolean, false),
      cancelada_em = case when v_estado = 'canceled' then coalesce(nullif(s->>'canceled_at', '')::timestamptz, cancelada_em, now()) else cancelada_em end,
      metodo = case s#>>'{payment_method,type}' when 'mpesa' then 'mpesa' when 'card' then 'cartao' when 'manual' then 'fatura' else metodo end,
      links = case when v_link is not null then coalesce(links, '{}'::jsonb) || jsonb_build_object('validacao', v_link)
                   else coalesce(links, '{}'::jsonb) - 'validacao' end,
      ultimo_erro = case when v_estado = 'past_due' then 'A fatura venceu sem pagamento.'
                         when v_estado = 'unpaid' then 'A fatura passou a tolerância sem pagamento: a área está suspensa.'
                         when v_estado in ('trialing', 'active') then null else ultimo_erro end,
      tentativas = 0, proxima_tentativa = null,
      -- O que se puxa não mexe no relógio dos eventos: a API dá a hora ao
      -- segundo, e um evento do mesmo segundo, a seguir, não pode ficar «antigo».
      ultimo_evento_em = case when v_puxado then ultimo_evento_em
                              else greatest(coalesce(ultimo_evento_em, v_quando), v_quando) end,
      atualizado_em = now()
     where organizacao_id = v_org;
  end if;

  -- A fatura (cada uma é uma cobrança do Payflow, com o link de pagar).
  if v_resultado in ('aplicado', 'antigo') and jsonb_typeof(f) = 'object' and coalesce(f->>'id', '') ~ '^in_' then
    insert into nucleo.faturas_plataforma (organizacao_id, plano_id, ciclo, periodo_inicio, periodo_fim, valor, moeda,
                                           estado, tipo, referencia, ambiente, pago_em, motivo, link, vence_em)
    select v_org, x.plano_id, x.ciclo,
           -- A validação não tem período: conta o dia em que foi emitida.
           coalesce(nullif(f->>'period_start', '')::timestamptz, nullif(f->>'created_at', '')::timestamptz, now()),
           coalesce(nullif(f->>'period_end', '')::timestamptz, nullif(f->>'created_at', '')::timestamptz, now()),
           round(coalesce((f->>'amount')::numeric, 0) / 100, 2), coalesce(nullif(f->>'currency', ''), x.moeda),
           case f->>'status' when 'paid' then 'paga' when 'void' then 'falhou' when 'uncollectible' then 'falhou' else 'pendente' end,
           case f->>'kind' when 'setup' then 'verificacao' else 'periodo' end,
           'payflow:' || (f->>'id'), case when (f->>'livemode')::boolean then 'payflow' else 'teste' end,
           nullif(f->>'paid_at', '')::timestamptz,
           case when f->>'status' = 'void' then 'Anulada.' end,
           nullif(f->>'hosted_invoice_url', ''), nullif(f->>'due_date', '')::date
      from nucleo.assinaturas x where x.organizacao_id = v_org
    on conflict (referencia) do update set
      estado = excluded.estado, valor = excluded.valor, pago_em = coalesce(excluded.pago_em, nucleo.faturas_plataforma.pago_em),
      motivo = excluded.motivo, link = coalesce(excluded.link, nucleo.faturas_plataforma.link),
      periodo_inicio = excluded.periodo_inicio, periodo_fim = excluded.periodo_fim,
      vence_em = coalesce(excluded.vence_em, nucleo.faturas_plataforma.vence_em);
  end if;

  if not v_puxado then
    insert into nucleo.eventos_payflow (id, tipo, organizacao_id, resultado, corpo) values (v_id, v_tipo, v_org, v_resultado, p_evento);
  end if;
  return jsonb_build_object('resultado', v_resultado, 'organizacao', v_org,
    'estado', (select estado from nucleo.assinaturas where organizacao_id = v_org));
end $$;
revoke execute on function public.escola_aplicar_assinatura(jsonb) from public, anon, authenticated;
grant execute on function public.escola_aplicar_assinatura(jsonb) to service_role;

-- O academia-receber chama sempre plataforma_aplicar_evento: os eventos da API
-- pública seguem para a função de cima; os antigos (`assinatura.*`, da porta
-- interna) continuam onde estavam até ao A6.
do $$
declare v text := pg_get_functiondef('public.plataforma_aplicar_evento(jsonb)'::regprocedure);
begin
  if position('escola_aplicar_assinatura' in v) = 0 then
    v := replace(v, '  if v_id is null then raise exception ''Evento sem id.''; end if;',
      '  if v_id is null then raise exception ''Evento sem id.''; end if;
  if v_tipo like ''subscription.%'' or v_tipo like ''invoice.%'' then
    return public.escola_aplicar_assinatura(p_evento);
  end if;');
    if position('escola_aplicar_assinatura' in v) = 0 then raise exception 'plataforma_aplicar_evento: o trecho do id mudou.'; end if;
    execute v;
  end if;
end $$;

-- As escolas à espera: também as que têm uma assinatura do Payflow (para a
-- criar-escola perguntar pela API) — devolve o id dela.
create or replace function public.plataforma_por_validar_payflow(p_email text default null)
returns table(organizacao uuid, slug text, nome text, payflow_id text)
language sql
stable
security definer
set search_path to ''
as $$
  select o.id, o.slug, o.nome, a.payflow_id
    from nucleo.assinaturas a
    join nucleo.organizacoes o on o.id = a.organizacao_id
   where a.estado = 'pendente'
     and a.payflow_id is not null
     and coalesce(a.links, '{}'::jsonb) ? 'validacao'
     and a.criado_em > now() - interval '24 hours'
     and (p_email is null or exists (
           select 1 from academia.convites c
            where c.organizacao_id = o.id and c.papel = 'dono'
              and lower(c.email) = lower(trim(p_email))))
   order by a.criado_em desc
   limit 50
$$;
revoke execute on function public.plataforma_por_validar_payflow(text) from public, anon, authenticated;
grant execute on function public.plataforma_por_validar_payflow(text) to service_role;

-- A assinatura do Payflow de uma escola (null: a escola é da porta interna).
create or replace function public.plataforma_payflow_da_escola(p_org uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$ select a.payflow_id from nucleo.assinaturas a where a.organizacao_id = p_org $$;
revoke execute on function public.plataforma_payflow_da_escola(uuid) from public, anon, authenticated;
grant execute on function public.plataforma_payflow_da_escola(uuid) to service_role;

-- ============ A consola ============

create or replace function academia.consola_integracoes()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare i nucleo.integracoes_plataforma; k nucleo.payflow_cliente;
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  select * into i from nucleo.integracoes_plataforma where app = 'payflow';
  select * into k from nucleo.payflow_cliente where id;
  return jsonb_build_object(
    'payflow', jsonb_build_object(
      'ligada', i.segredo_id is not null,
      'segredoFim', i.segredo_fim,
      'ligadaEm', i.ligado_em,
      'atualizadaEm', i.atualizado_em,
      'ultimoEvento', (select jsonb_build_object('tipo', e.tipo, 'resultado', e.resultado, 'recebidoEm', e.recebido_em)
                         from nucleo.eventos_payflow e order by e.recebido_em desc limit 1),
      'eventos', (select count(*) from nucleo.eventos_payflow),
      'api', jsonb_build_object('ligada', k.chave_id is not null, 'chaveFim', k.chave_fim, 'modo', k.modo,
                                'ligadaEm', k.ligada_em, 'atualizadaEm', k.atualizado_em)));
end $$;
revoke execute on function academia.consola_integracoes() from public, anon;
grant execute on function academia.consola_integracoes() to authenticated;

-- A página «Planos e preços»: com a chave ligada, o produto de cada célula e o
-- que a API disse dele.
do $$
declare v text := pg_get_functiondef('academia.consola_cobranca()'::regprocedure);
begin
  if position('planos_produtos' in v) = 0 then
    v := replace(v, '''definicoes'', public.plataforma_definicoes(),',
      '''definicoes'', public.plataforma_definicoes(),
    ''payflow'', jsonb_build_object(''ligado'', nucleo.payflow_ligado(),
      ''modo'', (select k.modo from nucleo.payflow_cliente k where k.id),
      ''produtos'', (select coalesce(jsonb_agg(jsonb_build_object(''plano'', pp.plano_id, ''ciclo'', pp.ciclo, ''moeda'', pp.moeda,
          ''produto'', pp.produto, ''nome'', pp.nome, ''preco'', pp.preco, ''validacao'', pp.validacao, ''diasGratis'', pp.dias_gratis,
          ''aVenda'', pp.a_venda, ''motivo'', pp.motivo, ''lidoEm'', pp.lido_em)), ''[]''::jsonb)
          from nucleo.planos_produtos pp where pp.produto is not null)),');
    if position('planos_produtos' in v) = 0 then raise exception 'consola_cobranca: o trecho das definições mudou.'; end if;
    execute v;
  end if;
end $$;
