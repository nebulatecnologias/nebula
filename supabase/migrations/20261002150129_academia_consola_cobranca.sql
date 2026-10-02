-- A cobrança na consola da plataforma (W4·4). Só a administração da
-- plataforma (nucleo.e_admin_plataforma):
--   consola_cobranca        os planos com preços, as definições (ambiente da
--                           Paystack) e a conta de cada escola;
--   consola_guardar_plano   o preço mensal e anual (ZAR) de um plano; vazio
--                           tira o plano de venda nesse ciclo;
--   consola_isentar         isentar uma escola, ou voltar a cobrá-la (com
--                           cartão: novos dias de teste; sem cartão: pendente);
--   consola_ambiente        «teste» ou «producao»: as chaves da Paystack que
--                           os cartões novos usam. Cada cartão guarda o seu e
--                           é cobrado sempre no ambiente em que foi guardado.

create or replace function academia.consola_cobranca()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  return jsonb_build_object(
    'planos', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id, 'nome', p.nome, 'alunosMax', p.alunos_max, 'precoMensal', p.preco_mensal,
                 'precoAnual', p.preco_anual, 'moeda', p.moeda,
                 'simbolo', (select t.simbolo from public.tesourarias t where t.moeda = p.moeda order by t.id limit 1))
               order by p.ordem), '[]'::jsonb) from nucleo.planos_plataforma p where p.ativo),
    'definicoes', public.plataforma_definicoes(),
    'escolas', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', o.id, 'slug', o.slug, 'nome', o.nome, 'kingdom', o.id = nucleo.organizacao_kingdom(),
                 'estado', a.estado, 'plano', a.plano_id, 'ciclo', a.ciclo, 'testeAte', a.teste_ate, 'pagoAte', a.pago_ate,
                 'cancelaNoFim', coalesce(a.cancela_no_fim, false), 'ultimoErro', a.ultimo_erro, 'tentativas', coalesce(a.tentativas, 0),
                 'temCartao', exists (select 1 from nucleo.cartoes_plataforma c where c.organizacao_id = o.id),
                 'contaEmDia', nucleo.conta_em_dia(o.id), 'alunosAtivos', nucleo.alunos_ativos(o.id))
               order by o.nome), '[]'::jsonb)
               from nucleo.organizacoes o left join nucleo.assinaturas a on a.organizacao_id = o.id));
end $$;

create or replace function academia.consola_guardar_plano(p_plano text, p_mensal numeric, p_anual numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if (p_mensal is not null and (p_mensal <= 0 or p_mensal > 1000000))
     or (p_anual is not null and (p_anual <= 0 or p_anual > 10000000)) then
    raise exception 'Preço inválido.';
  end if;
  update nucleo.planos_plataforma
     set preco_mensal = round(p_mensal, 2), preco_anual = round(p_anual, 2), atualizado_em = now()
   where id = p_plano;
  if not found then raise exception 'Plano não encontrado.'; end if;
end $$;

create or replace function academia.consola_isentar(p_organizacao uuid, p_isenta boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_dias int := coalesce((public.plataforma_definicoes()->>'diasTeste')::int, 7);
        v_cartao boolean := exists (select 1 from nucleo.cartoes_plataforma c where c.organizacao_id = p_organizacao);
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if not exists (select 1 from nucleo.organizacoes where id = p_organizacao) then raise exception 'Escola não encontrada.'; end if;
  if p_isenta then
    insert into nucleo.assinaturas (organizacao_id, plano_id, estado)
    values (p_organizacao, 'escala', 'isenta')
    on conflict (organizacao_id) do update set estado = 'isenta', cancela_no_fim = false, tentativas = 0,
      proxima_tentativa = null, ultimo_erro = null, atualizado_em = now();
  else
    if p_organizacao = nucleo.organizacao_kingdom() then raise exception 'A Kingdom não paga mensalidade.'; end if;
    insert into nucleo.assinaturas (organizacao_id, plano_id, estado)
    values (p_organizacao, 'essencial', 'pendente')
    on conflict (organizacao_id) do update
      set estado = case when v_cartao then 'teste' else 'pendente' end,
          teste_ate = case when v_cartao then now() + make_interval(days => v_dias) else null end,
          pago_ate = null, tentativas = 0, proxima_tentativa = null, ultimo_erro = null, atualizado_em = now()
      where nucleo.assinaturas.estado = 'isenta';
  end if;
end $$;

create or replace function academia.consola_ambiente(p_ambiente text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if p_ambiente not in ('teste', 'producao') then raise exception 'Ambiente inválido.'; end if;
  update nucleo.definicoes_plataforma set valor = valor || jsonb_build_object('ambiente', p_ambiente), atualizado_em = now()
   where chave = 'cobranca';
end $$;

revoke all on function academia.consola_cobranca() from public, anon;
revoke all on function academia.consola_guardar_plano(text, numeric, numeric) from public, anon;
revoke all on function academia.consola_isentar(uuid, boolean) from public, anon;
revoke all on function academia.consola_ambiente(text) from public, anon;
grant execute on function academia.consola_cobranca() to authenticated;
grant execute on function academia.consola_guardar_plano(text, numeric, numeric) to authenticated;
grant execute on function academia.consola_isentar(uuid, boolean) to authenticated;
grant execute on function academia.consola_ambiente(text) to authenticated;
