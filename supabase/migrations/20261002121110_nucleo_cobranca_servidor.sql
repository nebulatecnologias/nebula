-- A cobrança das escolas: o que as Edge Functions pedem à base (W4).
--
-- Só o servidor chama isto (service_role): `criar-escola`, `plataforma-cartao`
-- e `plataforma-cobrar`. As contas do dinheiro ficam aqui: o preço sai do
-- plano, o período sai do ciclo, e o browser não diz nenhum dos dois.
--
--   plataforma_criar_escola   a escola nova (pendente, sem cartão), o nome
--      dela na Aparência, e o convite de dono para quem a criou — é o
--      convite que a faz dona quando entra (academia.aceitar_convite) e que
--      impede a conta nova de cair na Kingdom (nucleo.ponte_do_perfil).
--   plataforma_cartao_preparar / _guardar   a verificação do cartão (R 1,00,
--      devolvido logo) e a autorização que fica; com o cartão, a escola
--      passa de pendente a teste (7 dias).
--   plataforma_a_cobrar / plataforma_cobranca_iniciar / _resultado   o fim
--      do teste e as renovações: o que está por cobrar, a fatura com o valor
--      do plano, e o que a Paystack respondeu. Falhou: em atraso, nova
--      tentativa no dia seguinte, até 4; depois espera por um cartão novo.
--   escola_vagas   quantos alunos cabem ainda no plano (para os convites).
--
-- Aplicada por execute_sql e registada à mão.

create or replace function public.plataforma_definicoes()
returns jsonb language sql stable security definer set search_path = ''
as $$ select coalesce((select valor from nucleo.definicoes_plataforma where chave = 'cobranca'), '{}'::jsonb) $$;

create or replace function public.plataforma_criar_escola(p_nome text, p_email text, p_plano text, p_ciclo text, p_por uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := left(trim(coalesce(p_nome, '')), 80);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_base text; v_slug text; v_n int := 1; v_id uuid; p nucleo.planos_plataforma;
begin
  if length(v_nome) < 2 then raise exception 'Escreva o nome da área de membros.'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Email inválido.'; end if;
  if p_ciclo not in ('mensal', 'anual') then raise exception 'Ciclo inválido.'; end if;
  select * into p from nucleo.planos_plataforma where id = p_plano and ativo;
  if not found then raise exception 'Plano inválido.'; end if;
  if (case p_ciclo when 'anual' then p.preco_anual else p.preco_mensal end) is null then
    raise exception 'Esse plano ainda não está à venda.';
  end if;
  -- Uma pessoa não acumula escolas por pagar.
  if (select count(*) from academia.convites c join nucleo.assinaturas a on a.organizacao_id = c.organizacao_id
       where lower(c.email) = v_email and c.papel = 'dono' and a.estado = 'pendente'
         and c.criado_em > now() - interval '1 day') >= 3 then
    raise exception 'Já criou várias áreas de membros hoje sem terminar. Termine uma delas primeiro.';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(translate(v_nome,
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'escola'), 36);
  if length(v_base) < 2 then v_base := v_base || '-escola'; end if;
  v_slug := v_base;
  while exists (select 1 from nucleo.organizacoes where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into nucleo.organizacoes (slug, nome) values (v_slug, v_nome) returning id into v_id;
  insert into nucleo.assinaturas (organizacao_id, plano_id, ciclo, estado) values (v_id, p.id, p_ciclo, 'pendente');
  insert into academia.config (organizacao_id, chave, valor)
  values (v_id, 'aparencia', jsonb_build_object('nomeEscola', v_nome));
  insert into academia.convites (email, nome, organizacao_id, papel, origem, criado_por, expira_em)
  values (v_email, null, v_id, 'dono', 'manual', p_por, now() + interval '30 days');
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;

create or replace function public.plataforma_cartao_preparar(p_org uuid, p_referencia text, p_valor numeric, p_ambiente text)
returns void language sql security definer set search_path = ''
as $$
  insert into nucleo.faturas_plataforma (organizacao_id, plano_id, ciclo, periodo_inicio, periodo_fim, valor, moeda, estado, tipo, referencia, ambiente)
  select p_org, a.plano_id, a.ciclo, now(), now(), p_valor, 'ZAR', 'pendente', 'verificacao', p_referencia, p_ambiente
    from nucleo.assinaturas a where a.organizacao_id = p_org
$$;

-- O cartão ficou: a autorização (só servidor), o que se mostra dele, e a
-- escola pendente passa a teste. Devolve o estado em que ficou.
create or replace function public.plataforma_cartao_guardar(p_org uuid, p_referencia text, p_autorizacao text, p_email text,
                                                            p_assinatura text, p_cartao jsonb, p_ambiente text, p_paystack_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a nucleo.assinaturas; v_dias int := coalesce((public.plataforma_definicoes()->>'diasTeste')::int, 7);
begin
  update nucleo.faturas_plataforma set estado = 'paga', pago_em = now(), paystack_id = p_paystack_id
   where referencia = p_referencia and organizacao_id = p_org and tipo = 'verificacao';
  if not found then raise exception 'Verificação desconhecida.'; end if;
  insert into nucleo.cartoes_plataforma (organizacao_id, autorizacao, email, assinatura, ambiente)
  values (p_org, p_autorizacao, lower(p_email), p_assinatura, p_ambiente)
  on conflict (organizacao_id) do update set autorizacao = excluded.autorizacao, email = excluded.email,
    assinatura = excluded.assinatura, ambiente = excluded.ambiente, criado_em = now();
  update nucleo.assinaturas
     set cartao = jsonb_strip_nulls(p_cartao),
         estado = case when estado = 'pendente' then 'teste' else estado end,
         teste_ate = case when estado = 'pendente' then now() + make_interval(days => v_dias) else teste_ate end,
         tentativas = 0,
         proxima_tentativa = case when estado = 'em_atraso' then now() else proxima_tentativa end,
         ultimo_erro = null, atualizado_em = now()
   where organizacao_id = p_org
   returning * into a;
  return jsonb_build_object('estado', a.estado, 'testeAte', a.teste_ate);
end $$;

create or replace function public.plataforma_fatura_estado(p_referencia text, p_estado text, p_motivo text)
returns void language sql security definer set search_path = ''
as $$
  update nucleo.faturas_plataforma set estado = p_estado, motivo = coalesce(p_motivo, motivo)
   where referencia = p_referencia
$$;

-- As escolas com cobrança por fazer agora (fim do teste ou do período).
create or replace function public.plataforma_a_cobrar()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select a.organizacao_id from nucleo.assinaturas a
   where a.estado in ('teste', 'ativa', 'em_atraso')
     and coalesce(a.pago_ate, a.teste_ate) <= now()
     and (a.proxima_tentativa is null or a.proxima_tentativa <= now())
     and a.tentativas < 4
$$;

-- Prepara a cobrança de uma escola: a fatura com o preço do plano e o período.
-- Se cancelou, fecha em vez de cobrar. Devolve o que a função precisa (a
-- autorização vai só para a Paystack) ou o porquê de não cobrar.
create or replace function public.plataforma_cobranca_iniciar(p_org uuid, p_referencia text, p_forcar boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a nucleo.assinaturas; p nucleo.planos_plataforma; c nucleo.cartoes_plataforma;
        v_valor numeric; v_inicio timestamptz; v_fim timestamptz;
begin
  select * into a from nucleo.assinaturas where organizacao_id = p_org for update;
  if not found or a.estado not in ('teste', 'ativa', 'em_atraso') then
    return jsonb_build_object('cobrar', false, 'porque', 'sem assinatura para cobrar');
  end if;
  if not p_forcar and coalesce(a.pago_ate, a.teste_ate) > now() then
    return jsonb_build_object('cobrar', false, 'porque', 'ainda não chegou a data');
  end if;
  -- Uma cobrança que ficou sem resposta confirma-se antes de se cobrar outra.
  if exists (select 1 from nucleo.faturas_plataforma f where f.organizacao_id = p_org and f.tipo = 'periodo' and f.estado = 'pendente') then
    return jsonb_build_object('cobrar', false, 'porque', 'há uma cobrança por confirmar',
      'verificar', (select f.referencia from nucleo.faturas_plataforma f where f.organizacao_id = p_org and f.tipo = 'periodo'
                      and f.estado = 'pendente' order by f.criado_em desc limit 1),
      'ambiente', (select f.ambiente from nucleo.faturas_plataforma f where f.organizacao_id = p_org and f.tipo = 'periodo'
                      and f.estado = 'pendente' order by f.criado_em desc limit 1));
  end if;
  if a.cancela_no_fim then
    update nucleo.assinaturas set estado = 'cancelada', atualizado_em = now() where organizacao_id = p_org;
    return jsonb_build_object('cobrar', false, 'porque', 'cancelada no fim do período');
  end if;
  select * into p from nucleo.planos_plataforma where id = a.plano_id;
  v_valor := case a.ciclo when 'anual' then p.preco_anual else p.preco_mensal end;
  if v_valor is null then
    update nucleo.assinaturas set ultimo_erro = 'O plano não tem preço.', atualizado_em = now() where organizacao_id = p_org;
    return jsonb_build_object('cobrar', false, 'porque', 'o plano não tem preço');
  end if;
  select * into c from nucleo.cartoes_plataforma where organizacao_id = p_org;
  if not found then
    update nucleo.assinaturas set estado = 'em_atraso', ultimo_erro = 'Sem cartão.', atualizado_em = now() where organizacao_id = p_org;
    return jsonb_build_object('cobrar', false, 'porque', 'sem cartão');
  end if;
  -- O período começa onde o anterior acabou (ou agora, se ficou para trás).
  v_inicio := greatest(coalesce(a.pago_ate, a.teste_ate, now()), now() - interval '7 days');
  v_fim := v_inicio + case a.ciclo when 'anual' then interval '1 year' else interval '1 month' end;
  insert into nucleo.faturas_plataforma (organizacao_id, plano_id, ciclo, periodo_inicio, periodo_fim, valor, moeda, estado, tipo, referencia, ambiente)
  values (p_org, a.plano_id, a.ciclo, v_inicio, v_fim, v_valor, p.moeda, 'pendente', 'periodo', p_referencia, c.ambiente);
  return jsonb_build_object('cobrar', true, 'autorizacao', c.autorizacao, 'email', c.email, 'ambiente', c.ambiente,
                            'valorSubunidade', (v_valor * 100)::bigint, 'moeda', p.moeda, 'referencia', p_referencia);
end $$;

create or replace function public.plataforma_cobranca_resultado(p_referencia text, p_ok boolean, p_motivo text, p_paystack_id text, p_valor_subunidade bigint)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare f nucleo.faturas_plataforma;
begin
  select * into f from nucleo.faturas_plataforma where referencia = p_referencia and tipo = 'periodo' for update;
  if not found then raise exception 'Fatura desconhecida.'; end if;
  if f.estado = 'paga' then return jsonb_build_object('estado', 'paga', 'ja', true); end if;
  if p_ok and p_valor_subunidade = (f.valor * 100)::bigint then
    update nucleo.faturas_plataforma set estado = 'paga', pago_em = now(), paystack_id = p_paystack_id where id = f.id;
    update nucleo.assinaturas set estado = 'ativa', pago_ate = f.periodo_fim, tentativas = 0,
           proxima_tentativa = null, ultimo_erro = null, atualizado_em = now()
     where organizacao_id = f.organizacao_id;
    return jsonb_build_object('estado', 'paga', 'pagoAte', f.periodo_fim);
  end if;
  update nucleo.faturas_plataforma set estado = 'falhou', paystack_id = p_paystack_id,
         motivo = coalesce(p_motivo, case when p_ok then 'O valor cobrado não confere.' end) where id = f.id;
  update nucleo.assinaturas set estado = 'em_atraso', tentativas = tentativas + 1,
         proxima_tentativa = now() + interval '1 day', ultimo_erro = left(coalesce(p_motivo, 'O cartão foi recusado.'), 200),
         atualizado_em = now()
   where organizacao_id = f.organizacao_id;
  return jsonb_build_object('estado', 'falhou');
end $$;

create or replace function public.escola_vagas(p_org uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('limite', nucleo.limite_de_alunos(p_org), 'ativos', nucleo.alunos_ativos(p_org),
    'pendentes', (select count(*) from academia.convites c where c.organizacao_id = p_org and c.papel = 'aluno'
                    and c.aceite_em is null and c.revogado_em is null and c.expira_em >= now()),
    'contaEmDia', nucleo.conta_em_dia(p_org))
$$;

revoke all on function public.plataforma_definicoes() from public, anon, authenticated;
revoke all on function public.plataforma_criar_escola(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.plataforma_cartao_preparar(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.plataforma_cartao_guardar(uuid, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.plataforma_fatura_estado(text, text, text) from public, anon, authenticated;
revoke all on function public.plataforma_a_cobrar() from public, anon, authenticated;
revoke all on function public.plataforma_cobranca_iniciar(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.plataforma_cobranca_resultado(text, boolean, text, text, bigint) from public, anon, authenticated;
revoke all on function public.escola_vagas(uuid) from public, anon, authenticated;
grant execute on function public.plataforma_definicoes() to service_role;
grant execute on function public.plataforma_criar_escola(text, text, text, text, uuid) to service_role;
grant execute on function public.plataforma_cartao_preparar(uuid, text, numeric, text) to service_role;
grant execute on function public.plataforma_cartao_guardar(uuid, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.plataforma_fatura_estado(text, text, text) to service_role;
grant execute on function public.plataforma_a_cobrar() to service_role;
grant execute on function public.plataforma_cobranca_iniciar(uuid, text, boolean) to service_role;
grant execute on function public.plataforma_cobranca_resultado(text, boolean, text, text, bigint) to service_role;
grant execute on function public.escola_vagas(uuid) to service_role;
