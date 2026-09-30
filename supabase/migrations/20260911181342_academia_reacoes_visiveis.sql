-- Migração 20260911181342 «academia_reacoes_visiveis», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- Um gosto e' publico por natureza: toda a gente ve quantos sao.
-- Escrever continua a ser so' na propria linha.
drop policy if exists reacoes_proprias on academia.reacoes;

create policy reacoes_leitura on academia.reacoes
  for select to authenticated using (true);

create policy reacoes_minhas on academia.reacoes
  for insert to authenticated with check (utilizador_id = auth.uid());

create policy reacoes_tirar on academia.reacoes
  for delete to authenticated using (utilizador_id = auth.uid() or academia_privado.e_equipa());
