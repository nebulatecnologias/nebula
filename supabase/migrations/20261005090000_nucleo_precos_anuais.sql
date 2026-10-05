-- Preços anuais dos planos (decisão do Shelton a 05/10/2026): «o pagamento anual
-- dá 2 meses grátis para todos os planos». Anual = 10 × mensal, nas duas moedas:
--
--   Essencial     MZ   699,00 → MZ  6 990,00 (MZ 1 398,00 de desconto)   R 155,33 → R 1 553,30 (R   310,66)
--   Profissional  MZ 1 350,00 → MZ 13 500,00 (MZ 2 700,00 de desconto)   R 300,00 → R 3 000,00 (R   600,00)
--   Premium       MZ 3 450,00 → MZ 34 500,00 (MZ 6 900,00 de desconto)   R 766,67 → R 7 666,70 (R 1 533,34)
--
-- Vale para a tabela dos planos (o que se vende enquanto a Academia não tiver
-- a chave do Payflow); com a chave, valem os produtos do Payflow, criados com
-- os mesmos valores.
update nucleo.planos_plataforma
   set preco_anual_mzn = preco_mensal_mzn * 10,
       preco_anual = preco_mensal * 10,
       atualizado_em = now()
 where ativo and preco_mensal_mzn is not null and preco_mensal is not null;
