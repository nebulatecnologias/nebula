drop trigger if exists ponte_do_perfil on public.utilizadores;
create trigger ponte_do_perfil
  after insert or update of perfil, estado, removido_em on public.utilizadores
  for each row execute function nucleo.ponte_do_perfil();
