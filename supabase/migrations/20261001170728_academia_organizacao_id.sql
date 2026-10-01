-- F1a, passo 2 — cada linha da Academia diz de que organização é.
-- Todas as tabelas do esquema `academia` ganham `organizacao_id`, com a Kingdom
-- por omissão: o que já existe é da Kingdom, e o que nasce também, até o
-- passo 3 trocar o valor por omissão pelo da organização do pedido.
--
-- Só acrescenta. Ninguém lê a coluna ainda; as regras de leitura mudam no
-- passo 3. O valor por omissão é um literal (lido aqui da Kingdom), para não
-- reescrever as tabelas. lock_timeout: se alguma ligação tiver uma tabela
-- presa, falha em vez de ficar à espera.

set lock_timeout = '10s';

do $$
declare
  v_org uuid := nucleo.organizacao_kingdom();
  t     text;
  antes int;
  depois int;
begin
  if v_org is null then raise exception 'falta a organização kingdom'; end if;

  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'academia' and c.relkind = 'r' order by 1
  loop
    execute format('select count(*) from academia.%I', t) into antes;

    execute format('alter table academia.%I add column organizacao_id uuid not null default %L', t, v_org);
    execute format('alter table academia.%I add constraint %I foreign key (organizacao_id)
                      references nucleo.organizacoes(id) not valid', t, t || '_organizacao_fkey');
    execute format('alter table academia.%I validate constraint %I', t, t || '_organizacao_fkey');
    execute format('create index %I on academia.%I (organizacao_id)', t || '_por_organizacao', t);

    execute format('select count(*) from academia.%I where organizacao_id = %L', t, v_org) into depois;
    if depois <> antes then
      raise exception '%: % linhas antes, % da Kingdom depois', t, antes, depois;
    end if;
    raise notice '%: % linhas', t, depois;
  end loop;
end $$;
-- A chave estrangeira não precisa de dar ao aluno acesso ao esquema nucleo:
-- as verificações de integridade correm sem regras de leitura nem permissões
-- de quem escreve.
