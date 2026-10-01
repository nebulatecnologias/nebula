-- A notificação de um curso novo, sem subtítulo, dizia «Já podes começar.» — o
-- último «tu» que ficou na base depois da passagem a «você» (30/09/2026). Fica
-- «Já pode começar.», que a app traduz para «You can start now.». O resto da
-- função fica igual. Não há notificações gravadas com o texto antigo (contado:
-- zero), por isso nada mais muda.
create or replace function academia_privado.anunciar_curso()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.publicado and not coalesce(old.publicado, false) and new.removido_em is null then
    perform academia_privado.anunciar(
      'Novo curso: ' || new.titulo,
      coalesce(nullif(new.subtitulo, ''), 'Já pode começar.'),
      'curso', new.id);
  end if;
  return new;
end;
$function$;
