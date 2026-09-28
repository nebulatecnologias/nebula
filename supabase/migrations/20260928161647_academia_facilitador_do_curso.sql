-- Fase 3 do plano da Academia. Aplicada em produção a 28/09/2026.
--
-- O cartão do curso diz quem o dá (pedido do Shelton a 27/09/2026). Nome e
-- fotografia livres, e não uma ligação a um utilizador: quem facilita um
-- curso pode não ter conta na plataforma. Só acrescenta colunas; nada
-- existente muda.
alter table academia.cursos
  add column if not exists facilitador          text,
  add column if not exists facilitador_foto_url text;

comment on column academia.cursos.facilitador          is 'Quem dá o curso, como aparece no cartão e na página do curso.';
comment on column academia.cursos.facilitador_foto_url is 'Fotografia do facilitador (Storage, academia-publico/facilitadores).';
