-- Convites no modelo das turmas e das assinaturas, e links de inscrição
-- (passo 5 da especificação «Convites, Assinaturas e Turmas», Shelton,
-- 17/11/2026).
--
-- O CONVITE À MÃO passa a dar uma de três coisas: cursos (cada um numa
-- turma), uma assinatura, ou acesso ilimitado. Deixa de ter duração própria:
-- o prazo é o da turma, ou o trial / a extensão do nível. As colunas turmas e
-- niveis já existiam (passo 4); junta-se ilimitado.
--
-- O LINK DE INSCRIÇÃO é um convite aberto: a escola divulga um endereço, a
-- pessoa preenche nome, email e (se pedido) WhatsApp, e fica inscrita. Cada
-- inscrição é um convite como os outros (origem «link»): segue por email, e
-- é ao abri-lo que a pessoa entra e recebe o que o link dá. Assim só recebe
-- acesso quem é mesmo dono do email, e nada do que já existe para convites
-- (carta, prazo do link, entrada, aceitação) se duplica.
--
-- Nada aqui muda o acesso de quem já é membro: só se juntam colunas e uma
-- tabela, e a aceitação ganha três ramos novos (ilimitado, telefone, e não
-- reabrir por um link quem a escola suspendeu).

-- 1 O que se junta ---------------------------------------------------------------
create table academia.links_de_inscricao (
  id                   text primary key default academia.novo_id(),
  organizacao_id       uuid not null default academia_privado.organizacao() references nucleo.organizacoes(id),
  codigo               text not null unique,
  titulo               text not null,
  descricao            text,
  limite               integer check (limite is null or limite > 0),
  telefone_obrigatorio boolean not null default false,
  modalidade           text not null default 'cursos' check (modalidade in ('cursos', 'assinatura', 'ilimitado')),
  cursos               text[] not null default '{}'::text[],
  turmas               jsonb not null default '{}'::jsonb,
  nivel_id             text references academia.niveis(id),
  fundo                text,
  arquivado_em         timestamptz,
  criado_por           uuid default auth.uid() references public.utilizadores(id) on delete set null,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
create index links_de_inscricao_por_organizacao on academia.links_de_inscricao (organizacao_id);
create index links_de_inscricao_por_nivel on academia.links_de_inscricao (nivel_id) where nivel_id is not null;

alter table academia.links_de_inscricao enable row level security;
create policy links_de_inscricao_equipa on academia.links_de_inscricao for all to authenticated
  using (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa())
  with check (organizacao_id = (select academia_privado.organizacao()) and academia_privado.e_equipa());
-- Não se apagam: arquivam-se, e as inscrições ficam.
revoke all on academia.links_de_inscricao from public, anon, authenticated;
grant select, insert, update on academia.links_de_inscricao to authenticated;
grant all on academia.links_de_inscricao to service_role;

-- O convite leva o acesso ilimitado, e a inscrição de que nasceu.
alter table academia.convites
  add column ilimitado boolean not null default false,
  add column link_id   text references academia.links_de_inscricao(id),
  add column telefone  text;
alter table academia.convites drop constraint convites_origem_check;
alter table academia.convites add constraint convites_origem_check
  check (origem = any (array['manual'::text, 'pagamento'::text, 'link'::text]));
-- Uma pessoa inscreve-se uma vez em cada link.
create unique index convites_um_por_link on academia.convites (link_id, lower(email))
  where link_id is not null and revogado_em is null;

-- O telefone fica no perfil do membro no One Members.
alter table academia.perfis add column telefone text;

-- Quem tentou inscrever-se, para travar abusos (por endereço e por email).
create table academia_privado.inscricoes_tentativas (
  id        bigint generated always as identity primary key,
  ip        text,
  email     text,
  codigo    text,
  criado_em timestamptz not null default now()
);
create index inscricoes_tentativas_por_ip on academia_privado.inscricoes_tentativas (ip, criado_em);
create index inscricoes_tentativas_por_email on academia_privado.inscricoes_tentativas (email, criado_em);
alter table academia_privado.inscricoes_tentativas enable row level security;
revoke all on academia_privado.inscricoes_tentativas from public, anon, authenticated;

-- 2 Guardar um link ---------------------------------------------------------------
create or replace function academia_privado.link_validar()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  -- Sem 0, O, 1, l e I, que se confundem ao copiar à mão.
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  v_bytes bytea;
  v_codigo text;
begin
  new.titulo := btrim(coalesce(new.titulo, ''));
  if new.titulo = '' then raise exception 'O link de inscrição precisa de um título.'; end if;
  if length(new.titulo) > 160 then raise exception 'O título é demasiado longo (160 caracteres no máximo).'; end if;
  new.descricao := nullif(btrim(coalesce(new.descricao, '')), '');
  if length(coalesce(new.descricao, '')) > 4000 then raise exception 'A descrição é demasiado longa (4000 caracteres no máximo).'; end if;
  new.fundo := nullif(btrim(coalesce(new.fundo, '')), '');
  if new.fundo is not null and new.fundo !~ '^https://' then raise exception 'A imagem de fundo tem de ser um endereço https.'; end if;

  if tg_op = 'UPDATE' then
    -- O código é o endereço que já foi divulgado: nunca muda.
    new.codigo := old.codigo;
    new.organizacao_id := old.organizacao_id;
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  else
    loop
      v_bytes := extensions.gen_random_bytes(6);
      v_codigo := '';
      for i in 0..5 loop
        v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
      end loop;
      exit when not exists (select 1 from academia.links_de_inscricao l where l.codigo = v_codigo);
    end loop;
    new.codigo := v_codigo;
  end if;

  -- Só fica guardado o que a modalidade escolhida pede.
  if new.modalidade = 'cursos' then
    new.nivel_id := null;
    new.cursos := array(
      select s.c from (select x.c, min(x.o) o
                         from unnest(coalesce(new.cursos, '{}'::text[])) with ordinality as x(c, o)
                        where exists (select 1 from academia.cursos k
                                       where k.id = x.c and k.organizacao_id = new.organizacao_id and k.removido_em is null)
                        group by x.c) s
       order by s.o);
    if cardinality(new.cursos) = 0 then raise exception 'Escolha pelo menos um curso para este link.'; end if;
    new.turmas := coalesce((select jsonb_object_agg(e.key, e.value)
                              from jsonb_each_text(case when jsonb_typeof(new.turmas) = 'object' then new.turmas else '{}'::jsonb end) e
                             where e.key = any(new.cursos)
                               and exists (select 1 from academia.turmas t
                                            where t.id = e.value and t.curso_id = e.key and t.removido_em is null)), '{}'::jsonb);
  elsif new.modalidade = 'assinatura' then
    if not exists (select 1 from academia.niveis n
                    where n.id = new.nivel_id and n.organizacao_id = new.organizacao_id and n.removido_em is null) then
      raise exception 'Escolha a assinatura que este link dá.';
    end if;
    new.cursos := '{}'::text[];
    new.turmas := '{}'::jsonb;
  else
    new.cursos := '{}'::text[];
    new.turmas := '{}'::jsonb;
    new.nivel_id := null;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke execute on function academia_privado.link_validar() from public, anon, authenticated;

create trigger link_validar before insert or update on academia.links_de_inscricao
  for each row execute function academia_privado.link_validar();

-- 3 O estado de um link, para quem o abre ------------------------------------------
-- aberto, arquivado, esgotado (chegou ao limite) ou indisponivel (já não tem
-- nada para dar: os cursos ou a assinatura saíram). Uma inscrição conta para
-- o limite enquanto está viva: aceite, ou ainda dentro do prazo do link dela.
create or replace function academia_privado.link_estado(p_id text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when l.arquivado_em is not null then 'arquivado'
    when l.modalidade = 'cursos' and not exists (
           select 1 from academia.cursos c
            where c.id = any(l.cursos) and c.organizacao_id = l.organizacao_id and c.removido_em is null) then 'indisponivel'
    when l.modalidade = 'assinatura' and not exists (
           select 1 from academia.niveis n
            where n.id = l.nivel_id and n.organizacao_id = l.organizacao_id and n.removido_em is null) then 'indisponivel'
    when l.limite is not null and (
           select count(*) from academia.convites c
            where c.link_id = l.id and c.revogado_em is null
              and (c.aceite_em is not null or c.expira_em >= now())) >= l.limite then 'esgotado'
    else 'aberto' end
  from academia.links_de_inscricao l
  where l.id = p_id
$$;
revoke execute on function academia_privado.link_estado(text) from public, anon, authenticated;

-- O que a página pública mostra: o texto, a imagem e se ainda aceita
-- inscrições. Mais nada do link sai daqui.
create or replace function public.link_de_inscricao(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
           'codigo', l.codigo, 'titulo', l.titulo, 'descricao', l.descricao, 'fundo', l.fundo,
           'telefoneObrigatorio', l.telefone_obrigatorio,
           'escola', o.slug,
           'estado', academia_privado.link_estado(l.id))
    from academia.links_de_inscricao l
    join nucleo.organizacoes o on o.id = l.organizacao_id and o.estado = 'ativa'
   where l.codigo = p_codigo
$$;
revoke execute on function public.link_de_inscricao(text) from public;
grant execute on function public.link_de_inscricao(text) to anon, authenticated, service_role;

-- 4 Inscrever-se ---------------------------------------------------------------------
-- Só o servidor (a função inscricao) chama isto, depois de conferir o captcha.
-- Devolve o convite a mandar por email, ou a razão de não haver inscrição.
-- O limite é respeitado mesmo com pedidos ao mesmo tempo: a linha do link
-- fica presa enquanto se conta e se grava.
create or replace function public.inscricao_registar(
  p_codigo text, p_nome text, p_email text, p_telefone text, p_idioma text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  l          academia.links_de_inscricao;
  c          academia.convites;
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_nome     text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_telefone text := nullif(regexp_replace(coalesce(p_telefone, ''), '[\s().-]', '', 'g'), '');
  v_idioma   text := case when p_idioma = 'en' then 'en' else 'pt' end;
  v_ip       text := nullif(btrim(coalesce(p_ip, '')), '');
  v_slug     text;
  v_estado   text;
  v_conta    uuid;
  v_vagas    jsonb;
  v_reenvio  boolean := false;
begin
  -- Travões: por endereço (20 por hora) e por email (3 em dez minutos).
  delete from academia_privado.inscricoes_tentativas t where t.criado_em < now() - interval '2 days';
  if v_ip is not null and (select count(*) from academia_privado.inscricoes_tentativas t
                            where t.ip = v_ip and t.criado_em > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('estado', 'muitas');
  end if;
  if v_email <> '' and (select count(*) from academia_privado.inscricoes_tentativas t
                         where t.email = v_email and t.criado_em > now() - interval '10 minutes') >= 3 then
    return jsonb_build_object('estado', 'muitas');
  end if;
  insert into academia_privado.inscricoes_tentativas (ip, email, codigo) values (v_ip, nullif(v_email, ''), left(coalesce(p_codigo, ''), 20));

  select * into l from academia.links_de_inscricao x where x.codigo = p_codigo for update;
  if not found then return jsonb_build_object('estado', 'inexistente'); end if;
  select o.slug into v_slug from nucleo.organizacoes o where o.id = l.organizacao_id and o.estado = 'ativa';
  if v_slug is null then return jsonb_build_object('estado', 'inexistente'); end if;

  if v_nome = '' or length(v_nome) > 120 then return jsonb_build_object('estado', 'invalido', 'campo', 'nome'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then return jsonb_build_object('estado', 'invalido', 'campo', 'email'); end if;
  if v_telefone is not null and v_telefone !~ '^\+[0-9]{8,15}$' then return jsonb_build_object('estado', 'invalido', 'campo', 'telefone'); end if;
  if l.telefone_obrigatorio and v_telefone is null then return jsonb_build_object('estado', 'invalido', 'campo', 'telefone'); end if;

  v_estado := academia_privado.link_estado(l.id);
  if v_estado in ('arquivado', 'indisponivel') then return jsonb_build_object('estado', v_estado); end if;

  -- Quem a escola suspendeu, ou uma conta desligada, não reabre por um link.
  -- A resposta é a de sempre: não se diz a ninguém se um email tem conta.
  select u.id into v_conta from public.utilizadores u where lower(u.email) = v_email limit 1;
  if v_conta is not null and (
       exists (select 1 from public.utilizadores u where u.id = v_conta and (u.removido_em is not null or u.estado::text <> 'Ativo'))
    or exists (select 1 from nucleo.membros m where m.organizacao_id = l.organizacao_id and m.utilizador_id = v_conta
                                               and m.app = 'academia' and m.estado <> 'ativo')) then
    return jsonb_build_object('estado', 'ok', 'enviar', false);
  end if;

  -- Já se inscreveu neste link: não gasta outra vaga.
  select * into c from academia.convites x
   where x.link_id = l.id and lower(x.email) = v_email and x.revogado_em is null;
  if found then
    if c.aceite_em is not null then
      return jsonb_build_object('estado', 'ok', 'enviar', false, 'ja', true, 'email', c.email, 'nome', coalesce(c.nome, v_nome),
                                'lingua', coalesce(c.idioma, v_idioma), 'escola', v_slug);
    end if;
    -- Ainda não entrou: o mesmo link volta a seguir, com mais sete dias. Se o
    -- prazo já tinha passado, a vaga tinha ficado livre: confere-se o limite.
    if c.expira_em < now() and v_estado = 'esgotado' then return jsonb_build_object('estado', 'esgotado'); end if;
    update academia.convites x
       set expira_em = now() + interval '7 days', nome = v_nome, telefone = coalesce(v_telefone, x.telefone), idioma = v_idioma
     where x.id = c.id returning * into c;
    v_reenvio := true;
  else
    if v_estado = 'esgotado' then return jsonb_build_object('estado', 'esgotado'); end if;
    -- O limite de alunos do plano da escola vale aqui como nos convites à mão
    -- (quem já é aluno ativo dela não conta outra vez).
    v_vagas := public.escola_vagas(l.organizacao_id);
    if (v_vagas->>'limite') is not null
       and (v_vagas->>'ativos')::int + (v_vagas->>'pendentes')::int >= (v_vagas->>'limite')::int
       and not exists (select 1 from nucleo.membros m where m.organizacao_id = l.organizacao_id and m.utilizador_id = v_conta
                                                       and m.app = 'academia' and m.estado = 'ativo') then
      return jsonb_build_object('estado', 'esgotado', 'plano', true);
    end if;
    insert into academia.convites (email, nome, cursos, turmas, niveis, ilimitado, origem, link_id, telefone,
                                   idioma, papel, organizacao_id, criado_por, expira_em)
    values (v_email, v_nome,
            case when l.modalidade = 'cursos' then l.cursos else '{}'::text[] end,
            case when l.modalidade = 'cursos' then l.turmas else '{}'::jsonb end,
            case when l.modalidade = 'assinatura' then array[l.nivel_id] else '{}'::text[] end,
            l.modalidade = 'ilimitado', 'link', l.id, v_telefone,
            v_idioma, 'aluno', l.organizacao_id, l.criado_por, now() + interval '7 days')
    returning * into c;
  end if;

  return jsonb_build_object('estado', 'ok', 'enviar', true, 'reenvio', v_reenvio, 'convite', c.id, 'token', c.token,
                            'email', c.email, 'nome', c.nome, 'lingua', c.idioma, 'expiraEm', c.expira_em, 'escola', v_slug);
end $$;
revoke execute on function public.inscricao_registar(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.inscricao_registar(text, text, text, text, text, text) to service_role;

-- 5 Entrar por um convite ------------------------------------------------------------
-- Como estava (passo 4), mais: o acesso ilimitado, o telefone no perfil (só
-- se ainda não houver), e um convite que veio de um link não reabre quem a
-- escola suspendeu.
create or replace function academia.aceitar_convite()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email   text;
  v_convite academia.convites%rowtype;
  v_curso   text;
  v_nivel   text;
  v_turma   academia.turmas%rowtype;
  v_dias    integer;
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
    -- Um link público não é a equipa a convidar: quem está suspenso fica.
    if v_convite.origem = 'link' and exists (
         select 1 from nucleo.membros m
          where m.organizacao_id = v_convite.organizacao_id and m.utilizador_id = auth.uid()
            and m.app = 'academia' and m.estado <> 'ativo') then
      continue;
    end if;

    insert into nucleo.membros (organizacao_id, utilizador_id, app, papel)
    values (v_convite.organizacao_id, auth.uid(), 'academia', v_convite.papel)
    on conflict (organizacao_id, utilizador_id, app) do update
      set papel = case
            when nucleo.membros.papel = 'dono' then 'dono'
            when excluded.papel = 'aluno' then nucleo.membros.papel
            else excluded.papel end,
          estado = 'ativo';

    -- Os cursos: cada um na turma que o convite leva (sem ela, a padrão).
    foreach v_curso in array coalesce(v_convite.cursos, '{}'::text[]) loop
      if exists (select 1 from academia.cursos c
                  where c.id = v_curso and c.removido_em is null
                    and c.organizacao_id = v_convite.organizacao_id) then
        select t.* into v_turma from academia.turmas t
         where t.curso_id = v_curso and t.removido_em is null
           and (t.id = v_convite.turmas->>v_curso or t.padrao)
         order by coalesce(t.id = v_convite.turmas->>v_curso, false) desc
         limit 1;
        -- O prazo conta do dia em que a pessoa entra: o que o convite disser
        -- (os de antes); senão, o da turma.
        v_dias := coalesce(v_convite.acesso_dias, v_turma.prazo_dias);
        insert into academia.acessos (utilizador_id, curso_id, origem, nota, turma_id, expira_em)
        values (auth.uid(), v_curso, 'convite', 'Convite ' || v_convite.id, v_turma.id,
                case when v_dias is not null then current_date + v_dias end)
        on conflict (utilizador_id, curso_id) do nothing;
        v_n := v_n + 1;
      end if;
    end loop;

    -- As assinaturas. Num convite que veio de uma compra, a data é a da
    -- extensão do nível; num convite dado pela equipa ou por um link, o trial
    -- se houver, senão a extensão, senão sem prazo. Quem já a tem ativa fica
    -- como está.
    foreach v_nivel in array coalesce(v_convite.niveis, '{}'::text[]) loop
      select case when v_convite.origem = 'pagamento' then n.extensao_dias
                  else coalesce(n.trial_dias, n.extensao_dias) end
        into v_dias
        from academia.niveis n
       where n.id = v_nivel and n.organizacao_id = v_convite.organizacao_id and n.removido_em is null;
      if found then
        insert into academia.assinaturas as s (organizacao_id, utilizador_id, nivel_id, estado, expira_em, origem, nota)
        values (v_convite.organizacao_id, auth.uid(), v_nivel, 'ativo',
                case when v_dias is not null then current_date + v_dias end, 'convite', 'Convite ' || v_convite.id)
        on conflict (utilizador_id, nivel_id) do update
          set estado = 'ativo', expira_em = excluded.expira_em, iniciado_em = now(),
              origem = 'convite', nota = excluded.nota, atualizado_em = now()
          where not (s.estado = 'ativo' and (s.expira_em is null or s.expira_em >= current_date));
        v_n := v_n + 1;
      end if;
    end loop;

    -- O acesso ilimitado: tudo o que a escola tem publicado, e o que vier.
    if v_convite.ilimitado then
      insert into academia.acessos_ilimitados (organizacao_id, utilizador_id, concedido_por)
      values (v_convite.organizacao_id, auth.uid(), v_convite.criado_por)
      on conflict (organizacao_id, utilizador_id) do nothing;
      v_n := v_n + 1;
    end if;

    -- O telefone que a pessoa deu ao inscrever-se: só se o perfil não tiver um.
    if nullif(v_convite.telefone, '') is not null then
      insert into academia.perfis as p (utilizador_id, telefone)
      values (auth.uid(), v_convite.telefone)
      on conflict (utilizador_id) do update
        set telefone = excluded.telefone
        where nullif(p.telefone, '') is null;
    end if;

    update academia.convites
       set aceite_em = now(), aceite_por = auth.uid()
     where id = v_convite.id;
  end loop;

  return v_n;
end;
$function$;
