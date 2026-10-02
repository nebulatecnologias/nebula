-- Mudar de plano e cancelar fazem-se no Payflow (W4·6b): é ele que cobra, e
-- uma mudança feita só do lado da Academia deixava os dois a dizer coisas
-- diferentes. As funções ficam (a consola e os testes de base podem usá-las),
-- mas as escolas deixam de as poder chamar. A Cobrança abre o link do Payflow.
revoke execute on function academia.mudar_plano(text, text) from authenticated;
revoke execute on function academia.cancelar_assinatura(boolean) from authenticated;
