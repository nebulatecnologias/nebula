/* ============================================================
   Helpers de dados
   ============================================================ */
function cursoPorId(id){ return DB.cursos.find(c=>c.id===id); }
function todasAsAulasDoCurso(curso){ return curso.modulos.flatMap(m=>m.aulas.map(a=>({...a, moduloId:m.id, moduloTitulo:m.titulo}))); }
function localizarAula(cursoId, aulaId){
  const curso = cursoPorId(cursoId); if(!curso) return null;
  for(const m of curso.modulos){ const i = m.aulas.findIndex(a=>a.id===aulaId); if(i!==-1) return { curso, modulo:m, aula:m.aulas[i] }; }
  return null;
}
function estadoDaAula(cursoId, aulaId){ if(estado.progresso[aulaId]) return "concluida"; if(aulaId===estado.ultimaAulaPorCurso[cursoId]) return "progresso"; return "porver"; }
function progressoModulo(m){ const concluidas = m.aulas.filter(a=>estado.progresso[a.id]).length; return { concluidas, total:m.aulas.length }; }
function progressoCurso(curso){ const aulas = todasAsAulasDoCurso(curso); const concluidas = aulas.filter(a=>estado.progresso[a.id]).length; const total = aulas.length; return { concluidas, total, pct: total?Math.round(concluidas/total*100):0 }; }
function progressoGeral(){ let concluidas=0, total=0; DB.cursos.forEach(c=>{ const p=progressoCurso(c); concluidas+=p.concluidas; total+=p.total; }); return { concluidas, total, pct: total?Math.round(concluidas/total*100):0 }; }
function aulaAnteriorProxima(curso, aulaId){ const l = todasAsAulasDoCurso(curso); const i = l.findIndex(a=>a.id===aulaId); return { anterior: i>0?l[i-1]:null, proxima:(i!==-1 && i<l.length-1)?l[i+1]:null }; }
function iniciais(nome){ return nome.trim().split(/\s+/).slice(0,2).map(p=>p[0].toUpperCase()).join(""); }
function avatarConteudo(){ return estado.fotoUrl ? `<img src="${estado.fotoUrl}" alt="">` : iniciais(estado.nome); }
function calcularXP(){ return progressoGeral().concluidas * DB.config.gamificacao.xpPorAula; }
function calcularNivel(){ return Math.floor(calcularXP()/DB.config.gamificacao.xpPorNivel)+1; }
function xpNoNivelAtual(){ return calcularXP()%DB.config.gamificacao.xpPorNivel; }
function conquistaDesbloqueada(b){
  const regra = b.regra || {};
  const geral = progressoGeral();
  switch(regra.tipo){
    case "aulas":       return geral.concluidas >= regra.valor;
    case "modulos":     return DB.cursos.filter(c=>c.modulos.some(m=>{ const p=progressoModulo(m); return p.total>0 && p.concluidas===p.total; })).length >= regra.valor;
    case "cursos":      return DB.cursos.filter(c=>progressoCurso(c).pct===100).length >= regra.valor;
    case "sequencia":   return estado.streakDias >= regra.valor;
    case "categorias":  return new Set(DB.cursos.filter(c=>progressoCurso(c).concluidas>0).map(c=>c.categoria)).size >= regra.valor;
    case "percentagem": return geral.pct >= regra.valor;
    default:            return false;
  }
}
function badgesDesbloqueados(){ return new Set(DB.conquistas.filter(conquistaDesbloqueada).map(b=>b.id)); }
function formatarDataEvento(dataStr){ const [y,m,d] = dataStr.split("-").map(Number); const meses=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]; return { dia:String(d).padStart(2,"0"), mes:meses[m-1] }; }
function diasAte(dataHora){ const diff = Math.round((dataHora - new Date())/86400000); return diff; }
function iconeCheck(){ return '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>'; }
function iconePlay(){ return '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'; }

/* ============================================================
   Toasts
   ============================================================ */
function mostrarToast(msg){
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = iconeCheck() + "<span>" + msg + "</span>";
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s ease, transform .25s ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function renderNotificacoes(){
  const painel = document.getElementById("notif-panel");
  painel.innerHTML = `
    <div class="notif-panel-head">Notificações</div>
    <div class="notif-list">
      ${DB.notificacoes.length ? DB.notificacoes.map(n => `
        <div class="notif-item">
          <span class="dot-unread ${n.lida?"lida":""}"></span>
          <div class="txt"><strong>${n.titulo}</strong><p>${n.desc}</p><span class="tempo">${n.tempo}</span></div>
        </div>
      `).join("") : '<div class="notif-empty">Sem notificações por agora.</div>'}
    </div>
  `;
}

/* ============================================================
   Router
   ============================================================ */
function irPara(view, a, b){
  estado.viewAtual = view;
  if(view!=="calendario" && bannerTimer){ clearInterval(bannerTimer); bannerTimer=null; }
  const isAdminExtra = view.indexOf("admin-")===0 && view!=="admin-visao";
  const containerId = isAdminExtra ? "content-admin-placeholder" : "content-"+view;
  document.querySelectorAll("#app-shell .content > div").forEach(v=>v.classList.add("hidden"));
  document.getElementById(containerId).classList.remove("hidden");
  renderSidebarNav(view);
  if(view==="dashboard") renderDashboard();
  if(view==="catalogo") renderCatalogo();
  if(view==="curso") renderCurso(a);
  if(view==="aula") renderAula(a, b);
  if(view==="comunidade") renderComunidade();
  if(view==="conquistas") renderConquistas();
  if(view==="calendario") renderCalendario();
  if(view==="certificados") renderCertificados();
  if(view==="definicoes") renderDefinicoes();
  if(view==="admin-visao") renderAdminVisaoGeral();
  if(isAdminExtra) renderAdminPlaceholder(view);
  renderSidebarFoot();
  atualizarSidebarGlobal();
  atualizarTopbarCTA(view);
  renderAvisoPrevia();
  fecharMenuMobile();
  window.scrollTo(0,0);
}

function renderSidebarNav(activeView){
  const lista = papelEfetivo()==="administrador" ? NAV_ADMIN : NAV_ALUNO;
  const navView = (activeView==="curso" || activeView==="aula") ? "catalogo" : activeView;
  const el = document.getElementById("sidebar-nav-items");
  el.innerHTML = lista.map(grupo => `
    <div class="nav-label">${grupo.grupo}</div>
    ${grupo.itens.map(it => `
      <div class="nav-item ${it.view===navView?"active":""}" data-view="${it.view}">
        ${it.icon}
        <span>${it.label}</span>
        ${it.dot ? `<span class="nav-dot hidden" id="dot-${it.dot}"></span>` : ""}
      </div>
    `).join("")}
  `).join("");
  el.querySelectorAll(".nav-item[data-view]").forEach(n => n.addEventListener("click", () => irPara(n.getAttribute("data-view"))));
}

function renderSidebarFoot(){
  const el = document.getElementById("sidebar-foot");
  if(papelEfetivo()==="administrador"){
    el.innerHTML = `
      <div class="user-chip">
        <div class="avatar">${avatarConteudo()}</div>
        <div class="user-chip-info"><div class="name">${estado.nome}</div><div class="role">Administrador</div></div>
        ${ICONS.chevronDown}
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="progress-mini-label"><span>Progresso geral</span><span id="sidebar-pct">0%</span></div>
      <div class="progress-track thin"><div class="progress-fill mini" id="sidebar-progress-fill" style="width:0%"></div></div>
    `;
  }
}

function atualizarTopbarCTA(view){
  const el = document.getElementById("topbar-cta");
  if(estado.papel==="administrador" && !estado.prevendoComoAluno && view.indexOf("admin-")===0){
    el.innerHTML = `<button class="btn btn-secondary btn-sm" id="btn-ver-como-aluno">Ver como aluno</button>`;
    document.getElementById("btn-ver-como-aluno").addEventListener("click", entrarPreviaAluno);
  } else {
    el.innerHTML = "";
  }
}

/* Permite ao administrador confirmar, na vista real do aluno, o efeito do que configurou. */
function entrarPreviaAluno(){
  estado.prevendoComoAluno = true;
  irPara("dashboard");
}

function sairPreviaAluno(){
  estado.prevendoComoAluno = false;
  irPara("admin-visao");
}

function papelEfetivo(){
  return (estado.papel==="administrador" && !estado.prevendoComoAluno) ? "administrador" : "aluno";
}

function renderAvisoPrevia(){
  document.querySelectorAll(".aviso-previa").forEach(el => el.remove());
  if(!estado.prevendoComoAluno) return;
  const conteudo = document.querySelector("#app-shell .content > div:not(.hidden)");
  if(!conteudo) return;
  const aviso = document.createElement("div");
  aviso.className = "aviso-previa";
  aviso.innerHTML = `<span>Estás a ver a área como um aluno a vê.</span><button class="btn btn-secondary btn-sm" id="btn-sair-previa">Voltar ao painel</button>`;
  conteudo.prepend(aviso);
  document.getElementById("btn-sair-previa").addEventListener("click", sairPreviaAluno);
}

function atualizarSidebarGlobal(){
  const p = progressoGeral();
  const pct = document.getElementById("sidebar-pct");
  const fill = document.getElementById("sidebar-progress-fill");
  if(pct) pct.textContent = p.pct + "%";
  if(fill) fill.style.width = p.pct + "%";
  document.getElementById("avatar-iniciais").innerHTML = avatarConteudo();
  const dotCert = document.getElementById("dot-certificados");
  if(dotCert){ const temCertificado = DB.cursos.some(c=>progressoCurso(c).pct===100); dotCert.classList.toggle("hidden", !temCertificado); }
  const dotCal = document.getElementById("dot-calendario");
  if(dotCal){ const proximoEm7Dias = DB.eventos.some(e=>{ const d=diasAte(new Date(e.data+"T"+e.hora+":00")); return d>=0 && d<=7; }); dotCal.classList.toggle("hidden", !proximoEm7Dias); }
  const dotCom = document.getElementById("dot-comunidade");
  if(dotCom) dotCom.classList.remove("hidden");
  const naoLidas = DB.notificacoes.filter(n=>!n.lida).length;
  const notifBadge = document.getElementById("notif-badge");
  if(notifBadge){ notifBadge.textContent = naoLidas; notifBadge.classList.toggle("hidden", naoLidas===0); }
}

function fecharMenuMobile(){
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("backdrop").classList.remove("show");
}

