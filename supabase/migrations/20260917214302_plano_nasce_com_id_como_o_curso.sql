-- Migração 20260917214302 «plano_nasce_com_id_como_o_curso», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* Um plano criado pela Academia nao tem de inventar um id do lado do browser:
   e a mesma funcao que ja da ids aos cursos e as aulas. */
alter table academia.planos alter column id set default academia.novo_id();
