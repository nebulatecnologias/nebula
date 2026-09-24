/* ============================================================
   A carta da Kingdom Academy, no desenho da Kingdom Library.

   Mesma assinatura que a carta() da Edge Function `confirmar-e-abrir`:
     carta(lang, titulo, tratamento, corpo, botao, link, pe)
   Aplicar o desenho novo é trocar o corpo dessa função por este, e fazer o
   mesmo ao corpoDoEmail() da `convidar-aluno` (ver LEIA-ME.md). Nada do que
   decide quem recebe o quê muda: isto é só o papel da carta.

   Regras do mundo Library para email: fica sempre claro (os clientes de email
   não seguem o tema da app), valores escritos à letra em vez de variáveis,
   tabelas e estilos em linha para o Gmail e o Outlook, uma só faixa laranja e
   um só botão.
   ============================================================ */

const LOGO = "https://membros.kingdomcompny.com/img/coroa-email.png";
const FONTE = "'Google Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * @param {"pt"|"en"} lang
 * @param {string} titulo      já traduzido
 * @param {string} tratamento  "Olá Ana," — já escapado
 * @param {string} corpo       pode trazer <b>, já escapado
 * @param {string} botao
 * @param {string} link
 * @param {string} pe          nota pequena por baixo do botão
 * @param {{ marca?: string, rodape?: string, logo?: string }} [extra]
 */
export function carta(lang, titulo, tratamento, corpo, botao, link, pe, extra = {}) {
  const marca = extra.marca || "Kingdom Academy";
  const logo = extra.logo || LOGO;
  const rodape = extra.rodape || (lang === "en"
    ? "You are receiving this email because of your access to the Kingdom Academy members area."
    : "Recebes este email por causa do teu acesso à área de membros da Kingdom Academy.");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f3f1ee;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f1ee;">${titulo}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ee;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #ebe6e0;border-radius:18px;border-collapse:separate;overflow:hidden;">
      <tr><td bgcolor="#f25a12" style="background:#f25a12;background-image:linear-gradient(160deg,#ff8a45 0%,#ee5410 100%);padding:26px 30px;border-radius:18px 18px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;"><img src="${logo}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
          <td style="font-family:${FONTE};font-size:18px;font-weight:700;letter-spacing:-.02em;color:#ffffff;">${marca}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px 30px 8px;font-family:${FONTE};">
        <h1 style="margin:0 0 16px;font-size:25px;line-height:1.2;font-weight:500;letter-spacing:-.02em;color:#1c1a17;">${titulo}</h1>
        <p style="margin:0 0 12px;font-size:15.5px;line-height:1.6;color:#3b3732;">${tratamento}</p>
        <p style="margin:0 0 26px;font-size:15.5px;line-height:1.6;color:#3b3732;">${corpo}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>
          <td bgcolor="#f2570f" style="border-radius:999px;background:#f2570f;background-image:linear-gradient(180deg,#ff7f37 0%,#f2570f 100%);box-shadow:0 6px 16px -4px rgba(226,78,12,.5);">
            <a href="${link}" style="display:inline-block;padding:14px 26px;font-family:${FONTE};font-size:15.5px;font-weight:500;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">${botao}</a>
          </td>
        </tr></table>
        <p style="margin:0 0 24px;padding-top:16px;border-top:1px solid #efe9e2;font-size:13.5px;line-height:1.6;color:#6f6962;">${pe}</p>
      </td></tr>
      <tr><td bgcolor="#faf8f5" style="background:#faf8f5;padding:18px 30px;font-family:${FONTE};font-size:12px;line-height:1.6;color:#6f6962;border-radius:0 0 18px 18px;">
        ${rodape}<br>© Kingdom Company · <a href="https://membros.kingdomcompny.com" style="color:#b8400a;text-decoration:underline;">membros.kingdomcompny.com</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
