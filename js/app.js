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
   Login / logout / shell
   ============================================================ */
document.getElementById("form-login").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("input-email").value.trim();
  /* A conta vem do registo criado pelo administrador em Membros.
     Se não existir, um convite pendente cria-a; caso contrário entra-se
     como visitante, para a pré-visualização continuar a funcionar. */
  let membro = membroPorEmail(email) || aceitarConvitePendente(email);
  if(membro && membro.acesso==="bloqueado"){
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
  document.getElementById("view-login").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  irPara(estado.papel==="administrador" ? "admin-visao" : "dashboard");
});

document.getElementById("btn-logout").addEventListener("click", () => {
  estado.prevendoComoAluno = false;
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("view-login").classList.remove("hidden");
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
    DB.notificacoes.forEach(n => n.lida = true);
    atualizarSidebarGlobal();
  }
});
document.addEventListener("click", e => {
  const painel = document.getElementById("notif-panel");
  if(!painel.classList.contains("hidden") && !e.target.closest(".notif-wrap")) painel.classList.add("hidden");
});

document.getElementById("btn-tema").addEventListener("click", () => {
  document.body.classList.toggle("light");
});

document.getElementById("btn-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("backdrop").classList.add("show");
});
document.getElementById("backdrop").addEventListener("click", fecharMenuMobile);
document.getElementById("modal-certificado").addEventListener("click", e => { if(e.target.id==="modal-certificado") fecharCertificado(); });
