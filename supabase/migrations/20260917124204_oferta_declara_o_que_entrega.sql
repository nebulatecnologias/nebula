-- Migração 20260917124204 «oferta_declara_o_que_entrega», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* A oferta passa a dizer o que entrega, em vez de se adivinhar.

   Até aqui a entrega deduzia-se de sinais espalhados: uma caixa "Abrir o acesso
   à Academia ao confirmar" que alguém tinha de se lembrar de marcar, um
   link_conteudo escrito à mão, e a coluna cursos.oferta_id que existe desde o
   princípio e que quase ninguém preenchia. O resultado está à vista na base:
   cinco ofertas activas recebem dinheiro e não entregam nada sozinhas, e um
   e-book de 97 MT tem colado o link de outro produto.

   Três valores, e a diferença entre eles é o que acontece quando o pagamento
   fica confirmado:

     Academia  abre o acesso ao curso ligado, para o email do checkout
     Link      manda o endereço do conteúdo
     Nada      só regista o pagamento -- eventos presenciais, consultoria

   'Nada' é o valor por omissão de propósito: entregar de menos corrige-se com
   um email, entregar a coisa errada a quem pagou não. */

create type public.tipo_entrega as enum ('Academia', 'Link', 'Nada');

alter table public.ofertas
  add column entrega public.tipo_entrega not null default 'Nada';

comment on column public.ofertas.entrega is
  'O que a pessoa recebe quando o pagamento fica confirmado. Academia abre o '
  'curso ligado (academia.cursos.oferta_id); Link manda o endereço; Nada só '
  'regista.';

/* Preenchido a partir do que já existe, para nenhuma oferta perder o
   comportamento que tinha hoje. */
update public.ofertas o set entrega =
  case
    when exists (select 1 from academia.cursos c
                  where c.oferta_id = o.id and c.removido_em is null) then 'Academia'
    when nullif(btrim(coalesce(o.link_conteudo, '')), '') is not null  then 'Link'
    else 'Nada'
  end::public.tipo_entrega
where o.removido_em is null;

/* Uma oferta entrega UM curso. Sem isto, o confirmar-e-abrir teria de escolher
   entre dois e a escolha seria a ordem do índice -- ou seja, sorte. Parcial
   porque um curso removido não ocupa o lugar. */
create unique index cursos_uma_oferta_um_curso
  on academia.cursos (oferta_id)
  where oferta_id is not null and removido_em is null;
