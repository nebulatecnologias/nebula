-- O terceiro plano chama-se «Premium» (decisão do Shelton a 02/10). O
-- identificador fica «escala»: as assinaturas e as isenções apontam para ele.
update nucleo.planos_plataforma set nome = 'Premium', atualizado_em = now() where id = 'escala';
