-- Migração 20260912225818 «estado_dos_cursos», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- Quantas aulas tem, de facto, cada curso ligado a uma oferta.
-- Serve para quem confirma um pagamento decidir se convida ou nao com o dado
-- a frente, em vez de o adivinhar. So a equipa do fluxo de caixa ve isto.
create or replace function public.estado_dos_cursos()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (privado.sou_admin() or privado.tenho_acesso('fluxo')) then
    raise exception 'Sem permissão.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'oferta', x.oferta,
             'curso',  x.curso,
             'aulas',  x.aulas
           ) order by x.aulas, x.oferta)
    from (
      select o.nome as oferta, c.titulo as curso,
             (select count(*) from academia.aulas a
               join academia.modulos m on m.id = a.modulo_id
              where m.curso_id = c.id) as aulas
      from academia.cursos c
      join public.ofertas o on o.id = c.oferta_id
      where c.removido_em is null and c.publicado
        and o.removido_em is null and o.estado = 'Ativa'
    ) x
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.estado_dos_cursos() from public;
grant execute on function public.estado_dos_cursos() to authenticated;
