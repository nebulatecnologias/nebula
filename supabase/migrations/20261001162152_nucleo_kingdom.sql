-- F1a, passo 1 (continuação) — a Kingdom como organização 1, com os seus três
-- endereços e quem já cá está (o papel vem do `perfil` de hoje), e a função da
-- ponte que o trigger da migração seguinte usa.

create or replace function nucleo.ponte_do_perfil()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := nucleo.organizacao_kingdom();
begin
  if v_org is null then return new; end if;
  if new.removido_em is not null then
    update nucleo.membros set estado = 'suspenso'
     where organizacao_id = v_org and utilizador_id = new.id and app = 'academia';
    return new;
  end if;
  if not exists (select 1 from auth.users where id = new.id) then return new; end if;
  insert into nucleo.membros (organizacao_id, utilizador_id, app, papel, estado)
  values (v_org, new.id, 'academia', new.perfil::text,
          case when new.estado::text = 'Ativo' then 'ativo' else 'suspenso' end)
  on conflict (organizacao_id, utilizador_id, app) do update
    set papel = case when nucleo.membros.papel = 'dono' then 'dono' else excluded.papel end,
        estado = excluded.estado;
  return new;
end $$;
revoke all on function nucleo.ponte_do_perfil() from public, anon, authenticated;

do $$
declare
  v_org uuid;
  v_esperados int;
  v_membros int;
begin
  insert into nucleo.organizacoes (slug, nome) values ('kingdom', 'Kingdom Company')
  returning id into v_org;

  insert into nucleo.dominios (dominio, organizacao_id, app, principal) values
    ('membros.kingdomcompny.com',   v_org, 'academia', true),
    ('payflow.kingdomcompny.com',   v_org, 'payflow',  true),
    ('dashboard.kingdomcompny.com', v_org, 'painel',   true);

  select count(*) into v_esperados
    from public.utilizadores u
   where u.removido_em is null and exists (select 1 from auth.users a where a.id = u.id);

  insert into nucleo.membros (organizacao_id, utilizador_id, app, papel, estado)
  select v_org, u.id, 'academia', u.perfil::text,
         case when u.estado::text = 'Ativo' then 'ativo' else 'suspenso' end
    from public.utilizadores u
   where u.removido_em is null and exists (select 1 from auth.users a where a.id = u.id);

  select count(*) into v_membros from nucleo.membros where organizacao_id = v_org;
  raise notice 'kingdom: % membros (esperados %)', v_membros, v_esperados;
  if v_membros <> v_esperados then
    raise exception 'esperava % membros, ficaram %', v_esperados, v_membros;
  end if;
end $$;
