/* ============================================================
   Administração › Membros
   Quem está na escola, o que pode fazer e a que cursos tem acesso
   (pedido do Shelton a 28/10/2026). Até aqui a aba era só de leitura e
   mandava para o painel de gestão, que não gere as escolas.

   Com servidor, cada ação é uma função da base (academia.membro_*): é
   ela que confere quem pede — a equipa dá e tira cursos e assinaturas; só a
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
  { valor:"turma", rotulo:"O prazo da turma" },
  { valor:"",    rotulo:"Sem prazo" },
  { valor:"30",  rotulo:"30 dias" },
  { valor:"90",  rotulo:"90 dias" },
  { valor:"180", rotulo:"6 meses" },
  { valor:"365", rotulo:"1 ano" }
];

const ORIGENS_DO_ACESSO = { manual:"Dado à mão", convite:"Convite", oferta:"Compra" };
/* Os estados de uma matrícula (17/11/2026). «Expirada» é também a ativa cujo
   prazo já passou. */
const ESTADOS_DA_MATRICULA = { ativo:"Ativa", pendente:"Pendente", expirado:"Expirada", desativado:"Desativada" };
function estadoDoAcesso(a){ return a.estado || (a.ativo ? "ativo" : "desativado"); }

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
  if(!dias || isNaN(Number(dias))) return null;
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
    const f = await API.membro("membro_ficha", { p_utilizador:id });
    f.assinaturas = (f.assinaturas || []).map(x => ({ nivel:x.nivel, estado:x.estado, expira:x.expira || null, desde:x.iniciado || null }));
    return f;
  },
  async darCursos(id, cursos, expira){
    if(modoDemonstracao()) return demoDarCursos(id, cursos, expira);
    return API.membro("membro_dar_acesso", { p_utilizador:id, p_cursos:cursos, p_expira:expira });
  },
  /* A matrícula de um membro num curso: a turma, o estado e a expiração. Com
     prazoDaTurma, a data é a de hoje mais o prazo da turma. */
  async matricula(id, curso, o){
    o = o || {};
    if(modoDemonstracao()){
      const m = membroDemo(id);
      const pedida = turmaPorId(o.turma);
      const turma = pedida && pedida.cursoId === curso ? pedida : turmaPadraoDe(curso);
      const expira = o.prazoDaTurma ? expiraPelaTurma(turma) : (o.expira || null);
      let est = o.estado || "ativo";
      if(est === "ativo" && expira && expira < hojeISO()) est = "expirado";
      let a = m.acessos.find(x => x.curso === curso);
      if(!a){ a = { curso, origem:"manual", desde:hojeISO() }; m.acessos.push(a); }
      Object.assign(a, { turma:turma.id, estado:est, expira, ativo: est === "ativo" });
      return { curso, turma:turma.id, estado:est, expira };
    }
    return API.membro("matricula_definir", { p_utilizador:id, p_curso:curso, p_turma:o.turma || null,
      p_estado:o.estado || "ativo", p_expira:o.expira || null, p_prazo_da_turma:!!o.prazoDaTurma });
  },
  async tirarCursos(id, cursos){
    if(modoDemonstracao()){
      const m = membroDemo(id);
      let n = 0;
      m.acessos.forEach(a => { if(cursos.includes(a.curso) && a.ativo){ a.ativo = false; a.estado = "desativado"; a.expira = ontemISO(); n++; } });
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
  /* A assinatura de um membro num nível: o estado e a expiração. Sem estado,
     deixa de a ter. */
  async assinatura(id, nivel, o){
    o = o || {};
    if(modoDemonstracao()){
      const m = membroDemo(id);
      if(!o.estado){ m.assinaturas = m.assinaturas.filter(x => x.nivel !== nivel); return { nivel, estado:null }; }
      let est = o.estado;
      if(est === "ativo" && o.expira && o.expira < hojeISO()) est = "expirado";
      let x = m.assinaturas.find(k => k.nivel === nivel);
      if(!x){ x = { nivel, desde:hojeISO() }; m.assinaturas.push(x); }
      else if(est === "ativo" && x.estado !== "ativo") x.desde = hojeISO();
      Object.assign(x, { estado:est, expira:o.expira || null });
      return { nivel, estado:est, expira:x.expira };
    }
    return API.membro("assinatura_definir", { p_utilizador:id, p_nivel:nivel, p_estado:o.estado || null, p_expira:o.expira || null });
  },
  /* O acesso ilimitado: abre tudo o que a escola tem publicado. */
  async ilimitado(id, ligado){
    if(modoDemonstracao()){ membroDemo(id).ilimitado = !!ligado; return !!ligado; }
    return API.membro("membro_ilimitado", { p_utilizador:id, p_ligado:!!ligado });
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
    await Promise.all([API.recarregarMembros(), API.recarregarAssinaturas()]);
  }
};

function ontemISO(){ const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

/* Na demonstração, cada membro nasce com as matrículas próprias e a
   assinatura com que foi criado (js/dados.js): arruma-se aqui, uma vez. */
function semearMembroDemo(m){
  if(!Array.isArray(m.acessos)){
    m.acessos = (m.matriculas || []).filter(curso => DB.cursos.some(c => c.id === curso)).map(curso => ({
      curso, origem:"oferta", expira:null, ativo:true, estado:"ativo", desde:m.membroDesde || hojeISO()
    }));
  }
  assinaturasDoMembro(m);
  m.acessos.forEach(a => {
    if(a.ativo && a.expira && a.expira < hojeISO()){ a.ativo = false; a.estado = "expirado"; }
    if(!a.turma || !turmaPorId(a.turma)) a.turma = (turmaPadraoDe(a.curso) || {}).id || null;
    if(!a.estado) a.estado = a.ativo ? "ativo" : "desativado";
  });
  return m;
}
function membroDemo(id){
  const m = DB.membros.find(x => x.id === id);
  if(!m) throw new Error("Esta pessoa não é membro desta escola.");
  return semearMembroDemo(m);
}

function demoDarCursos(id, cursos, expira){
  const m = membroDemo(id);
  let n = 0;
  cursos.forEach(curso => {
    if(!DB.cursos.some(c => c.id === curso)) return;
    const a = m.acessos.find(x => x.curso === curso);
    if(a){
      if(!a.ativo) a.origem = "manual";
      a.expira = expira;
      a.ativo = true; a.estado = "ativo";
    } else m.acessos.push({ curso, origem:"manual", expira, ativo:true, estado:"ativo", desde:hojeISO(),
                            turma:(turmaPadraoDe(curso) || {}).id || null });
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
    acessos:m.acessos.map(a => Object.assign({}, a)), assinaturas:m.assinaturas.map(x => Object.assign({}, x)),
    ilimitado:m.ilimitado === true, payflow:[], concluidas:m.concluidas || {}
  };
}

/* As matrículas próprias abertas de um membro, para a lista. */
function cursosAbertosDoMembro(m){
  if(Array.isArray(m.acessos)) return m.acessos.filter(a => a.ativo).length;
  if(m.cursosAbertos != null) return m.cursosAbertos;
  return (m.matriculas || []).length;
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
  /* Vindo das Assinaturas: só quem tem aquele nível, naquele estado. */
  const fa = estado.filtroAssinatura && nivelPorId(estado.filtroAssinatura.nivel) ? estado.filtroAssinatura : null;
  if(!fa) estado.filtroAssinatura = null;
  const lista = todos.filter(doFiltro[filtro] || doFiltro.todos).filter(m =>
    !busca || ((m.nome || "") + " " + (m.email || "")).toLowerCase().includes(busca))
    .filter(m => !fa || estadoDaAssinatura(assinaturasDoMembro(m).find(x => x.nivel === fa.nivel)) === fa.estado);
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
      ${fa ? `<div class="membros-filtro-ativo" id="membros-filtro-assinatura">
          <span>Assinatura <strong>${textoSeguro(nivelPorId(fa.nivel).nome)}</strong> · ${fa.estado === "pendente" ? "pendentes" : "ativos"} · ${lista.length} ${lista.length === 1 ? "membro" : "membros"}</span>
          <button class="btn btn-secondary btn-sm" type="button" id="btn-limpar-filtro-assinatura">Ver todos</button>
        </div>` : ""}
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
  document.getElementById("btn-limpar-filtro-assinatura")?.addEventListener("click", () => { estado.filtroAssinatura = null; renderAdminMembros(); });
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
  /* O acesso, em poucas palavras: as matrículas próprias e, por baixo, as
     assinaturas ativas (cada uma abre os cursos que leva). */
  const niveis = assinaturasDoMembro(m).filter(assinaturaAtiva).map(x => (nivelPorId(x.nivel) || {}).nome).filter(Boolean);
  const n = cursosAbertosDoMembro(m);
  const acesso = funcao !== "aluno"
    ? `<span class="sub-celula">Todos os cursos</span>`
    : membroIlimitado(m) ? `Acesso ilimitado`
    : `${n || !niveis.length ? `${n} ${n === 1 ? "curso" : "cursos"}` : ""}${niveis.length ? `<div class="${n ? "sub-celula" : ""}">${niveis.map(textoSeguro).join(" · ")}</div>` : ""}`;
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
   uma pessoa — papel, estado, cursos, assinaturas e convites.
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
  const abertos = viasDeAcesso(f.acessos, f.assinaturas);
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
        <div><dt>Cursos abertos</dt><dd>${funcao !== "aluno" ? "Todos" : f.ilimitado ? "Todos os publicados" : abertos.length + (f.payflow || []).filter(c => !abertos.some(a => a.curso === c)).length}</dd></div>
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
      ${seccaoAssinaturas(f)}
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
  /* O que abre: as matrículas próprias e, a seguir, os cursos que vêm das
     assinaturas ativas (sem matrícula própria). */
  const vias = viasDeAcesso(acessos, f.assinaturas);
  const abertos = vias.map(v => v.via === "matricula" ? acessos.find(a => a.ativo && a.curso === v.curso)
    : { curso:v.curso, turma:v.turma, expira:v.expira, ativo:true, nivel:v.nivel });
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
      ${funcao !== "aluno" ? `<p class="hint">Como ${FUNCOES[funcao].rotulo.toLowerCase()}, vê todos os cursos da escola. Os acessos abaixo valem se voltar a ser aluno.</p>`
        : f.ilimitado ? `<p class="hint">Tem acesso ilimitado: abre todos os cursos publicados. As matrículas abaixo valem se o acesso ilimitado for retirado, e dizem em que turma está.</p>` : ""}
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
  /* Um curso que vem de uma assinatura não tem matrícula própria: mostra-se
     de onde vem, e pode dar-se-lhe uma (que passa a valer mais). */
  const nivel = a.nivel ? nivelPorId(a.nivel) : null;
  const origem = nivel ? "Assinatura " + nivel.nome : (ORIGENS_DO_ACESSO[a.origem] || "Dado à mão");
  const prazo = a.expira ? "Até " + dataLegivel(a.expira) : "Sem prazo";
  const editando = fichaAberta.abertos.prazo === a.curso;
  /* A turma só se diz quando o curso tem mais de uma: senão é sempre a mesma. */
  const turmas = turmasDoCurso(a.curso);
  const turma = turmas.length > 1 ? (turmaPorId(a.turma) || {}).nome : "";
  return `
    <div class="acesso-linha" data-acesso="${a.curso}" ${nivel ? `data-pela-assinatura="${nivel.id}"` : ""}>
      ${miniaturaDoCurso(c)}
      <div class="acesso-info">
        <div class="nome">${textoSeguro(c.titulo)}</div>
        <div class="sub-celula">${[turma ? textoSeguro(turma) : "", textoSeguro(origem), prazo, progressoNoCurso(f, c)].filter(Boolean).join(" · ")}</div>
      </div>
      <div class="acoes-linha">
        <button class="btn-icone" type="button" data-prazo="${a.curso}" title="${nivel ? "Dar uma matrícula própria: turma, estado e prazo" : "Mudar a matrícula: turma, estado e prazo"}" aria-label="${nivel ? "Dar uma matrícula própria em" : "Mudar a matrícula em"} ${textoSeguro(c.titulo)}">${ICONE_PRAZO}</button>
        ${nivel ? "" : `<button class="btn-icone perigo" type="button" data-tirar="${a.curso}" title="Tirar o acesso" aria-label="Tirar o acesso a ${textoSeguro(c.titulo)}">${ICONE_TIRAR}</button>`}
      </div>
      ${editando ? `
        <div class="acesso-prazo">
          ${turmas.length > 1 ? `<label for="turma-${a.curso}">Turma</label>
            <div class="select-wrap"><select id="turma-${a.curso}">${turmas.map(t => `<option value="${t.id}" ${t.id === a.turma ? "selected" : ""}>${textoSeguro(t.nome)}</option>`).join("")}</select></div>` : ""}
          <label for="estado-${a.curso}">Estado</label>
          <div class="select-wrap"><select id="estado-${a.curso}">${Object.entries(ESTADOS_DA_MATRICULA).map(([v, r]) => `<option value="${v}" ${v === "ativo" ? "selected" : ""}>${r}</option>`).join("")}</select></div>
          <label for="prazo-${a.curso}">Acesso até</label>
          <input type="date" id="prazo-${a.curso}" value="${a.expira || ""}">
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
        <div class="sub-celula">${estadoDoAcesso(a) === "pendente" ? "Pendente: ainda não abre"
          : estadoDoAcesso(a) === "expirado" ? "Expirou a " + dataLegivel(a.expira)
          : a.expira && a.expira < hojeISO() ? "Fechado desde " + dataLegivel(a.expira) : "Desativada"}</div>
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

/* As assinaturas: uma linha por nível que a escola tem, com o estado e a
   data desta pessoa em cada um; e o acesso ilimitado. */
function seccaoAssinaturas(f){
  const niveis = DB.niveis || [];
  const aberto = fichaAberta.abertos.assinatura;
  const pill = { ativo:"pill-ativo", pendente:"pill-morno", expirado:"pill-inativo", desativado:"pill-inativo" };
  return `
    <section class="membro-seccao" id="membro-assinaturas">
      <h4>Assinaturas</h4>
      <p class="hint">Uma assinatura abre de uma vez os cursos que leva, enquanto estiver ativa. ${niveis.length ? "" : "Ainda não há nenhuma: criam-se em Assinaturas."}</p>
      ${niveis.length ? `<div class="acessos-lista">
        ${niveis.map(n => {
          const x = (f.assinaturas || []).find(k => k.nivel === n.id);
          const est = estadoDaAssinatura(x);
          const cursos = cursosDoNivel(n).map(k => (DB.cursos.find(c => c.id === k.cursoId) || {}).titulo).filter(Boolean);
          const sub = [`${cursos.length} ${cursos.length === 1 ? "curso" : "cursos"}`,
            est === "ativo" ? (x.expira ? "Até " + dataLegivel(x.expira) : "Sem prazo")
            : est === "expirado" ? "Expirou a " + dataLegivel(x.expira) : ""].filter(Boolean).join(" · ");
          const prazos = [
            n.trialDias ? { valor:"trial", rotulo:`Trial gratuito (${prazoEmDias(n.trialDias)})` } : null,
            n.extensaoDias ? { valor:"extensao", rotulo:`${prazoEmDias(n.extensaoDias)} (a extensão)` } : null,
            { valor:"", rotulo:"Sem prazo" }].filter(Boolean);
          return `
            <div class="acesso-linha" data-assinatura="${n.id}">
              <span class="cartao-mini sem-imagem" aria-hidden="true">${textoSeguro(iniciais(n.nome || "?"))}</span>
              <div class="acesso-info">
                <div class="nome">${textoSeguro(n.nome)}${est ? ` <span class="pill ${pill[est]}">${ESTADOS_DA_ASSINATURA_DO_MEMBRO[est]}</span>` : ""}</div>
                <div class="sub-celula">${sub}</div>
              </div>
              <div class="acoes-linha">
                ${est ? `<button class="btn-icone" type="button" data-editar-assinatura="${n.id}" title="Mudar o estado e a data" aria-label="Mudar a assinatura ${textoSeguro(n.nome)}">${ICONE_PRAZO}</button>` : ""}
                ${est === "ativo" || est === "pendente" ? `<button class="btn-icone perigo" type="button" data-tirar-assinatura="${n.id}" title="Desativar a assinatura" aria-label="Desativar a assinatura ${textoSeguro(n.nome)}">${ICONE_TIRAR}</button>` : ""}
                ${est === "ativo" || est === "pendente" ? "" : `<button class="btn btn-secondary btn-sm" type="button" data-abrir-assinatura="${n.id}" ${cursos.length ? "" : "disabled"}>Dar assinatura</button>`}
              </div>
              ${aberto === "dar:" + n.id ? `
                <div class="acesso-prazo">
                  <label for="assinatura-prazo">Prazo</label>
                  <div class="select-wrap"><select id="assinatura-prazo">${prazos.map(k => `<option value="${k.valor}">${k.rotulo}</option>`).join("")}</select></div>
                  <button class="btn btn-primary btn-sm" type="button" data-dar-assinatura="${n.id}">Dar assinatura</button>
                  <button class="btn btn-secondary btn-sm" type="button" data-abrir-assinatura="${n.id}">Cancelar</button>
                </div>` : ""}
              ${aberto === "editar:" + n.id ? `
                <div class="acesso-prazo">
                  <label for="assinatura-estado">Estado</label>
                  <div class="select-wrap"><select id="assinatura-estado">${Object.entries(ESTADOS_DA_ASSINATURA_DO_MEMBRO).map(([v, r]) => `<option value="${v}" ${v === (est === "expirado" ? "ativo" : est) ? "selected" : ""}>${r}</option>`).join("")}</select></div>
                  <label for="assinatura-expira">Válida até</label>
                  <input type="date" id="assinatura-expira" value="${x.expira || ""}">
                  <button class="btn btn-primary btn-sm" type="button" data-guardar-assinatura="${n.id}">Guardar</button>
                  <button class="btn btn-secondary btn-sm" type="button" data-assinatura-sem-prazo="${n.id}">Sem prazo</button>
                </div>` : ""}
            </div>`;
        }).join("")}
      </div>` : ""}
      <div class="toggle-row membro-ilimitado">
        <div><div class="t-title">Acesso ilimitado</div>
          <div class="t-sub">Abre todos os cursos publicados, os de agora e os que vierem.</div></div>
        <div class="toggle ${f.ilimitado ? "on" : ""}" id="membro-ilimitado" role="switch" aria-checked="${!!f.ilimitado}" aria-label="Acesso ilimitado" tabindex="0"><div class="knob"></div></div>
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

/* A turma e o estado escolhidos no editor da matrícula de um curso. */
function matriculaDoFormulario(caixa, curso){
  const turma = caixa.querySelector("#turma-" + CSS.escape(curso));
  const est = caixa.querySelector("#estado-" + CSS.escape(curso));
  return { turma: turma ? turma.value : null, estado: est ? est.value : "ativo" };
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
    const prazo = caixa.querySelector("#dar-prazo").value;
    const expira = dataDaquiA(prazo);
    acaoNaFicha(async () => {
        /* «O prazo da turma»: cada curso na sua turma padrão, com o prazo dela. */
        if(prazo === "turma"){ for(const c of cursos) await GestaoDeMembros.matricula(id, c, { estado:"ativo", prazoDaTurma:true }); }
        else await GestaoDeMembros.darCursos(id, cursos, expira);
      },
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
    const m = matriculaDoFormulario(caixa, curso);
    if(m.estado === "ativo" && !data){ mostrarToast("Escolha uma data, ou carregue em «Sem prazo»"); return; }
    if(m.estado === "ativo" && data < hojeISO()){ mostrarToast("Esse prazo já passou. Para fechar o acesso, tire o curso."); return; }
    acaoNaFicha(() => GestaoDeMembros.matricula(id, curso, { turma:m.turma, estado:m.estado, expira:data || null }),
      m.estado === "ativo" ? "Acesso até " + dataLegivel(data) : "Matrícula " + ESTADOS_DA_MATRICULA[m.estado].toLowerCase());
  }));
  caixa.querySelectorAll("[data-sem-prazo]").forEach(b => b.addEventListener("click", () => {
    const curso = b.getAttribute("data-sem-prazo");
    const m = matriculaDoFormulario(caixa, curso);
    acaoNaFicha(() => GestaoDeMembros.matricula(id, curso, { turma:m.turma, estado:m.estado, expira:null }),
      m.estado === "ativo" ? "O acesso já não tem prazo" : "Matrícula " + ESTADOS_DA_MATRICULA[m.estado].toLowerCase());
  }));

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

  /* As assinaturas. */
  const nomeDoNivel = nivel => textoSeguro((nivelPorId(nivel) || {}).nome || "");
  caixa.querySelectorAll("[data-abrir-assinatura]").forEach(b => b.addEventListener("click", () => {
    const chave = "dar:" + b.getAttribute("data-abrir-assinatura");
    fichaAberta.abertos = fichaAberta.abertos.assinatura === chave ? {} : { assinatura:chave };
    desenharFicha();
  }));
  caixa.querySelectorAll("[data-editar-assinatura]").forEach(b => b.addEventListener("click", () => {
    const chave = "editar:" + b.getAttribute("data-editar-assinatura");
    fichaAberta.abertos = fichaAberta.abertos.assinatura === chave ? {} : { assinatura:chave };
    desenharFicha();
  }));
  caixa.querySelectorAll("[data-dar-assinatura]").forEach(b => b.addEventListener("click", () => {
    const nivel = b.getAttribute("data-dar-assinatura");
    const n = nivelPorId(nivel) || {};
    const prazo = caixa.querySelector("#assinatura-prazo").value;
    const expira = prazo === "trial" ? dataDaquiA(n.trialDias) : prazo === "extensao" ? dataDaquiA(n.extensaoDias) : null;
    acaoNaFicha(() => GestaoDeMembros.assinatura(id, nivel, { estado:"ativo", expira }), "Assinatura " + nomeDoNivel(nivel) + " dada");
  }));
  caixa.querySelectorAll("[data-guardar-assinatura], [data-assinatura-sem-prazo]").forEach(b => b.addEventListener("click", () => {
    const semPrazo = b.hasAttribute("data-assinatura-sem-prazo");
    const nivel = b.getAttribute(semPrazo ? "data-assinatura-sem-prazo" : "data-guardar-assinatura");
    const est = caixa.querySelector("#assinatura-estado").value;
    const data = semPrazo ? "" : caixa.querySelector("#assinatura-expira").value;
    if(!semPrazo && est === "ativo" && !data){ mostrarToast("Escolha uma data, ou carregue em «Sem prazo»"); return; }
    if(est === "ativo" && data && data < hojeISO()){ mostrarToast("Essa data já passou. Para fechar a assinatura, desative-a."); return; }
    acaoNaFicha(() => GestaoDeMembros.assinatura(id, nivel, { estado:est, expira:data || null }),
      "Assinatura " + nomeDoNivel(nivel) + ": " + ESTADOS_DA_ASSINATURA_DO_MEMBRO[est].toLowerCase());
  }));
  caixa.querySelectorAll("[data-tirar-assinatura]").forEach(b => b.addEventListener("click", () => {
    const nivel = b.getAttribute("data-tirar-assinatura");
    const x = (f.assinaturas || []).find(k => k.nivel === nivel) || {};
    confirmarAcao({
      titulo: "Desativar a assinatura",
      mensagem: `Os cursos que <strong>${nomeDoNivel(nivel)}</strong> abre fecham para "${textoSeguro(f.nome || f.email)}". Os que tem por matrícula própria ficam, e o progresso fica guardado.`,
      textoConfirmar: "Desativar",
      aoConfirmar: () => acaoNaFicha(() => GestaoDeMembros.assinatura(id, nivel, { estado:"desativado", expira:x.expira || null }), "Assinatura desativada")
    });
  }));
  const ilimitado = caixa.querySelector("#membro-ilimitado");
  if(ilimitado){
    const alternar = () => {
      if(f.ilimitado) return acaoNaFicha(() => GestaoDeMembros.ilimitado(id, false), "Acesso ilimitado retirado");
      confirmarAcao({
        titulo: "Dar acesso ilimitado",
        mensagem: `"${textoSeguro(f.nome || f.email)}" passa a abrir todos os cursos publicados da escola, os de agora e os que vierem.`,
        textoConfirmar: "Dar acesso ilimitado",
        aoConfirmar: () => acaoNaFicha(() => GestaoDeMembros.ilimitado(id, true), "Acesso ilimitado dado")
      });
    };
    ilimitado.addEventListener("click", alternar);
    ilimitado.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); alternar(); } });
  }

  caixa.querySelectorAll("[data-reenviar-convite]").forEach(b => b.addEventListener("click", () => reenviarConvite(b.getAttribute("data-reenviar-convite"))));
  caixa.querySelectorAll("[data-revogar-convite]").forEach(b => b.addEventListener("click", () => revogarConvite(b.getAttribute("data-revogar-convite"))));
}

registarViews({ "admin-membros": renderAdminMembros });
