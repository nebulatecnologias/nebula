/* ============================================================
   Helpers de dados
   ============================================================ */
function cursoPorId(id){ return DB.cursos.find(c=>c.id===id); }
/* O aluno só vê cursos publicados; o administrador vê também os rascunhos. */
/* Quem está na sessão, segundo o registo de Membros. */
function membroAtual(){ return estado.membroId ? DB.membros.find(m=>m.id===estado.membroId) : null; }

function sincronizarSessaoComMembro(membro){
  estado.membroId = membro.id;
  estado.nome = membro.nome;
  estado.email = membro.email;
  estado.papel = membro.papel || "aluno";
}

/* Os cursos que este aluno pode mesmo abrir.
   Em produção a lista vem do servidor, que é quem sabe: inscrições do
   CRM, acessos dados por convite e os cursos do plano geral. Um cartão
   que o aluno não pode abrir não deve estar aqui — abria sem aulas
   nenhumas, e isso não é um cartão, é uma porta fechada pintada de
   porta aberta. A Vitrine é o lugar desses.
   Sem servidor (demonstração) vale o plano, como sempre valeu. */
function cursosVisiveis(){
  const publicados = DB.cursos.filter(c => c.publicado !== false);
  if(papelEfetivo() === "administrador") return publicados;
  if(Array.isArray(DB.meusCursos)){
    const comAcesso = new Set(DB.meusCursos);
    return publicados.filter(c => comAcesso.has(c.id));
  }
  const membro = membroAtual();
  const doPlano = cursosPermitidos(membro);
  const abertos = publicados.filter(c => c.abertoATodos).map(c => c.id);
  if(!doPlano) return publicados;                    // acesso total
  const permitidos = new Set([...doPlano, ...cursosPorTurma(membro), ...abertos]);
  return publicados.filter(c => permitidos.has(c.id));
}
function categoriaDe(id){ return DB.categorias[id] || { nome:"Sem categoria", cor:"#6c6b74" }; }

/* Como um encontro se paga. O aluno vê isto como etiqueta no cartão. */
const ROTULO_ACESSO = { gratuito:"Gratuito", exclusivo:"Exclusivo", pago:"Pago" };

/* ============================================================
   Aparência
   O que o administrador define em Aparência é aplicado aqui:
   cor, nome, logótipo e tema. Uma só função, chamada ao arrancar
   e sempre que a configuração muda.
   ============================================================ */
function hexParaRgba(hex, alfa){
  const h = (hex||"#ff5a1f").replace("#","");
  const n = h.length===3 ? h.split("").map(c=>c+c).join("") : h;
  const num = parseInt(n,16);
  return `rgba(${(num>>16)&255}, ${(num>>8)&255}, ${num&255}, ${alfa})`;
}
function clarearHex(hex, quanto){
  const h = (hex||"#ff5a1f").replace("#","");
  const n = h.length===3 ? h.split("").map(c=>c+c).join("") : h;
  const num = parseInt(n,16);
  const mistura = c => Math.round(c + (255-c)*quanto);
  const r = mistura((num>>16)&255), g = mistura((num>>8)&255), b = mistura(num&255);
  return "#" + [r,g,b].map(c=>c.toString(16).padStart(2,"0")).join("");
}

function crestSVG(cor, pequeno){
  const tam = pequeno ? ' width="30" height="30"' : "";
  return `<svg class="crest" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"${tam}><path d="M20 2L35 8V19C35 28.5 28.8 35.6 20 38C11.2 35.6 5 28.5 5 19V8L20 2Z" stroke="${cor}" stroke-width="2"/><path d="M13 19L18 24L27 14" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function marcaHTML(pequeno){
  const a = DB.aparencia;
  const marca = a.logoUrl
    ? `<img class="crest logo-imagem" src="${a.logoUrl}" alt="${a.nomeEscola}"${pequeno?' style="width:30px;height:30px;"':""}>`
    : crestSVG(a.corAccent, pequeno);
  return `${marca}<span class="wordmark">${a.nomeEscola}<small>${a.sublinha||""}</small></span>`;
}

function aplicarAparencia(){
  const a = DB.aparencia;
  const raiz = document.documentElement.style;
  raiz.setProperty("--accent", a.corAccent);
  raiz.setProperty("--accent-hover", clarearHex(a.corAccent, 0.18));
  raiz.setProperty("--accent-soft", hexParaRgba(a.corAccent, 0.14));
  raiz.setProperty("--accent-line", hexParaRgba(a.corAccent, 0.35));

  document.title = a.nomeEscola + " — Área de Membros";
  document.querySelectorAll(".brand-mark").forEach(el => {
    el.innerHTML = marcaHTML(!!el.closest(".sidebar-head"));
  });

  const kicker = document.querySelector("#login-quote .kicker");
  const titulo = document.querySelector("#login-quote h2");
  const texto  = document.querySelector("#login-quote p");
  if(kicker) kicker.textContent = a.nomeEscola.toUpperCase();
  if(titulo) titulo.textContent = a.loginTitulo;
  if(texto)  texto.textContent = a.loginTexto;
  const rodape = document.getElementById("login-rodape");
  if(rodape) rodape.textContent = a.rodape || "";

  /* O tema que a pessoa escolheu no botão manda sobre o tema por omissão. */
  const tema = estado.tema || a.temaPadrao;
  document.body.classList.toggle("light", tema === "light");
}

/* Só as abas ligadas em Configurações chegam ao aluno. */
function navDoAluno(){
  const ligadas = new Set(DB.config.abasAluno || []);
  return NAV_ALUNO
    .map(g => ({ ...g, itens:g.itens.filter(i => ligadas.has(i.view)) }))
    .filter(g => g.itens.length);
}
function abaDoAlunoLigada(view){
  if(view==="curso" || view==="aula") return (DB.config.abasAluno||[]).includes("catalogo");
  return !NAV_ALUNO.some(g=>g.itens.some(i=>i.view===view)) || (DB.config.abasAluno||[]).includes(view);
}
/* Cursos criados pelo administrador ainda não têm estatísticas registadas. */
function statsCurso(id){ return DB.cursoStats[id] || { inscritos:0, conclusao:0, avaliacao:0 }; }
function formatarTamanho(bytes){
  if(bytes < 1024) return bytes + " B";
  if(bytes < 1024*1024) return Math.round(bytes/1024) + " KB";
  return (bytes/1024/1024).toFixed(1) + " MB";
}

function contarAulas(curso){ return curso.modulos.reduce((s,m)=>s+m.aulas.length, 0); }

/* ============================================================
   Vídeo das aulas
   O endereço vem do código de incorporação que o administrador
   copia do provedor (Panda Video, YouTube, Vimeo...). Só se
   aproveita o endereço: o iframe é sempre construído por nós,
   para o player ficar com o nosso estilo e para nenhum HTML
   vindo de fora entrar na página.
   ============================================================ */
function urlDoEmbed(texto){
  if(!texto) return null;
  const t = String(texto).trim();
  if(!t) return null;
  const comIframe = t.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  const bruto = comIframe ? comIframe[1] : (/^https?:\/\//i.test(t) ? t.split(/\s/)[0] : null);
  if(!bruto) return null;
  return normalizarUrlVideo(bruto.replace(/&amp;/g, "&"));
}

/* Endereços de partilha do YouTube e do Vimeo não reproduzem dentro de
   um iframe — passam-se para a forma de incorporação. */
function normalizarUrlVideo(url){
  try {
    const u = new URL(url, location.href);
    if(u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
    if(host === "youtu.be") return "https://www.youtube.com/embed" + u.pathname + u.search;
    if(host.endsWith("youtube.com")){
      const v = u.searchParams.get("v");
      if(u.pathname === "/watch" && v) return "https://www.youtube.com/embed/" + v;
      if(u.pathname.startsWith("/shorts/")) return "https://www.youtube.com/embed/" + u.pathname.split("/")[2];
    }
    if(host === "vimeo.com" && /^\/\d+/.test(u.pathname)) return "https://player.vimeo.com/video" + u.pathname;
    return u.href;
  } catch(e){ return null; }
}

function urlDoVideo(aula){
  if(!aula) return null;
  const doEmbed = urlDoEmbed(aula.embed);
  if(doEmbed) return doEmbed;
  /* Aulas de versões anteriores guardam só o ID, com o modelo de
     endereço definido em Integrações. Continuam a funcionar. */
  const i = DB.config.integracoes || {};
  if(!i.playerAtivo || !aula.videoId) return null;
  return normalizarUrlVideo((i.playerUrl||"").replace("{conta}", i.playerId||"").replace("{id}", aula.videoId));
}

function temVideo(aula){ return !!urlDoVideo(aula); }

/* O player, sempre com a nossa moldura. */
function playerHTML(aula, titulo){
  const url = urlDoVideo(aula);
  if(url){
    return `<iframe class="player-embed" src="${comApiDoPlayer(url)}" title="${(titulo||"").replace(/"/g,"&quot;")}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }
  const temCodigo = (aula && aula.embed || "").trim();
  return `
    <div class="placeholder-inner">
      <div class="play-badge"><svg class="icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      <div class="placeholder-label">${temCodigo ? "CÓDIGO DE INCORPORAÇÃO NÃO RECONHECIDO" : "AULA SEM VÍDEO"}</div>
      <div class="placeholder-sub">${temCodigo
        ? "O código colado não traz um endereço de vídeo."
        : "Cola o código de incorporação em Conteúdos › aula › Vídeo."}</div>
    </div>`;
}
/* ============================================================
   Quanto tempo tem a aula
   Ninguém devia ter de cronometrar um vídeo à mão para escrever a
   duração num campo. Quem sabe é o próprio leitor: pergunta-se-lhe.
   ============================================================ */

/* O YouTube só responde a quem lhe pede com a API ligada. */
function comApiDoPlayer(url){
  try {
    const u = new URL(url, location.href);
    if(u.hostname.replace(/^www\./, "").endsWith("youtube.com") && !u.searchParams.has("enablejsapi")){
      u.searchParams.set("enablejsapi", "1");
      u.searchParams.set("origin", location.origin);
      return u.href;
    }
    return url;
  } catch(e){ return url; }
}

/* "00:00" gravado não é uma duração, é a falta dela. */
function duracaoLegivel(aula){
  const d = String((aula && aula.duracao) || "").trim();
  return (!d || /^0+:0+$/.test(d)) ? "" : d;
}

function formatarDuracao(segundos){
  const t = Math.round(Number(segundos) || 0);
  if(t <= 0) return "";
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const dois = n => String(n).padStart(2, "0");
  return h ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/* Cada leitor responde à sua maneira; só nos interessa o número. */
function duracaoNaMensagem(dados){
  let d = dados;
  if(typeof d === "string"){
    try { d = JSON.parse(d); } catch(e){ return 0; }
  }
  if(!d || typeof d !== "object") return 0;
  const candidatos = [
    d.duration,                                   // Panda e a maioria
    d.info && d.info.duration,                    // YouTube
    d.data && d.data.duration,                    // Vimeo (eventos)
    d.method === "getDuration" ? d.value : null   // Vimeo (resposta directa)
  ];
  for(const c of candidatos){
    const n = Number(c);
    if(n > 0 && n < 86400) return n;              // nada dura mais de um dia
  }
  return 0;
}

/* Pergunta ao leitor quanto tempo tem, e desiste em silêncio se ele
   não responder: uma duração em falta nunca pode partir uma aula. */
function medirDuracao(iframe, aoSaber){
  if(!iframe || !iframe.contentWindow) return;
  const leitor = iframe.contentWindow;
  let terminado = false;

  const desistir = () => {
    if(terminado) return;
    terminado = true;
    clearInterval(relogio);
    window.removeEventListener("message", aoResponder);
  };

  function aoResponder(ev){
    if(ev.source !== leitor) return;
    const segundos = duracaoNaMensagem(ev.data);
    if(!segundos) return;
    desistir();
    aoSaber(formatarDuracao(segundos), segundos);
  }

  function perguntar(){
    try {
      leitor.postMessage('{"event":"listening"}', "*");                                        // YouTube
      leitor.postMessage(JSON.stringify({ method:"addEventListener", value:"loaded" }), "*");  // Vimeo
      leitor.postMessage(JSON.stringify({ method:"getDuration" }), "*");                       // Vimeo
    } catch(e){ /* o leitor ainda não está pronto */ }
  }

  window.addEventListener("message", aoResponder);
  const relogio = setInterval(perguntar, 1200);
  perguntar();
  setTimeout(desistir, 20000);
}

function bannersAtivos(){ return DB.banners.filter(b => b.ativo !== false); }
function fundoBanner(b){
  return b.imagem
    ? `background-image:url(${b.imagem});background-size:cover;background-position:center;`
    : `background:${b.gradiente || "linear-gradient(120deg,#ff5a1f,#c23f13)"};`;
}
/* Primeira aula de um curso, no formato de localizarAula(). Serve de recurso
   quando a última aula vista já não existe. */
function primeiraAulaDoCurso(curso){
  for(const m of curso.modulos){
    if(m.aulas.length) return { curso, modulo:m, aula:m.aulas[0] };
  }
  return null;
}
function todasAsAulasDoCurso(curso){ return curso.modulos.flatMap(m=>m.aulas.map(a=>({...a, moduloId:m.id, moduloTitulo:m.titulo}))); }
function localizarAula(cursoId, aulaId){
  const curso = cursoPorId(cursoId); if(!curso) return null;
  for(const m of curso.modulos){ const i = m.aulas.findIndex(a=>a.id===aulaId); if(i!==-1) return { curso, modulo:m, aula:m.aulas[i] }; }
  return null;
}
function estadoDaAula(cursoId, aulaId){ if(estado.progresso[aulaId]) return "concluida"; if(aulaId===estado.ultimaAulaPorCurso[cursoId]) return "progresso"; return "porver"; }
function progressoModulo(m){ const concluidas = m.aulas.filter(a=>estado.progresso[a.id]).length; return { concluidas, total:m.aulas.length }; }
function progressoCurso(curso){ const aulas = todasAsAulasDoCurso(curso); const concluidas = aulas.filter(a=>estado.progresso[a.id]).length; const total = aulas.length; return { concluidas, total, pct: total?Math.round(concluidas/total*100):0 }; }
function progressoGeral(){ let concluidas=0, total=0; cursosVisiveis().forEach(c=>{ const p=progressoCurso(c); concluidas+=p.concluidas; total+=p.total; }); return { concluidas, total, pct: total?Math.round(concluidas/total*100):0 }; }
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
    case "modulos":     return cursosVisiveis().filter(c=>c.modulos.some(m=>{ const p=progressoModulo(m); return p.total>0 && p.concluidas===p.total; })).length >= regra.valor;
    case "cursos":      return cursosVisiveis().filter(c=>progressoCurso(c).pct===100).length >= regra.valor;
    case "sequencia":   return estado.streakDias >= regra.valor;
    case "categorias":  return new Set(cursosVisiveis().filter(c=>progressoCurso(c).concluidas>0).map(c=>c.categoria)).size >= regra.valor;
    case "percentagem": return geral.pct >= regra.valor;
    default:            return false;
  }
}
function badgesDesbloqueados(){ return new Set(DB.conquistas.filter(conquistaDesbloqueada).map(b=>b.id)); }
function formatarDataEvento(dataStr){ const [y,m,d] = dataStr.split("-").map(Number); const meses=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]; return { dia:String(d).padStart(2,"0"), mes:meses[m-1] }; }
function diasAte(dataHora){ const diff = Math.round((dataHora - new Date())/86400000); return diff; }
/* Certificado: um só desenho, usado pelo aluno e pela pré-visualização do painel. */
function certificadoHTML({ nome, curso, data, comFechar }){
  const c = DB.config.certificado;
  return `
    ${comFechar ? '<button class="modal-close" id="btn-fechar-certificado"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' : ""}
    <svg class="crest" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 2L35 8V19C35 28.5 28.8 35.6 20 38C11.2 35.6 5 28.5 5 19V8L20 2Z" stroke="${DB.aparencia.corAccent}" stroke-width="2"/><path d="M13 19L18 24L27 14" stroke="${DB.aparencia.corAccent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="kicker">${c.titulo}</span>
    <h2>${nome}</h2>
    <p style="color:var(--text-dim);">${c.frase}</p>
    <div class="cert-course">${curso}</div>
    <p style="color:var(--text-dim);font-size:13px;">${c.rodape}</p>
    ${c.assinaturaNome ? `<div class="cert-assinatura"><span class="linha"></span><strong>${c.assinaturaNome}</strong><span class="cargo">${c.assinaturaCargo||""}</span></div>` : ""}
    <div class="cert-date">Emitido em ${data}</div>
  `;
}

/* Um curso emite certificado quando o aluno chega à percentagem definida no painel. */
function regraCertificado(){ return DB.config.certificado.regraPct || 100; }
function cursoEmiteCertificado(curso){ return curso.certificado !== false; }
function certificadoDesbloqueado(curso){
  return cursoEmiteCertificado(curso) && progressoCurso(curso).pct >= regraCertificado();
}

/* Avaliação da aula feita por quem está na sessão. */
function minhaAvaliacao(aulaId){
  const membro = membroAtual();
  return (DB.avaliacoes||[]).find(a => a.aulaId===aulaId && (membro ? a.membroId===membro.id : a.membroId===null));
}
function espacoPorId(id){ return (DB.espacos||[]).find(e=>e.id===id) || { nome:"Geral", cor:"#ff5a1f" }; }
function espacosAtivos(){ return (DB.espacos||[]).filter(e=>e.ativo!==false); }
/* O feed do aluno esconde o que foi moderado e põe os fixados à frente. */
function postsVisiveis(){
  const ativos = new Set(espacosAtivos().map(e=>e.id));
  return (DB.posts||[])
    .filter(p => !p.oculto && ativos.has(p.espacoId||"geral"))
    .sort((a,b) => (b.fixado?1:0) - (a.fixado?1:0));
}

function iconeCheck(){ return '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>'; }
/* Seta dentro de um círculo, à medida do texto onde está (1em). */
/* ============================================================
   Links para fora
   Um endereço escrito sem "https://" é lido pelo browser como um
   caminho dentro da própria plataforma — e a página de destino nunca
   abre. Aqui damos-lhe o esquema que falta, e recusamos os esquemas
   que não servem para navegar.
   ============================================================ */
function linkExterno(url){
  const t = String(url || "").trim();
  if(!t || t === "#") return "";
  /* mailto: e tel: são legítimos e não levam https. */
  if(/^(mailto:|tel:)/i.test(t)) return t;
  /* Um esquema perigoso não passa, venha de onde vier. */
  if(/^(javascript|data|vbscript):/i.test(t)) return "";
  if(/^https?:\/\//i.test(t)) return t;
  /* Parece um email escrito à mão? Trata-se como email. */
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "mailto:" + t;
  /* Falta o esquema: é o caso do kingdomcompny.com/pagina. */
  return "https://" + t.replace(/^\/+/, "");
}

/* Abre um endereço numa aba nova, já normalizado. */
function abrirLink(url){
  const destino = linkExterno(url);
  if(!destino){ mostrarToast("Este link não é válido."); return false; }
  window.open(destino, "_blank", "noopener");
  return true;
}

function setaCirculo(){
  return '<svg class="seta-circulo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5 13.5 12 10 15.5"/></svg>';
}
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
        <div class="notif-item ${destinoDaNotificacao(n)?"clicavel":""}" data-notif="${n.id}">
          <span class="dot-unread ${n.lida?"lida":""}"></span>
          <div class="txt"><strong>${n.titulo}</strong><p>${n.desc}</p><span class="tempo">${n.tempo}</span></div>
        </div>
      `).join("") : '<div class="notif-empty">Sem notificações por agora.</div>'}
    </div>
  `;

  painel.querySelectorAll("[data-notif]").forEach(el => el.addEventListener("click", () => {
    const n = DB.notificacoes.find(x => x.id === el.getAttribute("data-notif"));
    const destino = n && destinoDaNotificacao(n);
    if(!destino) return;
    painel.classList.add("hidden");
    irPara(destino.view, destino.id);
  }));
}

/* Um aviso que não leva a lado nenhum é só ruído: só fica clicável se
   o que anuncia ainda existir e esta pessoa o puder abrir. */
function destinoDaNotificacao(n){
  if(!n.link) return null;
  if(n.tipo === "curso" || n.tipo === "aula"){
    const curso = (DB.cursos || []).find(c => c.id === n.link);
    return curso ? { view:"curso", id:curso.id } : null;
  }
  if(n.tipo === "evento"){
    const evento = (DB.eventos || []).find(e => e.id === n.link);
    return evento ? { view:"calendario" } : null;
  }
  return null;
}

/* ============================================================
   Router
   ============================================================ */
/* Registo de ecrãs: cada módulo inscreve os seus, para acrescentar
   abas novas sem mexer no router nem no HTML. */
const VIEWS = {};
function registarViews(mapa){ Object.assign(VIEWS, mapa); }

function irPara(view, a, b){
  estado.viewAtual = view;
  if(view!=="calendario" && view!=="dashboard" && view!=="admin-banners" && bannerTimer){ clearInterval(bannerTimer); bannerTimer=null; }
  const ehAdmin = view.indexOf("admin-")===0;
  const containerId = ehAdmin ? "content-admin" : "content-"+view;
  const container = document.getElementById(containerId);
  /* Um atalho antigo ou um ecrã que deixou de existir não pode deixar a
     app sem nada visível: voltamos ao início. */
  if(!container){ if(view!=="dashboard") irPara("dashboard"); return; }
  /* Uma aba desligada em Configurações não abre para o aluno. */
  if(!ehAdmin && papelEfetivo()!=="administrador" && !abaDoAlunoLigada(view) && view!=="dashboard"){ irPara("dashboard"); return; }
  document.querySelectorAll("#app-shell .content > div").forEach(v=>v.classList.add("hidden"));
  container.classList.remove("hidden");
  renderSidebarNav(view);
  const render = VIEWS[view];
  if(render) render(a, b);
  else if(ehAdmin) renderAdminPlaceholder(view);
  renderSidebarFoot();
  atualizarSidebarGlobal();
  atualizarTopbarCTA(view);
  renderAvisoPrevia();
  fecharMenuMobile();
  window.scrollTo(0,0);
}

function renderSidebarNav(activeView){
  const lista = papelEfetivo()==="administrador" ? NAV_ADMIN : navDoAluno();
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

