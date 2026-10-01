-- F1a — a configuração da Academia passa a ser de cada organização.
-- A chave era só `chave` (uma «aparencia», um «certificado» para toda a
-- plataforma); passa a ser (organizacao_id, chave). As 7 linhas de hoje são
-- da Kingdom e ficam como estão. Uma organização nova começa sem linhas e a
-- app usa os valores de origem (CONFIG_PADRAO, APARENCIA_PADRAO).
--
-- A app grava com upsert({ chave, valor }) sem dizer o conflito: o PostgREST
-- usa a chave primária, e a organização vem do valor por omissão
-- (academia_privado.organizacao()). Não muda nada na app.

set lock_timeout = '10s';

do $$
declare antes int; depois int;
begin
  select count(*) into antes from academia.config;
  alter table academia.config drop constraint config_pkey;
  alter table academia.config add constraint config_pkey primary key (organizacao_id, chave);
  select count(*) into depois from academia.config;
  if depois <> antes then raise exception 'config: % linhas antes, % depois', antes, depois; end if;
end $$;
