-- A consola da plataforma (pedido do Shelton a 01/10/2026): quem gere as
-- escolas, e com que funções.
--
--   nucleo.administradores_plataforma  quem administra a PLATAFORMA. Não é
--      papel numa escola: ser superadministrador não faz de ninguém equipa
--      nem aluno de escola nenhuma, e administrar a Kingdom não dá a consola.
--   academia.consola_*  o que a página /consola pede. Todas exigem
--      superadministrador. Contam alunos e cursos, mas não mostram dados de
--      alunos: o nome e o email só da equipa de cada escola.
--   academia.convites.papel  um convite pode ser para a equipa (dono, admin,
--      colaborador) e não só para aluno; aceitá-lo faz da pessoa membro da
--      escola do convite, com esse papel.
--   academia.meu_papel_em(org)  o papel de quem chama numa escola dada, para
--      a função do convite (que corre fora do endereço da escola).
--   ponte do perfil  uma conta nova só entra na Kingdom se não foi convidada
--      apenas para outra escola; e mudar o estado de uma conta que não é da
--      Kingdom não a mete na Kingdom.
--
-- Aplicada por execute_sql e registada à mão.

set lock_timeout = '10s';

create table nucleo.administradores_plataforma (
  utilizador_id uuid primary key references auth.users(id) on delete cascade,
  criado_em     timestamptz not null default now()
);
alter table nucleo.administradores_plataforma enable row level security;
alter table nucleo.administradores_plataforma force row level security;
grant all on nucleo.administradores_plataforma to service_role;

insert into nucleo.administradores_plataforma (utilizador_id)
select id from public.utilizadores where id = '7f2bcba7-34cb-4273-aa00-70549fd472b2';

create or replace function nucleo.e_admin_plataforma()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from nucleo.administradores_plataforma a
                   join public.utilizadores u on u.id = a.utilizador_id
                                             and u.removido_em is null and u.estado = 'Ativo'
                  where a.utilizador_id = auth.uid())
$$;
revoke all on function nucleo.e_admin_plataforma() from public, anon;
grant execute on function nucleo.e_admin_plataforma() to authenticated;

/* ---------- convites para a equipa ---------- */
alter table academia.convites add column papel text not null default 'aluno'
  check (papel in ('aluno', 'colaborador', 'admin', 'dono'));

create or replace function academia.aceitar_convite()
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  v_email   text;
  v_convite academia.convites%rowtype;
  v_curso   text;
  v_n       integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(u.email) into v_email
  from public.utilizadores u
  where u.id = auth.uid() and u.removido_em is null and u.estado = 'Ativo';

  if v_email is null then
    return 0;
  end if;

  for v_convite in
    select * from academia.convites
    where lower(email) = v_email
      and aceite_em is null
      and revogado_em is null
      and expira_em >= now()
  loop
    /* A pessoa passa a ser membro da escola do convite, com o papel dele.
       Um convite de equipa nunca baixa o papel de quem já lá está acima. */
    insert into nucleo.membros (organizacao_id, utilizador_id, app, papel)
    values (v_convite.organizacao_id, auth.uid(), 'academia', v_convite.papel)
    on conflict (organizacao_id, utilizador_id, app) do update
      set papel = case
            when nucleo.membros.papel = 'dono' then 'dono'
            when excluded.papel = 'aluno' then nucleo.membros.papel
            else excluded.papel end,
          estado = 'ativo';

    foreach v_curso in array coalesce(v_convite.cursos, '{}'::text[]) loop
      if exists (select 1 from academia.cursos c
                  where c.id = v_curso and c.removido_em is null
                    and c.organizacao_id = v_convite.organizacao_id) then
        insert into academia.acessos (utilizador_id, curso_id, origem, nota)
        values (auth.uid(), v_curso, 'convite', 'Convite ' || v_convite.id)
        on conflict (utilizador_id, curso_id) do nothing;
        v_n := v_n + 1;
      end if;
    end loop;

    update academia.convites
       set aceite_em = now(), aceite_por = auth.uid()
     where id = v_convite.id;
  end loop;

  return v_n;
end;
$$;

create or replace function academia.meu_papel_em(p_organizacao uuid)
returns text language sql stable security definer set search_path = ''
as $$ select academia_privado.papel_em(p_organizacao) $$;
revoke all on function academia.meu_papel_em(uuid) from public, anon;
grant execute on function academia.meu_papel_em(uuid) to authenticated;

/* ---------- a ponte do perfil ---------- */
create or replace function nucleo.ponte_do_perfil()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := nucleo.organizacao_kingdom();
  v_na_kingdom boolean;
begin
  if v_org is null then return new; end if;
  if new.removido_em is not null then
    update nucleo.membros set estado = 'suspenso'
     where organizacao_id = v_org and utilizador_id = new.id and app = 'academia';
    return new;
  end if;
  if not exists (select 1 from auth.users where id = new.id) then return new; end if;

  v_na_kingdom := exists (select 1 from nucleo.membros
                           where organizacao_id = v_org and utilizador_id = new.id and app = 'academia');

  if not v_na_kingdom then
    /* Uma conta que nasce de um convite só de outra escola não é da Kingdom. */
    if tg_op = 'INSERT' and exists (
         select 1 from academia.convites c
          where lower(c.email) = lower(new.email) and c.aceite_em is null and c.revogado_em is null
            and c.organizacao_id <> v_org)
       and not exists (
         select 1 from academia.convites c
          where lower(c.email) = lower(new.email) and c.aceite_em is null and c.revogado_em is null
            and c.organizacao_id = v_org) then
      return new;
    end if;
    /* Mudar o estado de quem não é da Kingdom não o mete lá; só passar a
       equipa no painel (que é da Kingdom) o faz. */
    if tg_op = 'UPDATE' and new.perfil::text = 'aluno' then
      return new;
    end if;
  end if;

  insert into nucleo.membros (organizacao_id, utilizador_id, app, papel, estado)
  values (v_org, new.id, 'academia', new.perfil::text,
          case when new.estado::text = 'Ativo' then 'ativo' else 'suspenso' end)
  on conflict (organizacao_id, utilizador_id, app) do update
    set papel = case when nucleo.membros.papel = 'dono' then 'dono' else excluded.papel end,
        estado = excluded.estado;
  return new;
end $$;

/* ---------- a marca diz também o id e o endereço da escola ---------- */
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
                             and d.dominio = lower(trim(p_endereco))))),
      nucleo.organizacao_kingdom()) as id
  )
  select jsonb_build_object('id', o.id, 'slug', o.slug, 'nome', o.nome,
           'dominio', (select d.dominio from nucleo.dominios d
                        where d.organizacao_id = o.id and d.app = 'academia'
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

/* ---------- a consola ---------- */
create or replace function academia.consola_sou_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select nucleo.e_admin_plataforma() $$;

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
                              from nucleo.dominios d where d.organizacao_id = o.id and d.app = 'academia'), '[]'::jsonb),
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
  if v_dom is not null and (v_dom !~ '^[a-z0-9.-]+\.[a-z]{2,}$' or exists (select 1 from nucleo.dominios where dominio = v_dom)) then
    raise exception 'O domínio «%» não é válido ou já está em uso.', v_dom;
  end if;
  insert into nucleo.organizacoes (slug, nome) values (v_slug, trim(p_nome)) returning id into v_id;
  if v_dom is not null then
    insert into nucleo.dominios (dominio, organizacao_id, app, principal) values (v_dom, v_id, 'academia', true);
  end if;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;

create or replace function academia.consola_mudar_estado(p_organizacao uuid, p_estado text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if p_estado not in ('ativa', 'suspensa') then raise exception 'Estado inválido.'; end if;
  if p_organizacao = nucleo.organizacao_kingdom() then raise exception 'A Kingdom não se suspende pela consola.'; end if;
  update nucleo.organizacoes set estado = p_estado where id = p_organizacao;
  if not found then raise exception 'Escola não encontrada.'; end if;
end $$;

create or replace function academia.consola_juntar_dominio(p_organizacao uuid, p_dominio text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_dom text := lower(trim(coalesce(p_dominio, '')));
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if v_dom !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Domínio inválido.'; end if;
  if exists (select 1 from nucleo.dominios where dominio = v_dom) then raise exception 'Esse domínio já está em uso.'; end if;
  insert into nucleo.dominios (dominio, organizacao_id, app, principal)
  values (v_dom, p_organizacao, 'academia',
          not exists (select 1 from nucleo.dominios where organizacao_id = p_organizacao and app = 'academia'));
end $$;

/* Mudar o papel ou suspender alguém da equipa de uma escola. Na Kingdom a
   equipa gere-se no painel de gestão (a ponte do perfil passaria por cima). */
create or replace function academia.consola_mudar_membro(p_organizacao uuid, p_utilizador uuid, p_papel text, p_ativo boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  if p_organizacao = nucleo.organizacao_kingdom() then
    raise exception 'Na Kingdom, a equipa gere-se no painel de gestão.';
  end if;
  if p_papel not in ('dono', 'admin', 'colaborador', 'aluno') then raise exception 'Papel inválido.'; end if;
  update nucleo.membros set papel = p_papel, estado = case when p_ativo then 'ativo' else 'suspenso' end
   where organizacao_id = p_organizacao and utilizador_id = p_utilizador and app = 'academia';
  if not found then raise exception 'Essa pessoa não é membro desta escola.'; end if;
end $$;

/* Revogar um convite de equipa ainda por aceitar. */
create or replace function academia.consola_revogar_convite(p_convite text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not nucleo.e_admin_plataforma() then raise exception 'Só a administração da plataforma.'; end if;
  update academia.convites set revogado_em = now()
   where id = p_convite and aceite_em is null and revogado_em is null;
end $$;

revoke all on function academia.consola_sou_admin(), academia.consola_organizacoes(),
  academia.consola_criar_organizacao(text, text, text), academia.consola_mudar_estado(uuid, text),
  academia.consola_juntar_dominio(uuid, text), academia.consola_mudar_membro(uuid, uuid, text, boolean),
  academia.consola_revogar_convite(text) from public, anon;
grant execute on function academia.consola_sou_admin(), academia.consola_organizacoes(),
  academia.consola_criar_organizacao(text, text, text), academia.consola_mudar_estado(uuid, text),
  academia.consola_juntar_dominio(uuid, text), academia.consola_mudar_membro(uuid, uuid, text, boolean),
  academia.consola_revogar_convite(text) to authenticated;
