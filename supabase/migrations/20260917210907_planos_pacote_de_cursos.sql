-- Migração 20260917210907 «planos_pacote_de_cursos», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* Um plano e um conjunto de cursos com nome, entregue por uma oferta.

   Ate aqui uma oferta so podia entregar UM curso. Isso chega para o 10X
   Mindset, mas nao para a "Assinatura da Plataforma" nem para o Tracktion --
   coisas que se vendem como acesso a varias coisas ao mesmo tempo.

   AS DUAS FORMAS, decididas pela cobranca da oferta e nao por um campo a
   parte -- um campo a parte podia contradizer o preco:

     Cobranca unica     acesso permanente, expira_em fica a null
     Recorrente mensal  acesso enquanto estiver pago; cada pagamento
                        confirmado empurra o expira_em um mes para a frente

   A parte boa e que o portao ja existe e ja esta testado: o
   academia_privado.tem_acesso() ja respeita o expira_em desde sempre, e
   ninguem o usava. O que faltava era quem escrevesse as datas.

   O plano vive no esquema academia porque e um agrupamento de CONTEUDO -- os
   cursos sao de la. Quem decide que oferta o entrega e o Payflow, pela coluna
   oferta_id, do mesmo modo que ja acontece com os cursos. */

create table academia.planos (
  id            text primary key,
  nome          text not null,
  descricao     text,
  oferta_id     bigint references public.ofertas(id) on delete set null,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  removido_em   timestamptz
);

comment on table academia.planos is
  'Um conjunto de cursos com nome, entregue por uma oferta. O acesso e '
  'permanente ou expira com a assinatura, conforme a cobranca da oferta.';

/* Uma oferta entrega um plano so, pela mesma razao que entrega um curso so:
   senao quem abre o acesso tinha de escolher entre dois, e a escolha seria a
   ordem do indice. */
create unique index planos_uma_oferta_um_plano
  on academia.planos (oferta_id)
  where oferta_id is not null and removido_em is null;

create table academia.plano_cursos (
  plano_id  text not null references academia.planos(id) on delete cascade,
  curso_id  text not null references academia.cursos(id) on delete cascade,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now(),
  primary key (plano_id, curso_id)
);

create index plano_cursos_curso on academia.plano_cursos (curso_id);

/* Um curso pode estar em varios planos -- e essa e a diferenca para a coluna
   cursos.oferta_id, que so aceita um dono. Um curso pode ser vendido sozinho
   E fazer parte do pacote. */

alter table academia.planos       enable row level security;
alter table academia.plano_cursos enable row level security;

/* Leitura aberta a quem entrou: um plano e catalogo, e a Vitrine precisa de o
   mostrar a quem ainda nao o comprou. O que ele da -- as aulas -- continua
   fechado pelas politicas de 'modulos' e 'aulas'. */
create policy planos_leitura on academia.planos
  for select using (removido_em is null or academia_privado.e_equipa());
create policy planos_escrita on academia.planos
  for all using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

create policy plano_cursos_leitura on academia.plano_cursos
  for select using (true);
create policy plano_cursos_escrita on academia.plano_cursos
  for all using (academia_privado.e_equipa()) with check (academia_privado.e_equipa());

grant select on academia.planos, academia.plano_cursos to authenticated;
grant all    on academia.planos, academia.plano_cursos to service_role;

/* A entrega ganha o quarto valor. */
alter type public.tipo_entrega add value if not exists 'Plano';
