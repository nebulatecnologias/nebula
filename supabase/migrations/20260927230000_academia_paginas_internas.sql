-- Fase 2 do plano da Academia (PLANO.md, secção «Academia»), 27/09/2026.
--
-- 1) BANNERS LEVAM A UMA PÁGINA DENTRO DA ACADEMIA
--    Decidido pelo Shelton: cada banner aponta para um evento, um curso, uma
--    oferta, ou uma página própria (título, resumo, imagem, botão, link). Só o
--    botão dessa página leva para fora.
--
-- 2) O LINK DA SALA SAI DA TABELA DOS EVENTOS
--    Se um evento se vende, o link da sala é o que se compra. Estava numa
--    coluna que qualquer aluno que visse o evento lia. Passa para
--    academia.salas, com uma regra própria: a equipa, e quem pode ver o evento
--    -- e, num evento pago, só quem tem inscrição viva na oferta que o vende.
--
-- 3) UM EVENTO PAGO VÊ-SE ANTES DE SE COMPRAR
--    Até aqui a oferta de um evento limitava quem o via. Num evento pago a
--    oferta é o bilhete: tem de ser visto por quem ainda não o tem, senão não
--    se vende. Nesses, quem vê decide-se só pelos cursos.

-- ---------- 1) banners ----------
alter table academia.banners
  add column if not exists destino_tipo text,
  add column if not exists destino_id   text,
  add column if not exists resumo       text;

update academia.banners set destino_tipo = 'pagina' where destino_tipo is null;

alter table academia.banners
  alter column destino_tipo set default 'pagina',
  alter column destino_tipo set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'banners_destino_tipo_check') then
    alter table academia.banners add constraint banners_destino_tipo_check
      check (destino_tipo in ('evento','curso','oferta','pagina'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'banners_destino_id_check') then
    alter table academia.banners add constraint banners_destino_id_check
      check (destino_tipo = 'pagina' or destino_id is not null);
  end if;
end $$;

comment on column academia.banners.destino_tipo is 'evento | curso | oferta | pagina: para onde o banner leva, dentro da Academia';
comment on column academia.banners.destino_id   is 'O id do evento, do curso ou da oferta. Vazio numa página própria.';
comment on column academia.banners.resumo       is 'O texto da página própria do banner.';

-- ---------- a inscrição viva numa oferta ----------
-- A mesma regra do tem_acesso(): estado vivo e sem parcela atrasada há mais
-- de 7 dias. Serve os eventos pagos e, na fase 5, as comunidades.
create or replace function academia_privado.tem_oferta(p_oferta bigint)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select p_oferta is not null and exists (
    select 1
      from public.turmas t
      join public.inscricoes i on i.turma_id = t.id and i.removido_em is null
     where t.oferta_id = p_oferta and t.removido_em is null
       and i.lead_id in (select academia_privado.leads_do_utilizador())
       and i.estado::text in ('Não iniciada','Em curso','Concluída')
       and not exists (
             select 1 from public.lancamentos l
              where l.inscricao_id = i.id
                and l.tipo = 'Entrada' and l.estado = 'Pendente'
                and l.removido_em is null and l.vencimento_acordado
                and l.data < current_date - 7
           )
  )
$$;
revoke execute on function academia_privado.tem_oferta(bigint) from public, anon;
grant  execute on function academia_privado.tem_oferta(bigint) to authenticated;

-- ---------- 3) quem vê um evento ----------
create or replace function academia_privado.ve_evento(p_oferta bigint, p_cursos text[], p_acesso text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select academia_privado.e_equipa()
      or case when p_acesso = 'pago' then
                -- a oferta é o bilhete: não decide quem vê
                coalesce(array_length(p_cursos, 1), 0) = 0
                or exists (select 1 from unnest(p_cursos) as c where academia_privado.tem_acesso(c))
              else
                (p_oferta is null and coalesce(array_length(p_cursos, 1), 0) = 0)
                or exists (select 1 from unnest(coalesce(p_cursos, '{}'::text[])) as c where academia_privado.tem_acesso(c))
                or academia_privado.tem_oferta(p_oferta)
         end
$$;
revoke execute on function academia_privado.ve_evento(bigint, text[], text) from public, anon;
grant  execute on function academia_privado.ve_evento(bigint, text[], text) to authenticated;

drop policy if exists eventos_leitura on academia.eventos;
create policy eventos_leitura on academia.eventos
  for select using (academia_privado.ve_evento(oferta_id, cursos, acesso));

drop function if exists academia_privado.ve_evento(bigint, text[]);

-- ---------- 2) a sala ----------
create table if not exists academia.salas (
  evento_id     text primary key references academia.eventos(id) on delete cascade,
  link          text not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table academia.salas is 'O link de entrada de cada evento. Num evento pago, é o que se compra.';

alter table academia.salas enable row level security;

create or replace function academia_privado.entra_na_sala(p_evento text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select academia_privado.e_equipa() or exists (
    select 1 from academia.eventos e
     where e.id = p_evento
       and academia_privado.ve_evento(e.oferta_id, e.cursos, e.acesso)
       and (e.acesso <> 'pago' or academia_privado.tem_oferta(e.oferta_id))
  )
$$;
revoke execute on function academia_privado.entra_na_sala(text) from public, anon;
grant  execute on function academia_privado.entra_na_sala(text) to authenticated;

drop policy if exists salas_leitura on academia.salas;
create policy salas_leitura on academia.salas
  for select using (academia_privado.entra_na_sala(evento_id));
drop policy if exists salas_escrita on academia.salas;
create policy salas_escrita on academia.salas
  for all using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

grant select, insert, update, delete on academia.salas to authenticated;
grant all on academia.salas to service_role;

drop trigger if exists t_toque_salas on academia.salas;
create trigger t_toque_salas before update on academia.salas
  for each row execute function academia.toque_atualizado();

insert into academia.salas (evento_id, link)
  select id, link from academia.eventos where link is not null and link <> ''
  on conflict (evento_id) do nothing;

alter table academia.eventos drop column if exists link;
