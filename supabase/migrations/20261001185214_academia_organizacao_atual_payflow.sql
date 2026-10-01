-- organizacao_atual() diz também se a escola tem o Payflow (até ao F1b, só a
-- Kingdom): a app esconde a Vitrine e a Migração onde não tem.
-- Aplicada por execute_sql e registada à mão.

set lock_timeout = '10s';
create or replace function academia.organizacao_atual()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome,
                            'payflow', academia_privado.payflow_ligado())
    from nucleo.organizacoes o where o.id = academia_privado.organizacao()
$$;
