/* ============================================================
   Rede de segurança
   Os dados vivem no browser de quem usa a app. Se um registo antigo
   ou incompleto fizer a interface falhar, mostramos uma saída em vez
   de deixar o ecrã em branco.
   ============================================================ */
window.addEventListener("error", e => {
  /* Ignora falhas de recursos (fonte, favicon, imagem): não partem a app. */
  if(!e.error && !e.message) return;
  if(e.target && e.target !== window) return;
  mostrarEcraDeRecuperacao(e.message);
});
window.addEventListener("unhandledrejection", e => mostrarEcraDeRecuperacao(String(e.reason)));

function mostrarEcraDeRecuperacao(detalhe){
  if(document.getElementById("ecra-recuperacao")) return;
  const el = document.createElement("div");
  el.id = "ecra-recuperacao";
  el.className = "modal-overlay";
  el.innerHTML = `
    <div class="card confirm-card">
      <h3>${t("Algo correu mal ao abrir a área de membros")}</h3>
      <p>${t("Isto costuma acontecer quando ficam dados antigos guardados neste browser. Pode repor os dados de demonstração — o conteúdo volta ao estado original.")}</p>
      <p class="hint" style="word-break:break-word;">${detalhe || ""}</p>
      <div class="confirm-acoes">
        <button class="btn btn-secondary" type="button" id="btn-recarregar">${t("Tentar de novo")}</button>
        <button class="btn btn-primary" type="button" id="btn-repor-dados">${t("Repor dados")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  document.getElementById("btn-recarregar").addEventListener("click", () => location.reload());
  document.getElementById("btn-repor-dados").addEventListener("click", () => {
    try {
      localStorage.removeItem(DB_CHAVE);
      localStorage.removeItem(ESTADO_CHAVE);
    } catch(err){ /* browser sem armazenamento: recarregar já resolve */ }
    location.reload();
  });
}

/* ============================================================
   Arranque
   Em produção nada aparece antes de sabermos quem entrou: a área
   de membros carrega-se do Supabase depois da sessão confirmada.
   ============================================================ */
const ecraArranque = document.getElementById("view-arranque");
const ecraLogin    = document.getElementById("view-login");
const ecraApp      = document.getElementById("app-shell");

function mostrarEcra(qual){
  ecraArranque.classList.toggle("hidden", qual !== "arranque");
  ecraLogin.classList.toggle("hidden", qual !== "login");
  ecraApp.classList.toggle("hidden", qual !== "app");
  if(qual === "login"){
    montarSeletorDaEntrada();
    if(typeof despedidaDeQuemSaiu === "function") despedidaDeQuemSaiu();
  }
}

/* PT/EN no ecrã de entrada. Muda o texto fixo e o que vem da Aparência. */
function montarSeletorDaEntrada(aoMudar){
  const lugar = document.getElementById("login-idioma");
  if(!lugar) return;
  lugar.innerHTML = seletorDeIdiomaHTML();
  lugar.querySelectorAll("[data-idioma]").forEach(b => b.addEventListener("click", () => {
    if(!escolherIdioma(b.getAttribute("data-idioma"))) return;
    aplicarAparencia();
    if(aoMudar) aoMudar(); else montarSeletorDaEntrada();
    const aviso = document.getElementById("login-aviso");
    if(aviso) aviso.classList.add("hidden");
  }));
}

function avisoLogin(texto, tom){
  const el = document.getElementById("login-aviso");
  el.className = "login-aviso " + (tom || "erro");
  el.textContent = texto;
  el.classList.remove("hidden");
}

async function arrancar(){
  if(modoDemonstracao()){
    /* Modo de demonstração: dados de exemplo, sem servidor. */
    aplicarAparencia();
    mostrarEcra("login");
    return;
  }
  try {
    API.iniciar();
  } catch(e){
    mostrarEcra("arranque");
    document.getElementById("arranque-texto").innerHTML =
      t("Não foi possível carregar a biblioteca do Supabase.") + "<br>" + t("Verifique a ligação à internet e recarregue a página.");
    return;
  }

  /* O link do email do convite: `?convite=<token>`. O servidor diz se o
     convite ainda vale; se valer, devolve o link de entrada e segue-se
     para ele. Se não, diz-se porquê, aqui mesmo. */
  const pedido = new URLSearchParams(location.search);
  const token = pedido.get("convite");
  if(token){
    await abrirConviteDoEmail(token);
    return;
  }

  /* O link do email de recuperação: `?token_hash=…&type=recovery`. O código
     confirma-se aqui e pede-se a password nova. */
  const codigo = pedido.get("token_hash");
  if(codigo){
    history.replaceState(null, "", location.pathname);
    aplicarAparencia();
    mostrarEcra("login");
    try { await API.entrarComCodigo(codigo, pedido.get("type") === "invite" ? "invite" : "recovery"); }
    catch(erro){ avisoLogin(erro.message); return; }
    pedirNovaPassword(false);
    return;
  }

  /* Link do email: o Supabase devolve a sessão no endereço e o que
     falta é escolher a password. Um convite é a primeira entrada;
     uma recuperação é quem já cá andava e se esqueceu. */
  const convidado = location.hash.includes("type=invite") || location.hash.includes("type=signup");
  if(convidado || location.hash.includes("nova-password") || location.hash.includes("type=recovery")){
    mostrarEcra("login");
    aplicarAparencia();
    pedirNovaPassword(convidado);
    return;
  }

  try {
    const utilizador = await API.sessao();
    if(!utilizador){ aplicarAparencia(); mostrarEcra("login"); return; }
    /* Convidado que ainda não escolheu password: não entra sem a
       escolher, ou fica com uma conta em que nunca mais consegue
       entrar por si. A marca está na conta, não no endereço. */
    if(API.precisaDePassword){
      aplicarAparencia();
      mostrarEcra("login");
      pedirNovaPassword(true);
      return;
    }
    await entrarNaArea();
  } catch(erro){
    aplicarAparencia();
    mostrarEcra("login");
    avisoLogin(erro.message || t("Não foi possível ligar à academia."));
  }
}

async function abrirConviteDoEmail(token){
  mostrarEcra("arranque");
  document.getElementById("arranque-texto").textContent = t("A abrir o seu convite...");
  let r;
  try { r = await API.abrirConvite(token); }
  catch(erro){
    aplicarAparencia(); mostrarEcra("login");
    avisoLogin(erro.message || t("Não foi possível abrir o convite agora. Tente daqui a pouco."));
    return;
  }
  /* O token sai do endereço: recarregar não deve voltar a perguntar. */
  history.replaceState(null, "", location.pathname + location.hash);
  /* O convite diz em que língua a pessoa comprou. */
  if(r.lingua) aplicarIdiomaDaConta({ compra:r.lingua });

  if(r.estado === "ok" && r.tokenHash){
    try { await API.entrarComCodigo(r.tokenHash, r.tipo || "invite"); }
    catch(erro){ aplicarAparencia(); mostrarEcra("login"); avisoLogin(erro.message); return; }
    aplicarAparencia();
    mostrarEcra("login");
    pedirNovaPassword(true);
    return;
  }
  aplicarAparencia();
  mostrarEcra("login");
  if(r.estado === "aceite"){
    if(r.email) document.getElementById("input-email").value = r.email;
    avisoLogin(t("Este convite já foi usado. Entre com o seu email e a sua password."), "nota");
  } else if(r.estado === "revogado"){
    avisoLogin(t("Este convite foi cancelado. Peça um novo a quem o convidou."));
  } else if(r.estado === "expirado"){
    const quando = r.expiraEm ? new Date(r.expiraEm).toLocaleDateString(localeDoIdioma(), { day:"numeric", month:"long" }) : "";
    avisoLogin(quando ? t("Este convite expirou a {data}. Peça um novo a quem o convidou.", { data:quando }) : t("Este convite expirou. Peça um novo a quem o convidou."));
  } else {
    avisoLogin(t("Este link de convite não é válido. Confirme que o abriu inteiro, a partir do email."));
  }
}

/* Carrega tudo o que esta pessoa pode ver e abre a área. Se alguma
   coisa falhar a meio, volta ao login com o motivo à vista: ficar para
   sempre no ecrã de carregamento é a pior saída possível. */
async function entrarNaArea(){
  mostrarEcra("arranque");
  document.getElementById("arranque-texto").textContent = t("A carregar os seus cursos...");
  try {
    await API.carregarTudo();
  } catch(erro){
    aplicarAparencia();
    mostrarEcra("login");
    throw erro;
  }
  normalizarDB();
  aplicarAparencia();
  mostrarEcra("app");
  estado.prevendoComoAluno = false;
  arrancarNoEndereco(estado.papel === "administrador" ? "admin-visao" : "dashboard");
  ligarAcessoEmDireto();
  if(onboardingPendente()) abrirOnboarding(false);
}

/* ============================================================
   Login / logout
   ============================================================ */
document.getElementById("form-login").addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("input-email").value.trim();
  const password = document.querySelector("#form-login input[type=password]").value;
  const botao = document.getElementById("btn-entrar");

  if(modoDemonstracao()) return entrarEmDemonstracao(email);

  if(!email || !password){ avisoLogin(t("Preencha o email e a password.")); return; }

  botao.disabled = true;
  botao.textContent = t("A entrar...");
  try {
    await API.entrar(email, password);
    await entrarNaArea();
  } catch(erro){
    avisoLogin(erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = t("Entrar");
  }
});

/* O modo de demonstração mantém o comportamento antigo, para os
   testes automáticos e para mostrar a aplicação sem servidor. */
function entrarEmDemonstracao(email){
  let membro = membroPorEmail(email) || aceitarConvitePendente(email);
  if(membro && membro.acesso === "bloqueado"){
    mostrarToast(t("Este acesso está bloqueado. Fale com a sua mentoria."));
    return;
  }
  if(membro){
    sincronizarSessaoComMembro(membro);
  } else if(email){
    const prefixo = email.split("@")[0].replace(/[._]/g," ");
    estado.nome = prefixo.split(" ").filter(Boolean).map(p=>p[0].toUpperCase()+p.slice(1)).join(" ");
    estado.email = email;
    estado.membroId = null;
    estado.papel = email.toLowerCase().includes("admin") ? "administrador" : "aluno";
  }
  estado.prevendoComoAluno = false;
  guardarEstado();
  /* A sério, é a base que grava os certificados; aqui grava-os o browser. */
  if(estado.papel !== "administrador") atualizarCertificados();
  mostrarEcra("app");
  arrancarNoEndereco(estado.papel === "administrador" ? "admin-visao" : "dashboard");
  if(onboardingPendente()) abrirOnboarding(false);
}

/* ---------------- Recuperar password ---------------- */
document.getElementById("btn-esqueci").addEventListener("click", async e => {
  e.preventDefault();
  const email = document.getElementById("input-email").value.trim();
  if(!email){ avisoLogin(t("Escreva primeiro o seu email, e depois carregue aqui.")); return; }
  if(modoDemonstracao()){ avisoLogin(t("Em modo de demonstração não há emails."), "nota"); return; }
  try {
    await API.pedirNovaPassword(email);
    avisoLogin(t("Enviámos um link para {email}. Confirme também a pasta de spam.", { email }), "nota");
  } catch(erro){ avisoLogin(erro.message); }
});

document.getElementById("btn-pedir-acesso").addEventListener("click", e => {
  e.preventDefault();
  const apoio = (DB.config.integracoes || {}).suporteUrl;
  if(apoio) abrirLink(apoio);
  else avisoLogin(t("Peça o convite a quem o acompanha na academia."), "nota");
});

/* Formulário de nova password, depois do link do email. */
function pedirNovaPassword(primeiraVez){
  const cartao = document.querySelector(".login-card");
  cartao.innerHTML = `
    <div class="login-idioma" id="login-idioma"></div>
    <h1>${primeiraVez ? t("Boas-vindas à academia") : t("Escolha uma nova password")}</h1>
    <p class="sub">${primeiraVez ? t("Escolha a password com que passa a entrar. Pelo menos 8 caracteres.") : t("Tem de ter pelo menos 8 caracteres.")}</p>
    <div class="field"><label for="pass-nova">${t("Nova password")}</label><input type="password" id="pass-nova" autocomplete="new-password" placeholder="${t("Pelo menos 8 caracteres")}"></div>
    <div class="field"><label for="pass-repete">${t("Repita a password")}</label><input type="password" id="pass-repete" autocomplete="new-password"></div>
    <button class="btn btn-primary btn-block btn-lg" id="btn-definir-pass">${primeiraVez ? t("Entrar na academia") : t("Guardar e entrar")}</button>
    <div class="login-aviso hidden" id="login-aviso"></div>
  `;
  montarSeletorDaEntrada(() => pedirNovaPassword(primeiraVez));
  document.getElementById("btn-definir-pass").addEventListener("click", async () => {
    const nova = document.getElementById("pass-nova").value;
    const repete = document.getElementById("pass-repete").value;
    if(nova.length < 8){ avisoLogin(t("A password tem de ter pelo menos 8 caracteres.")); return; }
    if(nova !== repete){ avisoLogin(t("As duas passwords não são iguais.")); return; }
    try {
      await API.definirPassword(nova);
      history.replaceState(null, "", location.pathname);
      const utilizador = await API.sessao();
      if(utilizador) await entrarNaArea();
      else location.reload();
    } catch(erro){ avisoLogin(erro.message); }
  });
}

async function sairDaConta(){
  estado.prevendoComoAluno = false;
  if(!modoDemonstracao()){ API.pararDeOuvir(); await API.sair(); }
  /* Quem sai vê uma despedida no ecrã de entrada, e não um formulário
     igual ao de quem nunca entrou. */
  try { sessionStorage.setItem("academia-saiu", "1"); } catch(e){ /* sem armazenamento: sai na mesma */ }
  location.reload();
}
const botaoSair = document.getElementById("btn-logout");
botaoSair.addEventListener("click", sairDaConta);
botaoSair.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); sairDaConta(); } });

function despedidaDeQuemSaiu(){
  let saiu = false;
  try { saiu = sessionStorage.getItem("academia-saiu") === "1"; sessionStorage.removeItem("academia-saiu"); } catch(e){}
  if(saiu) avisoLogin(t("Saiu da sua conta. Até à próxima aula!"), "nota");
}

document.getElementById("avatar-iniciais").addEventListener("click", () => {
  irPara(papelEfetivo()==="administrador" ? "admin-config" : "definicoes");
});

document.getElementById("btn-notif").addEventListener("click", e => {
  e.stopPropagation();
  const painel = document.getElementById("notif-panel");
  const vaiAbrir = painel.classList.contains("hidden");
  painel.classList.toggle("hidden");
  if(vaiAbrir){
    renderNotificacoes();
    const porLer = DB.notificacoes.filter(n => !n.lida).map(n => n.id);
    DB.notificacoes.forEach(n => n.lida = true);
    atualizarSidebarGlobal();
    if(porLer.length) salvarNotificacoesLidas(porLer);
  }
});
document.addEventListener("click", e => {
  const painel = document.getElementById("notif-panel");
  if(!painel.classList.contains("hidden") && !e.target.closest(".notif-wrap")) painel.classList.add("hidden");
});

document.getElementById("btn-tema").addEventListener("click", () => {
  /* A escolha de quem está a usar guarda-se e passa a mandar sobre o
     tema por omissão definido em Aparência. */
  estado.tema = temaEfetivo() === "dark" ? "light" : "dark";
  aplicarTema();
  salvarPerfil();
});

/* Elementos que se comportam como botões ou ligações sem o serem
   (linhas de navegação, "Ver todos") respondem também ao teclado. */
document.addEventListener("keydown", e => {
  if(e.key !== "Enter" && e.key !== " ") return;
  const alvo = e.target.closest && e.target.closest('[role="link"],[role="button"]');
  if(!alvo || alvo.tagName === "BUTTON" || alvo.tagName === "A") return;
  if(alvo.id === "btn-logout" || alvo.classList.contains("nav-item")) return;  /* já tratam a tecla */
  e.preventDefault();
  alvo.click();
});

/* A identidade definida no painel é aplicada logo no ecrã de entrada. */
arrancar();

document.getElementById("btn-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("backdrop").classList.add("show");
});
document.getElementById("backdrop").addEventListener("click", fecharMenuMobile);
document.getElementById("modal-certificado").addEventListener("click", e => { if(e.target.id==="modal-certificado") fecharCertificado(); });
