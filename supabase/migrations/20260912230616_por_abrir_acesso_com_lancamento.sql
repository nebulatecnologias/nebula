-- Migração 20260912230616 «por_abrir_acesso_com_lancamento», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- Quem pagou e ainda nao tem o que comprou.
--
-- Nao e uma tabela nova: e um estado que se deduz. Alguem esta nesta lista
-- enquanto tiver pagamento confirmado, a oferta tiver curso publicado, e nao
-- tiver acesso a esse curso. Assim que o acesso abre, sai da lista sozinha --
-- nao ha nada para marcar como feito, nem nada que se possa esquecer de marcar.
--
-- Devolve tambem um lancamento ja confirmado de cada pessoa. E por ele que a
-- ponte abre o acesso: ela reconhece um pagamento ja confirmado, nao o volta a
-- confirmar, e faz o resto -- conta, ligacao ao lead, acesso e email. Assim nao
-- ha uma segunda funcao a repetir a mesma logica.
create or replace function public.por_abrir_acesso()
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
    select jsonb_agg(to_jsonb(x) order by x.turma, x.nome)
    from (
      select i.id                    as inscricao_id,
             le.nome,
             lower(le.email)         as email,
             o.nome                  as oferta,
             t.nome                  as turma,
             c.titulo                as curso,
             (select count(*) from academia.aulas a
               join academia.modulos m on m.id = a.modulo_id
              where m.curso_id = c.id)                    as aulas,
             (select coalesce(sum(l.valor),0) from public.lancamentos l
               where l.inscricao_id = i.id and l.tipo = 'Entrada'
                 and l.estado = 'Confirmado' and l.removido_em is null) as pago,
             i.total,
             u.id is not null        as tem_conta,
             (select max(l.data) from public.lancamentos l
               where l.inscricao_id = i.id and l.tipo = 'Entrada'
                 and l.estado = 'Confirmado' and l.removido_em is null) as pagou_em,
             -- Por onde a ponte pega para abrir o acesso desta pessoa.
             (select l.id from public.lancamentos l
               where l.inscricao_id = i.id and l.tipo = 'Entrada'
                 and l.estado = 'Confirmado' and l.removido_em is null
               order by l.data, l.id limit 1)             as lancamento_id
      from public.inscricoes i
      join public.leads   le on le.id = i.lead_id
      join public.turmas  t  on t.id  = i.turma_id
      join public.ofertas o  on o.id  = t.oferta_id
      join academia.cursos c on c.oferta_id = o.id and c.removido_em is null and c.publicado
      left join public.utilizadores u
             on lower(u.email) = lower(le.email) and u.removido_em is null
      where i.removido_em is null
        and i.estado <> 'Desistiu'
        and le.email is not null
        and exists (select 1 from public.lancamentos l
                     where l.inscricao_id = i.id and l.tipo = 'Entrada'
                       and l.estado = 'Confirmado' and l.removido_em is null)
        and not exists (select 1 from academia.acessos a
                         where a.curso_id = c.id and a.utilizador_id = u.id)
    ) x
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.por_abrir_acesso() from public;
grant execute on function public.por_abrir_acesso() to authenticated;
