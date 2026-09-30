-- Migração 20260918074738 «acessos_em_tempo_real_para_o_proprio», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* Para o cartão mudar de sítio sem a pessoa recarregar.

   O Realtime respeita as políticas da tabela, e a de acessos já é
   "utilizador_id = auth.uid() ou é da equipa" -- ninguém recebe o acesso de
   outra pessoa. Só entrega o que MUDA de linha; um acesso que caduca por data
   não mexe em linha nenhuma, e por isso a aplicação reconfirma também quando
   a pessoa volta ao separador. As duas coisas juntas cobrem os dois casos. */
alter publication supabase_realtime add table academia.acessos;
