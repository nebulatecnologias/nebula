-- Os emails da Academia com a marca de cada escola (W2, 01/10/2026).
--
--   public.escola_para_email(endereco)  tudo o que um email precisa de saber
--      da escola, numa só pergunta: o nome, a marca da Aparência (nome da
--      escola, logótipo, cor, símbolo, rodapé), o domínio para o link, e para
--      onde vão as respostas (o «email para respostas» das Integrações ou,
--      sem ele, o email do dono). O endereço é o nome curto ou um domínio da
--      escola.
--
-- Ao contrário de public.marca_da_academia, que cai na Kingdom quando não
-- conhece o endereço (para a página abrir sempre), esta devolve nulo: quem
-- envia um email tem de recusar em vez de assinar como a Kingdom por engano.
-- Só o servidor a chama (service_role): devolve o email do dono, que não é
-- público.
--
-- Aplicada por execute_sql e registada à mão.

create or replace function public.escola_para_email(p_endereco text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with o as (
    select o.* from nucleo.organizacoes o
     where o.estado = 'ativa'
       and (o.slug = lower(trim(p_endereco))
            or exists (select 1 from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia'
                          and d.dominio = lower(trim(p_endereco))))
  )
  select jsonb_build_object(
           'id', o.id, 'slug', o.slug, 'nome', o.nome,
           'kingdom', o.id = nucleo.organizacao_kingdom(),
           'dominio', (select d.dominio from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia' order by d.principal desc, d.criado_em limit 1),
           'dominios', coalesce((select jsonb_agg(d.dominio) from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia'), '[]'::jsonb),
           'respostaPara', coalesce(
              nullif(trim((select c.valor->>'respostaPara' from academia.config c where c.organizacao_id = o.id and c.chave = 'email')), ''),
              (select u.email from nucleo.membros m join public.utilizadores u on u.id = m.utilizador_id
                where m.organizacao_id = o.id and m.app = 'academia' and m.papel = 'dono' and m.estado = 'ativo'
                order by m.criado_em limit 1)))
      || coalesce((select jsonb_strip_nulls(jsonb_build_object(
                     'nomeEscola', c.valor->'nomeEscola', 'logoUrl', c.valor->'logoUrl',
                     'corAccent', c.valor->'corAccent', 'simbolo', c.valor->'simbolo',
                     'rodape', c.valor->'rodape'))
                     from academia.config c where c.organizacao_id = o.id and c.chave = 'aparencia'), '{}'::jsonb)
    from o
$$;
revoke all on function public.escola_para_email(text) from public, anon, authenticated;
grant execute on function public.escola_para_email(text) to service_role;
