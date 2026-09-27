-- Auditoria de 27/09/2026, achado A8. Aplicada em produção a 27/09/2026.
--
-- Nenhuma destas era alcançável (o anon não usa os esquemas e o
-- academia_privado não está exposto na API), mas bastava uma mudança de
-- configuração para deixarem de estar protegidas por isso -- e o anunciar()
-- deixava um aluno mandar uma notificação a todos.
--
-- Prova (transacção desfeita, aluna fictícia): o gatilho continua a anunciar
-- um evento novo; o aluno continua a ler eventos e a pedir a Vitrine; o aluno
-- que chama anunciar() recebe "permission denied".

-- Só o servidor anuncia. As funções de gatilho continuam a disparar: o
-- EXECUTE de uma função de gatilho só é verificado ao criar o gatilho.
revoke execute on function academia_privado.anunciar(text, text, text, text) from public, anon, authenticated;
revoke execute on function academia_privado.anunciar_curso()  from public, anon, authenticated;
revoke execute on function academia_privado.anunciar_aula()   from public, anon, authenticated;
revoke execute on function academia_privado.anunciar_evento() from public, anon, authenticated;

-- Estas servem quem tem sessão: a regra de leitura dos eventos chama o
-- ve_evento como o utilizador, e a Vitrine é pedida pelo aluno. Sai só o anon.
revoke execute on function academia_privado.ve_evento(bigint, text[]) from public, anon;
grant  execute on function academia_privado.ve_evento(bigint, text[]) to authenticated;
revoke execute on function academia.vitrine_do_aluno() from public, anon;
grant  execute on function academia.vitrine_do_aluno() to authenticated;
