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

/* A coroa da Kingdom: quadrado laranja com a coroa branca, o mesmo sinal da
   Kingdom Library. Com uma cor de destaque própria, a coroa veste essa cor. */
const COR_KINGDOM = "#f4621d";
let contadorCoroas = 0;
function crestSVG(cor, pequeno){
  const tam = pequeno ? ' width="34" height="34"' : "";
  const id = "kc-" + (++contadorCoroas);
  const propria = cor && !corEhDaKingdom(cor);
  const fundo = propria
    ? `<rect width="64" height="64" rx="15" fill="${cor}"/>`
    : `<defs><linearGradient id="${id}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ff8a4a"/><stop offset=".55" stop-color="#f7662a"/><stop offset="1" stop-color="#e8480c"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#${id})"/>`;
  return `<svg class="crest" viewBox="0 0 64 64" role="img" aria-label="Kingdom"${tam}>${fundo}<path d="M12.5 27.1 23.9 30.7 31.9 17.9 39.9 30.7 49.7 27.1 46.5 44.8H17.7Z" fill="#fff" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}

/* O laranja antigo da Academia e o da Library contam como "a cor da casa":
   ficam com a paleta completa da Library em vez de uma cor avulsa. */
function corEhDaKingdom(cor){
  const c = String(cor || "").trim().toLowerCase();
  return !c || c === COR_KINGDOM || c === "#ff5a1f";
}

/* Um campo pastel por curso, sempre o mesmo para o mesmo curso — as capas sem
   imagem ficam com cor própria em vez de um cinzento igual para todas. */
const CAMPOS_PASTEL = ["apricot","sky","meadow","lavender","sand","lagoon","blush","wheat"];
function campoDoCurso(id){
  const t = String(id || "");
  let h = 0;
  for(let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return `var(--field-${CAMPOS_PASTEL[h % CAMPOS_PASTEL.length]})`;
}

function marcaHTML(pequeno){
  const a = DB.aparencia;
  const marca = a.logoUrl
    ? `<img class="crest logo-imagem" src="${a.logoUrl}" alt="${a.nomeEscola}"${pequeno?' style="width:34px;height:34px;"':""}>`
    : crestSVG(a.corAccent, pequeno);
  return `${marca}<span class="wordmark">${a.nomeEscola}<small>${a.sublinha||""}</small></span>`;
}

function aplicarAparencia(){
  const a = DB.aparencia;
  const raiz = document.documentElement.style;
  const propriedades = ["--accent","--accent-soft","--accent-ink","--accent-line","--cta","--cta-hover","--cta-shadow","--brand-panel","--ring"];
  if(corEhDaKingdom(a.corAccent)){
    propriedades.forEach(p => raiz.removeProperty(p));
  } else {
    const c = a.corAccent;
    raiz.setProperty("--accent", c);
    raiz.setProperty("--accent-soft", `color-mix(in srgb, ${c} 14%, var(--surface))`);
    raiz.setProperty("--accent-ink", `color-mix(in srgb, ${c} 72%, var(--ink))`);
    raiz.setProperty("--accent-line", hexParaRgba(c, 0.35));
    raiz.setProperty("--cta", `linear-gradient(180deg, ${clarearHex(c, 0.14)} 0%, ${c} 100%)`);
    raiz.setProperty("--cta-hover", `linear-gradient(180deg, ${clarearHex(c, 0.22)} 0%, ${clarearHex(c, 0.06)} 100%)`);
    raiz.setProperty("--cta-shadow", `0 1px 0 rgba(255,255,255,.35) inset, 0 6px 16px -4px ${hexParaRgba(c, 0.55)}`);
    raiz.setProperty("--brand-panel", `linear-gradient(160deg, ${clarearHex(c, 0.16)} 0%, ${c} 100%)`);
    raiz.setProperty("--ring", `0 0 0 3px ${hexParaRgba(c, 0.28)}`);
  }

  document.title = a.nomeEscola + " — Área de Membros";
  document.querySelectorAll(".brand-mark").forEach(el => {
    el.innerHTML = marcaHTML(!!el.closest(".sidebar-head, .topbar"));
  });

  const titulo = document.querySelector("#login-quote h2");
  const texto  = document.querySelector("#login-quote p");
  if(titulo) titulo.textContent = a.loginTitulo;
  if(texto)  texto.textContent = a.loginTexto;
  const rodape = document.getElementById("login-rodape");
  if(rodape) rodape.textContent = a.rodape || "";

  aplicarTema();
}

/* ============================================================
   Tema
   Três valores: "light", "dark" e "auto". Por omissão segue o sistema,
   como a Kingdom Library. O botão do topo guarda a escolha da pessoa,
   que passa a mandar sobre o tema definido em Aparência.
   ============================================================ */
function temaEscolhido(){
  return estado.tema || DB.aparencia.temaPadrao || "auto";
}
function temaEfetivo(){
  const t = temaEscolhido();
  if(t === "light" || t === "dark") return t;
  try { return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  catch(e){ return "light"; }
}
function aplicarTema(){
  const t = temaEscolhido();
  const raiz = document.documentElement;
  if(t === "light" || t === "dark") raiz.setAttribute("data-theme", t);
  else raiz.removeAttribute("data-theme");
  document.body.classList.toggle("light", temaEfetivo() === "light");
}
try {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if(typeof DB !== "undefined") aplicarTema(); });
} catch(e){ /* browsers antigos: fica o tema do arranque */ }

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
      <div class="placeholder-label">${papelEfetivo() === "administrador" && temCodigo ? "Código de incorporação não reconhecido" : "Esta aula não tem vídeo"}</div>
      <div class="placeholder-sub">${papelEfetivo() === "administrador"
        ? (temCodigo ? "O código colado não traz um endereço de vídeo." : "Cola o código de incorporação em Conteúdos › aula › Vídeo.")
        : "O conteúdo desta aula está no texto e nos materiais abaixo. Podes marcá-la como concluída ou seguir para a próxima."}</div>
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
    : `background:${b.gradiente || "var(--brand-panel)"};`;
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
    ${crestSVG(DB.aparencia.corAccent)}
    <p class="cert-titulo">${c.titulo.charAt(0) + c.titulo.slice(1).toLowerCase()}</p>
    <h2>${nome}</h2>
    <p>${c.frase}</p>
    <div class="cert-course">${curso}</div>
    <p style="font-size:14px;">${c.rodape}</p>
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

/* ---- O ENDERECO ----------------------------------------------------------

   Ate aqui a Academia era uma pagina so: navegava-se por dentro e a barra de
   endereco dizia sempre a mesma coisa, estivesse a pessoa onde estivesse. Isso
   queria dizer tres coisas, todas mas: nao se podia mandar o link de um curso a
   ninguem, recarregar a pagina levava a pessoa de volta ao inicio, e o botao de
   recuar do browser saia da Academia em vez de recuar um passo.

   So o curso e a aula tem morada. O resto sao ecras da aplicacao, nao sitios
   para onde se manda alguem -- e cada morada a mais e uma coisa a mais que tem
   de continuar a funcionar para sempre.

   O conteudo NAO e protegido por aqui. Quem abrir a morada de um curso que nao
   comprou nao ve aulas nenhumas porque a base de dados nao lhas da: as
   politicas de leitura de 'modulos' e 'aulas' passam por tem_acesso(). O que
   esta funcao faz e dizer-lhe isso por palavras, em vez de lhe mostrar um curso
   vazio -- uma porta fechada pintada de porta aberta. */

function enderecoDe(view, a, b){
  if(view === "curso" && a) return "#/curso/" + encodeURIComponent(a);
  if(view === "aula"  && a && b) return "#/curso/" + encodeURIComponent(a) + "/aula/" + encodeURIComponent(b);
  return "";
}

/* So se le o que comeca por "#/". O Supabase deixa no endereco coisas como
   #access_token=... e #type=invite ao entrar, e nada disso e uma morada nossa. */
function lerEndereco(){
  const bruto = location.hash || "";
  if(!bruto.startsWith("#/")) return null;
  const partes = bruto.slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  if(partes[0] !== "curso" || !partes[1]) return null;
  if(partes[2] === "aula" && partes[3]) return { view:"aula", a:partes[1], b:partes[3] };
  return { view:"curso", a:partes[1] };
}

/* Escrever o endereco faz o browser disparar hashchange, e o hashchange volta a
   navegar -- um ciclo. A bandeira corta-o. */
let aEscreverEndereco = false;

function escreverEndereco(view, a, b){
  const novo = enderecoDe(view, a, b);
  const actual = location.hash || "";
  if(novo === actual) return;
  if(!novo){
    /* Limpar com replaceState em vez de location.hash="": o segundo deixa um
       "#" pendurado no endereco e nao dispara hashchange na mesma. */
    if(actual) history.replaceState(null, "", location.pathname + location.search);
    return;
  }
  aEscreverEndereco = true;
  location.hash = novo;
  setTimeout(() => { aEscreverEndereco = false; }, 0);
}

window.addEventListener("hashchange", () => {
  if(aEscreverEndereco) return;
  const destino = lerEndereco();
  if(destino) irPara(destino.view, destino.a, destino.b);
  else irPara(papelEfetivo() === "administrador" ? "admin-visao" : "dashboard");
});

/* Chamado depois de entrar, em vez de se ir sempre para o inicio: se a pessoa
   veio de um link, e para esse sitio que ela quer ir. */
function arrancarNoEndereco(porOmissao){
  const destino = lerEndereco();
  if(destino) irPara(destino.view, destino.a, destino.b);
  else irPara(porOmissao);
}

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
  escreverEndereco(view, a, b);
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
  el.querySelectorAll(".nav-item[data-view]").forEach(n => {
    n.setAttribute("role", "link");
    n.setAttribute("tabindex", "0");
    n.addEventListener("click", () => irPara(n.getAttribute("data-view")));
    n.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); irPara(n.getAttribute("data-view")); } });
  });
  renderTabbar(lista, navView);
  const ativo = el.querySelector(".nav-item.active");
  if(ativo) ativo.scrollIntoView({ block:"nearest" });
}

/* No telemóvel, os quatro destinos mais usados ficam numa barra em baixo;
   o resto está em "Mais", que abre a gaveta com a navegação toda. */
const TABBAR_ALUNO = ["dashboard","catalogo","calendario","comunidade","vitrine","conquistas"];
const TABBAR_ADMIN = ["admin-visao","admin-conteudos","admin-membros","admin-relatorios"];
const ROTULO_CURTO = { catalogo:"Cursos", "admin-visao":"Visão", "admin-conteudos":"Conteúdos", "admin-relatorios":"Relatórios" };
function renderTabbar(lista, navView){
  const barra = document.getElementById("tabbar");
  if(!barra) return;
  const itens = lista.flatMap(g => g.itens);
  const ordem = papelEfetivo()==="administrador" ? TABBAR_ADMIN : TABBAR_ALUNO;
  const escolhidos = ordem.map(v => itens.find(i => i.view === v)).filter(Boolean).slice(0, 4);
  const iconeMais = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  barra.innerHTML = escolhidos.map(it => `
    <button type="button" class="${it.view===navView?"active":""}" data-tab="${it.view}" ${it.view===navView?'aria-current="page"':""}>
      ${it.icon}<span>${ROTULO_CURTO[it.view] || it.label}</span>
    </button>`).join("") + `
    <button type="button" data-tab-mais>${iconeMais}<span>Mais</span></button>`;
  barra.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => irPara(b.getAttribute("data-tab"))));
  barra.querySelector("[data-tab-mais]").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("backdrop").classList.add("show");
  });
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
    el.innerHTML = `<button class="btn btn-secondary btn-sm" id="btn-ver-como-aluno" title="Ver como aluno"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span class="rotulo-cta">Ver como aluno</span></button>`;
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

