/* O criar-escola (chave de serviço) diz à página /criar se a escola já abriu. */
create or replace function public.plataforma_estado_da_escola(p_org uuid)
returns text language sql stable security definer set search_path to '' as $$
  select estado from nucleo.assinaturas where organizacao_id = p_org
$$;
revoke all on function public.plataforma_estado_da_escola(uuid) from public, anon, authenticated;
