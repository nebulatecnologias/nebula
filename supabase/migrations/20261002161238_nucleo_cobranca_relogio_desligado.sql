-- O motor directo da mensalidade sai (decisão do Shelton a 02/10: todos os
-- pagamentos pelo Payflow, que fala com a Academia por webhook/API). O relógio
-- diário que chamava a plataforma-cobrar desliga-se.
select cron.unschedule('plataforma-cobrar');
