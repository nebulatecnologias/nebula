/* W4·8·7 — a escola da África do Sul paga com o cartão (Shelton, 05/10:
   «aplique o 8»).

   A assinatura do Payflow por cartão traz, depois de paga a validação,
   `payment_method: {"type":"card","card":{"brand":…,"last4":…}}`. A Cobrança da
   escola mostra o cartão («Visa •••• 4081») a partir de nucleo.assinaturas.cartao:
   passa a vir daí. O código da autorização nunca chega aqui — fica no cofre do
   Payflow. */
do $$
declare d text;
begin
  d := pg_get_functiondef('public.escola_aplicar_assinatura'::regproc);
  if position('{payment_method,card,last4}' in d) = 0 then
    d := replace(d,
      $q$metodo = case s#>>'{payment_method,type}' when 'mpesa' then 'mpesa' when 'card' then 'cartao' when 'manual' then 'fatura' else metodo end,$q$,
      $q$metodo = case s#>>'{payment_method,type}' when 'mpesa' then 'mpesa' when 'card' then 'cartao' when 'manual' then 'fatura' else metodo end,
      cartao = case when jsonb_typeof(s#>'{payment_method,card}') = 'object'
                    then jsonb_build_object('marca', s#>>'{payment_method,card,brand}', 'ultimos4', s#>>'{payment_method,card,last4}')
                    else cartao end,$q$);
    if position('{payment_method,card,last4}' in d) = 0 then
      raise exception 'escola_aplicar_assinatura: não encontrei onde acrescentar';
    end if;
    execute d;
  end if;
end $$;
