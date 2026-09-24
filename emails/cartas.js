/* As cartas que a Academia envia hoje, com o texto tal e qual está nas Edge
   Functions — só para a pré-visualização. Nomes e ofertas são de exemplo. */

const T = (lang, pt, en) => lang === "en" ? en : pt;
const NOME = "Shelton";
const OFERTA = "Kingdom Tracktion";

export const CARTAS = [
  {
    nome: "Convite da equipa",
    quando: "Alguém da equipa convida um aluno",
    origem: "Edge Function convidar-aluno · corpoDoEmail()",
    dados: lang => ({
      assunto: T(lang, "Tens entrada na Kingdom Academy", "You are in — Kingdom Academy"),
      titulo: T(lang, "Tens entrada na academia", "You are in"),
      tratamento: T(lang, `Olá ${NOME},`, `Hi ${NOME},`),
      corpo: T(lang,
        "Tens convite para a área de membros da Kingdom Academy. Carrega no botão para escolheres a tua password e entrares.",
        "You have been invited to the Kingdom Academy members area. Press the button to choose your password and get in."),
      botao: T(lang, "Escolher password e entrar", "Choose a password and get in"),
      pe: T(lang,
        "O link é pessoal e expira dentro de pouco tempo. Se não funcionar, pede um novo convite a quem te acompanha.",
        "The link is personal and expires shortly. If it does not work, ask for a new invitation."),
    })
  },
  {
    nome: "Pagamento, conta nova",
    quando: "Primeira compra: cria a conta",
    origem: "Edge Function confirmar-e-abrir · emailDoConvite()",
    dados: lang => ({
      assunto: T(lang, "O teu acesso à Kingdom Academy está aberto", "Your Kingdom Academy access is open"),
      titulo: T(lang, "O teu acesso está aberto", "Your access is open"),
      tratamento: T(lang, `Olá ${NOME},`, `Hi ${NOME},`),
      corpo: T(lang,
        `Recebemos o teu pagamento do <b>${OFERTA}</b>. A tua área de membros já está pronta — carrega no botão para escolheres a tua palavra-passe e começares.`,
        `We received your payment for <b>${OFERTA}</b>. Your members area is ready — press the button to choose your password and get started.`),
      botao: T(lang, "Entrar na Academia", "Enter the Academy"),
      pe: T(lang,
        "O link é pessoal e expira dentro de pouco tempo. Se já não funcionar, usa «Esqueceste a palavra-passe?» na página de entrada — a conta fica na mesma.",
        "The link is personal and expires shortly. If it no longer works, use “Forgot your password?” on the sign-in page — your account is still there."),
    })
  },
  {
    nome: "Pagamento, conta existente",
    quando: "Quem já tem conta compra mais",
    origem: "Edge Function confirmar-e-abrir · emailDoAcesso()",
    dados: lang => ({
      assunto: T(lang, `O teu acesso ao ${OFERTA} está aberto`, `Your access to ${OFERTA} is open`),
      titulo: T(lang, "O teu acesso está aberto", "Your access is open"),
      tratamento: T(lang, `Olá ${NOME},`, `Hi ${NOME},`),
      corpo: T(lang,
        `Recebemos o teu pagamento do <b>${OFERTA}</b>. Já está aberto na tua área de membros.`,
        `We received your payment for <b>${OFERTA}</b>. It is now open in your members area.`),
      botao: T(lang, "Começar agora", "Start now"),
      pe: T(lang,
        "Entras com o email e a palavra-passe que já usas. Se não te lembrares dela, usa «Esqueceste a palavra-passe?» na página de entrada.",
        "Sign in with the email and password you already use. If you do not remember it, use “Forgot your password?” on the sign-in page."),
    })
  },
  {
    nome: "Conteúdo por link",
    quando: "Ofertas entregues por endereço (e-book)",
    origem: "Edge Function confirmar-e-abrir · emailDoConteudo()",
    dados: lang => ({
      assunto: T(lang, `O teu acesso ao ${OFERTA}`, `Your access to ${OFERTA}`),
      titulo: T(lang, "Aqui está o teu acesso", "Here is your access"),
      tratamento: T(lang, `Olá ${NOME},`, `Hi ${NOME},`),
      corpo: T(lang,
        `Recebemos o teu pagamento do <b>${OFERTA}</b>. O acesso é este — guarda este email, porque o link continua a servir.`,
        `We received your payment for <b>${OFERTA}</b>. Here is your access — keep this email, the link stays valid.`),
      botao: T(lang, "Abrir", "Open"),
      pe: T(lang,
        "Se o link não abrir, responde a este email que resolvemos.",
        "If the link does not open, reply to this email and we will sort it out."),
    })
  },
  {
    nome: "Recuperar a password",
    quando: "«Esqueceste a password?» no login",
    origem: "Supabase Auth · modelo Reset Password (recuperar-password.html)",
    dados: lang => ({
      assunto: T(lang, "Escolhe uma nova password", "Choose a new password"),
      titulo: T(lang, "Escolhe uma nova password", "Choose a new password"),
      tratamento: T(lang, "Olá,", "Hi there,"),
      corpo: T(lang,
        "Pediste para voltar a entrar na Kingdom Academy. Carrega no botão para escolheres uma nova password — o teu progresso e os teus cursos ficam como estavam.",
        "You asked to get back into the Kingdom Academy. Press the button to choose a new password — your progress and courses stay as they were."),
      botao: T(lang, "Escolher nova password", "Choose a new password"),
      pe: T(lang,
        "Se não foste tu a pedir, ignora este email: a tua password continua a mesma.",
        "If you did not ask for this, ignore this email: your password stays the same."),
    })
  },
];
