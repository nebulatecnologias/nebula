-- O relógio da mensalidade das escolas (W4). Uma vez por dia, às 05:57 UTC
-- (07:57 em Maputo), só quando há escolas a cobrar (fim do teste, fim do
-- período, ou uma nova tentativa de uma em atraso). O segredo vem do cofre,
-- como nos outros relógios; sem ele a função responde 401 e não cobra nada.
select cron.schedule('plataforma-cobrar', '57 5 * * *', $c$
  -- A mensalidade das escolas (W4). Uma vez por dia, só quando há escolas a
  -- cobrar; o segredo vem do cofre, como nos outros relógios.
  select net.http_post(
    url     := 'https://epqfotzxrcyligwpauwk.supabase.co/functions/v1/plataforma-cobrar',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-segredo', coalesce((select decrypted_secret from vault.decrypted_secrets
                                         where name = 'SEGREDO_COBRANCA' limit 1), '')),
    body    := '{"accao":"relogio"}'::jsonb,
    timeout_milliseconds := 120000
  ) where exists (select 1 from public.plataforma_a_cobrar());
$c$);
