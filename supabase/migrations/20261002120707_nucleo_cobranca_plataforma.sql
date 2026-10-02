-- A mensalidade das escolas (W4, decisões do Shelton a 02/10/2026, PLANO.md).
--
--   nucleo.planos_plataforma   os escalões: Essencial até 500 alunos activos,
--      Profissional até 1 500, Escala até 5 000. Mensal e anual. Os preços (em
--      Rand: o cartão é cobrado pela Kingdom da África do Sul) editam-se na
--      consola; enquanto um plano não tem preço, não se vende.
--   nucleo.assinaturas         uma por escola: plano, ciclo, estado, até quando
--      o teste (7 dias) ou o período pago, e o que se mostra do cartão (marca,
--      últimos 4, validade). Sem linha, a escola foi montada à mão pela
--      plataforma e não se cobra (o piloto).
--   nucleo.cartoes_plataforma  a autorização do cartão da Paystack. Só o
--      servidor a lê; nunca sai numa resposta.
--   nucleo.faturas_plataforma  o que se cobrou, a cada período.
--
--   nucleo.conta_em_dia(org)   a escola pode servir os alunos: isenta, em
--      teste, ou com o período pago — mais 3 dias de tolerância para o cartão
--      voltar a tentar. Fora disso os alunos deixam de ver os cursos; a equipa
--      continua a entrar (para pagar) e nada se apaga.
--   nucleo.alunos_ativos(org)  quantos alunos activos tem a escola: é o que o
--      plano limita (os convites param no limite).
--
-- A Kingdom e a escola de teste ficam isentas. O acesso dos alunos da Kingdom
-- não muda (conferido com a impressão de tem_acesso_em antes e depois).
--
-- Aplicada por execute_sql e registada à mão.

create table if not exists nucleo.planos_plataforma (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  nome text not null,
  alunos_max integer check (alunos_max is null or alunos_max > 0),
  preco_mensal numeric(12,2) check (preco_mensal is null or preco_mensal > 0),
  preco_anual numeric(12,2) check (preco_anual is null or preco_anual > 0),
  moeda text not null default 'ZAR' check (moeda in ('ZAR')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table nucleo.planos_plataforma enable row level security;
alter table nucleo.planos_plataforma force row level security;
insert into nucleo.planos_plataforma (id, nome, alunos_max, ordem) values
  ('essencial', 'Essencial', 500, 1),
  ('profissional', 'Profissional', 1500, 2),
  ('escala', 'Escala', 5000, 3)
on conflict (id) do nothing;

create table if not exists nucleo.assinaturas (
  organizacao_id uuid primary key references nucleo.organizacoes(id),
  plano_id text not null references nucleo.planos_plataforma(id),
  ciclo text not null default 'mensal' check (ciclo in ('mensal', 'anual')),
  estado text not null default 'teste' check (estado in ('pendente', 'teste', 'ativa', 'em_atraso', 'cancelada', 'isenta')),
  teste_ate timestamptz,
  pago_ate timestamptz,
  cancela_no_fim boolean not null default false,
  cancelada_em timestamptz,
  tentativas integer not null default 0,
  proxima_tentativa timestamptz,
  ultimo_erro text,
  cartao jsonb not null default '{}'::jsonb,
  faturacao jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table nucleo.assinaturas enable row level security;
alter table nucleo.assinaturas force row level security;

create table if not exists nucleo.cartoes_plataforma (
  organizacao_id uuid primary key references nucleo.organizacoes(id),
  autorizacao text not null,
  email text not null,
  assinatura text,
  ambiente text not null check (ambiente in ('teste', 'producao')),
  criado_em timestamptz not null default now()
);
alter table nucleo.cartoes_plataforma enable row level security;
alter table nucleo.cartoes_plataforma force row level security;

create table if not exists nucleo.faturas_plataforma (
  id bigint generated always as identity primary key,
  organizacao_id uuid not null references nucleo.organizacoes(id),
  plano_id text not null,
  ciclo text not null,
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  valor numeric(12,2) not null,
  moeda text not null,
  estado text not null check (estado in ('pendente', 'paga', 'falhou', 'reembolsada')),
  tipo text not null default 'periodo' check (tipo in ('periodo', 'verificacao')),
  referencia text not null unique,
  paystack_id text,
  motivo text,
  ambiente text not null,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);
alter table nucleo.faturas_plataforma enable row level security;
alter table nucleo.faturas_plataforma force row level security;
create index if not exists faturas_plataforma_org on nucleo.faturas_plataforma (organizacao_id, criado_em desc);

-- O pagamento da plataforma: modo da Paystack (teste até o Shelton dizer).
create table if not exists nucleo.definicoes_plataforma (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table nucleo.definicoes_plataforma enable row level security;
alter table nucleo.definicoes_plataforma force row level security;
insert into nucleo.definicoes_plataforma (chave, valor) values
  ('cobranca', '{"ambiente": "teste", "diasTeste": 7, "diasTolerancia": 3, "verificacaoZar": 1}')
on conflict (chave) do nothing;

-- A Kingdom e a escola de teste: isentas.
insert into nucleo.assinaturas (organizacao_id, plano_id, estado)
select o.id, 'escala', 'isenta' from nucleo.organizacoes o where o.slug in ('kingdom', 'teste')
on conflict (organizacao_id) do nothing;

-- ---------------------------------------------------------------------------

create or replace function nucleo.conta_em_dia(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_org = nucleo.organizacao_kingdom() then true
    when a.organizacao_id is null then true
    when a.estado = 'isenta' then true
    when a.estado = 'pendente' then false
    else greatest(coalesce(a.teste_ate, '-infinity'), coalesce(a.pago_ate, '-infinity'))
         + case when a.estado = 'cancelada' then interval '0' else make_interval(days => coalesce((select (d.valor->>'diasTolerancia')::int from nucleo.definicoes_plataforma d where d.chave = 'cobranca'), 3)) end
         > now()
  end
  from (select 1) x left join nucleo.assinaturas a on a.organizacao_id = p_org
$$;

create or replace function nucleo.alunos_ativos(p_org uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select count(*)::int from nucleo.membros m
   where m.organizacao_id = p_org and m.app = 'academia' and m.papel = 'aluno' and m.estado = 'ativo'
$$;

-- O limite de alunos do plano (nulo: sem limite — sem assinatura ou isenta).
create or replace function nucleo.limite_de_alunos(p_org uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select case when a.estado = 'isenta' or a.organizacao_id is null then null else p.alunos_max end
    from (select 1) x
    left join nucleo.assinaturas a on a.organizacao_id = p_org
    left join nucleo.planos_plataforma p on p.id = a.plano_id
$$;

-- Os alunos só leem os cursos com a conta em dia; a equipa lê sempre.
create or replace function academia_privado.tem_acesso_em(p_organizacao uuid, p_curso text)
returns boolean language sql stable security definer set search_path = 'public', 'pg_temp'
as $$
  select exists (select 1 from academia.cursos c0
                  where c0.id = p_curso and c0.organizacao_id = p_organizacao)
     and (
         academia_privado.e_equipa_em(p_organizacao)
      or (nucleo.conta_em_dia(p_organizacao) and (
           exists (
             select 1 from academia.cursos c
              where c.id = p_curso and c.aberto_a_todos and c.publicado and c.removido_em is null
           )
        or exists (
             select 1 from academia.acessos a
              where a.utilizador_id = auth.uid()
                and a.curso_id = p_curso
                and (a.expira_em is null or a.expira_em >= current_date)
           )
        or exists (
             select 1
               from academia.cursos c
               join public.turmas t     on t.oferta_id = c.oferta_id and t.removido_em is null
               join public.inscricoes i on i.turma_id  = t.id        and i.removido_em is null
              where c.id = p_curso
                and c.oferta_id is not null
                and c.removido_em is null
                and i.lead_id in (select academia_privado.leads_do_utilizador())
                and i.estado::text in ('Não iniciada','Em curso','Concluída')
                and not exists (
                      select 1 from public.lancamentos l
                       where l.inscricao_id = i.id
                         and l.tipo   = 'Entrada'
                         and l.estado = 'Pendente'
                         and l.removido_em is null
                         and l.vencimento_acordado
                         and l.data < current_date - 7
                    )
           )
      ))
     )
$$;

-- A conta da escola para a app: se serve os alunos, e o que dizer.
create or replace function academia.organizacao_atual()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome,
                            'payflow', academia_privado.payflow_ligado(),
                            'contaEmDia', nucleo.conta_em_dia(o.id),
                            'conta', (select jsonb_build_object('estado', a.estado, 'testeAte', a.teste_ate, 'pagoAte', a.pago_ate)
                                        from nucleo.assinaturas a where a.organizacao_id = o.id))
    from nucleo.organizacoes o where o.id = academia_privado.organizacao()
$$;

-- ---------------------------------------------------------------------------
-- Os planos, para a página de criar conta (anónima) e para a cobrança.

create or replace function public.planos_da_plataforma()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'nome', p.nome, 'alunosMax', p.alunos_max,
           'precoMensal', p.preco_mensal, 'precoAnual', p.preco_anual, 'moeda', p.moeda,
           'simbolo', 'R', 'aVenda', p.preco_mensal is not null)
         order by p.ordem), '[]'::jsonb)
    from nucleo.planos_plataforma p where p.ativo
$$;
grant execute on function public.planos_da_plataforma() to anon, authenticated;

-- O ecrã «Cobrança» da escola do endereço: só a administração dela.
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
        'plano', a.plano_id, 'ciclo', a.ciclo, 'estado', a.estado, 'testeAte', a.teste_ate, 'pagoAte', a.pago_ate,
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
revoke all on function academia.cobranca_da_escola() from public, anon;
grant execute on function academia.cobranca_da_escola() to authenticated;

-- Dados de faturação (NUIT, nome, morada, telefone).
create or replace function academia.guardar_faturacao(p_dados jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := academia_privado.organizacao();
begin
  if coalesce(academia_privado.papel_em(v_org), '') <> 'admin' and not nucleo.e_admin_plataforma() then
    raise exception 'Só a administração da escola.';
  end if;
  update nucleo.assinaturas set faturacao = jsonb_strip_nulls(jsonb_build_object(
      'nome',     nullif(left(trim(p_dados->>'nome'), 160), ''),
      'nuit',     nullif(left(regexp_replace(coalesce(p_dados->>'nuit', ''), '\s', '', 'g'), 30), ''),
      'morada',   nullif(left(trim(p_dados->>'morada'), 240), ''),
      'telefone', nullif(left(trim(p_dados->>'telefone'), 40), ''))),
      atualizado_em = now()
   where organizacao_id = v_org;
  if not found then raise exception 'Esta escola não tem assinatura.'; end if;
end $$;
revoke all on function academia.guardar_faturacao(jsonb) from public, anon;
grant execute on function academia.guardar_faturacao(jsonb) to authenticated;

-- Mudar de plano ou de ciclo: vale a partir da próxima cobrança, sem pro rata.
-- Não se desce para um plano abaixo dos alunos activos.
create or replace function academia.mudar_plano(p_plano text, p_ciclo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := academia_privado.organizacao(); p nucleo.planos_plataforma;
begin
  if coalesce(academia_privado.papel_em(v_org), '') <> 'admin' and not nucleo.e_admin_plataforma() then
    raise exception 'Só a administração da escola.';
  end if;
  if p_ciclo not in ('mensal', 'anual') then raise exception 'Ciclo inválido.'; end if;
  select * into p from nucleo.planos_plataforma where id = p_plano and ativo;
  if not found then raise exception 'Plano inválido.'; end if;
  if (case p_ciclo when 'anual' then p.preco_anual else p.preco_mensal end) is null then
    raise exception 'Esse plano ainda não está à venda.';
  end if;
  if p.alunos_max is not null and nucleo.alunos_ativos(v_org) > p.alunos_max then
    raise exception 'A escola tem % alunos activos: o plano % vai até %.', nucleo.alunos_ativos(v_org), p.nome, p.alunos_max;
  end if;
  update nucleo.assinaturas set plano_id = p.id, ciclo = p_ciclo, atualizado_em = now()
   where organizacao_id = v_org and estado <> 'isenta';
  if not found then raise exception 'Esta escola não tem uma assinatura para mudar.'; end if;
end $$;
revoke all on function academia.mudar_plano(text, text) from public, anon;
grant execute on function academia.mudar_plano(text, text) to authenticated;

-- Cancelar: a escola continua até ao fim do que pagou (ou do teste), e depois
-- deixa de servir os alunos. Reactivar desfaz, enquanto não acabou.
create or replace function academia.cancelar_assinatura(p_cancelar boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := academia_privado.organizacao();
begin
  if coalesce(academia_privado.papel_em(v_org), '') <> 'admin' and not nucleo.e_admin_plataforma() then
    raise exception 'Só a administração da escola.';
  end if;
  update nucleo.assinaturas
     set cancela_no_fim = p_cancelar,
         cancelada_em = case when p_cancelar then now() else null end,
         atualizado_em = now()
   where organizacao_id = v_org and estado in ('teste', 'ativa', 'em_atraso');
  if not found then raise exception 'Não há assinatura activa para mudar.'; end if;
end $$;
revoke all on function academia.cancelar_assinatura(boolean) from public, anon;
grant execute on function academia.cancelar_assinatura(boolean) to authenticated;
