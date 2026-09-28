-- Fase 5 do plano da Academia (pedido do Shelton a 27/09/2026): comunidades.
-- Aplicada em produção a 28/09/2026, com prova em transacção desfeita (duas
-- alunas fictícias): a inscrita na oferta A vê o grupo A e o geral, com o
-- link; não vê o B nem o desligado; não cria nem altera; a sem inscrição vê
-- só o geral; o anónimo não chega ao esquema; um link sem https é recusado.
--
-- O chat interno sai (decisão do Shelton); as conversas vivem nos grupos de
-- cada programa, no WhatsApp, no Telegram ou noutro sítio. A Academia mostra
-- a lista desses grupos, cada um com o seu link.
--
-- O LINK É O SEGREDO. Um convite de grupo de WhatsApp deixa entrar quem o
-- tiver; por isso a linha inteira, link incluído, só se lê por quem tem
-- inscrição numa das ofertas da comunidade (tem_oferta: a mesma regra das
-- salas dos eventos, que já trava quem tem uma parcela em atraso), ou por
-- qualquer aluno activo quando a comunidade é marcada «todos». A equipa lê
-- e escreve tudo. Sem oferta e sem «todos», nenhum aluno a vê.
--
-- As mensagens do chat antigo (academia.mensagens) ficam onde estão.

create table if not exists academia.comunidades (
  id            text primary key default academia.novo_id(),
  nome          text not null check (length(trim(nome)) > 0),
  descricao     text,
  canal         text not null default 'whatsapp' check (canal in ('whatsapp', 'telegram', 'outro')),
  link          text not null check (link ~ '^https://'),
  imagem_url    text,
  ofertas       bigint[] not null default '{}',
  todos         boolean not null default false,
  ativa         boolean not null default true,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  removido_em   timestamptz
);

comment on table academia.comunidades is
  'Os grupos de cada programa (WhatsApp, Telegram, outro). A linha, e com ela o link, só se lê por quem tem inscrição numa das ofertas, ou por todos os alunos activos quando todos = true.';
comment on column academia.comunidades.ofertas is 'Ofertas (public.ofertas.id) cujos inscritos vêem esta comunidade.';
comment on column academia.comunidades.todos is 'Aberta a qualquer aluno activo da Academia, com ou sem oferta.';

create trigger t_toque_comunidades before update on academia.comunidades
  for each row execute function academia.toque_atualizado();

alter table academia.comunidades enable row level security;
alter table academia.comunidades force row level security;

create policy comunidades_leitura on academia.comunidades for select to authenticated
  using (
    academia_privado.e_equipa()
    or (ativa and removido_em is null
        and ((todos and academia_privado.perfil() is not null)
             or exists (select 1 from unnest(ofertas) as o(id) where academia_privado.tem_oferta(o.id))))
  );

create policy comunidades_escrita on academia.comunidades for all to authenticated
  using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

revoke all on academia.comunidades from anon, public;
grant select, insert, update, delete on academia.comunidades to authenticated;
