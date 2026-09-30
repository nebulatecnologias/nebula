-- Migração 20260911215401 «academia_permissoes_service_role», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- O convite criava a conta e depois nao conseguia gravar a linha:
-- o papel que as funcoes do servidor usam (service_role) nunca teve
-- acesso ao esquema academia. O anon continua de fora, como deve ser.
grant usage on schema academia to service_role;
grant all on all tables    in schema academia to service_role;
grant all on all sequences in schema academia to service_role;
grant all on all functions in schema academia to service_role;

-- E para as tabelas que vierem a seguir nao repetirem o problema.
alter default privileges in schema academia grant all on tables    to service_role;
alter default privileges in schema academia grant all on sequences to service_role;
alter default privileges in schema academia grant all on functions to service_role;
