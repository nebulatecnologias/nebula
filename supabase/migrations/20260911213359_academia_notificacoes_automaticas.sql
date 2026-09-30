-- Migração 20260911213359 «academia_notificacoes_automaticas», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- O sino da academia estava sempre vazio: ninguem escrevia nada na
-- tabela. Passa a ser o proprio servidor a anunciar o que e novo, para
-- ser igual para toda a gente e nao depender do browser de ninguem.

create or replace function academia_privado.anunciar(p_titulo text, p_descricao text, p_tipo text, p_link text)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  insert into academia.notificacoes (titulo, descricao, tipo, link)
  values (p_titulo, p_descricao, p_tipo, p_link)
$$;

-- Um curso que passa a publicado e uma novidade para todos.
create or replace function academia_privado.anunciar_curso()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.publicado and not coalesce(old.publicado, false) and new.removido_em is null then
    perform academia_privado.anunciar(
      'Novo curso: ' || new.titulo,
      coalesce(nullif(new.subtitulo, ''), 'Já podes começar.'),
      'curso', new.id);
  end if;
  return new;
end;
$$;

-- Uma aula nova num curso ja publicado.
create or replace function academia_privado.anunciar_aula()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_curso academia.cursos%rowtype;
begin
  select c.* into v_curso
  from academia.modulos m
  join academia.cursos c on c.id = m.curso_id
  where m.id = new.modulo_id;

  if found and v_curso.publicado and v_curso.removido_em is null then
    perform academia_privado.anunciar(
      'Nova aula em ' || v_curso.titulo,
      new.titulo,
      'aula', v_curso.id);
  end if;
  return new;
end;
$$;

-- Um evento novo no calendario.
create or replace function academia_privado.anunciar_evento()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform academia_privado.anunciar(
    new.titulo,
    to_char(new.data, 'DD/MM') || ' às ' || to_char(new.hora, 'HH24:MI'),
    'evento', new.id);
  return new;
end;
$$;

drop trigger if exists t_anunciar_curso  on academia.cursos;
drop trigger if exists t_anunciar_aula   on academia.aulas;
drop trigger if exists t_anunciar_evento on academia.eventos;

create trigger t_anunciar_curso  after update on academia.cursos  for each row execute function academia_privado.anunciar_curso();
create trigger t_anunciar_aula   after insert on academia.aulas   for each row execute function academia_privado.anunciar_aula();
create trigger t_anunciar_evento after insert on academia.eventos for each row execute function academia_privado.anunciar_evento();
