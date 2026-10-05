/* W4·8·6 (A6) — a Cobrança da escola sabe se a assinatura é da API do Payflow.

   As escolas criadas pela /criar desde o A5 têm uma assinatura do Payflow
   criada pela API pública (nucleo.assinaturas.payflow_id). Essas não trazem
   o link de gestão da porta interna: cancelar faz-se pela criar-escola
   (accao 'cancelar' → POST /v1/subscriptions/{id}/cancel, no fim do período),
   e mudar de plano ou retomar ainda é connosco. O ecrã precisa de saber qual
   é qual: 'pelaApi' na assinatura. */
do $$
declare d text;
begin
  d := pg_get_functiondef('academia.cobranca_da_escola'::regproc);
  if position('''pelaApi''' in d) = 0 then
    d := replace(d, $q$'ultimoErro', a.ultimo_erro) end,$q$,
                    $q$'ultimoErro', a.ultimo_erro, 'pelaApi', a.payflow_id is not null) end,$q$);
    if position('''pelaApi''' in d) = 0 then raise exception 'cobranca_da_escola: não encontrei onde acrescentar'; end if;
    execute d;
  end if;
end $$;
