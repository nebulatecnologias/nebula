-- Domínio próprio para cada escola (W3, pedido do Shelton a 01/10/2026).
--
-- A escola escreve o domínio nas Configurações (por exemplo
-- academia.a-sua-escola.com) e cria dois registos no DNS dela:
--   - um CNAME para a plataforma (ou um A, se for o domínio de raiz), que é
--     o que faz o endereço abrir a área de membros;
--   - um TXT com um código só dela, que prova que o domínio é dela. Sem esta
--     prova, uma escola podia pedir o domínio de outra antes dela, e quando a
--     verdadeira apontasse o DNS para cá abria-se a escola errada.
--
-- Estados de nucleo.dominios:
--   pendente    pedido, ainda sem a prova (o TXT);
--   verificado  a prova está feita: o endereço já diz de que escola é, mas
--               ainda não abre (DNS a propagar, ou o certificado por emitir);
--   ativo       abre, com certificado; é para ele que os emails apontam;
--   removido    a escola deixou-o. A linha fica (o domínio é a chave), e
--               outra escola pode pedi-lo de novo.
-- Um pedido pendente com mais de 7 dias deixa de travar o domínio: outra
-- escola pode pedi-lo (ninguém reserva domínios que não são seus).
--
-- O que lê o domínio passa a olhar para o estado: o endereço diz a escola com
-- verificado ou ativo; os links dos emails só usam o ativo.
--
-- As escritas são da Edge Function `dominio-proprio` (que fala com a Vercel e
-- confere o DNS); a app só lê, por academia.dominio_proprio(). Os endereços que
-- a plataforma usa (membros., payflow., dashboard., academy. — reservado para o
-- site de vendas —, api., www., tracktor. e a raiz kingdomcompny.com) não se
-- pedem nem se retiram por aqui. Outros subdomínios da Kingdom podem ligar-se a
-- uma escola: a prova por TXT exige o DNS da Kingdom, e é assim que a Kingdom
-- dá um endereço seu a uma escola sem domínio (e como se experimenta).
--
-- Aplicada por execute_sql e registada à mão.

alter table nucleo.dominios
  add column if not exists estado text not null default 'ativo',
  add column if not exists token text,
  add column if not exists verificacao jsonb not null default '{}'::jsonb,
  add column if not exists verificado_em timestamptz,
  add column if not exists pedido_por uuid;
alter table nucleo.dominios
  add constraint dominios_estado_check check (estado in ('pendente', 'verificado', 'ativo', 'removido'));
-- As três linhas que já existiam ficaram ativas pelo valor de origem; daqui
-- para a frente, um domínio novo nasce pendente.
alter table nucleo.dominios alter column estado set default 'pendente';

create or replace function nucleo.dominio_da_plataforma(p_dominio text)
returns boolean language sql immutable set search_path = ''
as $$
  select lower(p_dominio) in ('kingdomcompny.com', 'www.kingdomcompny.com', 'membros.kingdomcompny.com',
                              'academy.kingdomcompny.com', 'payflow.kingdomcompny.com', 'dashboard.kingdomcompny.com',
                              'api.kingdomcompny.com', 'tracktor.kingdomcompny.com')
$$;

-- ---------------------------------------------------------------------------
-- O que resolve o endereço: só domínios com a prova feita.

create or replace function nucleo.organizacao_do_dominio(p_dominio text, p_app text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select d.organizacao_id
    from nucleo.dominios d
    join nucleo.organizacoes o on o.id = d.organizacao_id and o.estado = 'ativa'
   where d.dominio = lower(trim(p_dominio)) and d.app = p_app
     and d.estado in ('verificado', 'ativo')
$$;

create or replace function academia_privado.organizacao()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cab text := lower(trim(nullif(current_setting('request.headers', true), '')::json ->> 'x-organizacao'));
  v_org uuid;
begin
  if v_cab <> '' then
    select o.id into v_org
      from nucleo.organizacoes o
     where o.estado = 'ativa'
       and (o.slug = v_cab
            or exists (select 1 from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia' and d.dominio = v_cab
                          and d.estado in ('verificado', 'ativo')));
    if v_org is not null then return v_org; end if;
  end if;

  if auth.uid() is not null then
    select case when count(*) = 1 then (array_agg(m.organizacao_id))[1] end into v_org
      from nucleo.membros m
      join nucleo.organizacoes o on o.id = m.organizacao_id and o.estado = 'ativa'
     where m.utilizador_id = auth.uid() and m.app = 'academia' and m.estado = 'ativo';
    if v_org is not null then return v_org; end if;
  end if;

  return nucleo.organizacao_kingdom();
end $$;

create or replace function public.marca_da_academia(p_endereco text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with org as (
    select coalesce(
      (select o.id from nucleo.organizacoes o
        where o.estado = 'ativa'
          and (o.slug = lower(trim(p_endereco))
               or exists (select 1 from nucleo.dominios d
                           where d.organizacao_id = o.id and d.app = 'academia'
                             and d.dominio = lower(trim(p_endereco))
                             and d.estado in ('verificado', 'ativo')))),
      nucleo.organizacao_kingdom()) as id
  )
  select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome,
           'dominio', (select d.dominio from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia' and d.estado = 'ativo'
                        order by d.principal desc, d.criado_em limit 1))
      || coalesce((select jsonb_strip_nulls(jsonb_build_object(
                     'nomeEscola',  c.valor->'nomeEscola',
                     'sublinha',    c.valor->'sublinha',
                     'logoUrl',     c.valor->'logoUrl',
                     'corAccent',   c.valor->'corAccent',
                     'temaPadrao',  c.valor->'temaPadrao',
                     'rodape',      c.valor->'rodape',
                     'loginTitulo', c.valor->'loginTitulo',
                     'loginTexto',  c.valor->'loginTexto',
                     'simbolo',     c.valor->'simbolo'))
                     from academia.config c
                    where c.organizacao_id = o.id and c.chave = 'aparencia'), '{}'::jsonb)
    from org join nucleo.organizacoes o on o.id = org.id
$$;

create or replace function public.escola_para_email(p_endereco text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with o as (
    select o.* from nucleo.organizacoes o
     where o.estado = 'ativa'
       and (o.slug = lower(trim(p_endereco))
            or exists (select 1 from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia'
                          and d.dominio = lower(trim(p_endereco))
                          and d.estado in ('verificado', 'ativo')))
  )
  select jsonb_build_object(
           'id', o.id, 'slug', o.slug, 'nome', o.nome,
           'kingdom', o.id = nucleo.organizacao_kingdom(),
           'dominio', (select d.dominio from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia' and d.estado = 'ativo' order by d.principal desc, d.criado_em limit 1),
           'dominios', coalesce((select jsonb_agg(d.dominio) from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia' and d.estado = 'ativo'), '[]'::jsonb),
           'respostaPara', coalesce(
              nullif(trim((select c.valor->>'respostaPara' from academia.config c where c.organizacao_id = o.id and c.chave = 'email')), ''),
              (select u.email from nucleo.membros m join public.utilizadores u on u.id = m.utilizador_id
                where m.organizacao_id = o.id and m.app = 'academia' and m.papel = 'dono' and m.estado = 'ativo'
                order by m.criado_em limit 1)))
      || coalesce((select jsonb_strip_nulls(jsonb_build_object(
                     'nomeEscola', c.valor->'nomeEscola', 'logoUrl', c.valor->'logoUrl',
                     'corAccent', c.valor->'corAccent', 'simbolo', c.valor->'simbolo',
                     'rodape', c.valor->'rodape'))
                     from academia.config c where c.organizacao_id = o.id and c.chave = 'aparencia'), '{}'::jsonb)
    from o
$$;

-- ---------------------------------------------------------------------------
-- Pedir um domínio (por dentro: a consola e a função chamam isto).

create or replace function nucleo.reservar_dominio(p_org uuid, p_dominio text, p_por uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v text := lower(trim(coalesce(p_dominio, '')));
  l nucleo.dominios;
begin
  v := split_part(regexp_replace(v, '^https?://', ''), '/', 1);
  v := trim(both '.' from v);
  if length(v) > 253 or v !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then
    raise exception 'Escreva só o domínio, sem https:// nem barras — por exemplo academia.a-sua-escola.com.';
  end if;
  if nucleo.dominio_da_plataforma(v)
     or v ~ '(^|\.)(vercel\.app|vercel\.com|vercel-dns\.com|supabase\.co|supabase\.in|localhost)$' then
    raise exception 'Esse endereço é da plataforma. Use um domínio da sua escola.';
  end if;
  if not exists (select 1 from nucleo.organizacoes where id = p_org and estado = 'ativa') then
    raise exception 'Escola não encontrada.';
  end if;

  select * into l from nucleo.dominios where dominio = v for update;
  if found then
    if l.organizacao_id = p_org and l.estado <> 'removido' then
      return to_jsonb(l);
    end if;
    if l.estado in ('verificado', 'ativo') then
      raise exception 'Esse domínio já está ligado a outra área de membros.';
    end if;
    if l.estado = 'pendente' and l.criado_em > now() - interval '7 days' then
      raise exception 'Esse domínio já foi pedido por outra área de membros. Se é seu, fale connosco.';
    end if;
    update nucleo.dominios
       set organizacao_id = p_org, app = 'academia', estado = 'pendente', principal = false,
           token = replace(gen_random_uuid()::text, '-', ''), verificacao = '{}'::jsonb,
           verificado_em = null, pedido_por = p_por, criado_em = now()
     where dominio = v
     returning * into l;
  else
    insert into nucleo.dominios (dominio, organizacao_id, app, principal, estado, token, pedido_por)
    values (v, p_org, 'academia', false, 'pendente', replace(gen_random_uuid()::text, '-', ''), p_por)
    returning * into l;
  end if;
  return to_jsonb(l);
end $$;
revoke all on function nucleo.reservar_dominio(uuid, text, uuid) from public, anon, authenticated;

-- A consola passa a pedir o domínio como uma escola: fica pendente até à prova.
create or replace function academia.consola_juntar_dominio(p_organizacao uuid, p_dominio text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  perform nucleo.reservar_dominio(p_organizacao, p_dominio, auth.uid());
end $$;

create or replace function academia.consola_criar_organizacao(p_nome text, p_slug text, p_dominio text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_slug text := lower(trim(p_slug));
  v_dom  text := nullif(lower(trim(coalesce(p_dominio, ''))), '');
  v_id   uuid;
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Falta o nome da escola.'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' then
    raise exception 'O nome curto só pode ter letras minúsculas, números e hífenes (2 a 41).';
  end if;
  if exists (select 1 from nucleo.organizacoes where slug = v_slug) then
    raise exception 'Já existe uma escola com o nome curto «%».', v_slug;
  end if;
  insert into nucleo.organizacoes (slug, nome) values (v_slug, trim(p_nome)) returning id into v_id;
  if v_dom is not null then
    perform nucleo.reservar_dominio(v_id, v_dom, auth.uid());
  end if;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;

-- A consola mostra os domínios que já abrem e, à parte, os que estão a meio.
create or replace function academia.consola_organizacoes()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'slug', o.slug, 'nome', o.nome, 'estado', o.estado, 'criadoEm', o.criado_em,
      'kingdom', o.id = nucleo.organizacao_kingdom(),
      'nomeEscola', (select c.valor->>'nomeEscola' from academia.config c
                      where c.organizacao_id = o.id and c.chave = 'aparencia'),
      'dominios', coalesce((select jsonb_agg(d.dominio order by d.principal desc, d.criado_em)
                              from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia'
                               and d.estado = 'ativo'), '[]'::jsonb),
      'dominiosPorLigar', coalesce((select jsonb_agg(jsonb_build_object('dominio', d.dominio, 'estado', d.estado) order by d.criado_em)
                              from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia'
                               and d.estado in ('pendente', 'verificado')), '[]'::jsonb),
      'alunos', (select count(*) from nucleo.membros m
                  where m.organizacao_id = o.id and m.app = 'academia' and m.papel = 'aluno' and m.estado = 'ativo'),
      'cursos', (select count(*) from academia.cursos c where c.organizacao_id = o.id and c.removido_em is null),
      'equipa', coalesce((select jsonb_agg(jsonb_build_object(
                    'id', u.id, 'nome', u.nome, 'email', u.email, 'papel', m.papel, 'estado', m.estado)
                    order by case m.papel when 'dono' then 0 when 'admin' then 1 else 2 end, u.nome)
                  from nucleo.membros m join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null
                 where m.organizacao_id = o.id and m.app = 'academia' and m.papel <> 'aluno'), '[]'::jsonb),
      'convites', coalesce((select jsonb_agg(jsonb_build_object(
                    'id', c.id, 'email', c.email, 'nome', c.nome, 'papel', c.papel, 'expiraEm', c.expira_em)
                    order by c.criado_em desc)
                  from academia.convites c
                 where c.organizacao_id = o.id and c.papel <> 'aluno'
                   and c.aceite_em is null and c.revogado_em is null and c.expira_em >= now()), '[]'::jsonb)
    ) order by o.criado_em)
    from nucleo.organizacoes o), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- O que a app lê: o domínio próprio da escola do endereço, só para a sua
-- administração (o código do TXT não é para alunos).

create or replace function academia.dominio_proprio()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  o nucleo.organizacoes;
begin
  if coalesce(academia_privado.papel_em(v_org), '') <> 'admin' and not nucleo.e_admin_plataforma() then
    raise exception 'Só a administração da escola.';
  end if;
  select * into o from nucleo.organizacoes where id = v_org;
  return jsonb_build_object(
    'organizacao', jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome),
    'enderecoPlataforma', case when o.id = nucleo.organizacao_kingdom()
                               then 'membros.kingdomcompny.com'
                               else 'membros.kingdomcompny.com/?org=' || o.slug end,
    'dominio', (select jsonb_build_object('dominio', d.dominio, 'estado', d.estado, 'token', d.token,
                                          'verificacao', d.verificacao, 'verificadoEm', d.verificado_em,
                                          'criadoEm', d.criado_em, 'principal', d.principal)
                  from nucleo.dominios d
                 where d.organizacao_id = o.id and d.app = 'academia' and d.estado <> 'removido'
                   and not nucleo.dominio_da_plataforma(d.dominio)
                 order by d.criado_em desc limit 1));
end $$;
revoke all on function academia.dominio_proprio() from public, anon;
grant execute on function academia.dominio_proprio() to authenticated;

-- ---------------------------------------------------------------------------
-- O que a função `dominio-proprio` escreve. Só o servidor.

create or replace function public.dominio_reservar(p_org uuid, p_dominio text, p_por uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select nucleo.reservar_dominio(p_org, p_dominio, p_por) $$;

create or replace function public.dominios_proprios(p_org uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(d) order by d.criado_em desc), '[]'::jsonb)
    from nucleo.dominios d
   where d.organizacao_id = p_org and d.app = 'academia' and d.estado <> 'removido'
     and not nucleo.dominio_da_plataforma(d.dominio)
$$;

-- Grava o resultado de uma verificação. Ao ficar ativo, o domínio passa a
-- principal da escola (é para ele que os links dos emails apontam).
create or replace function public.dominio_registar(p_dominio text, p_estado text, p_verificacao jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare l nucleo.dominios;
begin
  if p_estado not in ('pendente', 'verificado', 'ativo') then raise exception 'Estado inválido.'; end if;
  update nucleo.dominios
     set estado = p_estado,
         verificacao = coalesce(p_verificacao, '{}'::jsonb),
         verificado_em = case when p_estado in ('verificado', 'ativo') then coalesce(verificado_em, now()) else null end
   where dominio = lower(p_dominio) and estado <> 'removido' and not nucleo.dominio_da_plataforma(dominio)
   returning * into l;
  if not found then raise exception 'Domínio não encontrado.'; end if;
  if p_estado = 'ativo' then
    update nucleo.dominios set principal = (dominio = l.dominio)
     where organizacao_id = l.organizacao_id and app = 'academia';
  elsif l.principal then
    perform public.dominio_principal_de_recurso(l.organizacao_id, l.dominio);
  end if;
  return to_jsonb(l);
end $$;

-- Quando o principal deixa de servir: passa para outro domínio ativo da
-- escola (o da plataforma primeiro), se houver.
create or replace function public.dominio_principal_de_recurso(p_org uuid, p_sem text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v text;
begin
  update nucleo.dominios set principal = false where dominio = p_sem;
  select d.dominio into v from nucleo.dominios d
   where d.organizacao_id = p_org and d.app = 'academia' and d.estado = 'ativo' and d.dominio <> p_sem
   order by nucleo.dominio_da_plataforma(d.dominio) desc, d.criado_em limit 1;
  if v is not null then update nucleo.dominios set principal = true where dominio = v; end if;
end $$;

create or replace function public.dominio_retirar(p_dominio text)
returns void language plpgsql security definer set search_path = ''
as $$
declare l nucleo.dominios;
begin
  if nucleo.dominio_da_plataforma(p_dominio) then raise exception 'Os domínios da plataforma não se retiram por aqui.'; end if;
  update nucleo.dominios set estado = 'removido', verificacao = '{}'::jsonb, verificado_em = null
   where dominio = lower(p_dominio) and estado <> 'removido'
   returning * into l;
  if found and l.principal then perform public.dominio_principal_de_recurso(l.organizacao_id, l.dominio); end if;
end $$;

revoke all on function public.dominio_reservar(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.dominios_proprios(uuid) from public, anon, authenticated;
revoke all on function public.dominio_registar(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.dominio_principal_de_recurso(uuid, text) from public, anon, authenticated;
revoke all on function public.dominio_retirar(text) from public, anon, authenticated;
grant execute on function public.dominio_reservar(uuid, text, uuid) to service_role;
grant execute on function public.dominios_proprios(uuid) to service_role;
grant execute on function public.dominio_registar(text, text, jsonb) to service_role;
grant execute on function public.dominio_principal_de_recurso(uuid, text) to service_role;
grant execute on function public.dominio_retirar(text) to service_role;
