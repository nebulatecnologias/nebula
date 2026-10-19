-- Aplicada a 19/10/2026 (versão 20261019134228). Prova antes: a migração e um ensaio correram numa
-- transação desfeita — a chave guarda-se e lê-se só pela service_role, uma chave curta é recusada,
-- desligar larga a chave, e anon/authenticated não executam as funções da chave.
--
-- Panda Video nativo (pedido do Shelton a 19/10/2026): cada escola liga a
-- conta Panda dela uma vez, com a chave da API, e o editor da aula passa a
-- escolher o vídeo da biblioteca, sem copiar códigos de incorporação.
--
-- A chave da API do Panda dá controlo total da conta (apagar vídeos
-- incluído), por isso nunca chega ao browser: guarda-se no Vault, cifrada,
-- como o segredo do Payflow (academia.integracoes guarda o id e os últimos
-- quatro caracteres). Quem fala com o Panda é a Edge Function panda-video,
-- com a service_role; o browser só recebe a lista de vídeos.
--
-- 1. academia.integracoes passa a aceitar app = 'panda'.
-- 2. academia.panda_quem_sou() — para a Edge Function, com a sessão de quem
--    chama: de que escola é o pedido (pelo x-organizacao, como o resto da
--    API), se pode ver a biblioteca (equipa da escola) e se pode ligar a
--    conta (administração da escola), e o estado da ligação.
-- 3. public.escola_panda_chave(org) e public.escola_panda_guardar(org, chave,
--    por) — só service_role. Guardar com a chave vazia desliga: a chave no
--    Vault é trocada por uma aleatória antes de se largar, como no Payflow.

alter table academia.integracoes drop constraint if exists integracoes_app_check;
alter table academia.integracoes add constraint integracoes_app_check check (app in ('payflow', 'panda'));

create or replace function academia.panda_quem_sou()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_ligar boolean;
  i academia.integracoes;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  v_ligar := academia_privado.pode_integrar(v_org);
  select * into i from academia.integracoes where organizacao_id = v_org and app = 'panda';
  return jsonb_build_object(
    'organizacao', v_org,
    'podeVer', v_ligar or academia_privado.e_equipa(),
    'podeLigar', v_ligar,
    'ligada', i.segredo_id is not null and i.estado = 'ativa',
    'chaveFim', case when v_ligar then i.segredo_fim end,
    'ligadaEm', case when i.segredo_id is not null then i.atualizado_em end);
end $$;
revoke execute on function academia.panda_quem_sou() from public, anon;
grant execute on function academia.panda_quem_sou() to authenticated;

create or replace function public.escola_panda_chave(p_org uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select d.decrypted_secret from academia.integracoes i
    join vault.decrypted_secrets d on d.id = i.segredo_id
   where i.organizacao_id = p_org and i.app = 'panda' and i.estado = 'ativa'
$$;
revoke execute on function public.escola_panda_chave(uuid) from public, anon, authenticated;
grant execute on function public.escola_panda_chave(uuid) to service_role;

create or replace function public.escola_panda_guardar(p_org uuid, p_chave text, p_por uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare i academia.integracoes; v_id uuid; v_chave text := trim(coalesce(p_chave, ''));
begin
  if p_org is null then raise exception 'Escola em falta.'; end if;
  select * into i from academia.integracoes where organizacao_id = p_org and app = 'panda' for update;
  if v_chave = '' then
    if i.segredo_id is not null then
      perform nucleo.guardar_segredo(i.segredo_id, encode(extensions.gen_random_bytes(24), 'hex'), 'panda');
    end if;
    update academia.integracoes set estado = 'desligada', segredo_id = null, segredo_fim = null,
           atualizado_em = now(), atualizado_por = p_por
     where organizacao_id = p_org and app = 'panda';
    return jsonb_build_object('ligada', false);
  end if;
  if length(v_chave) not between 16 and 300 or v_chave !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'Essa chave não parece do Panda. Copie-a outra vez em Configurações › Avançado › Chave da API.';
  end if;
  v_id := nucleo.guardar_segredo(i.segredo_id, v_chave, 'escola ' || p_org::text || ' · panda');
  insert into academia.integracoes (organizacao_id, app, estado, segredo_id, segredo_fim, atualizado_por)
  values (p_org, 'panda', 'ativa', v_id, right(v_chave, 4), p_por)
  on conflict (organizacao_id, app) do update set estado = 'ativa', segredo_id = excluded.segredo_id,
    segredo_fim = excluded.segredo_fim, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return jsonb_build_object('ligada', true, 'chaveFim', right(v_chave, 4));
end $$;
revoke execute on function public.escola_panda_guardar(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.escola_panda_guardar(uuid, text, uuid) to service_role;
