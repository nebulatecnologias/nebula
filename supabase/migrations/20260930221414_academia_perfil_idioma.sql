-- A língua escolhida pelo aluno nas Definições (tradução da Academia,
-- decidida pelo Shelton a 30/09/2026). Vazia quer dizer «ainda não escolheu»:
-- vale então a língua com que comprou, que já vem na conta desde o convite
-- (user_metadata.idioma), e por fim o português.
--
-- A regra de escrita do perfil é a de sempre (cada um escreve o seu), e o
-- trigger impedir_auto_promocao não olha para esta tabela.
alter table academia.perfis
  add column if not exists idioma text
    constraint perfis_idioma_valido check (idioma is null or idioma in ('pt', 'en'));

comment on column academia.perfis.idioma is
  'pt ou en, escolhido pelo aluno nas Definições. Nulo: vale a língua da compra (user_metadata.idioma).';
