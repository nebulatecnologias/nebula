/* W4·7 — a escola abre mesmo que a página /criar já não esteja a perguntar.

   Até aqui, a Academia só sabia que a validação tinha sido paga quando a
   página /criar perguntava (criar-escola, accao 'confirmar'). A 04/10 o
   Shelton pagou os 10 MT, o Payflow activou a assinatura, e a área ficou
   fechada: o pedido de PIN do browser foi cortado e a página deixou de
   perguntar. Agora, enquanto houver escolas à espera da validação, a
   criar-escola (accao 'sincronizar') pergunta ao Payflow por elas a cada
   minuto. Pela API do Payflow, como sempre: a Academia não lê as tabelas dele.

   plataforma_por_validar(p_email): as escolas pendentes com a validação pedida
   nas últimas 24 horas (depois disso ficam canceladas). Com email, só as que
   têm o convite de dono para esse email — é por aí que a /criar retoma a
   escola que ficou a meio, em vez de criar outra. */
create or replace function public.plataforma_por_validar(p_email text default null)
returns table (organizacao uuid, slug text, nome text)
language sql stable security definer set search_path to '' as $$
  select o.id, o.slug, o.nome
    from nucleo.assinaturas a
    join nucleo.organizacoes o on o.id = a.organizacao_id
   where a.estado = 'pendente'
     and coalesce(a.links, '{}'::jsonb) ? 'validacao'
     and a.criado_em > now() - interval '24 hours'
     and (p_email is null or exists (
           select 1 from academia.convites c
            where c.organizacao_id = o.id and c.papel = 'dono'
              and lower(c.email) = lower(trim(p_email))))
   order by a.criado_em desc
   limit 50
$$;
revoke all on function public.plataforma_por_validar(text) from public, anon, authenticated;
grant execute on function public.plataforma_por_validar(text) to service_role;

/* Só chama a função quando há alguma escola à espera: quase sempre não há, e
   então não sai pedido nenhum. O segredo vem do cofre, como nos outros. */
select cron.schedule('plataforma-sincronizar-por-validar', '* * * * *', $cron$
  select net.http_post(
    url     := 'https://epqfotzxrcyligwpauwk.supabase.co/functions/v1/criar-escola',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-segredo', coalesce((select decrypted_secret from vault.decrypted_secrets
                                         where name = 'SEGREDO_COBRANCA' limit 1), '')),
    body    := '{"accao":"sincronizar"}'::jsonb,
    timeout_milliseconds := 30000)
   where exists (select 1 from public.plataforma_por_validar());
$cron$);
