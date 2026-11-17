/* ============================================================
   Administração › Turmas e Certificados

   Uma TURMA é uma edição de um curso (especificação de 17/11/2026): tem um
   nome, um prazo de acesso e as regras de liberação dos módulos e das
   aulas (quando cada um abre para quem está nela). Todo o curso tem pelo menos uma, a «Turma A», que é a padrão dele.
   Quem tem o curso tem-no numa turma: é a matrícula.

   Até aqui esta aba mostrava as turmas do painel de gestão, só para ler.
   Agora são da escola: criam-se, editam-se e apagam-se aqui. As regras (uma
   padrão por curso, não apagar com membros ativos) são da base.

   Certificados define a regra e o desenho do diploma.
   ============================================================ */

const TURMAS_POR_PAGINA = 15;

function turmaPorId(id){ return (DB.turmas || []).find(t => t.id === id); }

/* As turmas de um curso, a padrão primeiro. Na demonstração, um curso criado
   no momento ganha aqui a sua «Turma A», como a base faz a sério. */
function turmasDoCurso(cursoId){
  DB.turmas = DB.turmas || [];
  if(modoDemonstracao() && cursoPorId(cursoId) && !DB.turmas.some(t => t.cursoId === cursoId))
    DB.turmas.push({ id:"t-" + cursoId, nome:"Turma A", cursoId, prazoDias:null, padrao:true });
  return DB.turmas.filter(t => t.cursoId === cursoId).sort((x, y) => (y.padrao ? 1 : 0) - (x.padrao ? 1 : 0));
}
function turmaPadraoDe(cursoId){
  const lista = turmasDoCurso(cursoId);
  return lista.find(t => t.padrao) || lista[0] || null;
}
function prazoDaTurmaEmTexto(t){
  if(!t || !t.prazoDias) return "sem prazo";
  if(t.prazoDias % 365 === 0) return t.prazoDias === 365 ? "1 ano" : (t.prazoDias / 365) + " anos";
  return t.prazoDias + (t.prazoDias === 1 ? " dia" : " dias");
}
/* A data em que acaba uma matrícula começada hoje nesta turma (nula sem prazo). */
function expiraPelaTurma(t){
  if(!t || !t.prazoDias) return null;
  const d = new Date(); d.setDate(d.getDate() + Number(t.prazoDias));
  return d.toISOString().slice(0, 10);
}

/* Os números do cartão. Com servidor vêm contados da base; na demonstração
   contam-se pelas matrículas em memória. */
function numerosDaTurma(t){
  if(!modoDemonstracao()) return { membros:t.membros || 0, comentarios:t.comentarios || 0, progresso:t.progresso || 0 };
  const dentro = (DB.membros || []).filter(m => membroDemo(m.id).acessos.some(a => a.turma === t.id && a.ativo));
  const ids = new Set(dentro.map(m => m.id));
  return {
    membros: dentro.length,
    comentarios: (DB.avaliacoes || []).filter(av => av.cursoId === t.cursoId && (av.comentario || "").trim() && ids.has(av.membroId)).length,
    progresso: dentro.length ? Math.round(dentro.reduce((s, m) => s + (Number(m.progresso) || 0), 0) / dentro.length) : 0
  };
}

/* ============================================================
   A lista, em cartões
   ============================================================ */
function renderAdminTurmas(){
  DB.cursos.forEach(c => turmasDoCurso(c.id));
  const busca = (estado.buscaTurmas || "").trim().toLowerCase();
  const todas = (DB.turmas || []).filter(t => cursoPorId(t.cursoId));
  const lista = todas.filter(t => !busca || (t.nome + " " + cursoPorId(t.cursoId).titulo).toLowerCase().includes(busca));
  const paginas = Math.max(1, Math.ceil(lista.length / TURMAS_POR_PAGINA));
  const pagina = Math.min(Math.max(1, estado.paginaTurmas || 1), paginas);
  const visiveis = lista.slice((pagina - 1) * TURMAS_POR_PAGINA, pagina * TURMAS_POR_PAGINA);

  /* Em lista, uma linha por turma (referência do Shelton, 17/11/2026): a capa
     do curso, o nome da turma e o curso, os membros, os comentários e o
     progresso médio. A pesquisa fica ao lado do botão. */
  const escola = (DB.aparencia && DB.aparencia.nomeEscola) || "";
  document.getElementById("content-admin").innerHTML = `
    <div class="turmas-cabeca">
      <div class="page-head">
        ${escola ? `<span class="turmas-escola">${textoSeguro(escola)}</span>` : ""}
        <h1>Turmas</h1>
      </div>
      <div class="turmas-acoes">
        <div class="search-pill"><input type="search" id="turmas-busca" placeholder="Pesquisar turma" aria-label="Pesquisar turma" value="${textoSeguro(estado.buscaTurmas || "").replace(/"/g, "&quot;")}"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></div>
        ${DB.cursos.length ? `<button class="btn btn-primary" type="button" id="btn-nova-turma">Nova turma</button>` : ""}
      </div>
    </div>
    ${visiveis.length ? `
      <div class="turmas-lista" id="turmas-grelha">${visiveis.map(linhaDaTurma).join("")}</div>
      ${paginas > 1 ? `<nav class="paginacao" aria-label="Páginas de turmas">
          <button class="btn btn-secondary btn-sm" type="button" data-pagina="${pagina - 1}" ${pagina === 1 ? "disabled" : ""}>Anterior</button>
          ${Array.from({ length:paginas }, (_, i) => `<button class="btn btn-sm ${i + 1 === pagina ? "btn-primary" : "btn-secondary"}" type="button" data-pagina="${i + 1}" ${i + 1 === pagina ? 'aria-current="page"' : ""}>${i + 1}</button>`).join("")}
          <button class="btn btn-secondary btn-sm" type="button" data-pagina="${pagina + 1}" ${pagina === paginas ? "disabled" : ""}>Próximo</button>
        </nav>` : ""}`
      : `<div class="card painel"><div class="empty-note">${todas.length ? "Nenhuma turma com esse nome."
          : DB.cursos.length ? "Ainda não há turmas." : "Crie primeiro um curso, em Conteúdos: ele nasce com a sua Turma A."}</div></div>`}
  `;

  const nova = document.getElementById("btn-nova-turma");
  if(nova) nova.addEventListener("click", () => novaTurma());
  const campo = document.getElementById("turmas-busca");
  campo.addEventListener("input", () => {
    estado.buscaTurmas = campo.value; estado.paginaTurmas = 1;
    const pos = campo.selectionStart;
    renderAdminTurmas();
    const outro = document.getElementById("turmas-busca");
    outro.focus(); outro.setSelectionRange(pos, pos);
  });
  document.querySelectorAll("#content-admin [data-pagina]").forEach(b => b.addEventListener("click", () => {
    estado.paginaTurmas = Number(b.getAttribute("data-pagina")); renderAdminTurmas(); window.scrollTo(0, 0);
  }));
  document.querySelectorAll("#turmas-grelha [data-turma]").forEach(el => {
    const abrir = () => irPara("admin-turma", el.getAttribute("data-turma"));
    el.addEventListener("click", abrir);
    el.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); abrir(); } });
  });
}

function linhaDaTurma(t){
  const c = cursoPorId(t.cursoId);
  const n = numerosDaTurma(t);
  /* A padrão só se assinala onde há escolha: num curso com mais de uma turma. */
  const variasNoCurso = turmasDoCurso(t.cursoId).length > 1;
  const detalhe = [textoSeguro(c.titulo), t.prazoDias ? "Acesso " + prazoDaTurmaEmTexto(t) : ""].filter(Boolean).join(" · ");
  return `<div class="card turma-linha" data-turma="${t.id}" role="link" tabindex="0" aria-label="${textoSeguro(t.nome)}, ${textoSeguro(c.titulo)}">
    <div class="turma-capa ${c.capa ? "com-capa" : ""}" style="--field:${campoDoCurso(c.id)};${c.capa ? `background-image:url(${c.capa})` : ""}" aria-hidden="true">${c.capa ? "" : textoSeguro(c.sigla || iniciais(c.titulo || "?"))}</div>
    <div class="turma-quem">
      <h3>${textoSeguro(t.nome)}${variasNoCurso && t.padrao ? ` <span class="pill pill-ativo">Padrão</span>` : ""}</h3>
      <p>${detalhe}</p>
    </div>
    <div class="turma-dado">${ICONS.people}<span>${n.membros} ${n.membros === 1 ? "Membro" : "Membros"}</span></div>
    <div class="turma-dado">${ICONS.chat}<span>${n.comentarios} ${n.comentarios === 1 ? "Comentário" : "Comentários"}</span></div>
    <div class="turma-progresso" title="Progresso médio dos membros">
      <div class="progress-track thin"><div class="progress-fill mini" style="width:${n.progresso}%"></div></div>
      <span class="pct">${n.progresso}%</span>
    </div>
  </div>`;
}

/* Criar: o nome e o curso. O resto (prazo, padrão e as regras de liberação)
   acerta-se na edição, que abre logo a seguir. */
function novaTurma(cursoId){
  abrirDrawer({
    titulo: "Nova turma",
    subtitulo: "Uma edição de um curso. O prazo de acesso define-se a seguir.",
    campos: [
      { nome:"nome", rotulo:"Nome", tipo:"texto", obrigatorio:true, placeholder:"ex.: Mentoria 7A" },
      { nome:"cursoId", rotulo:"Curso", tipo:"select", opcoes:opcoesCursos() }
    ],
    valores: { cursoId: cursoId || (DB.cursos[0] || {}).id },
    textoGuardar: "Criar turma",
    aoGuardar: v => {
      if(!cursoPorId(v.cursoId)){ mostrarToast("Escolha o curso desta turma."); return false; }
      criarTurma({ nome:v.nome, cursoId:v.cursoId, prazoDias:null, padrao:false });
      return false;
    }
  });
}

async function criarTurma(t){
  const botao = document.getElementById("drawer-guardar");
  if(botao) botao.disabled = true;
  try {
    let id;
    if(modoDemonstracao()){
      turmasDoCurso(t.cursoId);
      id = novoId("turma");
      DB.turmas.push(Object.assign({ id }, t));
      guardarDB();
    } else {
      id = await API.guardarTurma(t);
      await API.recarregarTurmas();
    }
    fecharDrawer(true);
    mostrarToast("Turma criada");
    irPara("admin-turma", id);
  } catch(e){
    mostrarToast(e.message || "Não foi possível criar a turma.");
    if(botao) botao.disabled = false;
  }
}

/* ============================================================
   Editar uma turma
   ============================================================ */
function renderAdminTurma(id){
  if(id) estado.turmaEditando = id;
  const t = turmaPorId(estado.turmaEditando);
  const c = t && cursoPorId(t.cursoId);
  if(!t || !c){ irPara("admin-turmas"); return; }
  const n = numerosDaTurma(t);
  const outras = turmasDoCurso(t.cursoId).filter(x => x.id !== t.id);

  document.getElementById("content-admin").innerHTML = `
    <div class="back-link" id="btn-voltar-turmas"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Turmas</div>
    <div class="gestao-head">
      <div>
        <h2>Editar turma</h2>
        <p>${textoSeguro(c.titulo)}${outras.length ? ` · ${outras.length === 1 ? "mais 1 turma" : "mais " + outras.length + " turmas"} neste curso` : " · a única turma deste curso"}</p>
      </div>
    </div>

    <div class="card painel turma-form">
      <dl class="membro-factos">
        <div><dt>Membros</dt><dd>${n.membros}</dd></div>
        <div><dt>Comentários</dt><dd>${n.comentarios}</dd></div>
        <div><dt>Progresso médio</dt><dd>${n.progresso}%</dd></div>
      </dl>
      <div class="field">
        <label for="turma-nome">Nome</label>
        <input id="turma-nome" maxlength="120" value="${textoSeguro(t.nome).replace(/"/g, "&quot;")}">
      </div>
      <div class="field">
        <label for="turma-prazo">Prazo de acesso</label>
        <div class="campo-com-sufixo"><input id="turma-prazo" type="number" min="1" max="36500" inputmode="numeric" value="${t.prazoDias || ""}" placeholder="Sem prazo"><span>dias</span></div>
        <p class="hint">A matrícula acaba este número de dias depois de começar. Vazio, o acesso não tem prazo. Mudar o prazo vale para as matrículas novas; as que já existem ficam com a data que têm.</p>
      </div>
      <div class="toggle-row" style="border-top:none;padding:10px 0;">
        <div><div class="t-title">Turma padrão</div>
          <div class="t-sub">${t.padrao
            ? "É a turma de quem recebe este curso sem se escolher uma turma. Para mudar, marque outra turma do curso como padrão."
            : "É a turma de quem recebe este curso sem se escolher uma turma. Marcar esta desmarca a padrão de agora."}</div></div>
        <div class="toggle ${t.padrao ? "on travado" : ""}" id="turma-padrao" role="switch" aria-checked="${!!t.padrao}" aria-label="Turma padrão" tabindex="0" ${t.padrao ? 'aria-disabled="true"' : ""}><div class="knob"></div></div>
      </div>
    </div>

    <div id="turma-regras-zona" class="turma-regras-zona"><div class="card painel turma-regras"><div class="empty-note">A ler as regras de liberação…</div></div></div>

    <div class="turma-rodape turma-form turma-rodape-solto">
      ${t.padrao ? "" : `<button class="btn btn-perigo-suave" type="button" id="turma-apagar">Excluir</button>`}
      <span class="turma-rodape-fim">
        <button class="btn btn-secondary" type="button" id="turma-cancelar">Cancelar</button>
        <button class="btn btn-primary" type="button" id="turma-guardar">Salvar</button>
      </span>
    </div>
  `;
  abrirRegrasDaTurma(t, c);

  const voltar = () => irPara("admin-turmas");
  document.getElementById("btn-voltar-turmas").addEventListener("click", voltar);
  document.getElementById("turma-cancelar").addEventListener("click", voltar);
  const padrao = document.getElementById("turma-padrao");
  if(!t.padrao){
    const alternar = () => { const ligado = padrao.classList.toggle("on"); padrao.setAttribute("aria-checked", String(ligado)); };
    padrao.addEventListener("click", alternar);
    padrao.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); alternar(); } });
  }
  document.getElementById("turma-guardar").addEventListener("click", () => guardarTurma(t));
  const apagar = document.getElementById("turma-apagar");
  if(apagar) apagar.addEventListener("click", () => apagarTurma(t));
}

async function guardarTurma(t){
  const nome = document.getElementById("turma-nome").value.trim();
  const bruto = document.getElementById("turma-prazo").value.trim();
  const prazoDias = bruto === "" ? null : Number(bruto);
  if(!nome){ mostrarToast("Dê um nome à turma."); return; }
  if(prazoDias !== null && (!Number.isInteger(prazoDias) || prazoDias < 1 || prazoDias > 36500)){
    mostrarToast("O prazo é um número de dias, a partir de 1. Vazio é sem prazo."); return;
  }
  const padrao = document.getElementById("turma-padrao").classList.contains("on");
  /* As regras conferem-se antes de se guardar o que quer que seja. Se não
     chegaram a ler-se (falha de rede), não se mexe nelas. */
  const regras = regrasParaGuardar(t);
  if(regras === false) return;
  const botao = document.getElementById("turma-guardar");
  botao.disabled = true;
  try {
    if(modoDemonstracao()){
      if(padrao) DB.turmas.forEach(x => { if(x.cursoId === t.cursoId) x.padrao = false; });
      Object.assign(t, { nome, prazoDias, padrao });
      if(regras){ DB.regras = DB.regras || {}; DB.regras[t.id] = regras; }
      guardarDB();
    } else {
      await API.guardarTurma({ id:t.id, nome, prazoDias, padrao });
      if(regras) await API.guardarRegrasDaTurma(t.id, regras);
      await API.recarregarTurmas();
    }
    mostrarToast("Turma guardada");
    irPara("admin-turmas");
  } catch(e){
    mostrarToast(e.message || "Não foi possível guardar a turma.");
    botao.disabled = false;
  }
}

function apagarTurma(t){
  const n = numerosDaTurma(t).membros;
  if(n){
    mostrarToast(`Esta turma tem ${n === 1 ? "1 membro" : n + " membros"} com a matrícula ativa. Passe-os para outra turma antes de a apagar.`);
    return;
  }
  confirmarAcao({
    titulo: "Excluir turma",
    mensagem: `«${textoSeguro(t.nome)}» deixa de existir. Não tem ninguém com a matrícula ativa; as matrículas antigas dela ficam no histórico.`,
    textoConfirmar: "Excluir",
    aoConfirmar: async () => {
      try {
        if(modoDemonstracao()){ DB.turmas = DB.turmas.filter(x => x.id !== t.id); if(DB.regras) delete DB.regras[t.id]; guardarDB(); }
        else { await API.apagarTurma(t.id); await API.recarregarTurmas(); }
        mostrarToast("Turma excluída");
        irPara("admin-turmas");
      } catch(e){ mostrarToast(e.message || "Não foi possível excluir a turma."); }
    }
  });
}

/* ============================================================
   Regras de liberação (na edição da turma)

   Por módulo e por aula, quando o conteúdo abre para quem está nesta turma.
   Sem regra, o acesso é livre. A regra de uma aula vale mais do que a do
   módulo dela: é assim que uma aula de boas-vindas fica livre num módulo
   que só abre daqui a um mês. Quem aplica as regras é a base (o aluno não
   chega a receber o que está oculto ou bloqueado); aqui só se escrevem.
   ============================================================ */
const REGRAS_DE_LIBERACAO = [
  { valor:"livre",     rotulo:"Acesso livre" },
  { valor:"data",      rotulo:"Data programada" },
  { valor:"dias",      rotulo:"Dias após a matrícula" },
  { valor:"oculto",    rotulo:"Oculto" },
  { valor:"bloqueado", rotulo:"Bloqueado" },
  { valor:"curso",     rotulo:"Curso concluído" },
  { valor:"modulo",    rotulo:"Módulo concluído" },
  { valor:"aula",      rotulo:"Aula concluída" }
];

/* O que se está a editar: uma cópia de trabalho, que só vai para a base (ou
   para a memória, na demonstração) ao Salvar. */
let regrasEmEdicao = null;

function abrirRegrasDaTurma(t, c){
  regrasEmEdicao = { turma:t.id, curso:c.id, lista:null };
  const chegaram = lista => {
    if(!regrasEmEdicao || regrasEmEdicao.turma !== t.id) return;
    const modulos = new Set(c.modulos.map(m => m.id));
    const aulas = new Set(c.modulos.flatMap(m => m.aulas.map(a => a.id)));
    /* Uma regra de um módulo ou de uma aula que já não existe não se mostra. */
    regrasEmEdicao.lista = lista.filter(r => (r.alvoTipo === "modulo" ? modulos : aulas).has(r.alvoId)).map(r => Object.assign({}, r));
    pintarRegrasDaTurma();
  };
  if(modoDemonstracao()){ chegaram(((DB.regras || {})[t.id]) || []); return; }
  API.regrasDaTurma(t.id).then(chegaram).catch(() => {
    const zona = document.getElementById("turma-regras-zona");
    if(zona && regrasEmEdicao && regrasEmEdicao.turma === t.id)
      zona.innerHTML = `<div class="card painel turma-regras"><div class="empty-note">Não foi possível ler as regras de liberação. Recarregue a página para as editar; o resto da turma pode guardar-se.</div></div>`;
  });
}

function regraEmEdicaoDe(tipo, id){
  return ((regrasEmEdicao && regrasEmEdicao.lista) || []).find(r => r.alvoTipo === tipo && r.alvoId === id);
}

/* Os campos que cada regra pede, ao lado do select. */
function camposDaRegraHTML(r, tipo, id){
  const c = cursoPorId(regrasEmEdicao.curso);
  const atributo = v => textoSeguro(v === null || v === undefined ? "" : v).replace(/"/g, "&quot;");
  const moduloDaAula = tipo === "aula" ? c.modulos.find(m => m.aulas.some(a => a.id === id)) : null;
  if(!r) return "";
  if(r.regra === "data") return `
    <label class="regra-campo"><span>Abre em</span><input type="date" data-campo="abreEm" value="${atributo(r.abreEm)}"></label>
    <label class="regra-campo"><span>Fecha em (opcional)</span><input type="date" data-campo="fechaEm" value="${atributo(r.fechaEm)}"></label>`;
  if(r.regra === "dias") return `
    <label class="regra-campo"><span>A contar da matrícula</span><span class="campo-com-sufixo"><input type="number" min="0" max="36500" inputmode="numeric" data-campo="dias" value="${atributo(r.dias)}" placeholder="0"><span>dias</span></span></label>`;
  if(r.regra === "curso") return `
    <label class="regra-campo largo"><span>Curso que tem de estar concluído</span><select data-campo="cursoConcluido">
      <option value="">Escolha o curso</option>
      ${DB.cursos.filter(x => x.id !== c.id).map(x => `<option value="${x.id}" ${x.id === r.cursoConcluido ? "selected" : ""}>${textoSeguro(x.titulo)}</option>`).join("")}
    </select></label>`;
  if(r.regra === "modulo") return `
    <label class="regra-campo largo"><span>Módulo que tem de estar concluído</span><select data-campo="moduloConcluido">
      <option value="">Escolha o módulo</option>
      ${c.modulos.filter(m => m.id !== id && m !== moduloDaAula).map(m => `<option value="${m.id}" ${m.id === r.moduloConcluido ? "selected" : ""}>${textoSeguro(m.titulo)}</option>`).join("")}
    </select></label>`;
  if(r.regra === "aula") return `
    <label class="regra-campo largo"><span>Aula que tem de estar concluída</span><select data-campo="aulaConcluida">
      <option value="">Escolha a aula</option>
      ${c.modulos.filter(m => m.id !== id).map(m => `<optgroup label="${atributo(m.titulo)}">${m.aulas.filter(a => a.id !== id).map(a =>
        `<option value="${a.id}" ${a.id === r.aulaConcluida ? "selected" : ""}>${textoSeguro(a.titulo)}</option>`).join("")}</optgroup>`).join("")}
    </select></label>`;
  return "";
}

function linhaDaRegraHTML(tipo, id, numero, titulo, sub){
  const r = regraEmEdicaoDe(tipo, id);
  const valor = r ? r.regra : "livre";
  const nome = (tipo === "modulo" ? "Regra do módulo " : "Regra da aula ") + titulo;
  return `<div class="regra-linha" data-regra-tipo="${tipo}" data-regra-alvo="${id}">
    <div class="regra-alvo">
      ${numero ? `<span class="regra-num">${numero}</span>` : ""}
      <span class="regra-nome"><strong>${textoSeguro(titulo)}</strong>${sub ? `<small>${textoSeguro(sub)}</small>` : ""}</span>
    </div>
    <div class="regra-campos">
      <label class="regra-campo"><span>Regra</span><select data-campo="regra" aria-label="${textoSeguro(nome).replace(/"/g, "&quot;")}">
        ${REGRAS_DE_LIBERACAO.map(o => `<option value="${o.valor}" ${o.valor === valor ? "selected" : ""}>${o.rotulo}</option>`).join("")}
      </select></label>
      ${camposDaRegraHTML(r, tipo, id)}
    </div>
    ${tipo === "aula" ? `<button class="btn-icone perigo" type="button" data-tirar-regra="${id}" aria-label="Tirar a regra desta aula" title="Tirar a regra desta aula"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ""}
  </div>`;
}

function pintarRegrasDaTurma(){
  const zona = document.getElementById("turma-regras-zona");
  if(!zona || !regrasEmEdicao || !regrasEmEdicao.lista) return;
  const c = cursoPorId(regrasEmEdicao.curso);
  const comRegra = regrasEmEdicao.lista.filter(r => r.alvoTipo === "aula");
  const semRegra = c.modulos.map(m => ({ m, aulas:m.aulas.filter(a => !regraEmEdicaoDe("aula", a.id)) })).filter(x => x.aulas.length);
  const posicao = id => { let n = 0; for(const m of c.modulos) for(const a of m.aulas){ if(a.id === id) return n; n++; } return n; };
  const linhasDeAulas = comRegra.slice().sort((x, y) => posicao(x.alvoId) - posicao(y.alvoId)).map(r => {
    const m = c.modulos.find(k => k.aulas.some(a => a.id === r.alvoId));
    const a = m.aulas.find(k => k.id === r.alvoId);
    return linhaDaRegraHTML("aula", a.id, "", a.titulo, m.titulo);
  }).join("");

  zona.innerHTML = `
    <div class="card painel turma-regras" id="regras-modulos">
      <h3>Regras de liberação de módulos</h3>
      <p class="hint">Quando cada módulo abre para quem está nesta turma. «Oculto» não aparece ao aluno; «Bloqueado» aparece com cadeado e não se abre. Os dias contam do início da matrícula.</p>
      ${c.modulos.length
        ? `<div class="regras-lista">${c.modulos.map((m, i) => linhaDaRegraHTML("modulo", m.id, String(i + 1).padStart(2, "0"), m.titulo,
            m.aulas.length === 1 ? "1 aula" : m.aulas.length + " aulas")).join("")}</div>`
        : `<div class="empty-note">Este curso ainda não tem módulos. Crie-os em Conteúdos e volte aqui para os programar.</div>`}
    </div>
    <div class="card painel turma-regras" id="regras-aulas">
      <h3>Regras de liberação de aulas</h3>
      <p class="hint">Programe aulas específicas quando as regras dos módulos não servirem. Uma aula com regra própria não segue a do módulo dela.</p>
      ${semRegra.length ? `<div class="regra-adicionar">
        <select id="regra-aula-nova" aria-label="Aula a programar">
          ${semRegra.map(x => `<optgroup label="${textoSeguro(x.m.titulo).replace(/"/g, "&quot;")}">${x.aulas.map(a => `<option value="${a.id}">${textoSeguro(a.titulo)}</option>`).join("")}</optgroup>`).join("")}
        </select>
        <button class="btn btn-secondary" type="button" id="regra-aula-adicionar">Adicionar</button>
      </div>` : (c.modulos.some(m => m.aulas.length) ? "" : `<div class="empty-note">Este curso ainda não tem aulas.</div>`)}
      ${linhasDeAulas ? `<div class="regras-lista">${linhasDeAulas}</div>` : ""}
    </div>`;

  /* Mudar um campo muda a cópia de trabalho; mudar a regra redesenha a linha,
     porque os campos ao lado são outros. */
  zona.querySelectorAll(".regra-linha").forEach(linha => {
    const tipo = linha.getAttribute("data-regra-tipo"), id = linha.getAttribute("data-regra-alvo");
    linha.querySelectorAll("[data-campo]").forEach(campo => {
      const nomeDoCampo = campo.getAttribute("data-campo");
      const mudar = () => {
        let r = regraEmEdicaoDe(tipo, id);
        if(nomeDoCampo === "regra"){
          if(campo.value === "livre" && tipo === "modulo") regrasEmEdicao.lista = regrasEmEdicao.lista.filter(x => x !== r);
          else if(r) r.regra = campo.value;
          else regrasEmEdicao.lista.push({ alvoTipo:tipo, alvoId:id, regra:campo.value });
          pintarRegrasDaTurma();
          const outro = document.querySelector(`.regra-linha[data-regra-tipo="${tipo}"][data-regra-alvo="${id}"] [data-campo="regra"]`);
          if(outro) outro.focus();
          return;
        }
        if(r) r[nomeDoCampo] = campo.value;
      };
      campo.addEventListener("change", mudar);
      if(campo.tagName === "INPUT") campo.addEventListener("input", mudar);
    });
  });
  zona.querySelectorAll("[data-tirar-regra]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-tirar-regra");
    regrasEmEdicao.lista = regrasEmEdicao.lista.filter(r => !(r.alvoTipo === "aula" && r.alvoId === id));
    pintarRegrasDaTurma();
  }));
  const adicionar = document.getElementById("regra-aula-adicionar");
  if(adicionar) adicionar.addEventListener("click", () => {
    const id = document.getElementById("regra-aula-nova").value;
    if(!id) return;
    regrasEmEdicao.lista.push({ alvoTipo:"aula", alvoId:id, regra:"livre" });
    pintarRegrasDaTurma();
    const novo = document.querySelector(`.regra-linha[data-regra-tipo="aula"][data-regra-alvo="${id}"] [data-campo="regra"]`);
    if(novo) novo.focus();
  });
}

/* As regras, conferidas e prontas a guardar. Devolve null se não chegaram a
   ler-se (não se mexe nelas) e false se alguma está por acabar (já avisou). */
function regrasParaGuardar(t){
  if(!regrasEmEdicao || regrasEmEdicao.turma !== t.id || !regrasEmEdicao.lista) return null;
  const c = cursoPorId(t.cursoId);
  const nomeDe = r => {
    if(r.alvoTipo === "modulo") return "do módulo «" + textoSeguro((c.modulos.find(m => m.id === r.alvoId) || {}).titulo) + "»";
    return "da aula «" + textoSeguro((c.modulos.flatMap(m => m.aulas).find(a => a.id === r.alvoId) || {}).titulo) + "»";
  };
  const falha = (r, msg) => {
    mostrarToast(`Regra ${nomeDe(r)}: ${msg}`);
    const campo = document.querySelector(`.regra-linha[data-regra-tipo="${r.alvoTipo}"][data-regra-alvo="${r.alvoId}"] [data-campo]:not([data-campo="regra"])`);
    if(campo) campo.focus();
    return false;
  };
  const limpas = [];
  for(const r of regrasEmEdicao.lista){
    const x = { alvoTipo:r.alvoTipo, alvoId:r.alvoId, regra:r.regra };
    if(r.regra === "data"){
      if(!r.abreEm) return falha(r, "falta a data em que abre.");
      if(r.fechaEm && r.fechaEm < r.abreEm) return falha(r, "a data de fecho é anterior à de abertura.");
      x.abreEm = r.abreEm; x.fechaEm = r.fechaEm || "";
    } else if(r.regra === "dias"){
      const dias = String(r.dias === undefined || r.dias === null ? "" : r.dias).trim() === "" ? NaN : Number(r.dias);
      if(!Number.isInteger(dias) || dias < 0 || dias > 36500) return falha(r, "os dias são um número inteiro, a partir de 0.");
      x.dias = dias;
    } else if(r.regra === "curso"){
      if(!r.cursoConcluido || !DB.cursos.some(k => k.id === r.cursoConcluido)) return falha(r, "escolha o curso que tem de estar concluído.");
      x.cursoConcluido = r.cursoConcluido;
    } else if(r.regra === "modulo"){
      if(!r.moduloConcluido || !c.modulos.some(m => m.id === r.moduloConcluido)) return falha(r, "escolha o módulo que tem de estar concluído.");
      x.moduloConcluido = r.moduloConcluido;
    } else if(r.regra === "aula"){
      if(!r.aulaConcluida || !c.modulos.some(m => m.aulas.some(a => a.id === r.aulaConcluida))) return falha(r, "escolha a aula que tem de estar concluída.");
      x.aulaConcluida = r.aulaConcluida;
    }
    limpas.push(x);
  }
  return limpas;
}

/* ============================================================
   Certificados
   ============================================================ */
function renderAdminCertificados(){
  const aba = estado.abaCertificados || "modelo";
  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Certificados",
      descricao: "O diploma que o aluno descarrega, e a partir de que percentagem é emitido.",
      acaoRotulo: aba==="modelo" ? "Editar modelo" : null,
      acaoId: "btn-editar-modelo"
    })}
    <div class="filter-bar">
      <div class="segmented" id="cert-segmented">
        <button data-aba="modelo" class="${aba==="modelo"?"active":""}">Modelo</button>
        <button data-aba="emitidos" class="${aba==="emitidos"?"active":""}">Emitidos</button>
      </div>
    </div>
    ${aba==="modelo" ? modeloCertificadoHTML() : emitidosCertificadoHTML()}
  `;

  document.querySelectorAll("#cert-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaCertificados = b.getAttribute("data-aba");
    renderAdminCertificados();
  }));
  const btnModelo = document.getElementById("btn-editar-modelo");
  if(btnModelo) btnModelo.addEventListener("click", editarModeloCertificado);
  document.querySelectorAll("#content-admin [data-curso-cert]").forEach(t =>
    t.addEventListener("click", () => {
      const curso = cursoPorId(t.getAttribute("data-curso-cert"));
      curso.certificado = curso.certificado === false;
      salvar("curso", curso);
      renderAdminCertificados();
      mostrarToast(curso.certificado ? "Curso passa a emitir certificado" : "Curso deixa de emitir certificado");
    }));
}

function modeloCertificadoHTML(){
  const c = DB.config.certificado;
  return `
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.cert}</div><div class="stat-label">Emitido a partir de</div><div class="stat-value">${c.regraPct}<span>%</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Cursos que emitem</div><div class="stat-value">${DB.cursos.filter(cursoEmiteCertificado).length}<span>/ ${DB.cursos.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.people}</div><div class="stat-label">Assinado por</div><div class="stat-value" style="font-size:16px;">${c.assinaturaNome||"—"}</div></div>
    </div>

    <div class="section-title"><h2>Pré-visualização</h2><span class="count" style="font-size:12.5px;color:var(--text-faint);">Exatamente como o aluno o vê</span></div>
    <div class="cert-previa-wrap">
      <div class="modal-cert cert-previa">
        ${certificadoHTML({ nome:"Nome do Aluno", curso:(DB.cursos[0]||{}).titulo||"Curso", data:"10 de setembro de 2026" })}
      </div>
    </div>

    <div class="card table-card">
      <div class="table-card-head"><h3>Que cursos emitem certificado</h3><span class="count">${DB.cursos.length} cursos</span></div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Curso</th><th>Categoria</th><th>Emite certificado</th></tr></thead>
          <tbody>
            ${DB.cursos.map(curso => {
              const cat = categoriaDe(curso.categoria);
              return `<tr>
                <td><div class="nome" style="font-weight:500;">${curso.titulo}</div></td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td><div class="toggle ${cursoEmiteCertificado(curso)?"on":""}" data-curso-cert="${curso.id}" style="cursor:pointer;"><div class="knob"></div></div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* Os certificados que a base gravou, do mais recente para o mais antigo. O
   nome e o curso são os do dia em que ficaram gravados. */
function emitidosCertificadoHTML(){
  const emitidos = DB.certificadosEmitidos || [];
  const membro = id => (DB.membros || []).find(m => m.id === id);
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Certificados emitidos</h3>
        <span class="count">${emitidos.length} ${emitidos.length === 1 ? "certificado" : "certificados"}</span>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Aluno</th><th>Curso</th><th>Emitido em</th><th>Código</th></tr></thead>
          <tbody>
            ${emitidos.length ? emitidos.map(c => {
              const m = membro(c.utilizadorId);
              const nome = c.nome || (m && m.nome) || "—";
              return `
              <tr>
                <td><div class="cell-user"><div class="avatar">${textoSeguro(iniciais(nome === "—" ? "?" : nome))}</div><div class="meta"><div class="nome">${textoSeguro(nome)}</div><div class="sub">${textoSeguro((m && m.email) || "")}</div></div></div></td>
                <td>${textoSeguro(c.cursoTitulo || "—")}</td>
                <td>${dataDoCertificado(c.emitidoEm)}</td>
                <td><code class="cert-codigo-celula">${textoSeguro(c.codigo)}</code></td>
              </tr>`;
            }).join("") : `<tr><td colspan="4"><div class="empty-note">Ainda nenhum aluno concluiu um curso. O certificado grava-se sozinho quando concluir ${regraCertificado()}% de um curso.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function editarModeloCertificado(){
  const c = DB.config.certificado;
  abrirDrawer({
    titulo: "Modelo do certificado",
    subtitulo: "Mude o texto e a regra de emissão. A pré-visualização atualiza logo.",
    campos: [
      { nome:"regraPct", rotulo:"Emitir a partir de (%)", tipo:"numero", obrigatorio:true, dica:"Percentagem do curso que o aluno tem de concluir." },
      { nome:"titulo", rotulo:"Título", tipo:"texto", obrigatorio:true },
      { nome:"frase", rotulo:"Frase de conclusão", tipo:"texto", placeholder:"concluiu com sucesso o curso" },
      { nome:"rodape", rotulo:"Rodapé", tipo:"texto", placeholder:"ex: na Escola de Liderança" },
      { nome:"assinaturaNome", rotulo:"Assinatura — nome", tipo:"texto", dica:"Deixe vazio para não mostrar assinatura." },
      { nome:"assinaturaCargo", rotulo:"Assinatura — cargo", tipo:"texto" }
    ],
    valores: c,
    aoGuardar: v => {
      v.regraPct = Math.min(100, Math.max(1, v.regraPct || 100));
      Object.assign(DB.config.certificado, v);
      salvarCertificado();
      renderAdminCertificados();
      mostrarToast("Modelo atualizado");
    }
  });
}

registarViews({
  "admin-turmas": renderAdminTurmas,
  "admin-turma": renderAdminTurma,
  "admin-certificados": renderAdminCertificados
});
