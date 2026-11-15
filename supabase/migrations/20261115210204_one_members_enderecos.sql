-- Aplicada a 15/11/2026 (versão 20261115210204). Provada antes numa transacção
-- desfeita: escola_para_email('teste') e ('kingdom') dão o mesmo de antes mais
-- os dois campos novos; um endereço desconhecido continua a dar nulo; a chave
-- `cobranca` das definições fica intacta.
--
-- O software chama-se One Members (Shelton, 15/11/2026); Kingdom Academy é uma
-- escola nele. O endereço do software e o remetente dos emails das escolas
-- passam a estar na base, para se trocarem sem republicar as funções:
-- nucleo.definicoes_plataforma › enderecos { plataforma, remetente }.
-- public.escola_para_email passa a dizer `plataforma` e `remetente` (lidos por
-- _shared/escola.ts e _shared/carta-academia.ts, no repositório do Payflow).
--
-- `plataforma` nasce com o endereço de sempre (membros.kingdomcompny.com) e
-- muda para onemembers.kingdomcompny.com quando o DNS estiver a responder:
--   update nucleo.definicoes_plataforma
--      set valor = valor || '{"plataforma":"onemembers.kingdomcompny.com"}', atualizado_em = now()
--    where chave = 'enderecos';
insert into nucleo.definicoes_plataforma (chave, valor)
values ('enderecos', jsonb_build_object('plataforma', 'membros.kingdomcompny.com', 'remetente', 'onemembers@kingdomcompny.com'))
on conflict (chave) do nothing;

create or replace function public.escola_para_email(p_endereco text)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with o as (
    select o.* from nucleo.organizacoes o
     where o.estado = 'ativa'
       and (o.slug = lower(trim(p_endereco))
            or exists (select 1 from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia'
                          and d.dominio = lower(trim(p_endereco))
                          and d.estado in ('verificado', 'ativo')))
  )
  select jsonb_build_object(
           'id', o.id, 'slug', o.slug, 'nome', o.nome,
           'kingdom', o.id = nucleo.organizacao_kingdom(),
           'dominio', (select d.dominio from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia' and d.estado = 'ativo' order by d.principal desc, d.criado_em limit 1),
           'dominios', coalesce((select jsonb_agg(d.dominio) from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia' and d.estado = 'ativo'), '[]'::jsonb),
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
      || coalesce((select jsonb_strip_nulls(jsonb_build_object(
                     'plataforma', d.valor->'plataforma', 'remetente', d.valor->'remetente'))
                     from nucleo.definicoes_plataforma d where d.chave = 'enderecos'), '{}'::jsonb)
    from o
$function$;
