-- Migração 20260911191310 «academia_aceitar_convite», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- Quem entra com um email convidado recebe os cursos do convite.
-- Corre do lado do servidor: o cliente nao consegue inventar acessos.
create or replace function academia.aceitar_convite()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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
$$;

revoke all on function academia.aceitar_convite() from public, anon;
grant execute on function academia.aceitar_convite() to authenticated;
