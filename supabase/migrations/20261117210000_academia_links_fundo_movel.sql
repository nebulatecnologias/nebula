-- A imagem de fundo de um link de inscrição passa a ter duas versões: a do
-- computador (fundo, que já existia) e a do telemóvel (fundo_movel). Pedido
-- do Shelton a 17/11/2026: «a imagem de fundo deve ter espaço para mobile e
-- espaço para desktop». A página pública usa a de cada ecrã e, na falta de
-- uma, a outra; sem nenhuma, o fundo é a cor da organização.
alter table academia.links_de_inscricao
  add column fundo_movel text check (fundo_movel is null or fundo_movel ~ '^https://');

-- O que a página pública mostra: o texto, as imagens e se ainda aceita
-- inscrições. Mais nada do link sai daqui.
create or replace function public.link_de_inscricao(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
           'codigo', l.codigo, 'titulo', l.titulo, 'descricao', l.descricao,
           'fundo', l.fundo, 'fundoMovel', l.fundo_movel,
           'telefoneObrigatorio', l.telefone_obrigatorio,
           'escola', o.slug,
           'estado', academia_privado.link_estado(l.id))
    from academia.links_de_inscricao l
    join nucleo.organizacoes o on o.id = l.organizacao_id and o.estado = 'ativa'
   where l.codigo = p_codigo
$$;
revoke execute on function public.link_de_inscricao(text) from public;
grant execute on function public.link_de_inscricao(text) to anon, authenticated, service_role;
