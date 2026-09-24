# Emails da Academia — desenho novo

Os emails passam a usar o papel da Kingdom Library: faixa laranja com a coroa, cartão
branco de 18px, título a 500, um só botão em pílula laranja e rodapé em pedra. Ficam sempre
claros, porque os clientes de email não seguem o tema da app.

**Nada disto está publicado.** As Edge Functions que enviam os emails também abrem acessos
e tratam pagamentos, por isso a troca faz-se à parte, com revisão.

| Ficheiro | Para quê |
|---|---|
| `carta.js` | A função `carta()` nova. Tem a mesma assinatura da que já existe em `confirmar-e-abrir`. |
| `cartas.js` | O texto das cinco cartas tal como está hoje, só para a pré-visualização. |
| `pre-visualizacao.html` | Abre-a num browser (a partir de um servidor local) para ver as cinco cartas em PT e EN. |
| `recuperar-password.html` | O modelo para colar no Supabase Auth. |

## Como aplicar, quando se decidir

1. **`confirmar-e-abrir`**: trocar o corpo da função `carta(lang, titulo, tratamento, corpo, botao, link, pe)`
   pelo de `carta.js`. As três cartas (`emailDoConvite`, `emailDoAcesso`, `emailDoConteudo`)
   passam todas pelo mesmo molde, por isso não é preciso tocar em mais nada.
2. **`convidar-aluno`**: trocar o `corpoDoEmail(lang, nome, academia, link)` por uma chamada à
   mesma `carta()`, com os textos que lá estão:
   `carta(lang, t(lang,'Tens entrada na academia'), tratamento, t(lang,'Tens convite para…',{a}), t(lang,'Escolher password e entrar'), link, t(lang,'O link é pessoal…'))`.
3. **Supabase Auth → Email Templates → Reset Password**: colar `recuperar-password.html`. O
   `{{ .ConfirmationURL }}` é a variável do Supabase e tem de ficar como está.
4. O logótipo carrega de `https://membros.kingdomcompny.com/img/coroa-email.png`, que só existe
   depois de a Academia com o desenho novo estar em produção.
5. Antes de publicar: enviar cada carta para o email do Shelton e ver no Gmail (telemóvel e
   computador) e no Outlook. Nunca para um aluno real.

Uma diferença de vocabulário que já existia e ficou por decidir: `convidar-aluno` diz
«password» e `confirmar-e-abrir` diz «palavra-passe». A app diz «password».
