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
      <h3>Algo correu mal ao abrir a área de membros</h3>
      <p>Isto costuma acontecer quando ficam dados antigos guardados neste browser. Podes repor os dados de demonstração — o conteúdo volta ao estado original.</p>
      <p class="hint" style="word-break:break-word;">${detalhe || ""}</p>
      <div class="confirm-acoes">
        <button class="btn btn-secondary" type="button" id="btn-recarregar">Tentar de novo</button>
        <button class="btn btn-primary" type="button" id="btn-repor-dados">Repor dados</button>
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
      "Não foi possível carregar a biblioteca do Supabase.<br>Verifica a ligação à internet e recarrega a página.";
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
    avisoLogin(erro.message || "Não foi possível ligar à academia.");
  }
}

/* Carrega tudo o que esta pessoa pode ver e abre a área. Se alguma
   coisa falhar a meio, volta ao login com o motivo à vista: ficar para
   sempre no ecrã de carregamento é a pior saída possível. */
async function entrarNaArea(){
  mostrarEcra("arranque");
  document.getElementById("arranque-texto").textContent = "A carregar os teus cursos...";
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
  irPara(estado.papel === "administrador" ? "admin-visao" : "dashboard");
  ligarComunidadeEmDireto();
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

  if(!email || !password){ avisoLogin("Preenche o email e a password."); return; }

  botao.disabled = true;
  botao.textContent = "A entrar...";
  try {
    await API.entrar(email, password);
    await entrarNaArea();
  } catch(erro){
    avisoLogin(erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});

/* O modo de demonstração mantém o comportamento antigo, para os
   testes automáticos e para mostrar a aplicação sem servidor. */
function entrarEmDemonstracao(email){
  let membro = membroPorEmail(email) || aceitarConvitePendente(email);
  if(membro && membro.acesso === "bloqueado"){
    mostrarToast("Este acesso está bloqueado. Fala com a tua mentoria.");
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
  mostrarEcra("app");
  irPara(estado.papel === "administrador" ? "admin-visao" : "dashboard");
  if(onboardingPendente()) abrirOnboarding(false);
}

/* ---------------- Recuperar password ---------------- */
document.getElementById("btn-esqueci").addEventListener("click", async e => {
  e.preventDefault();
  const email = document.getElementById("input-email").value.trim();
  if(!email){ avisoLogin("Escreve primeiro o teu email, e depois carrega aqui."); return; }
  if(modoDemonstracao()){ avisoLogin("Em modo de demonstração não há emails.", "nota"); return; }
  try {
    await API.pedirNovaPassword(email);
    avisoLogin("Enviámos-te um link para " + email + ". Confirma também a pasta de spam.", "nota");
  } catch(erro){ avisoLogin(erro.message); }
});

document.getElementById("btn-pedir-acesso").addEventListener("click", e => {
  e.preventDefault();
  const apoio = (DB.config.integracoes || {}).suporteUrl;
  if(apoio) abrirLink(apoio);
  else avisoLogin("Pede o convite a quem te acompanha na academia.", "nota");
});

/* Formulário de nova password, depois do link do email. */
function pedirNovaPassword(primeiraVez){
  const cartao = document.querySelector(".login-card");
  cartao.innerHTML = `
    <h1>${primeiraVez ? "Boas-vindas à academia" : "Escolhe uma nova password"}</h1>
    <p class="sub">${primeiraVez ? "Escolhe a password com que passas a entrar. Pelo menos 8 caracteres." : "Tem de ter pelo menos 8 caracteres."}</p>
    <div class="field"><label>Nova password</label><input type="password" id="pass-nova"></div>
    <div class="field"><label>Repete</label><input type="password" id="pass-repete"></div>
    <button class="btn btn-primary btn-block btn-lg" id="btn-definir-pass">${primeiraVez ? "Entrar na academia" : "Guardar e entrar"}</button>
    <div class="login-aviso hidden" id="login-aviso"></div>
  `;
  document.getElementById("btn-definir-pass").addEventListener("click", async () => {
    const nova = document.getElementById("pass-nova").value;
    const repete = document.getElementById("pass-repete").value;
    if(nova.length < 8){ avisoLogin("A password tem de ter pelo menos 8 caracteres."); return; }
    if(nova !== repete){ avisoLogin("As duas passwords não são iguais."); return; }
    try {
      await API.definirPassword(nova);
      history.replaceState(null, "", location.pathname);
      const utilizador = await API.sessao();
      if(utilizador) await entrarNaArea();
      else location.reload();
    } catch(erro){ avisoLogin(erro.message); }
  });
}

document.getElementById("btn-logout").addEventListener("click", async () => {
  estado.prevendoComoAluno = false;
  if(!modoDemonstracao()){ API.pararDeOuvir(); await API.sair(); }
  location.reload();
});

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
  const claro = !document.body.classList.contains("light");
  document.body.classList.toggle("light", claro);
  estado.tema = claro ? "light" : "dark";
  salvarPerfil();
});

/* A identidade definida no painel é aplicada logo no ecrã de entrada. */
arrancar();

document.getElementById("btn-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("backdrop").classList.add("show");
});
document.getElementById("backdrop").addEventListener("click", fecharMenuMobile);
document.getElementById("modal-certificado").addEventListener("click", e => { if(e.target.id==="modal-certificado") fecharCertificado(); });
