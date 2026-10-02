-- A prova da aceitação dos termos (W4·5). A página /criar diz «ao continuar,
-- aceita os Termos e a Política de privacidade»; a função criar-escola grava
-- aqui que versão foi aceite, quando, por que conta e de que endereço.
alter table nucleo.assinaturas add column if not exists termos_aceites jsonb;
comment on column nucleo.assinaturas.termos_aceites is 'Prova da aceitação dos termos ao criar a escola: {versao, em, por, ip}. Escrita só pelo servidor (criar-escola).';

create or replace function public.plataforma_termos_aceites(p_org uuid, p_versao text, p_por uuid, p_ip text)
returns void language sql security definer set search_path = ''
as $$
  update nucleo.assinaturas
     set termos_aceites = jsonb_build_object('versao', left(p_versao, 40), 'em', now(), 'por', p_por, 'ip', left(nullif(p_ip, ''), 64)),
         atualizado_em = now()
   where organizacao_id = p_org
$$;
revoke all on function public.plataforma_termos_aceites(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.plataforma_termos_aceites(uuid, text, uuid, text) to service_role;
