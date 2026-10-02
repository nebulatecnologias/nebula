-- O símbolo do dinheiro dos planos vem da tesouraria da moeda (CLAUDE.md:
-- «nunca do teclado»), não de um 'R' escrito à mão. E um plano está à venda
-- se tiver preço num dos ciclos (a criar-escola confere o do ciclo pedido).
create or replace function public.planos_da_plataforma()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'nome', p.nome, 'alunosMax', p.alunos_max,
           'precoMensal', p.preco_mensal, 'precoAnual', p.preco_anual, 'moeda', p.moeda,
           'simbolo', (select t.simbolo from public.tesourarias t where t.moeda = p.moeda order by t.id limit 1),
           'aVenda', p.preco_mensal is not null or p.preco_anual is not null)
         order by p.ordem), '[]'::jsonb)
    from nucleo.planos_plataforma p where p.ativo
$$;
