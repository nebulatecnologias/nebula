-- A consola ligada (pedido do Shelton a 02/10/2026: «ligue a consola»).
--
-- 1. academia.consola_painel(): o que a ficha e os pagamentos da consola
--    mostram e as funções que já existiam não davam — as faturas (vindas do
--    Payflow), os eventos do Payflow, a evolução dos alunos por mês e, por
--    organização, os números dos alunos (convites, novos, sem entrar há 30
--    dias, por curso). Só números: nenhum nome nem email de aluno sai daqui.
--
-- 2. nucleo.alunos_por_mes: uma fotografia, todos os dias, dos alunos
--    activos de cada organização, guardada no mês corrente (o último dia do
--    mês fica a valer como «fim do mês»). Antes de haver fotografia, o mês
--    conta-se pela data de entrada dos alunos activos hoje, e a consola diz
--    que é assim (estimado: true).
--
-- 3. academia.consola_cobranca() passa a dizer a forma de pagamento e os
--    links do Payflow de cada escola (já vinham nos eventos, W4·6b).

create table if not exists nucleo.alunos_por_mes (
  organizacao_id uuid not null references nucleo.organizacoes(id),
  mes date not null,
  alunos integer not null,
  atualizado_em timestamptz not null default now(),
  primary key (organizacao_id, mes)
);
alter table nucleo.alunos_por_mes enable row level security;
revoke all on nucleo.alunos_por_mes from anon, authenticated;

create or replace function nucleo.fotografar_alunos()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v integer;
begin
  insert into nucleo.alunos_por_mes (organizacao_id, mes, alunos, atualizado_em)
  select o.id, date_trunc('month', now())::date, nucleo.alunos_ativos(o.id), now()
    from nucleo.organizacoes o
  on conflict (organizacao_id, mes) do update set alunos = excluded.alunos, atualizado_em = excluded.atualizado_em;
  get diagnostics v = row_count;
  return v;
end $$;
revoke execute on function nucleo.fotografar_alunos() from public, anon, authenticated;

select cron.schedule('alunos-fotografar', '50 23 * * *', 'select nucleo.fotografar_alunos()');
select nucleo.fotografar_alunos();

create or replace function academia.consola_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_meses date[] := array(select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month')::date);
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  return jsonb_build_object(
    'ligado', true,

    'faturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'numero', 'F-' || to_char(coalesce(f.periodo_inicio, f.criado_em), 'YYYY') || '-' || lpad(f.id::text, 4, '0'),
        'organizacao', f.organizacao_id,
        'emitidaEm', coalesce(f.periodo_inicio, f.criado_em),
        'pagaEm', f.pago_em,
        'valor', f.valor, 'moeda', f.moeda,
        'estado', case f.estado when 'pendente' then 'por_pagar' when 'falhou' then 'falhada' else f.estado end,
        'metodo', a.metodo,
        'plano', p.nome,
        'erro', f.motivo,
        'link', f.link)
        order by coalesce(f.periodo_inicio, f.criado_em) desc, f.id desc)
        from nucleo.faturas_plataforma f
        left join nucleo.assinaturas a on a.organizacao_id = f.organizacao_id
        left join nucleo.planos_plataforma p on p.id = f.plano_id
       where f.tipo = 'periodo'), '[]'::jsonb),

    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'organizacao', e.organizacao_id,
                                          'resultado', e.resultado, 'recebidoEm', e.recebido_em) order by e.recebido_em desc)
        from (select * from nucleo.eventos_payflow order by recebido_em desc limit 200) e), '[]'::jsonb),

    'historico', coalesce((
      select jsonb_object_agg(o.id, (
        select jsonb_agg(jsonb_build_object(
                 'mes', to_char(m, 'YYYY-MM'),
                 'alunos', case when (m + interval '1 month') <= date_trunc('month', o.criado_em) then null
                                else coalesce(f.alunos, (select count(*) from nucleo.membros mb
                                                          where mb.organizacao_id = o.id and mb.app = 'academia' and mb.papel = 'aluno'
                                                            and mb.estado = 'ativo' and mb.criado_em < m + interval '1 month')) end,
                 'estimado', f.alunos is null) order by m)
          from unnest(v_meses) m
          left join nucleo.alunos_por_mes f on f.organizacao_id = o.id and f.mes = m))
        from nucleo.organizacoes o), '{}'::jsonb),

    'detalhe', coalesce((
      select jsonb_object_agg(o.id, jsonb_build_object(
        'convidados', (select count(*) from academia.convites c
                        where c.organizacao_id = o.id and coalesce(c.papel, 'aluno') = 'aluno'
                          and c.aceite_em is null and c.revogado_em is null and c.expira_em >= now()),
        'novos30', (select count(*) from nucleo.membros mb
                     where mb.organizacao_id = o.id and mb.app = 'academia' and mb.papel = 'aluno'
                       and mb.estado = 'ativo' and mb.criado_em >= now() - interval '30 days'),
        'inativos', (select count(*) from nucleo.membros mb left join auth.users u on u.id = mb.utilizador_id
                      where mb.organizacao_id = o.id and mb.app = 'academia' and mb.papel = 'aluno' and mb.estado = 'ativo'
                        and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '30 days')),
        'ultimaEntrada', (select max(u.last_sign_in_at) from nucleo.membros mb join auth.users u on u.id = mb.utilizador_id
                           where mb.organizacao_id = o.id and mb.app = 'academia' and mb.papel = 'aluno' and mb.estado = 'ativo'),
        'porCurso', coalesce((
          select jsonb_agg(jsonb_build_object('curso', c.titulo, 'publicado', c.publicado, 'alunos', x.alunos, 'concluiram', x.concluiram)
                           order by c.ordem nulls last, c.criado_em)
            from academia.cursos c
            cross join lateral (
              select
                case when c.aberto_a_todos then nucleo.alunos_ativos(o.id)
                     else (select count(distinct ac.utilizador_id) from academia.acessos ac
                            where ac.organizacao_id = o.id and ac.curso_id = c.id
                              and (ac.expira_em is null or ac.expira_em >= current_date)) end as alunos,
                (select count(*) from (
                   select pr.utilizador_id
                     from academia.progresso pr
                     join academia.aulas au on au.id = pr.aula_id and au.removido_em is null
                     join academia.modulos mo on mo.id = au.modulo_id and mo.removido_em is null and mo.curso_id = c.id
                    where pr.organizacao_id = o.id
                    group by pr.utilizador_id
                   having count(distinct pr.aula_id) = (
                     select count(*) from academia.aulas a2 join academia.modulos m2 on m2.id = a2.modulo_id
                      where m2.curso_id = c.id and a2.removido_em is null and m2.removido_em is null)
                      and count(distinct pr.aula_id) > 0) t) as concluiram
            ) x
           where c.organizacao_id = o.id and c.removido_em is null), '[]'::jsonb)))
        from nucleo.organizacoes o), '{}'::jsonb)
  );
end $$;
revoke execute on function academia.consola_painel() from public, anon;
grant execute on function academia.consola_painel() to authenticated;

create or replace function academia.consola_cobranca()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
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
                 'metodo', a.metodo, 'links', coalesce(a.links, '{}'::jsonb), 'ultimoEventoEm', a.ultimo_evento_em,
                 'temCartao', exists (select 1 from nucleo.cartoes_plataforma c where c.organizacao_id = o.id),
                 'contaEmDia', nucleo.conta_em_dia(o.id), 'alunosAtivos', nucleo.alunos_ativos(o.id))
               order by o.nome), '[]'::jsonb)
               from nucleo.organizacoes o left join nucleo.assinaturas a on a.organizacao_id = o.id));
end $$;
