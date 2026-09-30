-- Migração 20260911212145 «academia_realtime_comunidade», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- A comunidade passa a chegar em direto: quem esta na conversa ve as
-- mensagens novas sem recarregar a pagina. O Realtime respeita as
-- mesmas politicas de leitura, por isso ninguem ve o que nao podia ver.
alter publication supabase_realtime add table academia.mensagens;
alter publication supabase_realtime add table academia.reacoes;

-- Para as alteracoes e remocoes chegarem com a linha antiga inteira
-- (e nao so a chave), que e o que permite tirar a mensagem do ecra.
alter table academia.mensagens replica identity full;
