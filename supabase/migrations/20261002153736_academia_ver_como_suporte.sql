-- «Ver como» na consola (pedido do Shelton a 02/10): quem administra a
-- plataforma entra em qualquer escola como a equipa dela a vê, e daí como um
-- aluno a vê (o «Ver como aluno» que a app já tem).
--
-- Até aqui o papel saía só de ser membro (nucleo.membros), e quem administra
-- a plataforma, sem ser membro de uma escola, nem entrava. Agora, sem papel de
-- membro, a administração da plataforma conta como administração da escola —
-- é o «entrar como suporte» do plano (secção whitelabel, ponto 7). Quem for
-- membro continua com o papel que tem. A app avisa em todos os ecrãs que se
-- está como suporte (organizacao_atual().suporte).

create or replace function academia_privado.papel_em(p_organizacao uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case x.p when 'dono' then 'admin' else x.p end
    from (select coalesce(nucleo.papel(p_organizacao, 'academia'),
                          case when nucleo.e_admin_plataforma() then 'admin' end) as p) x
   where exists (select 1 from public.utilizadores u
                  where u.id = auth.uid() and u.removido_em is null and u.estado = 'Ativo')
$$;

create or replace function academia_privado.perfil()
returns text language sql stable security definer set search_path = ''
as $$ select academia_privado.papel_em(academia_privado.organizacao()) $$;

create or replace function academia.organizacao_atual()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome,
                            'payflow', academia_privado.payflow_ligado(),
                            'contaEmDia', nucleo.conta_em_dia(o.id),
                            'suporte', nucleo.papel(o.id, 'academia') is null and nucleo.e_admin_plataforma(),
                            'conta', (select jsonb_build_object('estado', a.estado, 'testeAte', a.teste_ate, 'pagoAte', a.pago_ate)
                                        from nucleo.assinaturas a where a.organizacao_id = o.id))
    from nucleo.organizacoes o where o.id = academia_privado.organizacao()
$$;
