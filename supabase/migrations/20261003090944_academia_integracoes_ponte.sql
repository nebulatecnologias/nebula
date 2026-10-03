-- A app da escola não diz o nome da marca de origem (teste 16): a função das
-- Integrações passa a dizer `vendasPelaPonte` — verdade só na escola cujas
-- vendas do Payflow ainda chegam pela ponte de origem, até à migração dos alunos.
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
    'organizacao', (select jsonb_build_object('id', o.id, 'slug', o.slug, 'vendasPelaPonte', o.id = nucleo.organizacao_kingdom())
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
    'cursos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo, 'publicado', c.publicado) order by c.ordem nulls last, c.criado_em)
                          from academia.cursos c where c.organizacao_id = v_org and c.removido_em is null), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', v.evento_id, 'app', v.app, 'tipo', v.tipo, 'resultado', v.resultado,
                              'pedido', v.referencia, 'email', v.email, 'cursos', to_jsonb(v.cursos), 'modo', v.modo, 'teste', v.teste,
                              'motivo', v.motivo, 'recebidoEm', v.recebido_em) order by v.recebido_em desc)
                            from (select * from academia.vendas_recebidas v where v.organizacao_id = v_org
                                   order by v.recebido_em desc limit 200) v), '[]'::jsonb));
end $$;
