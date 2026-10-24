-- Aplicada a 24/10/2026 (versão 20261024161833). Prova antes e depois, em
-- transacções desfeitas, como administração da Kingdom e com um email
-- inventado (ensaio@exemplo.invalid): o segredo liga; a ficha lista as 4
-- ofertas que a ponte entrega; ligar uma delas é recusado com o caminho; uma
-- oferta com entrega «Nada» liga e a venda dela dá convite; a venda de uma
-- oferta da ponte fica «ignorado» com o porquê; repetida → «repetido»;
-- reembolso total → «retirado» e o convite revogado; noutra escola a regra
-- não se aplica. Nada ficou gravado (conferido).
--
-- A Kingdom liga o Payflow como as outras escolas (pedido do Shelton a
-- 24/10/2026: «quero que nesta escola a integração seja igual à de todas as
-- outras e que tenha de ser configurada»).
--
-- Até aqui a base recusava ligar o Payflow na Kingdom, porque as vendas dela
-- chegam pela ponte de origem (o confirmar-e-abrir do Payflow abre os cursos
-- das ofertas com entrega «Academia» ou «Plano» e escreve ao aluno). Agora a
-- Kingdom configura a integração como qualquer escola: o endereço do
-- academia-vendas, os eventos, o segredo e cada produto ligado aos cursos.
--
-- A regra que não muda (PLANO.md, 25/09): nunca dois emails a dizer a mesma
-- coisa, nunca o mesmo acesso aberto duas vezes. Por isso, na Kingdom, um
-- produto que a ponte ainda entrega:
--   - não se liga aqui: produto_externo_guardar recusa e diz como passar
--     (no Payflow, a entrega da oferta passa a «Nada»; depois liga-se aqui);
--   - se uma venda dele chegar pela integração, não abre nada pela segunda vez
--     (escola_aplicar_venda regista «ignorado», com o porquê).
-- Produto a produto, sem mexer no Payflow e sem tocar nos alunos de hoje.
--
-- integracoes_da_escola deixa de dizer `vendasPelaPonte` (fica falso, para
-- uma página antiga em cache não esconder o formulário) e passa a dizer que
-- produtos a ponte ainda entrega, para a ficha os mostrar.

-- O produto (prod_… = ofertas.id_publico) que a ponte de origem ainda entrega
-- nesta escola; nulo se não for o caso. Só a Kingdom tem ponte.
create or replace function academia_privado.produto_pela_ponte(p_org uuid, p_produto text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select o.nome from public.ofertas o
   where p_org = nucleo.organizacao_kingdom()
     and o.id_publico = p_produto
     and o.removido_em is null
     and o.entrega::text in ('Academia', 'Plano')
   limit 1
$$;
revoke execute on function academia_privado.produto_pela_ponte(uuid, text) from public, anon, authenticated;

create or replace function academia.integracao_payflow_guardar(p_segredo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_org uuid := academia_privado.organizacao(); i academia.integracoes; v_id uuid; v_seg text := trim(coalesce(p_segredo, ''));
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
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
        v_ponte text;
begin
  if not academia_privado.pode_integrar(v_org) then raise exception 'Só a administração da escola.'; end if;
  if v_prod !~ '^prod_[A-Za-z0-9_]{4,64}$' then raise exception 'O ID do produto começa por prod_. Copie-o do Payflow, em Integrações › IDs dos produtos.'; end if;
  if cardinality(v_cursos) = 0 then raise exception 'Escolha pelo menos um curso para este produto abrir.'; end if;
  v_ponte := academia_privado.produto_pela_ponte(v_org, v_prod);
  if v_ponte is not null then
    raise exception '«%» ainda abre os cursos pela ligação de origem. No Payflow, mude a entrega desta oferta para «Nada» e ligue-a aqui: assim cada compra abre os cursos uma só vez.', v_ponte;
  end if;
  insert into academia.produtos_externos (organizacao_id, fornecedor, produto_id, nome, cursos)
  values (v_org, 'payflow', v_prod, nullif(left(trim(coalesce(p_nome, '')), 120), ''), v_cursos)
  on conflict (organizacao_id, fornecedor, produto_id) do update set nome = excluded.nome, cursos = excluded.cursos,
    atualizado_em = now(), removido_em = null;
end $$;
revoke execute on function academia.produto_externo_guardar(text, text, text[]) from public, anon;
grant execute on function academia.produto_externo_guardar(text, text, text[]) to authenticated;

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
    'organizacao', (select jsonb_build_object('id', o.id, 'slug', o.slug, 'vendasPelaPonte', false)
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
end $$;
revoke execute on function academia.integracoes_da_escola() from public, anon;
grant execute on function academia.integracoes_da_escola() to authenticated;

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
  v_ponte text;
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
    -- Os produtos que a ponte de origem ainda entrega já abrem os cursos por
    -- lá: aqui não abrem outra vez (24/10/2026).
    select coalesce(array_agg(distinct c), '{}') into v_cursos
      from academia.produtos_externos p
      cross join lateral unnest(p.cursos) c
     where p.organizacao_id = p_org and p.fornecedor = 'payflow' and p.removido_em is null
       and p.produto_id in (select it->>'product_id' from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) it)
       and academia_privado.produto_pela_ponte(p_org, p.produto_id) is null
       and exists (select 1 from academia.cursos k where k.id = c and k.organizacao_id = p_org and k.removido_em is null);
    select string_agg(n, ', ') into v_ponte
      from (select distinct academia_privado.produto_pela_ponte(p_org, it->>'product_id') n
              from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) it) x
     where n is not null;
    if cardinality(v_cursos) = 0 and v_ponte is not null then
      v_resultado := 'ignorado';
      v_motivo := left('Entregue pela ligação de origem (' || v_ponte || '): não abre os cursos duas vezes.', 200);
    elsif cardinality(v_cursos) = 0 then
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
