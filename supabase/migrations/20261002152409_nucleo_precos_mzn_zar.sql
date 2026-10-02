-- Os preços dos planos em meticais e em rand (W4·6, decisão do Shelton a 02/10:
-- as escolas de Moçambique pagam em meticais, as da África do Sul em rand).
--
-- preco_mensal / preco_anual já existiam e são os de RAND; juntam-se os de
-- meticais. A escola guarda a moeda em que paga (nucleo.assinaturas.moeda), e
-- tudo o que lê um preço passa por nucleo.preco_do_plano(plano, moeda, ciclo).
-- O símbolo vem sempre da tesouraria da moeda.

alter table nucleo.planos_plataforma add column if not exists preco_mensal_mzn numeric;
alter table nucleo.planos_plataforma add column if not exists preco_anual_mzn numeric;
comment on column nucleo.planos_plataforma.preco_mensal is 'Preço mensal em ZAR (rand).';
comment on column nucleo.planos_plataforma.preco_anual is 'Preço anual em ZAR (rand).';
comment on column nucleo.planos_plataforma.preco_mensal_mzn is 'Preço mensal em MZN (meticais).';
comment on column nucleo.planos_plataforma.preco_anual_mzn is 'Preço anual em MZN (meticais).';

alter table nucleo.assinaturas add column if not exists moeda text not null default 'ZAR';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assinaturas_moeda_valida') then
    alter table nucleo.assinaturas add constraint assinaturas_moeda_valida check (moeda in ('MZN', 'ZAR'));
  end if;
end $$;

create or replace function nucleo.preco_do_plano(p_plano text, p_moeda text, p_ciclo text)
returns numeric language sql stable security definer set search_path = ''
as $$
  select case
           when p_moeda = 'MZN' and p_ciclo = 'anual' then p.preco_anual_mzn
           when p_moeda = 'MZN' then p.preco_mensal_mzn
           when p_ciclo = 'anual' then p.preco_anual
           else p.preco_mensal
         end
    from nucleo.planos_plataforma p where p.id = p_plano
$$;

create or replace function nucleo.simbolo_da_moeda(p_moeda text)
returns text language sql stable security definer set search_path = ''
as $$ select t.simbolo from public.tesourarias t where t.moeda = p_moeda order by t.id limit 1 $$;

-- Os planos, para a página de inscrição (anónima), a Cobrança e a consola.
create or replace function public.planos_da_plataforma()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'nome', p.nome, 'alunosMax', p.alunos_max,
           'precos', jsonb_build_object(
             'MZN', jsonb_build_object('mensal', p.preco_mensal_mzn, 'anual', p.preco_anual_mzn, 'simbolo', nucleo.simbolo_da_moeda('MZN')),
             'ZAR', jsonb_build_object('mensal', p.preco_mensal, 'anual', p.preco_anual, 'simbolo', nucleo.simbolo_da_moeda('ZAR'))),
           'aVenda', coalesce(p.preco_mensal, p.preco_anual, p.preco_mensal_mzn, p.preco_anual_mzn) is not null)
         order by p.ordem), '[]'::jsonb)
    from nucleo.planos_plataforma p where p.ativo
$$;

-- Criar a escola com a moeda em que vai pagar. A versão de cinco argumentos
-- continua a servir (rand), e passa pela nova.
create or replace function public.plataforma_criar_escola(p_nome text, p_email text, p_plano text, p_ciclo text, p_por uuid, p_moeda text)
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
  if p_moeda not in ('MZN', 'ZAR') then raise exception 'Moeda inválida.'; end if;
  select * into p from nucleo.planos_plataforma where id = p_plano and ativo;
  if not found then raise exception 'Plano inválido.'; end if;
  if nucleo.preco_do_plano(p.id, p_moeda, p_ciclo) is null then
    raise exception 'Esse plano ainda não está à venda.';
  end if;
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
  insert into nucleo.assinaturas (organizacao_id, plano_id, ciclo, estado, moeda) values (v_id, p.id, p_ciclo, 'pendente', p_moeda);
  insert into academia.config (organizacao_id, chave, valor)
  values (v_id, 'aparencia', jsonb_build_object('nomeEscola', v_nome));
  insert into academia.convites (email, nome, organizacao_id, papel, origem, criado_por, expira_em)
  values (v_email, null, v_id, 'dono', 'manual', p_por, now() + interval '30 days');
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;
revoke all on function public.plataforma_criar_escola(text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.plataforma_criar_escola(text, text, text, text, uuid, text) to service_role;

create or replace function public.plataforma_criar_escola(p_nome text, p_email text, p_plano text, p_ciclo text, p_por uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select public.plataforma_criar_escola(p_nome, p_email, p_plano, p_ciclo, p_por, 'ZAR') $$;

-- Mudar de plano ou de ciclo, na moeda da escola.
create or replace function academia.mudar_plano(p_plano text, p_ciclo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := academia_privado.organizacao(); p nucleo.planos_plataforma;
        v_moeda text := (select a.moeda from nucleo.assinaturas a where a.organizacao_id = academia_privado.organizacao());
begin
  if coalesce(academia_privado.papel_em(v_org), '') <> 'admin' and not nucleo.e_admin_plataforma() then
    raise exception 'Só a administração da escola.';
  end if;
  if p_ciclo not in ('mensal', 'anual') then raise exception 'Ciclo inválido.'; end if;
  select * into p from nucleo.planos_plataforma where id = p_plano and ativo;
  if not found then raise exception 'Plano inválido.'; end if;
  if nucleo.preco_do_plano(p.id, coalesce(v_moeda, 'ZAR'), p_ciclo) is null then
    raise exception 'Esse plano ainda não está à venda.';
  end if;
  if p.alunos_max is not null and nucleo.alunos_ativos(v_org) > p.alunos_max then
    raise exception 'A escola tem % alunos activos: o plano % vai até %.', nucleo.alunos_ativos(v_org), p.nome, p.alunos_max;
  end if;
  update nucleo.assinaturas set plano_id = p.id, ciclo = p_ciclo, atualizado_em = now()
   where organizacao_id = v_org and estado <> 'isenta';
  if not found then raise exception 'Esta escola não tem uma assinatura para mudar.'; end if;
end $$;

-- A Cobrança da escola leva a moeda dela.
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
        'testeAte', a.teste_ate, 'pagoAte', a.pago_ate,
        'cancelaNoFim', a.cancela_no_fim, 'cartao', a.cartao, 'faturacao', a.faturacao,
        'ultimoErro', a.ultimo_erro, 'proximaTentativa', a.proxima_tentativa) end,
    'contaEmDia', nucleo.conta_em_dia(v_org),
    'alunosAtivos', nucleo.alunos_ativos(v_org),
    'limite', nucleo.limite_de_alunos(v_org),
    'planos', public.planos_da_plataforma(),
    'faturas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'inicio', f.periodo_inicio, 'fim', f.periodo_fim, 'valor', f.valor, 'moeda', f.moeda,
        'estado', f.estado, 'plano', f.plano_id, 'ciclo', f.ciclo, 'pagoEm', f.pago_em, 'motivo', f.motivo)
        order by f.criado_em desc)
      from nucleo.faturas_plataforma f where f.organizacao_id = v_org and f.tipo = 'periodo'), '[]'::jsonb));
end $$;

-- A consola guarda os quatro preços de um plano (vazio: fora de venda).
create or replace function academia.consola_guardar_plano(p_plano text, p_mensal_mzn numeric, p_anual_mzn numeric, p_mensal_zar numeric, p_anual_zar numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if exists (select 1 from unnest(array[p_mensal_mzn, p_anual_mzn, p_mensal_zar, p_anual_zar]) v where v is not null and (v <= 0 or v > 100000000)) then
    raise exception 'Preço inválido.';
  end if;
  update nucleo.planos_plataforma
     set preco_mensal_mzn = round(p_mensal_mzn, 2), preco_anual_mzn = round(p_anual_mzn, 2),
         preco_mensal = round(p_mensal_zar, 2), preco_anual = round(p_anual_zar, 2), atualizado_em = now()
   where id = p_plano;
  if not found then raise exception 'Plano não encontrado.'; end if;
end $$;
revoke all on function academia.consola_guardar_plano(text, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function academia.consola_guardar_plano(text, numeric, numeric, numeric, numeric) to authenticated;

-- A consola: os planos com os quatro preços, e a moeda de cada escola.
create or replace function academia.consola_cobranca()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  return jsonb_build_object(
    'planos', public.planos_da_plataforma(),
    'definicoes', public.plataforma_definicoes(),
    'escolas', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', o.id, 'slug', o.slug, 'nome', o.nome, 'kingdom', o.id = nucleo.organizacao_kingdom(),
                 'estado', a.estado, 'plano', a.plano_id, 'ciclo', a.ciclo, 'moeda', a.moeda, 'testeAte', a.teste_ate, 'pagoAte', a.pago_ate,
                 'cancelaNoFim', coalesce(a.cancela_no_fim, false), 'ultimoErro', a.ultimo_erro, 'tentativas', coalesce(a.tentativas, 0),
                 'temCartao', exists (select 1 from nucleo.cartoes_plataforma c where c.organizacao_id = o.id),
                 'contaEmDia', nucleo.conta_em_dia(o.id), 'alunosAtivos', nucleo.alunos_ativos(o.id))
               order by o.nome), '[]'::jsonb)
               from nucleo.organizacoes o left join nucleo.assinaturas a on a.organizacao_id = o.id));
end $$;
