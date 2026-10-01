-- O ensaio da migração lê o Payflow (leads, inscrições), que até ao F1b é só
-- da Kingdom. Numa outra escola, a equipa dela não o pode correr: ficaria a ver
-- os dados do Payflow da Kingdom. Remendo da verificação de permissão.
-- Aplicada por execute_sql e registada à mão.

set lock_timeout = '10s';
do $$
declare v_def text := pg_get_functiondef('academia.ensaio_da_migracao()'::regprocedure);
        de text := 'if not academia_privado.e_equipa() then';
begin
  if (length(v_def) - length(replace(v_def, de, ''))) / length(de) <> 1 then raise exception 'texto não aparece uma vez'; end if;
  execute replace(v_def, de, 'if not academia_privado.e_equipa() or not academia_privado.payflow_ligado() then');
end $$;
