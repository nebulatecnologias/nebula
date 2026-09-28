-- Aplicada em produção a 28/09/2026.
--
-- A sala guarda o link que se compra num evento pago. Como as outras 23
-- tabelas da Academia, as regras de leitura valem também para o dono da
-- tabela. O servidor (service_role) continua a passar por cima delas.
alter table academia.salas force row level security;
