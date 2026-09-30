-- Migração 20260918095229 «ensaio_da_migracao_sem_tocar_em_ninguem», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* O ensaio da migração.

   A regra da casa é que a migração acontece DE UMA VEZ, quando a plataforma
   estiver funcional e testada -- e não a conta-gotas por causa de um teste.
   Para essa decisão se poder tomar é preciso ver o que ela faria, e é isso e
   só isso que esta função devolve. NÃO ESCREVE NADA. Não há botão do outro
   lado; quando houver, será outra função, e esta continua a ser a que se olha
   antes.

   Uma pessoa é um email, não uma inscrição: quem comprou duas coisas é uma
   pessoa com dois acessos, e contá-la duas vezes fazia o número parecer maior
   do que a responsabilidade é.

   Cada oferta traz o motivo por que não entregaria, quando é o caso. Os
   motivos são os mesmos da ponte que já corre em produção -- não é uma
   segunda opinião sobre as mesmas regras. */
create or replace function academia.ensaio_da_migracao()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  if not academia_privado.e_equipa() then
    raise exception 'Sem permissão.';
  end if;

  with pagas as (
    /* quem pagou alguma coisa, alguma vez, e ainda cá está */
    select distinct i.id as inscricao, i.lead_id, t.oferta_id
      from public.inscricoes i
      join public.turmas t on t.id = i.turma_id
      join public.lancamentos l on l.inscricao_id = i.id
                               and l.estado = 'Confirmado' and l.removido_em is null
     where i.removido_em is null
  ),
  gente as (
    select p.inscricao, p.oferta_id,
           nullif(trim(lower(le.email)), '') as email,
           exists (select 1 from public.utilizadores u
                    where lower(u.email) = nullif(trim(lower(le.email)), '')
                      and u.removido_em is null) as tem_conta
      from pagas p
      left join public.leads le on le.id = p.lead_id
  ),
  cursos_da_oferta as (
    select o.id as oferta_id, c.id as curso_id, c.titulo,
           (select count(*) from academia.aulas a
             join academia.modulos m on m.id = a.modulo_id
            where m.curso_id = c.id and a.removido_em is null and m.removido_em is null) as aulas
      from public.ofertas o
      join academia.cursos c
        on c.removido_em is null and c.publicado
       and ((o.entrega = 'Academia' and c.oferta_id = o.id)
         or (o.entrega = 'Plano' and exists (
              select 1 from academia.plano_cursos pc
               join academia.planos p on p.id = pc.plano_id
                                     and p.oferta_id = o.id
                                     and p.removido_em is null
              where pc.curso_id = c.id)))
     where o.removido_em is null
  ),
  por_oferta as (
    select o.id, o.nome, o.estado::text as estado, o.entrega::text as entrega,
           o.preco, o.cobranca::text as cobranca,
           count(distinct coalesce(g.email, 'sem-email:' || g.inscricao)) as pessoas,
           count(*) filter (where g.email is null) as sem_email,
           coalesce((select jsonb_agg(jsonb_build_object('titulo', k.titulo, 'aulas', k.aulas)
                       order by k.titulo)
                       from cursos_da_oferta k where k.oferta_id = o.id), '[]'::jsonb) as cursos,
           coalesce((select sum(k.aulas) from cursos_da_oferta k where k.oferta_id = o.id), 0) as aulas
      from gente g
      join public.ofertas o on o.id = g.oferta_id
     group by o.id, o.nome, o.estado, o.entrega, o.preco, o.cobranca
  )
  select jsonb_build_object(
    'resumo', jsonb_build_object(
      'inscricoes',   (select count(*) from gente),
      'pessoas',      (select count(distinct coalesce(email, 'sem-email:' || inscricao)) from gente),
      'semEmail',     (select count(*) from gente where email is null),
      'comConta',     (select count(distinct email) from gente where tem_conta),
      'receberiam',   (select coalesce(sum(pessoas), 0) from por_oferta
                        where entrega in ('Academia','Plano') and aulas > 0 and estado <> 'Arquivada'),
      'ficariamFora', (select coalesce(sum(pessoas), 0) from por_oferta
                        where not (entrega in ('Academia','Plano') and aulas > 0 and estado <> 'Arquivada'))
    ),
    'porOferta', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ofertaId', id, 'nome', nome, 'estado', estado, 'entrega', entrega,
        'preco', preco, 'cobranca', cobranca,
        'pessoas', pessoas, 'semEmail', sem_email,
        'cursos', cursos, 'aulas', aulas,
        'motivo', case
          when entrega = 'Nada'  then 'a oferta não entrega nada automático'
          when entrega = 'Link'  then 'entrega um link por email, não um acesso'
          when jsonb_array_length(cursos) = 0 then
            case when entrega = 'Plano' then 'não tem plano ligado, ou o plano está vazio'
                 else 'não tem curso ligado' end
          when aulas = 0 then 'o que entrega ainda não tem nenhuma aula'
          when estado = 'Arquivada' then 'a oferta está arquivada'
          else null end
      ) order by pessoas desc)
      from por_oferta), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

revoke all on function academia.ensaio_da_migracao() from public, anon;
grant execute on function academia.ensaio_da_migracao() to authenticated;
