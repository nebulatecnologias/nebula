/* ============================================================
   Administração › Membros
   Quem está na escola, o que pode fazer e a que cursos tem acesso
   (pedido do Shelton a 28/10/2026). Até aqui a aba era só de leitura e
   mandava para o painel de gestão, que não gere as escolas.

   Com servidor, cada ação é uma função da base (academia.membro_*): é
   ela que confere quem pede — a equipa dá e tira cursos e planos; só a
   administração muda papéis, suspende e remove; ninguém mexe em si
   próprio nem no dono. Aqui só se mostra e se pergunta. Na
   demonstração, o mesmo em memória.
   ============================================================ */

const FILTROS_DE_MEMBROS = [
  { id:"todos",     rotulo:"Todos" },
  { id:"alunos",    rotulo:"Alunos" },
  { id:"equipa",    rotulo:"Equipa" },
  { id:"suspensos", rotulo:"Suspensos" }
];

const FUNCOES = {
  aluno:       { rotulo:"Aluno",         dica:"Vê os cursos a que tem acesso." },
  colaborador: { rotulo:"Colaborador",   dica:"Cria e edita os conteúdos, convida alunos e vê todos os cursos." },
  admin:       { rotulo:"Administrador", dica:"Tudo o que o colaborador faz, e gere também a equipa, as integrações e as configurações." }
};

/* O prazo de um acesso dado à mão, em dias a partir de hoje. */
const PRAZOS_DE_ACESSO = [
  { valor:"",    rotulo:"Sem prazo" },
  { valor:"30",  rotulo:"30 dias" },
  { valor:"90",  rotulo:"90 dias" },
  { valor:"180", rotulo:"6 meses" },
  { valor:"365", rotulo:"1 ano" }
];

const ORIGENS_DO_ACESSO = { manual:"Dado à mão", convite:"Convite", oferta:"Compra" };

function funcaoDe(m){ return m.funcao || (m.papel === "administrador" ? "admin" : "aluno"); }

function souAdminDaEscola(){
  if(modoDemonstracao()) return papelEfetivo() === "administrador";
  return !!API.utilizador && (API.utilizador.perfil === "admin" || API.adminPlataforma === true);
}

function souEu(id){
  return id === (modoDemonstracao() ? estado.membroId : (API.utilizador || {}).id);
}

/* Uma data a «dias» de hoje, como a base a quer (aaaa-mm-dd); nula sem prazo. */
function dataDaquiA(dias){
  if(!dias) return null;
  const d = new Date();
  d.setDate(d.getDate() + Number(dias));
  return d.toISOString().slice(0, 10);
}

function dataLegivel(iso){
  if(!iso) return "—";
  const d = new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso);
  return isNaN(d) ? "—" : d.toLocaleDateString("pt-PT", { day:"2-digit", month:"2-digit", year:"numeric" });
}

function hojeISO(){ return new Date().toISOString().slice(0, 10); }

function aulasDoCurso(c){ return (c.modulos || []).reduce((n, m) => n + (m.aulas || []).length, 0); }

/* ============================================================
   As ações. Com servidor, a base; na demonstração, a memória.
   ============================================================ */
const GestaoDeMembros = {
  async ficha(id){
    if(modoDemonstracao()) return fichaDeDemonstracao(id);
    return API.membro("membro_ficha", { p_utilizador:id });
  },
  async darCursos(id, cursos, expira){
    if(modoDemonstracao()) return demoDarCursos(id, cursos, expira, null);
    return API.membro("membro_dar_acesso", { p_utilizador:id, p_cursos:cursos, p_expira:expira });
  },
  async tirarCursos(id, cursos){
    if(modoDemonstracao()){
      const m = membroDemo(id);
      let n = 0;
      m.acessos.forEach(a => { if(cursos.includes(a.curso) && a.ativo){ a.ativo = false; a.expira = ontemISO(); n++; } });
      return { retirados:n, pelo_payflow:[] };
    }
    return API.membro("membro_tirar_acesso", { p_utilizador:id, p_cursos:cursos });
  },
  async prazo(id, curso, expira){
    if(modoDemonstracao()){
      const a = membroDemo(id).acessos.find(x => x.curso === curso && x.ativo);
      if(a) a.expira = expira;
      return !!a;
    }
    return API.membro("membro_prazo", { p_utilizador:id, p_curso:curso, p_expira:expira });
  },
  async darPlano(id, plano, expira){
    if(modoDemonstracao()){
      const p = planoPorId(plano);
      return demoDarCursos(id, (p && p.cursos) || [], expira, plano);
    }
    return API.membro("membro_dar_plano", { p_utilizador:id, p_plano:plano, p_expira:expira });
  },
  async tirarPlano(id, plano){
    if(modoDemonstracao()){
      let n = 0;
      membroDemo(id).acessos.forEach(a => { if(a.plano === plano && a.ativo){ a.ativo = false; a.expira = ontemISO(); n++; } });
      return n;
    }
    return API.membro("membro_tirar_plano", { p_utilizador:id, p_plano:plano });
  },
  async papel(id, funcao){
    if(modoDemonstracao()){
      const m = membroDemo(id);
      if(funcaoDe(m) === "admin" && funcao !== "admin" && !outraAdministracaoDemo(id)) throw new Error("A escola ficava sem administração.");
      m.funcao = funcao;
      m.papel = funcao === "aluno" ? "aluno" : "administrador";
      return funcao;
    }
    return API.membro("membro_papel", { p_utilizador:id, p_papel:funcao });
  },
  async estado(id, novo){
    if(modoDemonstracao()){
      const m = membroDemo(id);
      if(novo === "suspenso" && funcaoDe(m) === "admin" && !outraAdministracaoDemo(id)) throw new Error("A escola ficava sem administração.");
      m.acesso = novo === "ativo" ? "ativo" : "bloqueado";
      return novo;
    }
    return API.membro("membro_estado", { p_utilizador:id, p_estado:novo });
  },
  async remover(id){
    if(modoDemonstracao()){
      const m = membroDemo(id);
      const n = m.acessos.filter(a => a.ativo).length;
      (DB.convites || []).forEach(c => {
        if((c.email || "").toLowerCase() === (m.email || "").toLowerCase() && (c.estado === "enviado" || c.estado === "aberto")) c.estado = "revogado";
      });
      DB.membros = DB.membros.filter(x => x.id !== id);
      return { acessos:n, convites:0, pelo_payflow:[] };
    }
    return API.membro("membro_remover", { p_utilizador:id });
  },
  async enviarLink(email){
    if(modoDemonstracao()) return;
    return API.pedirNovaPassword(email);
  },
  /* Depois de mexer: a lista volta a ler-se da base. */
  async recarregar(){
    if(modoDemonstracao()){ guardarDB(); return; }
    await API.recarregarMembros();
  }
};

function ontemISO(){ const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

/* Na demonstração, os acessos nascem do plano que o membro já tinha. */
function membroDemo(id){
  const m = DB.membros.find(x => x.id === id);
  if(!m) throw new Error("Esta pessoa não é membro desta escola.");
  if(!Array.isArray(m.acessos)){
    const plano = planoPorId(m.planoId);
    m.acessos = ((plano && plano.cursos) || []).map(curso => ({
      curso, origem:"manual", expira:null, ativo:true, plano:plano.id, desde:m.membroDesde || hojeISO()
    }));
  }
  m.acessos.forEach(a => { if(a.ativo && a.expira && a.expira < hojeISO()) a.ativo = false; });
  return m;
}

function demoDarCursos(id, cursos, expira, plano){
  const m = membroDemo(id);
  let n = 0;
  cursos.forEach(curso => {
    if(!cursoPorId(curso)) return;
    const a = m.acessos.find(x => x.curso === curso);
    if(a){
      if(!a.ativo){ a.origem = "manual"; a.plano = plano; }
      else if(plano && a.origem === "manual") a.plano = plano;
      a.expira = plano && a.ativo ? (a.expira === null || expira === null ? null : (a.expira > expira ? a.expira : expira)) : expira;
      a.ativo = true;
    } else m.acessos.push({ curso, origem:"manual", expira, ativo:true, plano, desde:hojeISO() });
    n++;
  });
  return n;
}

function outraAdministracaoDemo(id){
  return DB.membros.some(x => x.id !== id && funcaoDe(x) === "admin" && x.acesso === "ativo");
}

function fichaDeDemonstracao(id){
  const m = membroDemo(id);
  return {
    id:m.id, nome:m.nome, email:m.email, papel:funcaoDe(m), dono:false,
    estado: m.acesso === "ativo" ? "ativo" : "suspenso", contaAtiva:true,
    desde:m.membroDesde, ultimoAcesso:null, ultimoAcessoTexto:m.ultimoAcesso,
    acessos:m.acessos.map(a => Object.assign({}, a)), payflow:[], concluidas:m.concluidas || {}
  };
}

/* Os planos que o membro tem abertos, para a lista. */
function planosDoMembro(m){
  if(Array.isArray(m.acessos)) return [...new Set(m.acessos.filter(a => a.ativo && a.plano).map(a => a.plano))];
  return m.planos || (m.planoId ? [m.planoId] : []);
}
function cursosAbertosDoMembro(m){
  if(Array.isArray(m.acessos)) return m.acessos.filter(a => a.ativo).length;
  if(m.cursosAbertos != null) return m.cursosAbertos;
  const plano = planoPorId(m.planoId);
  return plano ? (plano.cursos || []).length : 0;
}

/* ============================================================
   A lista
   ============================================================ */
function renderAdminMembros(){
  const todos = DB.membros || [];
  const filtro = estado.filtroMembros || "todos";
  const busca = (estado.buscaMembros || "").trim().toLowerCase();
  const doFiltro = {
    todos:     () => true,
    alunos:    m => funcaoDe(m) === "aluno",
    equipa:    m => funcaoDe(m) !== "aluno",
    suspensos: m => m.acesso !== "ativo"
  };
  const contagem = Object.fromEntries(FILTROS_DE_MEMBROS.map(f => [f.id, todos.filter(doFiltro[f.id]).length]));
  const lista = todos.filter(doFiltro[filtro] || doFiltro.todos).filter(m =>
    !busca || ((m.nome || "") + " " + (m.email || "")).toLowerCase().includes(busca));
  const ativos = todos.filter(m => m.acesso === "ativo").length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Membros",
      descricao: "Quem está na academia, o que pode fazer e a que cursos tem acesso.",
      acaoRotulo: "Adicionar membro",
      acaoId: "btn-novo-membro"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.people}</div><div class="stat-label">Membros ativos</div><div class="stat-value">${ativos}<span>/ ${todos.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.gear}</div><div class="stat-label">Equipa</div><div class="stat-value">${contagem.equipa}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.card}</div><div class="stat-label">Suspensos</div><div class="stat-value">${contagem.suspensos}</div></div>
    </div>
    <div class="card table-card convites-card membros-card">
      <div class="convites-barra">
        <div class="convites-estados" role="group" aria-label="Filtrar membros">
          ${FILTROS_DE_MEMBROS.map(f => `
            <button type="button" class="estado-chip ${filtro===f.id?"active":""}" data-filtro-membros="${f.id}" aria-pressed="${filtro===f.id}">
              ${f.rotulo}<span class="estado-chip-conta">${contagem[f.id]}</span>
            </button>`).join("")}
        </div>
        <div class="search-pill convites-busca">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="membros-busca" placeholder="Procurar por nome ou email" aria-label="Procurar por nome ou email" value="${textoSeguro(estado.buscaMembros || "").replace(/"/g,"&quot;")}">
        </div>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table convites-tabela membros-tabela">
          <thead><tr><th>Membro</th><th>Papel</th><th>Acesso</th><th>Estado</th><th>Membro desde</th><th>Última entrada</th><th><span class="so-leitor">Ações</span></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(linhaDoMembro).join("")
              : `<tr><td colspan="7"><div class="empty-note">${todos.length ? "Nenhum membro com este filtro." : "Ainda não há membros. Adicione o primeiro."}</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-novo-membro").addEventListener("click", () => adicionarMembro());
  document.querySelectorAll("#content-admin [data-filtro-membros]").forEach(b =>
    b.addEventListener("click", () => { estado.filtroMembros = b.getAttribute("data-filtro-membros"); renderAdminMembros(); }));
  const campoBusca = document.getElementById("membros-busca");
  campoBusca.addEventListener("input", () => {
    estado.buscaMembros = campoBusca.value;
    const pos = campoBusca.selectionStart;
    renderAdminMembros();
    const novo = document.getElementById("membros-busca");
    novo.focus(); novo.setSelectionRange(pos, pos);
  });
  document.querySelectorAll("#content-admin [data-membro]").forEach(linha =>
    linha.addEventListener("click", e => { if(!e.target.closest("button")) abrirMembro(linha.getAttribute("data-membro")); }));
  document.querySelectorAll("#content-admin [data-gerir-membro]").forEach(b =>
    b.addEventListener("click", () => abrirMembro(b.getAttribute("data-gerir-membro"))));
}

const ICONE_GERIR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

function linhaDoMembro(m){
  const funcao = funcaoDe(m);
  const quem = textoSeguro(m.email || "");
  const planos = planosDoMembro(m).map(id => (planoPorId(id) || {}).nome).filter(Boolean);
  const n = cursosAbertosDoMembro(m);
  const acesso = funcao !== "aluno"
    ? `<span class="sub-celula">Todos os cursos</span>`
    : `${n} ${n === 1 ? "curso" : "cursos"}${planos.length ? `<div class="sub-celula">${planos.map(textoSeguro).join(" · ")}</div>` : ""}`;
  return `
    <tr data-membro="${m.id}" class="linha-clicavel ${m.acesso !== "ativo" ? "tint-risco" : ""}">
      <td>
        <div class="pessoa-celula">
          <span class="avatar-iniciais" style="--c:${corDaPessoa(m.email)}" aria-hidden="true">${textoSeguro(iniciais(m.nome || m.email || "?"))}</span>
          <div>
            <div class="nome">${textoSeguro(m.nome || "")}${souEu(m.id) ? ` <span class="sub-celula">(você)</span>` : ""}</div>
            <div class="sub-celula">${quem}</div>
          </div>
        </div>
      </td>
      <td>${etiquetaDaFuncao(funcao, m.dono)}</td>
      <td class="membro-acesso">${acesso}</td>
      <td>${etiquetaDoEstado(m.acesso === "ativo" ? "ativo" : "suspenso")}</td>
      <td class="num">${dataLegivel(m.membroDesde)}</td>
      <td class="sub-celula">${textoSeguro(m.ultimoAcesso || "—")}</td>
      <td><div class="acoes-linha"><button class="btn-icone" type="button" data-gerir-membro="${m.id}" title="Gerir" aria-label="Gerir ${quem}">${ICONE_GERIR}</button></div></td>
    </tr>`;
}

function etiquetaDaFuncao(funcao, dono){
  if(dono) return `<span class="pill pill-morno">Dono</span>`;
  if(funcao === "admin") return `<span class="pill pill-morno">Administrador</span>`;
  if(funcao === "colaborador") return `<span class="pill pill-teste">Colaborador</span>`;
  return `<span class="sub-celula">Aluno</span>`;
}

function etiquetaDoEstado(est){
  return est === "ativo"
    ? `<span class="estado-convite e-aceite"><span class="estado-ponto" aria-hidden="true"></span>Ativo</span>`
    : `<span class="estado-convite e-parado"><span class="estado-ponto" aria-hidden="true"></span>Suspenso</span>`;
}

/* ============================================================
   Adicionar: quem já é membro recebe os cursos já; quem ainda
   não é recebe um convite (que serve também a quem já tem conta
   noutra escola — nunca se diz aqui quem tem conta onde).
   ============================================================ */
function adicionarMembro(){
  const admin = souAdminDaEscola();
  abrirDrawer({
    titulo: "Adicionar membro",
    subtitulo: "Se a pessoa já for membro, os cursos abrem já. Se não, recebe um convite por email.",
    campos: [
      { nome:"email", rotulo:"Email", tipo:"texto", obrigatorio:true, placeholder:"nome@exemplo.co.mz" },
      { nome:"nome", rotulo:"Nome", tipo:"texto", placeholder:"ex.: Marta Lopes" },
      { nome:"papel", rotulo:"Papel", tipo:"select",
        opcoes: Object.entries(FUNCOES).filter(([id]) => admin || id === "aluno").map(([valor, f]) => ({ valor, rotulo:f.rotulo })),
        dica: admin ? "A equipa (colaboradores e administradores) vê todos os cursos." : "Só a administração da escola adiciona pessoas à equipa." },
      { nome:"idioma", rotulo:"Idioma do email", tipo:"select", meia:true,
        opcoes:[{ valor:"pt", rotulo:"Português" }, { valor:"en", rotulo:"English" }] },
      { nome:"dias", rotulo:"O convite expira após", tipo:"select", meia:true,
        opcoes: PRAZOS_DO_CONVITE.map(n => ({ valor:String(n), rotulo: n === 1 ? "1 dia" : n + " dias" })) },
      { nome:"cursos", rotulo:"Cursos", tipo:"checklist", cartoes:true, opcoes: cursosParaConvidar() }
    ],
    valores: { papel:"aluno", idioma:"pt", dias:"7", cursos:[] },
    textoGuardar: "Adicionar",
    aoGuardar: v => {
      if(!/^\S+@\S+\.\S+$/.test(v.email)){ mostrarToast("Esse email não parece válido"); return false; }
      const membro = membroPorEmail(v.email);
      if(membro){ adicionarQuemJaEMembro(membro, v); return; }
      enviarConvite({ email:v.email, nome:v.nome, idioma:v.idioma, dias:v.dias, cursos:v.cursos, papel:v.papel })
        .then(() => { if(estado.viewAtual === "admin-membros") renderAdminMembros(); });
    }
  });
}

async function adicionarQuemJaEMembro(membro, v){
  try {
    if(v.papel !== funcaoDe(membro) && v.papel !== "aluno") await GestaoDeMembros.papel(membro.id, v.papel);
    if(v.cursos.length) await GestaoDeMembros.darCursos(membro.id, v.cursos, null);
    await GestaoDeMembros.recarregar();
    renderAdminMembros();
    mostrarToast(`${membro.nome || membro.email} já era membro${v.cursos.length ? ": os cursos já estão abertos" : ""}`);
    abrirMembro(membro.id);
  } catch(erro){ mostrarToast(erro.message || "Não foi possível adicionar."); }
}

/* ============================================================
   A ficha do membro: uma gaveta larga com tudo o que se faz a
   uma pessoa — papel, estado, cursos, planos e convites.
   ============================================================ */
const ICONE_PRAZO = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;
const ICONE_TIRAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const ICONE_EMAIL = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;

let fichaAberta = null;

function abrirMembro(id){
  fecharMembro(true);
  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  overlay.id = "membro-overlay";
  overlay.innerHTML = `<div class="drawer drawer-membro" role="dialog" aria-modal="true" aria-labelledby="membro-nome">
    <div class="drawer-body"><div class="empty-note">A carregar…</div></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if(e.target === overlay) fecharMembro(); });
  document.addEventListener("keydown", fecharMembroComEsc);
  requestAnimationFrame(() => overlay.classList.add("aberto"));
  fichaAberta = { id, abertos:{} };
  carregarFicha();
}

function fecharMembroComEsc(e){ if(e.key === "Escape") fecharMembro(); }

function fecharMembro(imediato){
  const overlay = document.getElementById("membro-overlay");
  document.removeEventListener("keydown", fecharMembroComEsc);
  fichaAberta = null;
  if(!overlay) return;
  overlay.removeAttribute("id");
  overlay.classList.remove("aberto");
  if(imediato) overlay.remove();
  else setTimeout(() => overlay.remove(), 180);
}

async function carregarFicha(){
  if(!fichaAberta) return;
  const id = fichaAberta.id;
  try {
    const ficha = await GestaoDeMembros.ficha(id);
    if(!fichaAberta || fichaAberta.id !== id) return;
    fichaAberta.ficha = ficha;
    desenharFicha();
  } catch(erro){
    const corpo = document.querySelector("#membro-overlay .drawer");
    if(corpo) corpo.innerHTML = `<div class="drawer-body"><div class="empty-note">${textoSeguro(erro.message || "Não foi possível abrir a ficha.")}</div>
      <button class="btn btn-secondary" type="button" data-fechar-membro>Fechar</button></div>`;
    document.querySelectorAll("#membro-overlay [data-fechar-membro]").forEach(b => b.addEventListener("click", () => fecharMembro()));
  }
}

function desenharFicha(){
  const caixa = document.querySelector("#membro-overlay .drawer");
  if(!caixa || !fichaAberta || !fichaAberta.ficha) return;
  const f = fichaAberta.ficha;
  const funcao = f.papel === "admin" || f.papel === "colaborador" ? f.papel : "aluno";
  const admin = souAdminDaEscola();
  const eu = souEu(f.id);
  const podeMexer = admin && !eu && !f.dono;
  const abertos = (f.acessos || []).filter(a => a.ativo);
  const ultima = f.ultimoAcesso ? tempoRelativo(f.ultimoAcesso) : (f.ultimoAcessoTexto || "nunca");

  caixa.innerHTML = `
    <div class="drawer-head">
      <div class="membro-topo">
        <span class="avatar-iniciais avatar-grande" style="--c:${corDaPessoa(f.email)}" aria-hidden="true">${textoSeguro(iniciais(f.nome || f.email || "?"))}</span>
        <div class="membro-quem">
          <h3 id="membro-nome">${textoSeguro(f.nome || f.email)}</h3>
          <p class="drawer-sub">${textoSeguro(f.email || "")}</p>
          <div class="membro-etiquetas">${etiquetaDaFuncao(funcao, f.dono)}${etiquetaDoEstado(f.estado)}</div>
        </div>
      </div>
      <button class="modal-close" type="button" data-fechar-membro aria-label="Fechar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="drawer-body">
      <dl class="membro-factos">
        <div><dt>Membro desde</dt><dd>${dataLegivel(f.desde)}</dd></div>
        <div><dt>Última entrada</dt><dd>${textoSeguro(ultima)}</dd></div>
        <div><dt>Cursos abertos</dt><dd>${funcao === "aluno" ? abertos.length + (f.payflow || []).filter(c => !abertos.some(a => a.curso === c)).length : "Todos"}</dd></div>
      </dl>

      <div class="membro-acoes">
        <button class="btn btn-secondary btn-sm" type="button" data-membro-link>${ICONE_EMAIL} Enviar link de acesso</button>
        ${podeMexer ? (f.estado === "ativo"
          ? `<button class="btn btn-secondary btn-sm" type="button" data-membro-estado="suspenso">Suspender</button>`
          : `<button class="btn btn-secondary btn-sm" type="button" data-membro-estado="ativo">Reativar</button>`) : ""}
        ${podeMexer ? `<button class="btn btn-perigo-suave btn-sm" type="button" data-membro-remover>Remover da escola</button>` : ""}
      </div>
      ${f.estado !== "ativo" ? `<p class="membro-aviso">Suspenso: não entra nos cursos nem na equipa até ser reativado.${f.contaAtiva === false ? " A conta está desativada no painel de gestão." : ""}</p>` : ""}

      ${seccaoPapel(funcao, f, admin, eu)}
      ${seccaoCursos(f, funcao)}
      ${seccaoPlanos(f)}
      ${seccaoConvites(f)}
    </div>
  `;
  ligarFicha(caixa, f);
}

function seccaoPapel(funcao, f, admin, eu){
  const travado = !admin || eu || f.dono;
  const porque = f.dono ? "O dono da escola não se altera daqui."
    : eu ? "Não pode mudar o seu próprio papel."
    : !admin ? "Só a administração da escola muda papéis." : "";
  return `
    <section class="membro-seccao">
      <h4>Papel</h4>
      <div class="papel-opcoes" role="radiogroup" aria-label="Papel">
        ${Object.entries(FUNCOES).map(([id, x]) => `
          <label class="papel-opcao ${funcao === id ? "escolhido" : ""} ${travado ? "travado" : ""}">
            <input type="radio" name="membro-papel" value="${id}" ${funcao === id ? "checked" : ""} ${travado ? "disabled" : ""}>
            <span class="papel-nome">${x.rotulo}</span>
            <span class="papel-dica">${x.dica}</span>
          </label>`).join("")}
      </div>
      ${porque ? `<p class="hint">${porque}</p>` : ""}
    </section>`;
}

function seccaoCursos(f, funcao){
  const acessos = f.acessos || [];
  const abertos = acessos.filter(a => a.ativo);
  const fechados = acessos.filter(a => !a.ativo && !abertos.some(x => x.curso === a.curso));
  const doPayflow = (f.payflow || []).filter(c => cursoPorId(c));
  const semAcesso = (DB.cursos || []).filter(c => !abertos.some(a => a.curso === c.id) && !doPayflow.includes(c.id));
  const darAberto = fichaAberta.abertos.dar;
  return `
    <section class="membro-seccao">
      <div class="seccao-cabeca">
        <h4>Cursos</h4>
        ${semAcesso.length ? `<button class="btn btn-secondary btn-sm" type="button" data-abrir="dar" aria-expanded="${!!darAberto}">Dar acesso</button>` : ""}
      </div>
      ${funcao !== "aluno" ? `<p class="hint">Como ${FUNCOES[funcao].rotulo.toLowerCase()}, vê todos os cursos da escola. Os acessos abaixo valem se voltar a ser aluno.</p>` : ""}
      ${darAberto ? formularioDarCursos(semAcesso) : ""}
      <div class="acessos-lista">
        ${abertos.map(a => linhaDoAcesso(a, f)).join("")}
        ${doPayflow.filter(c => !abertos.some(a => a.curso === c)).map(c => linhaDoPayflow(c, f)).join("")}
        ${!abertos.length && !doPayflow.length ? `<div class="empty-note">Sem cursos abertos.</div>` : ""}
      </div>
      ${fechados.length ? `
        <details class="acessos-fechados">
          <summary>Acessos fechados (${fechados.length})</summary>
          ${fechados.map(a => linhaDoAcessoFechado(a)).join("")}
        </details>` : ""}
    </section>`;
}

function miniaturaDoCurso(c){
  return miniaturaDoCartao({ imagem:c.capa || "", iniciais:c.sigla || iniciais(c.titulo || "?"), cor:(DB.categorias[c.categoria] || {}).cor || "" });
}

function progressoNoCurso(f, c){
  const total = aulasDoCurso(c);
  const feitas = Number((f.concluidas || {})[c.id] || 0);
  return total ? `${Math.min(feitas, total)}/${total} aulas` : "";
}

function linhaDoAcesso(a, f){
  const c = cursoPorId(a.curso);
  if(!c) return "";
  const plano = a.plano ? planoPorId(a.plano) : null;
  const origem = plano ? "Plano " + plano.nome : (ORIGENS_DO_ACESSO[a.origem] || "Dado à mão");
  const prazo = a.expira ? "Até " + dataLegivel(a.expira) : "Sem prazo";
  const editando = fichaAberta.abertos.prazo === a.curso;
  return `
    <div class="acesso-linha" data-acesso="${a.curso}">
      ${miniaturaDoCurso(c)}
      <div class="acesso-info">
        <div class="nome">${textoSeguro(c.titulo)}</div>
        <div class="sub-celula">${[textoSeguro(origem), prazo, progressoNoCurso(f, c)].filter(Boolean).join(" · ")}</div>
      </div>
      <div class="acoes-linha">
        <button class="btn-icone" type="button" data-prazo="${a.curso}" title="Mudar o prazo" aria-label="Mudar o prazo de ${textoSeguro(c.titulo)}">${ICONE_PRAZO}</button>
        <button class="btn-icone perigo" type="button" data-tirar="${a.curso}" title="Tirar o acesso" aria-label="Tirar o acesso a ${textoSeguro(c.titulo)}">${ICONE_TIRAR}</button>
      </div>
      ${editando ? `
        <div class="acesso-prazo">
          <label for="prazo-${a.curso}">Acesso até</label>
          <input type="date" id="prazo-${a.curso}" min="${hojeISO()}" value="${a.expira || ""}">
          <button class="btn btn-primary btn-sm" type="button" data-guardar-prazo="${a.curso}">Guardar</button>
          <button class="btn btn-secondary btn-sm" type="button" data-sem-prazo="${a.curso}">Sem prazo</button>
        </div>` : ""}
    </div>`;
}

function linhaDoPayflow(id, f){
  const c = cursoPorId(id);
  return `
    <div class="acesso-linha">
      ${miniaturaDoCurso(c)}
      <div class="acesso-info">
        <div class="nome">${textoSeguro(c.titulo)}</div>
        <div class="sub-celula">${["Inscrição no Payflow", progressoNoCurso(f, c)].filter(Boolean).join(" · ")}</div>
      </div>
      <span class="cartao-etiqueta" title="Este acesso vem de uma inscrição no Payflow e trata-se lá.">Payflow</span>
    </div>`;
}

function linhaDoAcessoFechado(a){
  const c = cursoPorId(a.curso);
  if(!c) return "";
  return `
    <div class="acesso-linha fechado">
      ${miniaturaDoCurso(c)}
      <div class="acesso-info">
        <div class="nome">${textoSeguro(c.titulo)}</div>
        <div class="sub-celula">Fechado desde ${dataLegivel(a.expira)}</div>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" data-reabrir="${a.curso}">Abrir outra vez</button>
    </div>`;
}

function formularioDarCursos(semAcesso){
  return `
    <div class="membro-form" id="form-dar-cursos">
      <div class="checklist checklist-cartoes">
        ${semAcesso.map(c => `
          <label class="checklist-item checklist-cartao">
            <input type="checkbox" value="${c.id}">
            ${miniaturaDoCurso(c)}
            <span class="cartao-nome">${textoSeguro(c.titulo)}</span>
            ${c.publicado === false ? `<span class="cartao-etiqueta">Oculto</span>` : (aulasDoCurso(c) === 0 ? `<span class="cartao-etiqueta">Em breve</span>` : "")}
          </label>`).join("")}
      </div>
      <div class="membro-form-pe">
        <label class="field-rotulo" for="dar-prazo">Prazo</label>
        <div class="select-wrap"><select id="dar-prazo">${PRAZOS_DE_ACESSO.map(p => `<option value="${p.valor}">${p.rotulo}</option>`).join("")}</select></div>
        <button class="btn btn-secondary btn-sm" type="button" data-abrir="dar">Cancelar</button>
        <button class="btn btn-primary btn-sm" type="button" data-dar-cursos>Dar acesso</button>
      </div>
    </div>`;
}

function seccaoPlanos(f){
  const planos = DB.planos || [];
  if(!planos.length) return "";
  const meus = new Set((f.acessos || []).filter(a => a.ativo && a.plano).map(a => a.plano));
  const aDar = fichaAberta.abertos.plano;
  return `
    <section class="membro-seccao">
      <h4>Planos</h4>
      <p class="hint">Um plano abre de uma vez todos os cursos que leva dentro.</p>
      <div class="acessos-lista">
        ${planos.map(p => {
          const tem = meus.has(p.id);
          const nomes = (p.cursos || []).map(id => (cursoPorId(id) || {}).titulo).filter(Boolean);
          return `
            <div class="acesso-linha" data-plano-linha="${p.id}">
              <span class="cartao-mini sem-imagem" aria-hidden="true">${textoSeguro(iniciais(p.nome || "?"))}</span>
              <div class="acesso-info">
                <div class="nome">${textoSeguro(p.nome)}${tem ? ` <span class="pill pill-ativo">Ativo</span>` : ""}</div>
                <div class="sub-celula">${nomes.length} ${nomes.length === 1 ? "curso" : "cursos"}${nomes.length ? " · " + nomes.slice(0, 3).map(textoSeguro).join(", ") + (nomes.length > 3 ? "…" : "") : ""}</div>
              </div>
              ${tem
                ? `<button class="btn btn-secondary btn-sm" type="button" data-tirar-plano="${p.id}">Tirar</button>`
                : `<button class="btn btn-secondary btn-sm" type="button" data-abrir-plano="${p.id}" ${nomes.length ? "" : "disabled"}>Dar plano</button>`}
              ${aDar === p.id ? `
                <div class="acesso-prazo">
                  <label for="plano-prazo">Prazo</label>
                  <div class="select-wrap"><select id="plano-prazo">${PRAZOS_DE_ACESSO.map(x => `<option value="${x.valor}">${x.rotulo}</option>`).join("")}</select></div>
                  <button class="btn btn-primary btn-sm" type="button" data-dar-plano="${p.id}">Dar plano</button>
                  <button class="btn btn-secondary btn-sm" type="button" data-abrir-plano="${p.id}">Cancelar</button>
                </div>` : ""}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

function seccaoConvites(f){
  const email = (f.email || "").toLowerCase();
  const convites = (DB.convites || []).filter(c => (c.email || "").toLowerCase() === email);
  if(!convites.length) return "";
  return `
    <section class="membro-seccao">
      <h4>Convites</h4>
      <div class="acessos-lista">
        ${convites.map(c => {
          const est = estadoDoConvite(c.estado);
          const vivo = c.estado === "enviado" || c.estado === "aberto";
          return `
            <div class="acesso-linha">
              <div class="acesso-info">
                <div class="nome">Enviado a ${dataLegivel(c.criadoEm)}</div>
                <div class="sub-celula">${resumoDoConvite(c)}</div>
              </div>
              <span class="estado-convite ${est.classe}"><span class="estado-ponto" aria-hidden="true"></span>${est.rotulo}</span>
              ${c.estado !== "aceite" ? `<button class="btn-icone" type="button" data-reenviar-convite="${c.id}" title="Enviar outra vez" aria-label="Enviar o convite outra vez">${ICONE_REENVIAR}</button>` : ""}
              ${vivo ? `<button class="btn-icone perigo" type="button" data-revogar-convite="${c.id}" title="Revogar" aria-label="Revogar o convite">${ICONE_REVOGAR}</button>` : ""}
            </div>`;
        }).join("")}
      </div>
    </section>`;
}

/* Corre uma ação, relê a ficha e a lista, e diz o que aconteceu. */
async function acaoNaFicha(fazer, mensagem){
  const id = fichaAberta && fichaAberta.id;
  document.querySelectorAll("#membro-overlay button").forEach(b => b.disabled = true);
  try {
    const resposta = await fazer();
    await GestaoDeMembros.recarregar();
    if(estado.viewAtual === "admin-membros") renderAdminMembros();
    if(fichaAberta && fichaAberta.id === id){ fichaAberta.abertos = {}; await carregarFicha(); }
    const texto = typeof mensagem === "function" ? mensagem(resposta) : mensagem;
    if(texto) mostrarToast(texto);
    return resposta;
  } catch(erro){
    mostrarToast(erro.message || "Não foi possível fazer isto agora.");
    desenharFicha();
  }
}

function avisoDoPayflow(resposta){
  const ficam = ((resposta && resposta.pelo_payflow) || []).map(c => (cursoPorId(c) || {}).titulo).filter(Boolean);
  return ficam.length ? ` Continua com ${ficam.join(", ")} pela inscrição no Payflow.` : "";
}

function ligarFicha(caixa, f){
  const id = f.id;
  const titulo = c => textoSeguro((cursoPorId(c) || {}).titulo || "o curso");
  caixa.querySelectorAll("[data-fechar-membro]").forEach(b => b.addEventListener("click", () => fecharMembro()));

  caixa.querySelector("[data-membro-link]")?.addEventListener("click", () => confirmarAcao({
    titulo: "Enviar link de acesso",
    mensagem: `Enviamos a <strong>${textoSeguro(f.email)}</strong> um email com um link para escolher uma password e entrar.`,
    textoConfirmar: "Enviar",
    aoConfirmar: async () => {
      try { await GestaoDeMembros.enviarLink(f.email); mostrarToast("Link de acesso enviado para " + f.email); }
      catch(erro){ mostrarToast(erro.message || "Não foi possível enviar agora."); }
    }
  }));

  caixa.querySelectorAll("[data-membro-estado]").forEach(b => b.addEventListener("click", () => {
    const novo = b.getAttribute("data-membro-estado");
    if(novo === "ativo") return acaoNaFicha(() => GestaoDeMembros.estado(id, "ativo"), "Membro reativado");
    confirmarAcao({
      titulo: "Suspender membro",
      mensagem: `"${textoSeguro(f.nome || f.email)}" deixa de entrar nos cursos${f.papel !== "aluno" ? " e na equipa" : ""} até ser reativado. Os acessos e o progresso ficam guardados.`,
      textoConfirmar: "Suspender",
      aoConfirmar: () => acaoNaFicha(() => GestaoDeMembros.estado(id, "suspenso"), "Membro suspenso")
    });
  }));

  caixa.querySelector("[data-membro-remover]")?.addEventListener("click", () => confirmarAcao({
    titulo: "Remover da escola",
    mensagem: `"${textoSeguro(f.nome || f.email)}" sai da academia: os cursos fecham e os convites por aceitar são revogados. A conta e o histórico ficam; um convite novo traz a pessoa de volta.${(f.payflow || []).length ? "<br><br>Os cursos que vêm de uma inscrição no Payflow continuam abertos: esses tratam-se no Payflow." : ""}`,
    textoConfirmar: "Remover",
    aoConfirmar: async () => {
      try {
        const r = await GestaoDeMembros.remover(id);
        fecharMembro();
        await GestaoDeMembros.recarregar();
        if(estado.viewAtual === "admin-membros") renderAdminMembros();
        mostrarToast("Membro removido." + avisoDoPayflow(r));
      } catch(erro){ mostrarToast(erro.message || "Não foi possível remover."); }
    }
  }));

  caixa.querySelectorAll('input[name="membro-papel"]').forEach(r => r.addEventListener("change", () => {
    const funcao = r.value;
    const antes = f.papel;
    confirmarAcao({
      titulo: "Mudar o papel",
      mensagem: `"${textoSeguro(f.nome || f.email)}" passa a <strong>${FUNCOES[funcao].rotulo.toLowerCase()}</strong>. ${FUNCOES[funcao].dica}`,
      textoConfirmar: "Mudar",
      aoConfirmar: () => acaoNaFicha(() => GestaoDeMembros.papel(id, funcao), "Papel mudado para " + FUNCOES[funcao].rotulo.toLowerCase())
    });
    /* Até confirmar, o papel que vale é o de antes. */
    caixa.querySelectorAll('input[name="membro-papel"]').forEach(x => { x.checked = x.value === antes; });
  }));

  caixa.querySelectorAll("[data-abrir]").forEach(b => b.addEventListener("click", () => {
    const qual = b.getAttribute("data-abrir");
    fichaAberta.abertos = fichaAberta.abertos[qual] ? {} : { [qual]:true };
    desenharFicha();
  }));
  caixa.querySelectorAll("#form-dar-cursos .checklist-item input").forEach(i =>
    i.addEventListener("change", () => i.closest(".checklist-item").classList.toggle("escolhido", i.checked)));
  caixa.querySelector("[data-dar-cursos]")?.addEventListener("click", () => {
    const cursos = [...caixa.querySelectorAll("#form-dar-cursos input:checked")].map(i => i.value);
    if(!cursos.length){ mostrarToast("Escolha pelo menos um curso"); return; }
    const expira = dataDaquiA(caixa.querySelector("#dar-prazo").value);
    acaoNaFicha(() => GestaoDeMembros.darCursos(id, cursos, expira),
      cursos.length === 1 ? "Acesso dado a " + (cursoPorId(cursos[0]) || {}).titulo : `Acesso dado a ${cursos.length} cursos`);
  });

  caixa.querySelectorAll("[data-prazo]").forEach(b => b.addEventListener("click", () => {
    const curso = b.getAttribute("data-prazo");
    fichaAberta.abertos = fichaAberta.abertos.prazo === curso ? {} : { prazo:curso };
    desenharFicha();
    document.getElementById("prazo-" + curso)?.focus();
  }));
  caixa.querySelectorAll("[data-guardar-prazo]").forEach(b => b.addEventListener("click", () => {
    const curso = b.getAttribute("data-guardar-prazo");
    const data = caixa.querySelector("#prazo-" + curso).value;
    if(!data){ mostrarToast("Escolha uma data, ou carregue em «Sem prazo»"); return; }
    if(data < hojeISO()){ mostrarToast("Esse prazo já passou. Para fechar o acesso, tire o curso."); return; }
    acaoNaFicha(() => GestaoDeMembros.prazo(id, curso, data), "Acesso até " + dataLegivel(data));
  }));
  caixa.querySelectorAll("[data-sem-prazo]").forEach(b => b.addEventListener("click", () =>
    acaoNaFicha(() => GestaoDeMembros.prazo(id, b.getAttribute("data-sem-prazo"), null), "O acesso já não tem prazo")));

  caixa.querySelectorAll("[data-tirar]").forEach(b => b.addEventListener("click", () => {
    const curso = b.getAttribute("data-tirar");
    confirmarAcao({
      titulo: "Tirar o acesso",
      mensagem: `"${textoSeguro(f.nome || f.email)}" deixa de ver <strong>${titulo(curso)}</strong>. O progresso fica guardado, para o caso de voltar a abrir.`,
      textoConfirmar: "Tirar",
      aoConfirmar: () => acaoNaFicha(() => GestaoDeMembros.tirarCursos(id, [curso]), r => "Acesso retirado." + avisoDoPayflow(r))
    });
  }));
  caixa.querySelectorAll("[data-reabrir]").forEach(b => b.addEventListener("click", () =>
    acaoNaFicha(() => GestaoDeMembros.darCursos(id, [b.getAttribute("data-reabrir")], null), "Acesso aberto outra vez")));

  caixa.querySelectorAll("[data-abrir-plano]").forEach(b => b.addEventListener("click", () => {
    const plano = b.getAttribute("data-abrir-plano");
    fichaAberta.abertos = fichaAberta.abertos.plano === plano ? {} : { plano };
    desenharFicha();
  }));
  caixa.querySelectorAll("[data-dar-plano]").forEach(b => b.addEventListener("click", () => {
    const plano = b.getAttribute("data-dar-plano");
    const expira = dataDaquiA(caixa.querySelector("#plano-prazo").value);
    acaoNaFicha(() => GestaoDeMembros.darPlano(id, plano, expira), "Plano " + ((planoPorId(plano) || {}).nome || "") + " dado");
  }));
  caixa.querySelectorAll("[data-tirar-plano]").forEach(b => b.addEventListener("click", () => {
    const plano = planoPorId(b.getAttribute("data-tirar-plano")) || {};
    confirmarAcao({
      titulo: "Tirar o plano",
      mensagem: `Os cursos que vieram do plano <strong>${textoSeguro(plano.nome || "")}</strong> fecham para "${textoSeguro(f.nome || f.email)}". Os que tinha por outra via ficam.`,
      textoConfirmar: "Tirar",
      aoConfirmar: () => acaoNaFicha(() => GestaoDeMembros.tirarPlano(id, plano.id), "Plano retirado")
    });
  }));

  caixa.querySelectorAll("[data-reenviar-convite]").forEach(b => b.addEventListener("click", () => reenviarConvite(b.getAttribute("data-reenviar-convite"))));
  caixa.querySelectorAll("[data-revogar-convite]").forEach(b => b.addEventListener("click", () => revogarConvite(b.getAttribute("data-revogar-convite"))));
}

registarViews({ "admin-membros": renderAdminMembros });
