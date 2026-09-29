/* Convites com prazo, e com o que aconteceu a cada um.

   Até aqui o convite tinha uma data de fim (`expira_em`, 30 dias por omissão)
   que ninguém via, e o link que ia no email era o do Supabase, que morre em
   horas, fosse qual fosse essa data. Agora o email leva o token do convite
   (`membros.…/?convite=<token>`) e a função `convite-entrar` só gera o link de
   entrada quando a pessoa o abre, e só se o convite ainda valer. O prazo que a
   equipa escolhe passa a ser o prazo verdadeiro.

   - `aberto_em`: a primeira vez que alguém abriu o link (estado «Aberto»).
   - `revogado_em`: revogar deixa de apagar a linha; o convite fica, parado,
     e deixa de dar entrada e cursos.
   - `idioma`: a língua em que o email saiu, para o reenvio sair na mesma.
   - `origem`: 'manual' (a equipa, no painel) ou 'pagamento' (a ponte). */

alter table academia.convites
  add column if not exists aberto_em   timestamptz,
  add column if not exists revogado_em timestamptz,
  add column if not exists idioma      text check (idioma in ('pt', 'en')),
  add column if not exists origem      text not null default 'manual'
                                       check (origem in ('manual', 'pagamento'));

alter table academia.convites alter column expira_em set default now() + interval '7 days';

/* A ponte grava os convites sem autor quando quem paga é o M-Pesa automático.
   A tabela tem FORCE ROW LEVEL SECURITY: sem o tirar por um instante, esta
   migração via a tabela como um anónimo e o update não mudava nada, sem erro. */
alter table academia.convites no force row level security;
update academia.convites set origem = 'pagamento' where criado_por is null;
alter table academia.convites force row level security;

create unique index if not exists convites_token_unico on academia.convites (token);

/* Um convite revogado já não abre cursos. */
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
    foreach v_curso in array coalesce(v_convite.cursos, '{}'::text[]) loop
      if exists (select 1 from academia.cursos c where c.id = v_curso and c.removido_em is null) then
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
$function$;
