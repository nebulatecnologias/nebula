/* ============================================================
   Onboarding
   Na primeira entrada, o aluno responde a três perguntas curtas.
   Com as respostas montamos uma trilha — a ordem pela qual lhe
   sugerimos os cursos a que já tem acesso.
   ============================================================ */

const RITMOS = [
  { id:"leve",   rotulo:"Menos de 2h por semana",  desc:"Uma aula de cada vez, sem pressa.",        aulasSemana:2 },
  { id:"medio",  rotulo:"Entre 2h e 5h por semana", desc:"Um ritmo constante, com tempo para aplicar.", aulasSemana:5 },
  { id:"forte",  rotulo:"Mais de 5h por semana",   desc:"Quero avançar depressa.",                   aulasSemana:10 }
];

const MOMENTOS = [
  { id:"zero",    rotulo:"Estou a começar do zero",      desc:"Quero bases sólidas antes de avançar." },
  { id:"caminho", rotulo:"Já comecei, quero consistência", desc:"Tenho alguma coisa a andar e quero organizar." },
  { id:"escalar", rotulo:"Quero escalar o que já tenho",  desc:"Procuro estrutura, sistemas e decisão." }
];

function onboardingPendente(){
  return papelEfetivo() === "aluno" && !(estado.onboarding && estado.onboarding.feito);
}

function abrirOnboarding(refazer){
  if(document.getElementById("onboarding")) return;
  estado.respostasOnb = refazer && estado.onboarding
    ? { objetivos:[...(estado.onboarding.objetivos||[])], ritmo:estado.onboarding.ritmo, momento:estado.onboarding.momento }
    : { objetivos:[], ritmo:null, momento:null };
  estado.passoOnb = 0;

  const el = document.createElement("div");
  el.className = "modal-overlay onboarding-overlay";
  el.id = "onboarding";
  el.innerHTML = `<div class="card onboarding-card"><div id="onboarding-corpo"></div></div>`;
  document.body.appendChild(el);
  renderPassoOnboarding();
}

function objetivosDisponiveis(){
  /* As opções são as categorias que têm cursos publicados — assim
     acompanham o que o administrador criar, sem lista fixa no código. */
  const comCursos = new Set(DB.cursos.filter(c=>c.publicado!==false).map(c=>c.categoria));
  return Object.entries(DB.categorias)
    .filter(([id]) => comCursos.has(id))
    .map(([id,c]) => ({ id, nome:c.nome, cor:c.cor }));
}

function renderPassoOnboarding(){
  const corpo = document.getElementById("onboarding-corpo");
  if(!corpo) return;
  const r = estado.respostasOnb;
  const passo = estado.passoOnb;

  if(passo === 3) return renderResultadoOnboarding(corpo);

  const passos = [
    {
      titulo: "O que te trouxe aqui?",
      sub: "Escolhe uma ou mais áreas. É por aí que vamos começar a tua trilha.",
      opcoes: objetivosDisponiveis().map(o => ({ id:o.id, rotulo:o.nome, cor:o.cor })),
      multipla: true,
      valor: r.objetivos
    },
    {
      titulo: "Quanto tempo tens por semana?",
      sub: "Serve para calibrar o ritmo que te vamos sugerir.",
      opcoes: RITMOS.map(x => ({ id:x.id, rotulo:x.rotulo, desc:x.desc })),
      valor: r.ritmo
    },
    {
      titulo: "Em que ponto estás agora?",
      sub: "Ajuda-nos a perceber por onde entrar.",
      opcoes: MOMENTOS.map(x => ({ id:x.id, rotulo:x.rotulo, desc:x.desc })),
      valor: r.momento
    }
  ][passo];

  const escolhido = id => passos.multipla ? passos.valor.includes(id) : passos.valor === id;
  const podeAvancar = passos.multipla ? passos.valor.length > 0 : !!passos.valor;

  corpo.innerHTML = `
    <div class="onb-passos">${[0,1,2].map(i=>`<span class="${i<=passo?"feito":""}"></span>`).join("")}</div>
    <span class="eyebrow">PASSO ${passo+1} DE 3</span>
    <h2>${passos.titulo}</h2>
    <p class="onb-sub">${passos.sub}</p>
    <div class="onb-opcoes">
      ${passos.opcoes.map(o => `
        <button class="onb-opcao ${escolhido(o.id)?"escolhida":""}" data-opcao="${o.id}">
          ${o.cor ? `<span class="dot" style="--c:${o.cor}"></span>` : ""}
          <span class="onb-opcao-txt"><strong>${o.rotulo}</strong>${o.desc?`<span>${o.desc}</span>`:""}</span>
          <span class="onb-check">${iconeCheck()}</span>
        </button>`).join("")}
    </div>
    <div class="onb-acoes">
      ${passo ? `<button class="btn btn-texto" id="onb-atras">Voltar</button>` : `<button class="btn btn-texto" id="onb-saltar">Saltar por agora</button>`}
      <button class="btn btn-primary" id="onb-avancar" ${podeAvancar?"":"disabled"}>${passo===2?"Ver a minha trilha":"Continuar"}</button>
    </div>
  `;

  corpo.querySelectorAll("[data-opcao]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-opcao");
    if(passo===0){
      const i = r.objetivos.indexOf(id);
      i===-1 ? r.objetivos.push(id) : r.objetivos.splice(i,1);
    } else if(passo===1){ r.ritmo = id; }
    else { r.momento = id; }
    renderPassoOnboarding();
  }));

  const avancar = document.getElementById("onb-avancar");
  avancar.addEventListener("click", () => {
    if(avancar.disabled) return;
    estado.passoOnb++;
    if(estado.passoOnb === 3) guardarOnboarding();
    renderPassoOnboarding();
  });
  const atras = document.getElementById("onb-atras");
  if(atras) atras.addEventListener("click", () => { estado.passoOnb--; renderPassoOnboarding(); });
  const saltar = document.getElementById("onb-saltar");
  if(saltar) saltar.addEventListener("click", () => {
    /* Saltar não deixa o aluno sem trilha: fica a ordem natural dos cursos. */
    estado.onboarding = { feito:true, saltado:true, objetivos:[], ritmo:null, momento:null };
    salvarOnboarding();
    fecharOnboarding();
  });
}

function guardarOnboarding(){
  const r = estado.respostasOnb;
  estado.onboarding = { feito:true, saltado:false, objetivos:r.objetivos, ritmo:r.ritmo, momento:r.momento };
  salvarOnboarding();
}

/* A trilha: primeiro os cursos das áreas escolhidas, depois os restantes.
   Dentro de cada grupo, os já começados vêm à frente — continuar custa
   menos do que arrancar. */
function trilhaSugerida(){
  const onb = estado.onboarding || {};
  const objetivos = new Set(onb.objetivos || []);
  const visiveis = cursosVisiveis();
  const peso = c => {
    const p = progressoCurso(c);
    if(p.pct === 100) return 4;
    let n = objetivos.size && !objetivos.has(c.categoria) ? 2 : 0;
    if(p.concluidas) n -= 1;
    return n;
  };
  return [...visiveis].sort((a,b) => peso(a) - peso(b));
}

function renderResultadoOnboarding(corpo){
  const trilha = trilhaSugerida().slice(0,3);
  const ritmo = RITMOS.find(x=>x.id===estado.onboarding.ritmo);
  const nomes = (estado.onboarding.objetivos||[]).map(id => categoriaDe(id).nome);

  corpo.innerHTML = `
    <div class="onb-passos">${[0,1,2].map(()=>'<span class="feito"></span>').join("")}</div>
    <span class="eyebrow">A TUA TRILHA</span>
    <h2>Por aqui, ${estado.nome.split(" ")[0]}.</h2>
    <p class="onb-sub">${nomes.length ? `Focámos em ${nomes.join(", ")}` : "Montámos um percurso com o que tens disponível"}${ritmo ? `, a ${ritmo.aulasSemana} aulas por semana` : ""}.</p>
    ${trilha.length ? `<ol class="onb-trilha">
      ${trilha.map(c => {
        const cat = categoriaDe(c.categoria);
        const aulas = contarAulas(c);
        return `<li>
          <span class="onb-trilha-capa" style="${c.capa?`background-image:url(${c.capa})`:""}">${c.capa?"":(c.sigla||"")}</span>
          <span class="onb-trilha-txt"><strong>${c.titulo}</strong><span>${cat.nome} · ${aulas} aula${aulas===1?"":"s"}</span></span>
        </li>`;
      }).join("")}
    </ol>` : `<p class="onb-sub">Ainda não há cursos no teu acesso. Fala com a tua mentoria.</p>`}
    <div class="onb-acoes">
      <button class="btn btn-texto" id="onb-refazer">Responder de novo</button>
      <button class="btn btn-primary" id="onb-comecar">${trilha.length ? "Começar" : "Entrar"}</button>
    </div>
  `;
  document.getElementById("onb-refazer").addEventListener("click", () => { estado.passoOnb = 0; renderPassoOnboarding(); });
  document.getElementById("onb-comecar").addEventListener("click", () => {
    fecharOnboarding();
    const primeiro = trilha[0];
    if(primeiro) irPara("curso", primeiro.id);
  });
}

function fecharOnboarding(){
  const el = document.getElementById("onboarding");
  if(el) el.remove();
  if(estado.viewAtual === "dashboard") renderDashboard();
}

/* ---------------- A trilha no Início ---------------- */
function trilhaHTML(){
  const onb = estado.onboarding;
  if(!onb || !onb.feito || papelEfetivo()!=="aluno") return "";
  const trilha = trilhaSugerida().slice(0,3);
  if(!trilha.length) return "";
  const ritmo = RITMOS.find(x=>x.id===onb.ritmo);

  return `
    <div class="card trilha-card">
      <div class="trilha-head">
        <div>
          <span class="eyebrow">A TUA TRILHA</span>
          <h3>${onb.saltado ? "Sugerido para ti" : "Montada a partir do que disseste"}</h3>
          ${ritmo ? `<p class="sub-celula">Ritmo: ${ritmo.rotulo.toLowerCase()}.</p>` : ""}
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-refazer-trilha">${onb.saltado ? "Responder ao questionário" : "Rever respostas"}</button>
      </div>
      <ol class="trilha-passos">
        ${trilha.map((c,i) => {
          const p = progressoCurso(c);
          const cat = categoriaDe(c.categoria);
          return `<li class="trilha-passo ${p.pct===100?"concluido":""}" data-trilha="${c.id}">
            <span class="trilha-num">${p.pct===100 ? iconeCheck() : i+1}</span>
            <span class="trilha-txt">
              <strong>${c.titulo}</strong>
              <span class="sub-celula">${cat.nome} · ${p.concluidas} de ${p.total} aulas</span>
            </span>
            <span class="trilha-pct">${p.pct}%</span>
          </li>`;
        }).join("")}
      </ol>
    </div>`;
}

function ligarTrilha(){
  const btn = document.getElementById("btn-refazer-trilha");
  if(btn) btn.addEventListener("click", () => abrirOnboarding(true));
  document.querySelectorAll("#content-dashboard [data-trilha]").forEach(el =>
    el.addEventListener("click", () => irPara("curso", el.getAttribute("data-trilha"))));
}
