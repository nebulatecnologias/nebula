-- O Payflow avisa a Academia da assinatura de cada escola (W4·6b; decisão do
-- Shelton a 02/10: os dois falam só por webhook e/ou API). A Edge Function
-- `academia-receber` confere a assinatura do webhook (X-Kingdom-Signature, a
-- mesma das entregas à Library) e passa o evento a public.plataforma_aplicar_evento.
--
-- O contrato (PLANO.md, W4·6b) — corpo do webhook:
--   { "id": "evt_…", "type": "assinatura.paga", "created_at": "…",
--     "data": { "organizacao": "<uuid da escola na Academia>" | "escola": "<nome curto>",
--               "estado": "teste|ativa|em_atraso|suspensa|cancelada",
--               "plano": "essencial|profissional|escala", "ciclo": "mensal|anual",
--               "moeda": "MZN|ZAR", "teste_ate", "pago_ate", "cancela_no_fim",
--               "metodo": "cartao|fatura", "motivo",
--               "cartao": { "marca", "ultimos4", "expira" } | null,
--               "links": { "pagamento", "cartao" },
--               "fatura": { "id", "inicio", "fim", "valor", "moeda",
--                           "estado": "pendente|paga|falhou|devolvida|anulada",
--                           "pago_em", "motivo", "link" } } }
--
-- Regras:
-- - Cada evento aplica-se uma vez (nucleo.eventos_payflow, pelo id).
-- - Um evento mais velho do que o último aplicado não muda o estado (chegam
--   fora de ordem nas repetições), mas a fatura que traz grava-se na mesma.
-- - Uma escola isenta não muda de estado por um evento.
-- - «suspensa» (o Payflow suspende ao 7.º dia) fecha a conta já: estado em
--   atraso com «paga até» antes da tolerância. A tolerância passa a 7 dias,
--   a mesma da escada do Payflow, para os dois lados dizerem o mesmo.

create table if not exists nucleo.eventos_payflow (
  id text primary key,
  tipo text not null,
  organizacao_id uuid,
  resultado text not null,
  corpo jsonb not null,
  recebido_em timestamptz not null default now()
);
alter table nucleo.eventos_payflow enable row level security;
revoke all on nucleo.eventos_payflow from public, anon, authenticated;
comment on table nucleo.eventos_payflow is 'Eventos de assinatura recebidos do Payflow (academia-receber). Só o servidor lê e escreve.';

alter table nucleo.assinaturas add column if not exists metodo text;
alter table nucleo.assinaturas add column if not exists links jsonb not null default '{}'::jsonb;
alter table nucleo.assinaturas add column if not exists ultimo_evento_em timestamptz;
alter table nucleo.faturas_plataforma add column if not exists link text;

update nucleo.definicoes_plataforma set valor = valor || jsonb_build_object('diasTolerancia', 7), atualizado_em = now()
 where chave = 'cobranca';

create or replace function public.plataforma_aplicar_evento(p_evento jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := nullif(trim(p_evento->>'id'), '');
  v_tipo text := coalesce(p_evento->>'type', p_evento->>'tipo', '');
  v_quando timestamptz := coalesce(nullif(p_evento->>'created_at', '')::timestamptz, now());
  d jsonb := coalesce(p_evento->'data', p_evento->'dados', '{}'::jsonb);
  f jsonb := d->'fatura';
  v_org uuid; a nucleo.assinaturas; v_estado text; v_pago timestamptz;
  v_tol int := coalesce((public.plataforma_definicoes()->>'diasTolerancia')::int, 7);
  v_resultado text := 'aplicado';
begin
  if v_id is null then raise exception 'Evento sem id.'; end if;
  if v_tipo not like 'assinatura.%' then
    insert into nucleo.eventos_payflow (id, tipo, resultado, corpo) values (v_id, v_tipo, 'ignorado', p_evento)
    on conflict (id) do nothing;
    return jsonb_build_object('resultado', 'ignorado');
  end if;
  if exists (select 1 from nucleo.eventos_payflow where id = v_id) then
    return jsonb_build_object('resultado', 'repetido');
  end if;

  if d->>'organizacao' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select o.id into v_org from nucleo.organizacoes o where o.id = (d->>'organizacao')::uuid;
  elsif coalesce(d->>'escola', '') <> '' then
    select o.id into v_org from nucleo.organizacoes o where o.slug = lower(d->>'escola');
  end if;
  if v_org is null then raise exception 'Escola desconhecida.'; end if;

  select * into a from nucleo.assinaturas where organizacao_id = v_org for update;
  if not found then
    insert into nucleo.assinaturas (organizacao_id, plano_id, estado, moeda)
    values (v_org, coalesce(nullif(d->>'plano', ''), 'essencial'), 'pendente', coalesce(nullif(d->>'moeda', ''), 'MZN'))
    returning * into a;
  end if;

  if a.estado = 'isenta' then
    v_resultado := 'isenta';
  elsif a.ultimo_evento_em is not null and v_quando < a.ultimo_evento_em then
    v_resultado := 'antigo';
  else
    v_estado := d->>'estado';
    v_pago := nullif(d->>'pago_ate', '')::timestamptz;
    if v_estado = 'suspensa' then
      v_pago := least(coalesce(v_pago, now()), now() - make_interval(days => v_tol + 1));
    end if;
    update nucleo.assinaturas set
      estado = case v_estado when 'teste' then 'teste' when 'ativa' then 'ativa' when 'em_atraso' then 'em_atraso'
                             when 'suspensa' then 'em_atraso' when 'cancelada' then 'cancelada' else estado end,
      -- Suspensa fecha a conta já, mesmo que o fim do teste ainda estivesse por vir.
      teste_ate = case when v_estado = 'suspensa' then least(coalesce(teste_ate, v_pago), v_pago)
                       else coalesce(nullif(d->>'teste_ate', '')::timestamptz, teste_ate) end,
      pago_ate = case when v_estado in ('ativa', 'em_atraso', 'suspensa') or d ? 'pago_ate' then coalesce(v_pago, pago_ate) else pago_ate end,
      plano_id = case when d->>'plano' in (select p.id from nucleo.planos_plataforma p) then d->>'plano' else plano_id end,
      ciclo = case when d->>'ciclo' in ('mensal', 'anual') then d->>'ciclo' else ciclo end,
      moeda = case when d->>'moeda' in ('MZN', 'ZAR') then d->>'moeda' else moeda end,
      cancela_no_fim = case when d ? 'cancela_no_fim' then coalesce((d->>'cancela_no_fim')::boolean, false) else cancela_no_fim end,
      cancelada_em = case when v_estado = 'cancelada' then coalesce(cancelada_em, now()) else cancelada_em end,
      metodo = case when d->>'metodo' in ('cartao', 'fatura') then d->>'metodo' else metodo end,
      cartao = case when d ? 'cartao' then coalesce(jsonb_strip_nulls(jsonb_build_object(
                 'marca', d->'cartao'->>'marca', 'ultimos4', d->'cartao'->>'ultimos4', 'expira', d->'cartao'->>'expira')), '{}'::jsonb)
               else cartao end,
      links = case when jsonb_typeof(d->'links') = 'object' then links || jsonb_strip_nulls(d->'links') else links end,
      ultimo_erro = case when v_estado in ('em_atraso', 'suspensa') then left(coalesce(d->>'motivo', ultimo_erro), 200)
                         when v_estado in ('teste', 'ativa') then null else ultimo_erro end,
      tentativas = 0, proxima_tentativa = null,
      ultimo_evento_em = v_quando, atualizado_em = now()
     where organizacao_id = v_org;
  end if;

  -- A fatura que o evento traz: grava-se sempre (é o livro do Payflow).
  if jsonb_typeof(f) = 'object' and coalesce(f->>'id', '') <> '' then
    insert into nucleo.faturas_plataforma (organizacao_id, plano_id, ciclo, periodo_inicio, periodo_fim, valor, moeda,
                                           estado, tipo, referencia, ambiente, pago_em, motivo, link)
    values (v_org,
            coalesce(case when d->>'plano' in (select p.id from nucleo.planos_plataforma p) then d->>'plano' end, a.plano_id),
            coalesce(case when d->>'ciclo' in ('mensal', 'anual') then d->>'ciclo' end, a.ciclo),
            (f->>'inicio')::timestamptz, (f->>'fim')::timestamptz, (f->>'valor')::numeric,
            coalesce(nullif(f->>'moeda', ''), a.moeda),
            case f->>'estado' when 'paga' then 'paga' when 'falhou' then 'falhou' when 'anulada' then 'falhou'
                              when 'devolvida' then 'reembolsada' else 'pendente' end,
            'periodo', 'payflow:' || (f->>'id'), 'payflow',
            nullif(f->>'pago_em', '')::timestamptz,
            left(coalesce(f->>'motivo', case when f->>'estado' = 'anulada' then 'Anulada.' end), 200),
            nullif(f->>'link', ''))
    on conflict (referencia) do update set
      estado = excluded.estado, valor = excluded.valor, pago_em = coalesce(excluded.pago_em, nucleo.faturas_plataforma.pago_em),
      motivo = excluded.motivo, link = coalesce(excluded.link, nucleo.faturas_plataforma.link),
      periodo_inicio = excluded.periodo_inicio, periodo_fim = excluded.periodo_fim;
  end if;

  insert into nucleo.eventos_payflow (id, tipo, organizacao_id, resultado, corpo) values (v_id, v_tipo, v_org, v_resultado, p_evento);
  return jsonb_build_object('resultado', v_resultado, 'organizacao', v_org);
end $$;
revoke all on function public.plataforma_aplicar_evento(jsonb) from public, anon, authenticated;
grant execute on function public.plataforma_aplicar_evento(jsonb) to service_role;

-- A Cobrança da escola leva o método e os links de pagamento do Payflow, e o
-- link de cada fatura.
create or replace function academia.cobranca_da_escola()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_org uuid := academia_privado.organizacao(); a nucleo.assinaturas;
begin
  if coalesce(academia_privado.papel_em(v_org), '') <> 'admin' and not nucleo.e_admin_plataforma() then
    raise exception 'Só a administração da escola.';
  end if;
  select * into a from nucleo.assinaturas where organizacao_id = v_org;
  return jsonb_build_object(
    'organizacao', (select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome) from nucleo.organizacoes o where o.id = v_org),
    'assinatura', case when a.organizacao_id is null then null else jsonb_build_object(
        'plano', a.plano_id, 'ciclo', a.ciclo, 'estado', a.estado, 'moeda', a.moeda, 'simbolo', nucleo.simbolo_da_moeda(a.moeda),
        'testeAte', a.teste_ate, 'pagoAte', a.pago_ate, 'metodo', a.metodo, 'links', a.links,
        'cancelaNoFim', a.cancela_no_fim, 'cartao', a.cartao, 'faturacao', a.faturacao,
        'ultimoErro', a.ultimo_erro) end,
    'contaEmDia', nucleo.conta_em_dia(v_org),
    'alunosAtivos', nucleo.alunos_ativos(v_org),
    'limite', nucleo.limite_de_alunos(v_org),
    'planos', public.planos_da_plataforma(),
    'faturas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'inicio', f.periodo_inicio, 'fim', f.periodo_fim, 'valor', f.valor, 'moeda', f.moeda,
        'estado', f.estado, 'plano', f.plano_id, 'ciclo', f.ciclo, 'pagoEm', f.pago_em, 'motivo', f.motivo, 'link', f.link)
        order by f.periodo_inicio desc)
      from nucleo.faturas_plataforma f where f.organizacao_id = v_org and f.tipo = 'periodo'), '[]'::jsonb));
end $$;
