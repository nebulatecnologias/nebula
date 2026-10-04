/* ACADEMIA — a cobrança começa na inscrição (W4·7, decisões do Shelton a 04/10/2026).

   - A escola nasce PENDENTE (fechada) e com o pedido de validação guardado
     (links.validacao: a cobrança dos 10 MT no Payflow; metodo: mpesa|cartao).
     Abre quando chega a assinatura activa — pelo evento do Payflow, ou pelo
     /criar, que pergunta logo a seguir ao pagamento (criar-escola, accao
     'confirmar').
   - Os eventos do Payflow passam a trazer o método M-Pesa e o vencimento da
     fatura; quando a escola fica activa, o pedido de validação sai dos links.
   - Tolerância: 3 dias depois do vencimento (era 7).
   - Uma escola por validar há mais de 24 h fica cancelada (não se apaga nada:
     a conta continua a existir, e quem quiser volta a criar). */

alter table nucleo.faturas_plataforma add column if not exists vence_em date;

update nucleo.definicoes_plataforma
   set valor = valor || jsonb_build_object('diasTolerancia', 3)
 where chave = 'cobranca';

/* O criar-escola, com a chave de serviço, depois de pedir a validação ao Payflow. */
create or replace function public.plataforma_validacao_pedida(p_org uuid, p_metodo text, p_link text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_metodo not in ('mpesa', 'cartao') then raise exception 'Método inválido.'; end if;
  update nucleo.assinaturas
     set metodo = p_metodo,
         links = coalesce(links, '{}'::jsonb) || jsonb_build_object('validacao', p_link),
         atualizado_em = now()
   where organizacao_id = p_org and estado = 'pendente';
end $$;
revoke all on function public.plataforma_validacao_pedida(uuid, text, text) from public, anon, authenticated;

create or replace function public.plataforma_aplicar_evento(p_evento jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_id text := nullif(trim(p_evento->>'id'), '');
  v_tipo text := coalesce(p_evento->>'type', p_evento->>'tipo', '');
  v_quando timestamptz := coalesce(nullif(p_evento->>'created_at', '')::timestamptz, now());
  d jsonb := coalesce(p_evento->'data', p_evento->'dados', '{}'::jsonb);
  f jsonb := d->'fatura';
  v_org uuid; a nucleo.assinaturas; v_estado text; v_pago timestamptz;
  v_tol int := coalesce((public.plataforma_definicoes()->>'diasTolerancia')::int, 3);
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
    /* «pago até» chega como dia: vale até ao fim desse dia. */
    if d->>'pago_ate' ~ '^\d{4}-\d{2}-\d{2}$' then v_pago := ((d->>'pago_ate')::date + 1)::timestamptz - interval '1 second'; end if;
    if v_estado = 'suspensa' then
      v_pago := least(coalesce(v_pago, now()), now() - make_interval(days => v_tol + 1));
    end if;
    update nucleo.assinaturas set
      estado = case v_estado when 'teste' then 'teste' when 'ativa' then 'ativa' when 'em_atraso' then 'em_atraso'
                             when 'suspensa' then 'em_atraso' when 'cancelada' then 'cancelada' else estado end,
      teste_ate = case when v_estado = 'suspensa' then least(coalesce(teste_ate, v_pago), v_pago)
                       else coalesce(nullif(d->>'teste_ate', '')::timestamptz, teste_ate) end,
      pago_ate = case when v_estado in ('ativa', 'em_atraso', 'suspensa') or d ? 'pago_ate' then coalesce(v_pago, pago_ate) else pago_ate end,
      plano_id = case when d->>'plano' in (select p.id from nucleo.planos_plataforma p) then d->>'plano' else plano_id end,
      ciclo = case when d->>'ciclo' in ('mensal', 'anual') then d->>'ciclo' else ciclo end,
      moeda = case when d->>'moeda' in ('MZN', 'ZAR') then d->>'moeda' else moeda end,
      cancela_no_fim = case when d ? 'cancela_no_fim' then coalesce((d->>'cancela_no_fim')::boolean, false) else cancela_no_fim end,
      cancelada_em = case when v_estado = 'cancelada' then coalesce(cancelada_em, now()) else cancelada_em end,
      metodo = case when d->>'metodo' in ('cartao', 'fatura', 'mpesa') then d->>'metodo' else metodo end,
      cartao = case when d ? 'cartao' then coalesce(jsonb_strip_nulls(jsonb_build_object(
                 'marca', d->'cartao'->>'marca', 'ultimos4', d->'cartao'->>'ultimos4', 'expira', d->'cartao'->>'expira')), '{}'::jsonb)
               else cartao end,
      links = case when v_estado in ('ativa', 'teste') then
                     (case when jsonb_typeof(d->'links') = 'object' then coalesce(links, '{}'::jsonb) || jsonb_strip_nulls(d->'links') else coalesce(links, '{}'::jsonb) end) - 'validacao'
                   when jsonb_typeof(d->'links') = 'object' then coalesce(links, '{}'::jsonb) || jsonb_strip_nulls(d->'links')
                   else links end,
      ultimo_erro = case when v_estado in ('em_atraso', 'suspensa') then left(coalesce(d->>'motivo', ultimo_erro), 200)
                         when v_estado in ('teste', 'ativa') then null else ultimo_erro end,
      tentativas = 0, proxima_tentativa = null,
      ultimo_evento_em = v_quando, atualizado_em = now()
     where organizacao_id = v_org;
  end if;

  if jsonb_typeof(f) = 'object' and coalesce(f->>'id', '') <> '' then
    insert into nucleo.faturas_plataforma (organizacao_id, plano_id, ciclo, periodo_inicio, periodo_fim, valor, moeda,
                                           estado, tipo, referencia, ambiente, pago_em, motivo, link, vence_em)
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
            nullif(f->>'link', ''), nullif(f->>'vence', '')::date)
    on conflict (referencia) do update set
      estado = excluded.estado, valor = excluded.valor, pago_em = coalesce(excluded.pago_em, nucleo.faturas_plataforma.pago_em),
      motivo = excluded.motivo, link = coalesce(excluded.link, nucleo.faturas_plataforma.link),
      periodo_inicio = excluded.periodo_inicio, periodo_fim = excluded.periodo_fim,
      vence_em = coalesce(excluded.vence_em, nucleo.faturas_plataforma.vence_em);
  end if;

  insert into nucleo.eventos_payflow (id, tipo, organizacao_id, resultado, corpo) values (v_id, v_tipo, v_org, v_resultado, p_evento);
  return jsonb_build_object('resultado', v_resultado, 'organizacao', v_org);
end $$;

/* As escolas que pediram a validação e não a pagaram em 24 h ficam canceladas. */
create or replace function nucleo.plataforma_expirar_por_validar()
returns int language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  update nucleo.assinaturas
     set estado = 'cancelada', cancelada_em = now(), atualizado_em = now(),
         ultimo_erro = 'A validação do pagamento não foi feita em 24 horas.'
   where estado = 'pendente' and coalesce(links, '{}'::jsonb) ? 'validacao'
     and criado_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function nucleo.plataforma_expirar_por_validar() from public, anon, authenticated;

select cron.schedule('plataforma-expirar-por-validar', '37 * * * *', 'select nucleo.plataforma_expirar_por_validar()');
