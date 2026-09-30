-- Migração 20260911172400 «academia_autor_nas_mensagens», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- As politicas do CRM impedem um aluno de ler o registo de outro
-- aluno — e bem. Mas a conversa precisa de mostrar quem escreveu.
-- Guardamos o nome na propria mensagem, preenchido pelo servidor a
-- partir de utilizadores: o cliente nao o pode forjar.
-- ============================================================
alter table academia.mensagens
  add column if not exists autor_nome text,
  add column if not exists autor_iniciais text;

alter table academia.avaliacoes
  add column if not exists autor_nome text;

create or replace function academia_privado.carimbar_autor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text;
  v_partes text[];
begin
  select nome into v_nome from public.utilizadores where id = new.autor_id;
  v_nome := coalesce(nullif(trim(v_nome), ''), 'Aluno');
  new.autor_nome := v_nome;
  v_partes := regexp_split_to_array(v_nome, '\s+');
  new.autor_iniciais := upper(
    left(v_partes[1], 1) ||
    case when array_length(v_partes, 1) > 1 then left(v_partes[array_length(v_partes,1)], 1) else '' end
  );
  return new;
end;
$$;

create or replace function academia_privado.carimbar_autor_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(nullif(trim(nome), ''), 'Aluno') into new.autor_nome
  from public.utilizadores where id = new.utilizador_id;
  return new;
end;
$$;

drop trigger if exists t_mensagens_autor on academia.mensagens;
create trigger t_mensagens_autor
  before insert or update of autor_id on academia.mensagens
  for each row execute function academia_privado.carimbar_autor();

drop trigger if exists t_avaliacoes_autor on academia.avaliacoes;
create trigger t_avaliacoes_autor
  before insert or update of utilizador_id on academia.avaliacoes
  for each row execute function academia_privado.carimbar_autor_avaliacao();

revoke all on function academia_privado.carimbar_autor(), academia_privado.carimbar_autor_avaliacao() from public, anon, authenticated;
