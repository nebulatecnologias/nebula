-- Aplicada a 28/10/2026 (versão 20261028064911). Provada logo a seguir numa
-- transacção desfeita: três convites para o mesmo email inventado
-- (ensaio-repetido@exemplo.invalid), o primeiro revogado, gravam-se todos.
--
-- Um convite revogado ou expirado bloqueava todos os convites novos para o
-- mesmo email (pedido do Shelton a 28/10/2026: «o estado não muda, e quando
-- tento enviar um novo convite para este mesmo email não me permite»). O
-- índice único de 11/09 só olhava para aceite_em: um convite revogado ou
-- expirado nunca é aceite, e ficava a ocupar o lugar para sempre — em todas
-- as escolas. Reenviar também falhava, porque o convite novo era gravado
-- antes de o antigo ser revogado. Passa a índice normal, por escola, para as
-- procuras. Um só link vivo por pessoa é regra de quem convida: reenviar e
-- convidar outra vez substituem o convite vivo (convidar-aluno com
-- `substitui`).
drop index if exists academia.convites_email_pendente_idx;
create index if not exists convites_por_email on academia.convites (organizacao_id, lower(email));
