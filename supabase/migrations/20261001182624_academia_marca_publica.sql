-- F1a — tirar a Kingdom do código: a marca de cada Academia vem da base, já no
-- ecrã de entrada (antes de alguém entrar).
--
--   public.marca_da_academia(endereco)  o que a página de entrada mostra: nome,
--      sublinha, logótipo, cor, tema, rodapé, textos de entrada e símbolo, para
--      a organização do endereço (domínio ou slug; desconhecido → Kingdom).
--      Só estes campos, nunca o resto da configuração. Fica em `public` porque
--      o anónimo não tem acesso ao esquema academia.
--   simbolo  sem logótipo, o sinal da marca: «coroa» é o da Kingdom (gravado
--      na sua aparência); a origem passa a ser as iniciais do nome.
--
-- Aplicada por execute_sql e registada à mão.

set lock_timeout = '10s';

create or replace function public.marca_da_academia(p_endereco text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with org as (
    select coalesce(
      (select o.id from nucleo.organizacoes o
        where o.estado = 'ativa'
          and (o.slug = lower(trim(p_endereco))
               or exists (select 1 from nucleo.dominios d
                           where d.organizacao_id = o.id and d.app = 'academia'
                             and d.dominio = lower(trim(p_endereco))))),
      nucleo.organizacao_kingdom()) as id
  )
  select jsonb_build_object('slug', o.slug, 'nome', o.nome)
      || coalesce((select jsonb_strip_nulls(jsonb_build_object(
                     'nomeEscola',  c.valor->'nomeEscola',
                     'sublinha',    c.valor->'sublinha',
                     'logoUrl',     c.valor->'logoUrl',
                     'corAccent',   c.valor->'corAccent',
                     'temaPadrao',  c.valor->'temaPadrao',
                     'rodape',      c.valor->'rodape',
                     'loginTitulo', c.valor->'loginTitulo',
                     'loginTexto',  c.valor->'loginTexto',
                     'simbolo',     c.valor->'simbolo'))
                     from academia.config c
                    where c.organizacao_id = o.id and c.chave = 'aparencia'), '{}'::jsonb)
    from org join nucleo.organizacoes o on o.id = org.id
$$;
revoke all on function public.marca_da_academia(text) from public;
grant execute on function public.marca_da_academia(text) to anon, authenticated;

update academia.config
   set valor = valor || '{"simbolo":"coroa"}'::jsonb
 where chave = 'aparencia' and organizacao_id = nucleo.organizacao_kingdom()
   and not (valor ? 'simbolo');
