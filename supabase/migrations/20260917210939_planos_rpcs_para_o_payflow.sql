-- Migração 20260917210939 «planos_rpcs_para_o_payflow», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* O Payflow escolhe que plano uma oferta entrega, do mesmo modo que ja escolhe
   o curso. Passa por aqui e nao por escrita directa, porque o esquema academia
   nao esta exposto ao Payflow e nao deve passar a estar. */

create or replace function public.planos_para_ligar()
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
             'id',          p.id,
             'nome',        p.nome,
             'descricao',   p.descricao,
             'oferta_id',   p.oferta_id,
             'oferta_nome', o.nome,
             'cursos',      (select count(*) from academia.plano_cursos pc
                              join academia.cursos c on c.id = pc.curso_id
                             where pc.plano_id = p.id and c.removido_em is null),
             /* Um plano com cursos vazios entrega uma porta fechada tantas
                vezes quantos os cursos que la estao. Conta-se aqui para o
                aviso poder ser dado antes de alguem pagar. */
             'cursos_sem_aulas', (
                select count(*) from academia.plano_cursos pc
                 join academia.cursos c on c.id = pc.curso_id and c.removido_em is null
                where pc.plano_id = p.id
                  and not exists (
                        select 1 from academia.aulas a
                         join academia.modulos m on m.id = a.modulo_id
                        where m.curso_id = c.id
                          and a.removido_em is null and m.removido_em is null)),
             'titulos', (select coalesce(jsonb_agg(c.titulo order by pc.ordem, c.titulo), '[]'::jsonb)
                           from academia.plano_cursos pc
                           join academia.cursos c on c.id = pc.curso_id and c.removido_em is null
                          where pc.plano_id = p.id)
           ) order by p.ordem, p.nome)
    from academia.planos p
    left join public.ofertas o on o.id = p.oferta_id and o.removido_em is null
    where p.removido_em is null
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.oferta_ligar_plano(p_oferta bigint, p_plano text default null)
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

  if not exists (select 1 from public.ofertas where id = p_oferta and removido_em is null) then
    raise exception 'Essa oferta não existe.';
  end if;

  if p_plano is not null then
    if not exists (select 1 from academia.planos where id = p_plano and removido_em is null) then
      raise exception 'Esse plano não existe.';
    end if;

    /* Um plano de outra oferta nao se rouba em silencio. */
    select p.oferta_id, o.nome into v_dono_id, v_dono_nome
      from academia.planos p
      left join public.ofertas o on o.id = p.oferta_id and o.removido_em is null
     where p.id = p_plano;

    if v_dono_id is not null and v_dono_id <> p_oferta then
      raise exception 'Esse plano já é entregue por: %', coalesce(v_dono_nome, 'outra oferta');
    end if;
  end if;

  update academia.planos set oferta_id = null, atualizado_em = now()
   where oferta_id = p_oferta and removido_em is null;

  if p_plano is not null then
    update academia.planos set oferta_id = p_oferta, atualizado_em = now()
     where id = p_plano and removido_em is null;
  end if;

  return jsonb_build_object('ok', true, 'oferta', p_oferta, 'plano', p_plano);
end;
$function$;

revoke all on function public.planos_para_ligar()                from public, anon;
revoke all on function public.oferta_ligar_plano(bigint, text)   from public, anon;
grant execute on function public.planos_para_ligar()              to authenticated;
grant execute on function public.oferta_ligar_plano(bigint, text) to authenticated;
