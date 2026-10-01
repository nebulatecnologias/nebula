-- F1a, passo 4 — o que a app pergunta à base sobre a organização do pedido.
--
--   meu_papel()               o papel de quem entra nesta organização (admin,
--                             colaborador, aluno), ou nulo se não é membro.
--                             Substitui utilizadores.perfil, que é da conta
--                             inteira e não de uma organização.
--   organizacao_atual()       id, slug e nome da organização do pedido.
--   membros_da_organizacao()  a lista de membros para o painel da equipa
--                             (antes vinha de public.utilizadores inteira).
--                             Na Kingdom, «membro desde» continua a ser a data
--                             da conta.
--
-- Aplicada por execute_sql e registada à mão. Conferido como o administrador:
-- a lista nova tem as mesmas 13 pessoas, com o mesmo papel, estado e data.

set lock_timeout = '10s';

create or replace function academia.meu_papel()
returns text language sql stable security definer set search_path = ''
as $$ select academia_privado.perfil() $$;

create or replace function academia.organizacao_atual()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome)
    from nucleo.organizacoes o where o.id = academia_privado.organizacao()
$$;

create or replace function academia.membros_da_organizacao()
returns table (id uuid, nome text, email text, perfil text, estado text, criado_em timestamptz, lead_id bigint)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.nome, u.email,
         case m.papel when 'dono' then 'admin' else m.papel end,
         case when m.estado = 'ativo' and u.estado = 'Ativo' then 'Ativo' else 'Suspenso' end,
         case when m.organizacao_id = nucleo.organizacao_kingdom() then u.criado_em else m.criado_em end,
         u.lead_id
    from nucleo.membros m
    join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null
   where academia_privado.e_equipa()
     and m.organizacao_id = academia_privado.organizacao()
     and m.app = 'academia'
$$;

revoke all on function academia.meu_papel(), academia.organizacao_atual(), academia.membros_da_organizacao() from public, anon;
grant execute on function academia.meu_papel(), academia.organizacao_atual(), academia.membros_da_organizacao() to authenticated;
