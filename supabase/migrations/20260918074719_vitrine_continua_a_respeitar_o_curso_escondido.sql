-- Migração 20260918074719 «vitrine_continua_a_respeitar_o_curso_escondido», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* A flag passou a ser por oferta, mas a antiga não desaparece: um curso com
   cursos.vitrine = false estava escondido do aluno e tem de continuar
   escondido. Sem isto, a mudança de modelo publicava sozinha o que alguém já
   tinha mandado esconder -- entre eles o curso de teste interno. */
create or replace function academia.vitrine_do_aluno()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with entregue as (
    select o.id as oferta_id, c.id as curso_id
      from public.ofertas o
      join academia.cursos c
        on c.removido_em is null and c.publicado and c.vitrine
       and (
         (o.entrega = 'Academia' and c.oferta_id = o.id)
         or (o.entrega = 'Plano' and exists (
              select 1 from academia.plano_cursos pc
               join academia.planos p on p.id = pc.plano_id
                                     and p.oferta_id = o.id
                                     and p.removido_em is null
              where pc.curso_id = c.id))
       )
     where o.removido_em is null and o.estado = 'Ativa'
       and o.entrega in ('Academia', 'Plano')
       and exists (select 1 from academia.vitrine v
                    where v.oferta_id = o.id and v.mostrar)
  ),
  contadas as (
    select e.oferta_id, e.curso_id,
           (select count(*) from academia.aulas a
             join academia.modulos m on m.id = a.modulo_id
            where m.curso_id = e.curso_id
              and a.removido_em is null and m.removido_em is null) as aulas,
           academia_privado.tem_acesso(e.curso_id) as ja_tenho
      from entregue e
  )
  select coalesce(jsonb_agg(x order by x->>'ordem', x->>'nome'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'ofertaId',  o.id,
      'nome',      o.nome,
      'preco',     o.preco,
      'moeda',     o.moeda,
      'cobranca',  o.cobranca::text,
      'entrega',   o.entrega::text,
      'atalho',    o.atalho,
      'linkVendas', nullif(trim(coalesce(o.link_vendas, '')), ''),
      'destaque',  v.destaque,
      'chamada',   v.chamada,
      'ordem',     v.ordem,
      'aulas',     sum(k.aulas),
      'cursos',    jsonb_agg(jsonb_build_object(
                     'id', c.id, 'titulo', c.titulo, 'subtitulo', c.subtitulo,
                     'capa', c.capa_url, 'categoria', c.categoria_id,
                     'aulas', k.aulas,
                     'modulos', (select count(*) from academia.modulos m
                                  where m.curso_id = c.id and m.removido_em is null))
                     order by c.ordem, c.titulo)
    ) as x
    from contadas k
    join public.ofertas o on o.id = k.oferta_id
    join academia.vitrine v on v.oferta_id = o.id
    join academia.cursos c on c.id = k.curso_id
    group by o.id, o.nome, o.preco, o.moeda, o.cobranca, o.entrega, o.atalho,
             o.link_vendas, v.destaque, v.chamada, v.ordem
    having bool_or(not k.ja_tenho) and sum(k.aulas) > 0
  ) t;
$$;

/* E o ecrã da equipa passa a dizer quando é o curso que está escondido, para
   o motivo não ficar por explicar. */
create or replace function academia.vitrine_para_equipa()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not academia_privado.e_equipa() then
    raise exception 'Sem permissão.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'ofertaId', o.id,
      'nome',     o.nome,
      'preco',    o.preco,
      'moeda',    o.moeda,
      'cobranca', o.cobranca::text,
      'entrega',  o.entrega::text,
      'estado',   o.estado::text,
      'atalho',   o.atalho,
      'mostrar',  coalesce(v.mostrar, false),
      'temLinha', v.oferta_id is not null,
      'destaque', coalesce(v.destaque, false),
      'chamada',  v.chamada,
      'ordem',    coalesce(v.ordem, 0),
      'plano',    (select p.nome from academia.planos p
                    where p.oferta_id = o.id and p.removido_em is null limit 1),
      'cursos',   (select coalesce(jsonb_agg(jsonb_build_object(
                            'id', c.id, 'titulo', c.titulo,
                            'naVitrine', c.vitrine,
                            'aulas', (select count(*) from academia.aulas a
                                       join academia.modulos m on m.id = a.modulo_id
                                      where m.curso_id = c.id
                                        and a.removido_em is null and m.removido_em is null))
                          order by c.ordem, c.titulo), '[]'::jsonb)
                     from academia.cursos c
                    where c.removido_em is null and c.publicado
                      and ((o.entrega = 'Academia' and c.oferta_id = o.id)
                        or (o.entrega = 'Plano' and exists (
                             select 1 from academia.plano_cursos pc
                              join academia.planos p on p.id = pc.plano_id
                                                    and p.oferta_id = o.id
                                                    and p.removido_em is null
                             where pc.curso_id = c.id))))
    ) order by coalesce(v.ordem, 0), o.nome)
    from public.ofertas o
    left join academia.vitrine v on v.oferta_id = o.id
    where o.removido_em is null
      and o.entrega in ('Academia', 'Plano')
  ), '[]'::jsonb);
end;
$$;
