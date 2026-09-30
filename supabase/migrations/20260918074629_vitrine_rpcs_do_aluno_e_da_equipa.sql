-- Migração 20260918074629 «vitrine_rpcs_do_aluno_e_da_equipa», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* As guardas vivem aqui, e não no browser.

   A Vitrine passou a ter botão de pagar. Se as condições para o mostrar
   fossem decididas no JavaScript, bastava um erro de desenho para aparecer
   um botão de 947 MT em cima de um curso vazio -- que é exactamente o
   incidente que já aconteceu uma vez, com uma pessoa a sério.

   Uma oferta só chega ao aluno se as cinco se verificarem:
     1. está Ativa e não removida
     2. entrega Academia ou Plano
     3. alguém a mandou mostrar (academia.vitrine.mostrar)
     4. tem pelo menos um curso publicado para entregar
     5. esse conjunto tem pelo menos UMA AULA

   Falhando qualquer uma, não aparece. O ecrã da equipa diz qual falhou. */
create or replace function academia.vitrine_do_aluno()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with entregue as (
    /* os cursos publicados que cada oferta abre, por qualquer dos dois caminhos */
    select o.id as oferta_id, c.id as curso_id
      from public.ofertas o
      join academia.cursos c
        on c.removido_em is null and c.publicado
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
    /* nada de vender o que a pessoa já tem por inteiro, nem uma montra vazia */
    having bool_or(not k.ja_tenho) and sum(k.aulas) > 0
  ) t;
$$;

/* O mesmo, sem filtrar nada, com o motivo de cada uma aparecer ou não.
   É isto que a aba da Academia desenha. */
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

/* Escrever a flag. Uma linha por oferta, criada à primeira vez que se mexe. */
create or replace function academia.vitrine_mostrar(
  p_oferta bigint,
  p_mostrar boolean,
  p_destaque boolean default null,
  p_chamada text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_nome text;
begin
  if not academia_privado.e_equipa() then
    raise exception 'Sem permissão.';
  end if;

  select o.nome into v_nome from public.ofertas o
   where o.id = p_oferta and o.removido_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'oferta não encontrada');
  end if;

  insert into academia.vitrine (oferta_id, mostrar, destaque, chamada)
  values (p_oferta, p_mostrar, coalesce(p_destaque, false), p_chamada)
  on conflict (oferta_id) do update
    set mostrar       = excluded.mostrar,
        destaque      = coalesce(p_destaque, academia.vitrine.destaque),
        chamada       = coalesce(p_chamada, academia.vitrine.chamada),
        atualizado_em = now();

  return jsonb_build_object('ok', true, 'oferta', v_nome, 'mostrar', p_mostrar);
end;
$$;

revoke all on function academia.vitrine_para_equipa() from public, anon;
revoke all on function academia.vitrine_mostrar(bigint, boolean, boolean, text) from public, anon;
grant execute on function academia.vitrine_do_aluno() to authenticated;
grant execute on function academia.vitrine_para_equipa() to authenticated;
grant execute on function academia.vitrine_mostrar(bigint, boolean, boolean, text) to authenticated;
