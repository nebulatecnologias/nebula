/* ============================================================
   A página pública de um link de inscrição (17/11/2026, passo 5 da
   especificação «Convites, Assinaturas e Turmas»).

   `…/?inscricao=<código>` abre esta página, sem a navegação da área de
   membros e com a identidade da organização (logótipo, nome, cor e tema): o
   fundo a ecrã inteiro (a cor dela, ou a imagem do link, com uma versão para
   o computador e outra para o telemóvel) e um cartão ao centro com o título,
   a descrição e o formulário (nome, email e WhatsApp). Quem se inscreve recebe
   por email o link para entrar: é ao abri-lo que a conta nasce e que o que o
   link dá vira acesso. Assim só recebe acesso quem é mesmo dono do email.

   Em demonstração tudo fica em memória. Com servidor, a página lê
   public.link_de_inscricao (só o texto, a imagem e o estado) e inscreve pela
   função `inscricao`, que confere um desafio de cálculo antes de aceitar
   (um captcha sem perguntas: o browser faz a conta sozinho).
   ============================================================ */
const PAISES_DO_TELEFONE = [
  ["MZ", "+258"], ["ZA", "+27"], ["AO", "+244"], ["PT", "+351"], ["BR", "+55"], ["CV", "+238"],
  ["ST", "+239"], ["GW", "+245"], ["SZ", "+268"], ["ZW", "+263"], ["ZM", "+260"], ["MW", "+265"],
  ["TZ", "+255"], ["BW", "+267"], ["NA", "+264"], ["KE", "+254"], ["NG", "+234"], ["GH", "+233"],
  ["GB", "+44"], ["US", "+1"], ["FR", "+33"], ["ES", "+34"], ["DE", "+49"], ["IT", "+39"]
];

const estadoDaInscricao = { codigo:null, link:null, desafio:null, solucao:null, aResolver:null, enviado:null };

/* Negrito, itálico e links, e mais nada: o texto é escapado primeiro, e um
   link só vale se for http(s). */
function markdownSimples(texto){
  const seguro = String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return seguro.split(/\n{2,}/).map(p => "<p>" + p
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br>") + "</p>").join("");
}

/* O número como se guarda: o indicativo do país e só os algarismos. */
function telefoneE164(indicativo, numero){
  const algarismos = String(numero || "").replace(/\D/g, "").replace(/^0+/, "");
  if(!algarismos) return "";
  return indicativo + algarismos;
}

async function abrirPaginaDeInscricao(codigo){
  estadoDaInscricao.codigo = codigo;
  estadoDaInscricao.enviado = null;
  mostrarEcra("inscricao");
  let link = null;
  try {
    if(modoDemonstracao()){
      const l = (DB.linksDeInscricao || []).find(x => x.codigo === codigo);
      link = l ? { codigo:l.codigo, titulo:l.titulo, descricao:l.descricao, fundo:l.fundo, fundoMovel:l.fundoMovel,
                   telefoneObrigatorio:!!l.telefoneObrigatorio, estado:estadoDoLink(l) } : null;
    } else {
      link = await API.lerLinkPublico(codigo);
      /* O link é de uma escola: a página veste a marca dela. */
      const pedido = new URLSearchParams(location.search);
      if(link && link.escola && !pedido.get("org")){
        let atual = null;
        try { atual = (await API.marca() || {}).slug; } catch(e){ /* fica a marca que está */ }
        if(atual && atual !== link.escola){
          pedido.set("org", link.escola);
          location.replace(location.pathname + "?" + pedido.toString());
          return;
        }
      }
    }
  } catch(e){ link = null; }
  estadoDaInscricao.link = link;
  desenharPaginaDeInscricao();
  if(link && link.estado === "aberto") prepararDesafio();
}

function desenharPaginaDeInscricao(){
  let ecra = document.getElementById("view-inscricao");
  if(!ecra){
    ecra = document.createElement("div");
    ecra.id = "view-inscricao";
    ecra.className = "inscricao";
    document.body.appendChild(ecra);
  }
  const l = estadoDaInscricao.link;
  /* Duas imagens: a do computador e a do telemóvel. Cada ecrã usa a sua (é
     o CSS que escolhe); na falta de uma, serve a outra. Sem nenhuma, o fundo
     é a cor da organização. */
  const imagem = u => u && /^(https:\/\/|data:image\/)/.test(u) ? `url("${String(u).replace(/"/g, "%22")}")` : "";
  const fundo = imagem(l && l.fundo), fundoMovel = imagem(l && l.fundoMovel);
  ecra.style.setProperty("--fundo", fundo || fundoMovel || "none");
  ecra.style.setProperty("--fundo-movel", fundoMovel || fundo || "none");
  ecra.classList.toggle("com-fundo", !!fundo);
  ecra.classList.toggle("com-fundo-movel", !!fundoMovel);

  const fechado = !l ? t("Este convite não existe, ou já não está disponível.")
    : l.estado === "esgotado" ? t("As inscrições para este convite esgotaram.")
    : l.estado !== "aberto" ? t("Este convite já não está disponível.") : "";
  const enviado = estadoDaInscricao.enviado;

  ecra.innerHTML = `
    <div class="inscricao-veu" aria-hidden="true"></div>
    <main class="inscricao-cartao">
      <div class="inscricao-topo">
        <div class="brand-mark"></div>
        <div class="login-idioma" id="inscricao-idioma">${seletorDeIdiomaHTML()}</div>
      </div>
      ${enviado ? `
        <h1>${t("Inscrição recebida")}</h1>
        <p class="inscricao-texto" id="inscricao-sucesso">${t("Enviámos para {email} o link para entrar. Vale 7 dias. Se não o encontrar, veja a pasta de spam.", { email:`<strong>${textoSeguro(enviado)}</strong>` })}</p>
        <p class="inscricao-texto">${t("Se já tem conta nesta área de membros, o que este convite dá aparece na próxima vez que entrar.")}</p>
        <a class="btn btn-secondary" id="inscricao-entrada" href="${enderecoDaEntrada()}">${t("Ir para a entrada")}</a>
      ` : fechado ? `
        <h1>${l ? textoSeguro(l.titulo) : t("Convite indisponível")}</h1>
        <p class="inscricao-texto" id="inscricao-fechado">${fechado}</p>
        <a class="btn btn-secondary" id="inscricao-entrada" href="${enderecoDaEntrada()}">${t("Ir para a entrada")}</a>
      ` : `
        <h1>${textoSeguro(l.titulo)}</h1>
        ${l.descricao ? `<div class="inscricao-descricao">${markdownSimples(l.descricao)}</div>` : ""}
        <form id="form-inscricao" novalidate>
          <div class="field"><label for="inscricao-nome">${t("O seu nome")}</label>
            <input id="inscricao-nome" type="text" autocomplete="name" maxlength="120" required></div>
          <div class="field"><label for="inscricao-email">${t("O seu melhor email")}</label>
            <input id="inscricao-email" type="email" autocomplete="email" inputmode="email" maxlength="200" required></div>
          <div class="field"><label for="inscricao-telefone">${t("O seu número de WhatsApp")}${l.telefoneObrigatorio ? "" : ` <span class="opcional">${t("(opcional)")}</span>`}</label>
            <div class="inscricao-telefone">
              <div class="select-wrap"><select id="inscricao-pais" aria-label="${t("Indicativo do país")}">
                ${PAISES_DO_TELEFONE.map(([p, ind]) => `<option value="${ind}">${p} ${ind}</option>`).join("")}</select></div>
              <input id="inscricao-telefone" type="tel" autocomplete="tel-national" inputmode="tel" maxlength="20" ${l.telefoneObrigatorio ? "required" : ""}>
            </div></div>
          <p class="inscricao-captcha" id="inscricao-captcha" role="status"></p>
          <div class="login-aviso hidden" id="inscricao-aviso" role="alert"></div>
          <button class="btn btn-primary" type="submit" id="inscricao-enviar">${t("Aceitar convite")}</button>
        </form>
      `}
    </main>`;

  if(typeof aplicarAparencia === "function") aplicarAparencia();
  ecra.querySelectorAll("#inscricao-idioma [data-idioma]").forEach(b => b.addEventListener("click", () => {
    if(!escolherIdioma(b.getAttribute("data-idioma"))) return;
    const guardados = valoresDoFormularioDeInscricao();
    desenharPaginaDeInscricao();
    reporFormularioDeInscricao(guardados);
  }));
  const form = document.getElementById("form-inscricao");
  if(form){
    form.addEventListener("submit", e => { e.preventDefault(); enviarInscricao(); });
    pintarCaptcha();
  }
}

function enderecoDaEntrada(){
  const pedido = new URLSearchParams(location.search);
  pedido.delete("inscricao");
  const resto = pedido.toString();
  return location.pathname + (resto ? "?" + resto : "");
}

function valoresDoFormularioDeInscricao(){
  const v = id => (document.getElementById(id) || {}).value || "";
  return { nome:v("inscricao-nome"), email:v("inscricao-email"), pais:v("inscricao-pais"), telefone:v("inscricao-telefone") };
}
function reporFormularioDeInscricao(v){
  const poe = (id, valor) => { const el = document.getElementById(id); if(el && valor) el.value = valor; };
  poe("inscricao-nome", v.nome); poe("inscricao-email", v.email); poe("inscricao-pais", v.pais); poe("inscricao-telefone", v.telefone);
}

function avisoDaInscricao(texto){
  const el = document.getElementById("inscricao-aviso");
  if(!el) return;
  el.className = "login-aviso erro" + (texto ? "" : " hidden");
  el.textContent = texto || "";
}

/* ---------- o desafio (captcha sem perguntas) ---------- */
function pintarCaptcha(){
  const el = document.getElementById("inscricao-captcha");
  if(!el) return;
  const pronto = modoDemonstracao() || estadoDaInscricao.solucao !== null;
  el.classList.toggle("verificado", pronto);
  el.textContent = pronto ? t("Verificado") : t("A confirmar que não é um robô...");
}

function desafioAindaVale(d){
  const m = /[?&]expires=(\d+)/.exec((d && d.salt) || "");
  return !!m && Number(m[1]) * 1000 > Date.now() + 15000;
}

/* O servidor dá um número escondido atrás de um resumo SHA-256; o browser
   procura-o. Para uma pessoa é um segundo; para quem quer inscrever milhares
   de emails, é um segundo por cada um. */
async function resolverDesafio(d){
  const codificador = new TextEncoder();
  const alvo = (d.challenge.match(/../g) || []).map(h => parseInt(h, 16));
  for(let n = 0; n <= d.maxnumber; n++){
    const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", codificador.encode(d.salt + n)));
    let igual = true;
    for(let i = 0; i < alvo.length; i++){ if(resumo[i] !== alvo[i]){ igual = false; break; } }
    if(igual) return n;
    if(n % 2000 === 1999) await new Promise(r => setTimeout(r));
  }
  throw new Error("desafio sem solução");
}

function prepararDesafio(){
  if(modoDemonstracao()){ pintarCaptcha(); return Promise.resolve(); }
  if(estadoDaInscricao.solucao !== null && desafioAindaVale(estadoDaInscricao.desafio)) return Promise.resolve();
  if(estadoDaInscricao.aResolver) return estadoDaInscricao.aResolver;
  estadoDaInscricao.solucao = null;
  pintarCaptcha();
  estadoDaInscricao.aResolver = (async () => {
    try {
      const d = await API.inscricao({ acao:"desafio" });
      if(!d || !d.challenge) throw new Error("sem desafio");
      estadoDaInscricao.desafio = d;
      estadoDaInscricao.solucao = await resolverDesafio(d);
    } finally {
      estadoDaInscricao.aResolver = null;
      pintarCaptcha();
    }
  })();
  return estadoDaInscricao.aResolver;
}

/* ---------- inscrever ---------- */
function mensagemDaInscricao(chave){
  return ({
    nome: t("Escreva o seu nome."),
    email: t("Esse email não parece válido."),
    telefone: t("Escreva o seu número de WhatsApp, com o indicativo do país."),
    muitas: t("Demasiadas tentativas. Tente daqui a alguns minutos.")
  })[chave] || t("Não foi possível fazer a inscrição agora. Tente daqui a pouco.");
}

async function enviarInscricao(){
  const l = estadoDaInscricao.link;
  const v = valoresDoFormularioDeInscricao();
  const nome = v.nome.trim().replace(/\s+/g, " ");
  const email = v.email.trim().toLowerCase();
  const telefone = telefoneE164(v.pais, v.telefone);
  avisoDaInscricao("");
  if(!nome){ avisoDaInscricao(mensagemDaInscricao("nome")); document.getElementById("inscricao-nome").focus(); return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ avisoDaInscricao(mensagemDaInscricao("email")); document.getElementById("inscricao-email").focus(); return; }
  if((l.telefoneObrigatorio && !telefone) || (telefone && !/^\+[0-9]{8,15}$/.test(telefone))){
    avisoDaInscricao(mensagemDaInscricao("telefone")); document.getElementById("inscricao-telefone").focus(); return;
  }
  const botao = document.getElementById("inscricao-enviar");
  botao.disabled = true;
  botao.textContent = t("A inscrever...");
  let r;
  try {
    if(modoDemonstracao()) r = inscreverEmDemonstracao(estadoDaInscricao.codigo, { nome, email, telefone });
    else {
      await prepararDesafio();
      const d = estadoDaInscricao.desafio;
      r = await API.inscricao({ acao:"inscrever", codigo:estadoDaInscricao.codigo, nome, email, telefone, idioma:idioma(),
                                captcha:{ salt:d.salt, challenge:d.challenge, signature:d.signature, number:estadoDaInscricao.solucao } });
      /* Cada desafio serve uma vez. */
      estadoDaInscricao.solucao = null; estadoDaInscricao.desafio = null;
    }
  } catch(e){ r = { estado:"falhou" }; }

  if(r && r.estado === "ok"){
    estadoDaInscricao.enviado = email;
    desenharPaginaDeInscricao();
    return;
  }
  const estadoFinal = (r && r.estado) || "falhou";
  if(estadoFinal === "esgotado" || estadoFinal === "arquivado" || estadoFinal === "indisponivel" || estadoFinal === "inexistente"){
    estadoDaInscricao.link = Object.assign({}, l, { estado: estadoFinal === "esgotado" ? "esgotado" : "arquivado" });
    desenharPaginaDeInscricao();
    return;
  }
  botao.disabled = false;
  botao.textContent = t("Aceitar convite");
  avisoDaInscricao(mensagemDaInscricao(estadoFinal === "invalido" ? r.campo : estadoFinal));
  if(!modoDemonstracao()) prepararDesafio().catch(() => {});
}

/* O que a base faz em inscricao_registar(): confere o link e o limite, não
   gasta outra vaga a quem já se inscreveu, não reabre quem a escola
   suspendeu, e grava a inscrição como um convite com origem «link». */
function inscreverEmDemonstracao(codigo, { nome, email, telefone }){
  const l = (DB.linksDeInscricao || []).find(x => x.codigo === codigo);
  if(!l) return { estado:"inexistente" };
  const est = estadoDoLink(l);
  if(est === "arquivado" || est === "indisponivel") return { estado:est };
  const membro = membroPorEmail(email);
  if(membro && membro.acesso === "bloqueado") return { estado:"ok", enviar:false };
  DB.convites = DB.convites || [];
  const ja = DB.convites.find(c => c.linkId === l.id && (c.email || "").toLowerCase() === email && c.estado !== "revogado");
  const seteDias = new Date(Date.now() + 7 * 864e5).toISOString();
  if(ja){
    if(ja.estado === "aceite") return { estado:"ok", enviar:false, ja:true };
    if(ja.estado === "expirado" && est === "esgotado") return { estado:"esgotado" };
    Object.assign(ja, { nome, telefone: telefone || ja.telefone, expiraEm:seteDias, estado:"enviado" });
    guardarDB();
    return { estado:"ok", enviar:true, reenvio:true };
  }
  if(est === "esgotado") return { estado:"esgotado" };
  DB.convites.unshift({
    id:novoId("cv"), codigo:Array.from({ length:48 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
    email, nome, ofertaId:null, idioma:idioma(), origem:"link", linkId:l.id, telefone, papel:"aluno",
    cursos: l.modalidade === "cursos" ? (l.cursos || []).slice() : [],
    turmas: l.modalidade === "cursos" ? Object.assign({}, l.turmas || {}) : {},
    niveis: l.modalidade === "assinatura" ? [l.nivelId] : [],
    ilimitado: l.modalidade === "ilimitado", acessoDias:null,
    estado:"enviado", criadoEm:new Date().toISOString(), expiraEm:seteDias
  });
  guardarDB();
  return { estado:"ok", enviar:true, reenvio:false };
}
