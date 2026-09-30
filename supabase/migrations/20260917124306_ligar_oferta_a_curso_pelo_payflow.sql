-- Migração 20260917124306 «ligar_oferta_a_curso_pelo_payflow», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* A ligação oferta↔curso passa a fazer-se de onde se cria a oferta.

   Vivia só na Academia, num campo que quem monta a oferta não vê -- e por isso
   é que estava por preencher em quase toda a gente. O Payflow não escreve no
   esquema academia, e não deve passar a escrever: passa por aqui, com as
   verificações num sítio só. */

/* Os cursos que se podem escolher, com o que é preciso saber para escolher
   bem: quantas aulas tem, e se já pertence a outra oferta. */
create or replace function public.cursos_para_ligar()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not (privado.sou_admin() or privado.tenho_acesso('fluxo')) then
    raise exception 'Sem permissão.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',          c.id,
             'titulo',      c.titulo,
             'publicado',   c.publicado,
             'aulas',       (select count(*) from academia.aulas a
                              join academia.modulos m on m.id = a.modulo_id
                             where m.curso_id = c.id
                               and a.removido_em is null and m.removido_em is null),
             'oferta_id',   c.oferta_id,
             'oferta_nome', o.nome
           ) order by c.titulo)
    from academia.cursos c
    left join public.ofertas o on o.id = c.oferta_id and o.removido_em is null
    where c.removido_em is null
  ), '[]'::jsonb);
end;
$function$;

/* Ligar, ou desligar com p_curso a null.

   Limpa primeiro o que a oferta tinha: sem isso, trocar de curso deixava o
   antigo ligado e o índice único recusava a escrita com uma mensagem que
   ninguém percebe. */
create or replace function public.oferta_ligar_curso(p_oferta bigint, p_curso text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dono_id   bigint;
  v_dono_nome text;
begin
  if not (privado.sou_admin() or privado.tenho_acesso('fluxo')) then
    raise exception 'Sem permissão.';
  end if;

  if not exists (select 1 from public.ofertas
                  where id = p_oferta and removido_em is null) then
    raise exception 'Essa oferta não existe.';
  end if;

  if p_curso is not null then
    if not exists (select 1 from academia.cursos
                    where id = p_curso and removido_em is null) then
      raise exception 'Esse curso não existe.';
    end if;

    /* Um curso de outra oferta não se rouba em silêncio: quem está a ligar tem
       de saber a quem pertence, para decidir. */
    select c.oferta_id, o.nome into v_dono_id, v_dono_nome
      from academia.cursos c
      left join public.ofertas o on o.id = c.oferta_id and o.removido_em is null
     where c.id = p_curso;

    if v_dono_id is not null and v_dono_id <> p_oferta then
      raise exception 'Esse curso já é entregue por: %', coalesce(v_dono_nome, 'outra oferta');
    end if;
  end if;

  update academia.cursos set oferta_id = null
   where oferta_id = p_oferta and removido_em is null;

  if p_curso is not null then
    update academia.cursos set oferta_id = p_oferta
     where id = p_curso and removido_em is null;
  end if;

  return jsonb_build_object('ok', true, 'oferta', p_oferta, 'curso', p_curso);
end;
$function$;

revoke all on function public.cursos_para_ligar()               from public, anon;
revoke all on function public.oferta_ligar_curso(bigint, text)  from public, anon;
grant execute on function public.cursos_para_ligar()              to authenticated;
grant execute on function public.oferta_ligar_curso(bigint, text) to authenticated;
