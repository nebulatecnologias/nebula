-- Fase 4 do plano da Academia (pedido do Shelton a 27/09/2026): a Vitrine.
-- Aplicada em produção a 28/09/2026, com prova em transacção desfeita
-- (aluna fictícia): sem pré-venda, a oferta sem aulas não aparece; com ela,
-- aparece; a aluna não a consegue ligar; o aviso só chega a quem tem acesso.
--
-- 1. «Em breve» por oferta. Uma oferta cujo curso ainda não tem aulas pode ir
--    à Vitrine como pré-venda -- SÓ quando a equipa o liga nessa oferta, nunca
--    sozinha (decisão do Shelton). A data de abertura é opcional.
-- 2. Um só interruptor: o que aparece decide-se por oferta, em academia.vitrine.
--    O cursos.vitrine deixa de contar. O único curso que o tinha desligado
--    (o de teste) passa o veto para a oferta dele, para nada mudar de lado.
-- 3. O cartão da Vitrine traz o que o cartão do curso traz: duração,
--    avaliação e facilitador.

alter table academia.vitrine
  add column if not exists em_breve boolean not null default false,
  add column if not exists abre_em  date;

comment on column academia.vitrine.em_breve is
  'Pré-venda: a oferta aparece na Vitrine mesmo sem aulas, e o Payflow abre o acesso a quem compra. Só a equipa o liga.';
comment on column academia.vitrine.abre_em is
  'Quando as aulas abrem, numa pré-venda. Opcional: sem ela diz-se «em breve».';

-- O veto do curso passa para a oferta, antes de deixar de contar.
do $veto$
declare antes int; depois int;
begin
  select count(*) into antes from academia.vitrine v
   where v.mostrar and exists (select 1 from academia.cursos c
                                where c.oferta_id = v.oferta_id and c.removido_em is null and not c.vitrine)
     and not exists (select 1 from academia.cursos c
                      where c.oferta_id = v.oferta_id and c.removido_em is null and c.vitrine);

  update academia.vitrine v set mostrar = false, atualizado_em = now()
   where v.mostrar and exists (select 1 from academia.cursos c
                                where c.oferta_id = v.oferta_id and c.removido_em is null and not c.vitrine)
     and not exists (select 1 from academia.cursos c
                      where c.oferta_id = v.oferta_id and c.removido_em is null and c.vitrine);
  get diagnostics depois = row_count;
  if antes <> depois then
    raise exception 'veto: % ofertas por passar, % passadas', antes, depois;
  end if;
  raise notice 'veto passado para % oferta(s)', depois;
end $veto$;

comment on column academia.cursos.vitrine is
  'Já não conta (fase 4, 28/09/2026): o que aparece na Vitrine decide-se por oferta, em academia.vitrine.';

-- "mm:ss" ou "hh:mm:ss" em segundos; o que não se lê conta zero.
create or replace function academia_privado.segundos_de(p text)
returns integer language sql immutable set search_path = '' as $$
  select case
    when p ~ '^\d+:\d{1,2}:\d{1,2}$' then split_part(p,':',1)::int*3600 + split_part(p,':',2)::int*60 + split_part(p,':',3)::int
    when p ~ '^\d+:\d{1,2}$'         then split_part(p,':',1)::int*60 + split_part(p,':',2)::int
    else 0 end
$$;

create or replace function academia.vitrine_do_aluno()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with entregue as (
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
           (select coalesce(sum(academia_privado.segundos_de(a.duracao)), 0) from academia.aulas a
             join academia.modulos m on m.id = a.modulo_id
            where m.curso_id = e.curso_id
              and a.removido_em is null and m.removido_em is null) as segundos,
           (select round(avg(av.estrelas)::numeric, 1) from academia.avaliacoes av
             where av.curso_id = e.curso_id and not av.oculto and av.estrelas > 0) as nota,
           (select count(*) from academia.avaliacoes av
             where av.curso_id = e.curso_id and not av.oculto and av.estrelas > 0) as avaliacoes,
           academia_privado.tem_acesso(e.curso_id) as ja_tenho
      from entregue e
  )
  select coalesce(jsonb_agg(x order by (x->>'ordem')::int, x->>'nome'), '[]'::jsonb)
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
      'emBreve',   v.em_breve,
      'abreEm',    v.abre_em,
      'aulas',     sum(k.aulas),
      'segundos',  sum(k.segundos),
      'cursos',    jsonb_agg(jsonb_build_object(
                     'id', c.id, 'titulo', c.titulo, 'subtitulo', c.subtitulo,
                     'sigla', c.sigla,
                     'capa', c.capa_url, 'categoria', c.categoria_id,
                     'facilitador', c.facilitador, 'facilitadorFoto', c.facilitador_foto_url,
                     'aulas', k.aulas, 'segundos', k.segundos,
                     'nota', k.nota, 'avaliacoes', k.avaliacoes,
                     'modulos', (select count(*) from academia.modulos m
                                  where m.curso_id = c.id and m.removido_em is null))
                     order by c.ordem, c.titulo)
    ) as x
    from contadas k
    join public.ofertas o on o.id = k.oferta_id
    join academia.vitrine v on v.oferta_id = o.id
    join academia.cursos c on c.id = k.curso_id
    group by o.id, o.nome, o.preco, o.moeda, o.cobranca, o.entrega, o.atalho,
             o.link_vendas, v.destaque, v.chamada, v.ordem, v.em_breve, v.abre_em
    -- Sem aulas só passa quem a equipa pôs em pré-venda.
    having bool_or(not k.ja_tenho) and (sum(k.aulas) > 0 or v.em_breve)
  ) t;
$function$;

create or replace function academia.vitrine_para_equipa()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
      'emBreve',  coalesce(v.em_breve, false),
      'abreEm',   v.abre_em,
      'plano',    (select p.nome from academia.planos p
                    where p.oferta_id = o.id and p.removido_em is null limit 1),
      'cursos',   (select coalesce(jsonb_agg(jsonb_build_object(
                            'id', c.id, 'titulo', c.titulo, 'categoria', c.categoria_id,
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
$function$;

-- Ligar e desligar a pré-venda de uma oferta. Separada do vitrine_mostrar
-- porque aqui a data tem de se poder apagar: null quer dizer «sem data».
create or replace function academia.vitrine_pre_venda(p_oferta bigint, p_em_breve boolean, p_abre_em date default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- Ligar a pré-venda não põe a oferta à vista: isso é o outro interruptor.
  insert into academia.vitrine (oferta_id, mostrar, em_breve, abre_em)
  values (p_oferta, false, coalesce(p_em_breve, false), case when p_em_breve then p_abre_em end)
  on conflict (oferta_id) do update
    set em_breve      = coalesce(p_em_breve, false),
        abre_em       = case when p_em_breve then p_abre_em end,
        atualizado_em = now();

  return jsonb_build_object('ok', true, 'oferta', v_nome, 'emBreve', coalesce(p_em_breve, false),
                            'abreEm', case when p_em_breve then p_abre_em end);
end;
$function$;

-- Quem comprou em pré-venda entra no curso e vê quando as aulas abrem, em vez
-- de um curso vazio. Só os cursos a que a pessoa tem acesso.
create or replace function academia.pre_venda_dos_meus_cursos()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('cursoId', t.curso_id, 'abreEm', t.abre_em)), '[]'::jsonb)
    from (
      select c.id as curso_id, min(v.abre_em) as abre_em
        from academia.cursos c
        join public.ofertas o on o.removido_em is null
         and ((o.entrega = 'Academia' and c.oferta_id = o.id)
           or (o.entrega = 'Plano' and exists (
                select 1 from academia.plano_cursos pc
                 join academia.planos p on p.id = pc.plano_id and p.oferta_id = o.id and p.removido_em is null
                where pc.curso_id = c.id)))
        join academia.vitrine v on v.oferta_id = o.id and v.em_breve
       where c.removido_em is null and c.publicado
         and academia_privado.tem_acesso(c.id)
       group by c.id
    ) t
$function$;

revoke all on function academia.vitrine_pre_venda(bigint, boolean, date) from public, anon;
revoke all on function academia.pre_venda_dos_meus_cursos() from public, anon;
revoke all on function academia_privado.segundos_de(text) from public, anon, authenticated;
grant execute on function academia.vitrine_pre_venda(bigint, boolean, date) to authenticated;
grant execute on function academia.pre_venda_dos_meus_cursos() to authenticated;
