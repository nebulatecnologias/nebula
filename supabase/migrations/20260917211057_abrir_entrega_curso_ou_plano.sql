-- Migração 20260917211057 «abrir_entrega_curso_ou_plano», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* Quem abre os acessos de uma inscrição — um curso ou o plano inteiro.

   Estava na Edge Function, a inserir a linha à mão. Passa para aqui por três
   razões: com os planos deixou de ser uma linha e passou a ser um conjunto;
   a regra da expiração precisa de aritmética de datas que o SQL faz melhor;
   e aqui pode ser experimentada dentro de uma transacção e desfeita, coisa
   que numa Edge Function não se faz.

   A DATA DA EXPIRAÇÃO VEM DO LANÇAMENTO QUE FOI PAGO, e isto é o centro de
   tudo. A tentação era usar assinaturas.proxima_cobranca -- mas essa data
   avança quando a mensalidade é LANÇADA, no dia do vencimento, e não quando
   é paga. Quem nunca pagasse via a data a andar para a frente na mesma e
   ficava com acesso para sempre.

   Do lançamento confirmado sai a janela: a mensalidade que vencia a 5 de
   Março compra acesso até 5 de Abril, mais três dias de folga para quem paga
   em cima da hora. E toma-se sempre o maior entre o que já lá estava e o
   novo, por duas razões: correr isto duas vezes sobre o mesmo pagamento dá o
   mesmo resultado, e um pagamento antigo confirmado tarde nunca encurta um
   acesso que já vai mais longe.

   Cobrança única não expira: expira_em fica a null, que é o que o
   academia_privado.tem_acesso() já lê como "para sempre". */
create or replace function academia.abrir_entrega(
  p_inscricao     bigint,
  p_utilizador    uuid,
  p_concedido_por uuid    default null,
  p_lancamento    bigint  default null,
  p_nota          text    default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_folga  constant interval := interval '3 days';
  v_of     record;
  v_venc   date;
  v_expira date;
  v_curso  record;
  v_abertos jsonb := '[]'::jsonb;
  v_ja      int := 0;
begin
  select o.id, o.nome, o.entrega::text as entrega, o.cobranca::text as cobranca
    into v_of
    from public.inscricoes i
    join public.turmas  t on t.id = i.turma_id
    join public.ofertas o on o.id = t.oferta_id and o.removido_em is null
   where i.id = p_inscricao and i.removido_em is null;

  if not found then
    return jsonb_build_object('ok', false, 'porque', 'inscrição ou oferta não encontrada');
  end if;

  if v_of.entrega not in ('Academia', 'Plano') then
    return jsonb_build_object('ok', true, 'entrega', v_of.entrega,
                              'abertos', '[]'::jsonb, 'porque', 'esta oferta não abre acessos');
  end if;

  /* A janela, quando a há. */
  if v_of.cobranca = 'Recorrente mensal' and p_lancamento is not null then
    select l.data into v_venc from public.lancamentos l
     where l.id = p_lancamento and l.removido_em is null;
    if v_venc is not null then
      v_expira := (v_venc + interval '1 month' + v_folga)::date;
    end if;
  end if;

  for v_curso in
    select c.id
      from academia.cursos c
     where c.removido_em is null and c.publicado
       and (
         (v_of.entrega = 'Academia' and c.oferta_id = v_of.id)
         or
         (v_of.entrega = 'Plano' and exists (
            select 1 from academia.plano_cursos pc
             join academia.planos p on p.id = pc.plano_id
                                   and p.oferta_id = v_of.id
                                   and p.removido_em is null
            where pc.curso_id = c.id))
       )
  loop
    insert into academia.acessos (utilizador_id, curso_id, origem, inscricao_id,
                                  concedido_por, expira_em, nota)
    values (p_utilizador, v_curso.id, 'oferta', p_inscricao,
            p_concedido_por, v_expira, p_nota)
    on conflict (utilizador_id, curso_id) do update
      /* Nunca para trás: um pagamento antigo confirmado hoje não encurta um
         acesso que já ia mais longe. E um acesso permanente (null) ganha
         sempre a uma data. */
      set expira_em = case
            when academia.acessos.expira_em is null or excluded.expira_em is null then null
            else greatest(academia.acessos.expira_em, excluded.expira_em)
          end,
          inscricao_id  = coalesce(academia.acessos.inscricao_id, excluded.inscricao_id),
          concedido_por = coalesce(academia.acessos.concedido_por, excluded.concedido_por);

    v_abertos := v_abertos || to_jsonb(v_curso.id);
  end loop;

  return jsonb_build_object(
    'ok',       true,
    'entrega',  v_of.entrega,
    'oferta',   v_of.nome,
    'abertos',  v_abertos,
    'quantos',  jsonb_array_length(v_abertos),
    'expira_em', v_expira
  );
end;
$function$;

revoke all on function academia.abrir_entrega(bigint, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function academia.abrir_entrega(bigint, uuid, uuid, bigint, text) to service_role;
