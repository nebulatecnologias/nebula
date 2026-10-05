/* W4·8·6 (A6) — o relógio da criar-escola também relê os produtos do Payflow.

   O cron só chamava a criar-escola quando havia escolas à espera da validação;
   como quase nunca há, a releitura dos produtos (de 15 em 15 minutos, pela
   API, com a chave da Academia) nunca acontecia. Agora chama também quando a
   chave está posta e há produtos por ler. Continua sem sair pedido nenhum
   quando não há nada a fazer. */
select cron.schedule('plataforma-sincronizar-por-validar', '* * * * *', $cron$
  select net.http_post(
    url     := 'https://epqfotzxrcyligwpauwk.supabase.co/functions/v1/criar-escola',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-segredo', coalesce((select decrypted_secret from vault.decrypted_secrets
                                         where name = 'SEGREDO_COBRANCA' limit 1), '')),
    body    := '{"accao":"sincronizar"}'::jsonb,
    timeout_milliseconds := 30000)
   where exists (select 1 from public.plataforma_por_validar())
      or public.plataforma_produtos_por_ler(15);
$cron$);
