-- Migração 20260911081645 «academia_fixar_search_path», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- O linter do Supabase avisa, com razao: uma funcao sem search_path
-- fixo pode ser enganada por objetos criados noutro schema.
create or replace function academia.toque_atualizado()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create or replace function academia.novo_id()
returns text
language sql
volatile
set search_path = pg_catalog, extensions, pg_temp
as $$ select gen_random_uuid()::text $$;
