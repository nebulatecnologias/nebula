-- Os preços dos planos (Shelton, 02/10): mensais, em meticais — Essencial 699,
-- Profissional 1 350, Premium 3 450. O rand faz-se pelo câmbio 1 ZAR = 4,5 MT,
-- guardado nas definições (a consola usa-o para preencher o rand que ficar vazio).
-- O anual fica sem preço até ser decidido.
update nucleo.planos_plataforma p set preco_mensal_mzn = v.mzn, preco_mensal = round(v.mzn / 4.5, 2), atualizado_em = now()
  from (values ('essencial', 699::numeric), ('profissional', 1350::numeric), ('escala', 3450::numeric)) v(id, mzn)
 where p.id = v.id;
update nucleo.definicoes_plataforma set valor = valor || jsonb_build_object('cambioZarMzn', 4.5), atualizado_em = now() where chave = 'cobranca';
