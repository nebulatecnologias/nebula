/* ============================================================
   Administração › Conteúdos
   Cursos, categorias, módulos e aulas — tudo o que o aluno vê
   em "Meus cursos" e no leitor de vídeo.

   Curso e aula têm página própria em vez de gaveta: são
   formulários longos, com capa, conteúdo e materiais.
   ============================================================ */

function cursoPublicado(c){ return c.publicado !== false; }
function siglaSugerida(titulo){
  return (titulo||"").split(/\s+/).filter(Boolean).map(p=>p[0]).join("").slice(0,3).toUpperCase();
}
function moduloPorIdNoCurso(curso, id){ return curso.modulos.find(m=>m.id===id); }

/* ---------------- Ecrã principal ---------------- */
function renderAdminConteudos(){
  const aba = estado.abaConteudos || "cursos";
  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Conteúdos",
      descricao: "Os cursos, categorias, módulos e aulas que aparecem na área do aluno.",
      acaoRotulo: aba==="cursos" ? "Novo curso" : "Nova categoria",
      acaoId: "btn-novo-conteudo"
    })}
    <div class="filter-bar">
      <div class="segmented" id="conteudos-segmented">
        <button data-aba="cursos" class="${aba==="cursos"?"active":""}">Cursos</button>
        <button data-aba="categorias" class="${aba==="categorias"?"active":""}">Categorias</button>
      </div>
      <div class="search-pill"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" id="conteudos-busca" placeholder="Procurar..." value="${estado.buscaConteudos||""}"></div>
    </div>
    ${aba==="cursos" ? `<div class="chip-row" id="chips-conteudos"></div>` : ""}
    <div id="conteudos-tabela"></div>
  `;

  document.querySelectorAll("#conteudos-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaConteudos = b.getAttribute("data-aba");
    renderAdminConteudos();
  }));
  document.getElementById("conteudos-busca").addEventListener("input", e => {
    estado.buscaConteudos = e.target.value;
    renderTabelaConteudos();
  });
  document.getElementById("btn-novo-conteudo").addEventListener("click", () => {
    if((estado.abaConteudos||"cursos")==="cursos") abrirFormCurso(null); else editarCategoria(null);
  });

  renderChipsConteudos();
  renderTabelaConteudos();
}

function renderTabelaConteudos(){
  const wrap = document.getElementById("conteudos-tabela");
  if(!wrap) return;
  wrap.innerHTML = (estado.abaConteudos||"cursos")==="categorias" ? tabelaCategoriasHTML() : grelhaCursosAdminHTML();
  ligarAcoesConteudos();
}

/* ---------------- Cursos em cartões ---------------- */
/* O painel mostra os cursos com o mesmo cartão que o aluno vê em
   "Meus cursos" — o que se cria aqui é o que aparece lá. */
function cursosFiltradosAdmin(){
  const busca = (estado.buscaConteudos||"").trim().toLowerCase();
  const cat = estado.filtroCategoriaConteudos || "todos";
  return DB.cursos.filter(c =>
    (cat==="todos" || c.categoria===cat) &&
    (!busca || c.titulo.toLowerCase().includes(busca) || (c.subtitulo||"").toLowerCase().includes(busca)));
}

function renderChipsConteudos(){
  const row = document.getElementById("chips-conteudos");
  if(!row) return;
  const atual = estado.filtroCategoriaConteudos || "todos";
  const chips = [{ id:"todos", nome:"Todos", cor:null, n:DB.cursos.length }];
  Object.entries(DB.categorias).forEach(([id,c]) => {
    const n = DB.cursos.filter(x=>x.categoria===id).length;
    if(n) chips.push({ id, nome:c.nome, cor:c.cor, n });
  });
  row.innerHTML = chips.map(ch =>
    `<div class="chip ${atual===ch.id?"active":""}" data-cat="${ch.id}">${ch.cor?`<span class="dot" style="--c:${ch.cor}"></span>`:""}${ch.nome} <span class="chip-n">${ch.n}</span></div>`).join("");
  row.querySelectorAll(".chip").forEach(el => el.addEventListener("click", () => {
    estado.filtroCategoriaConteudos = el.getAttribute("data-cat");
    renderChipsConteudos();
    renderTabelaConteudos();
  }));
}

function grelhaCursosAdminHTML(){
  const lista = cursosFiltradosAdmin();
  if(!lista.length){
    return `<div class="card painel"><div class="empty-note">${DB.cursos.length
      ? "Nenhum curso encontrado com estes filtros."
      : 'Ainda não há cursos. Cria o primeiro em "Novo curso".'}</div></div>`;
  }
  return `
    <div class="contagem-grelha">${lista.length} de ${DB.cursos.length} curso${DB.cursos.length===1?"":"s"}</div>
    <div class="course-grid">${lista.map(c => renderCourseCardHTML(c, { admin:true })).join("")}</div>
  `;
}

/* ---------------- Tabela de categorias ---------------- */
function tabelaCategoriasHTML(){
  const busca = (estado.buscaConteudos||"").trim().toLowerCase();
  const entradas = Object.entries(DB.categorias).filter(([,c]) => !busca || c.nome.toLowerCase().includes(busca));
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Categorias</h3>
        <span class="count">${entradas.length} de ${Object.keys(DB.categorias).length} registos</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Categoria</th><th>Cor</th><th class="num">Cursos</th><th></th></tr></thead>
          <tbody>
            ${entradas.length ? entradas.map(([id,c]) => {
              const usados = DB.cursos.filter(x=>x.categoria===id).length;
              return `<tr>
                <td><span class="cat-tag" style="--c:${c.cor}">${c.nome}</span></td>
                <td><span class="amostra-cor" style="background:${c.cor}"></span><span class="sub-celula" style="display:inline;margin-left:8px;">${c.cor}</span></td>
                <td class="num">${usados}</td>
                <td>${acoesLinha(id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="4"><div class="empty-note">Nenhuma categoria encontrada.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function ligarAcoesConteudos(){
  const emCursos = (estado.abaConteudos||"cursos")==="cursos";
  /* O cartão inteiro abre a gestão do curso; os botões de canto não. */
  document.querySelectorAll("#conteudos-tabela .course-card").forEach(el =>
    el.addEventListener("click", e => {
      if(e.target.closest("[data-parar]")) return;
      irPara("admin-curso-editor", el.getAttribute("data-curso"));
    }));
  document.querySelectorAll("#conteudos-tabela [data-editar]").forEach(b =>
    b.addEventListener("click", () => emCursos ? abrirFormCurso(b.getAttribute("data-editar")) : editarCategoria(b.getAttribute("data-editar"))));
  document.querySelectorAll("#conteudos-tabela [data-apagar]").forEach(b =>
    b.addEventListener("click", () => emCursos ? apagarCurso(b.getAttribute("data-apagar")) : apagarCategoria(b.getAttribute("data-apagar"))));
}

/* ============================================================
   Página do curso: Novo curso / Editar curso
   ============================================================ */
function abrirFormCurso(id){
  estado.cursoNoForm = id || null;
  irPara("admin-curso-form");
}

function renderFormCurso(){
  const curso = estado.cursoNoForm ? cursoPorId(estado.cursoNoForm) : null;
  const v = curso || { vitrine:true, moderacao:false, publicado:true, certificado:true };

  document.getElementById("content-admin").innerHTML = `
    <div class="form-page">
      <div class="form-topo">
        <h1>${curso ? "Editar Curso" : "Novo Curso"}</h1>
      </div>

      <div class="form-secao">
        <div class="form-secao-desc">
          <h3>Detalhes do Curso</h3>
          <p>Escolhe um nome atrativo, insere a URL da página de vendas e descreve de forma clara e impactante a promessa única do curso.</p>
        </div>
        <div class="card form-card">
          <div class="campo-linha nome-sigla">
            <div class="field">
              <label>Nome do curso</label>
              <input type="text" id="f-titulo" value="${(v.titulo||"").replace(/"/g,"&quot;")}" placeholder="Escolhe um nome que atraia os teus compradores">
            </div>
            <div class="field">
              <label>Sigla</label>
              <input type="text" id="f-sigla" maxlength="4" value="${v.sigla||""}" placeholder="PRO">
            </div>
          </div>
          <div class="field">
            <label>URL da página de vendas</label>
            <input type="url" id="f-urlVendas" value="${v.urlVendas||""}" placeholder="https://meusite.co.mz/pagina-de-vendas">
          </div>
          <div class="field">
            <label>Descreve a promessa do teu curso</label>
            <textarea id="f-subtitulo" rows="3" placeholder="Explica o produto e os benefícios de forma clara e breve.">${v.subtitulo||""}</textarea>
          </div>
          <div class="field">
            <label>Categoria na vitrine</label>
            <div class="select-wrap" style="display:block;">
              <select id="f-categoria" style="width:100%;">
                ${opcoesCategorias().map(o=>`<option value="${o.valor}" ${o.valor===v.categoria?"selected":""}>${o.rotulo}</option>`).join("")}
              </select>
            </div>
          </div>
          ${checkCardHTML("f-vitrine", v.vitrine!==false, "Mostrar curso na vitrine de todos os alunos", "Incentiva a compra do teu conteúdo para alunos ainda não matriculados.")}
          ${checkCardHTML("f-moderacao", !!v.moderacao, "Ativar moderação de comentários", "Revê manualmente todos os comentários antes da publicação.")}
        </div>
      </div>

      <div class="form-secao">
        <div class="form-secao-desc">
          <h3>Imagem de capa</h3>
          <p>Insere a imagem de capa conforme a dimensão de exibição na vitrine. Para ecrãs retina, usa imagens com o dobro da resolução para garantir nitidez.</p>
        </div>
        <div class="card form-card">
          ${uploadHTML("capa", v.capa, "1280 × 720 px (16:9). É o formato do cartão em Meus cursos — a imagem aparece inteira, sem cortes.", "grande")}
        </div>
      </div>

      <div class="form-secao">
        <div class="form-secao-desc">
          <h3>Publicação</h3>
          <p>Um curso em rascunho fica invisível para os alunos, mesmo para quem o tem no plano.</p>
        </div>
        <div class="card form-card">
          <div class="toggle-row">
            <div><div class="t-title">Curso publicado</div><div class="t-sub">Desligado, desaparece do catálogo, do progresso e das conquistas.</div></div>
            <div class="toggle ${v.publicado!==false?"on":""}" id="f-publicado"><div class="knob"></div></div>
          </div>
          <div class="toggle-row">
            <div><div class="t-title">Emite certificado</div><div class="t-sub">A percentagem de conclusão exigida define-se em Certificados.</div></div>
            <div class="toggle ${v.certificado!==false?"on":""}" id="f-certificado"><div class="knob"></div></div>
          </div>
        </div>
      </div>

      <div class="form-rodape">
        ${curso ? `<button class="btn btn-perigo-suave" id="btn-apagar-curso-form">Apagar curso</button>` : ""}
        <div class="form-rodape-acoes">
          <button class="btn btn-texto" id="btn-cancelar-curso">Cancelar</button>
          <button class="btn btn-primary" id="btn-guardar-curso">${curso ? "Guardar" : "Criar curso"}</button>
        </div>
      </div>
    </div>
  `;

  ligarCheckCards();
  ligarUploads();
  document.querySelectorAll("#content-admin .toggle").forEach(t => t.addEventListener("click", () => t.classList.toggle("on")));

  /* A sigla escreve-se sozinha enquanto ninguém lhe tocar. */
  const campoSigla = document.getElementById("f-sigla");
  document.getElementById("f-titulo").addEventListener("input", e => {
    if(!campoSigla.dataset.tocado) campoSigla.value = siglaSugerida(e.target.value);
  });
  campoSigla.addEventListener("input", () => { campoSigla.dataset.tocado = "1"; });

  document.getElementById("btn-cancelar-curso").addEventListener("click", voltarDoFormCurso);
  document.getElementById("btn-guardar-curso").addEventListener("click", guardarFormCurso);
  const btnApagar = document.getElementById("btn-apagar-curso-form");
  if(btnApagar) btnApagar.addEventListener("click", () => apagarCurso(curso.id));
}

function voltarDoFormCurso(){
  if(estado.cursoNoForm && estado.cursoEditando === estado.cursoNoForm) irPara("admin-curso-editor", estado.cursoNoForm);
  else irPara("admin-conteudos");
}

function guardarFormCurso(){
  const titulo = document.getElementById("f-titulo").value.trim();
  if(!titulo){ mostrarToast("Dá um nome ao curso."); return; }

  const dados = {
    titulo,
    sigla: document.getElementById("f-sigla").value.trim().toUpperCase() || siglaSugerida(titulo),
    urlVendas: document.getElementById("f-urlVendas").value.trim(),
    subtitulo: document.getElementById("f-subtitulo").value.trim(),
    categoria: document.getElementById("f-categoria").value,
    capa: document.getElementById("valor-capa").value,
    vitrine: document.getElementById("f-vitrine").classList.contains("marcado"),
    moderacao: document.getElementById("f-moderacao").classList.contains("marcado"),
    publicado: document.getElementById("f-publicado").classList.contains("on"),
    certificado: document.getElementById("f-certificado").classList.contains("on")
  };

  const curso = estado.cursoNoForm ? cursoPorId(estado.cursoNoForm) : null;
  if(curso){
    Object.assign(curso, dados);
    salvar("curso", curso);
    mostrarToast("Curso atualizado");
    irPara("admin-curso-editor", curso.id);
  } else {
    const novo = Object.assign({ id:novoId("curso"), modulos:[], ordem:DB.cursos.length + 1 }, dados);
    DB.cursos.push(novo);
    salvar("curso", novo);
    mostrarToast("Curso criado. Agora cria o primeiro módulo.");
    irPara("admin-curso-editor", novo.id);
  }
}

function apagarCurso(id){
  const curso = cursoPorId(id);
  confirmarAcao({
    titulo: "Apagar curso",
    mensagem: `"${curso.titulo}" e os seus ${curso.modulos.length} módulos deixam de estar disponíveis para os alunos. Esta ação não pode ser desfeita.`,
    aoConfirmar: () => {
      DB.cursos = DB.cursos.filter(c=>c.id!==id);
      remover("curso", id);
      irPara("admin-conteudos");
      mostrarToast("Curso apagado");
    }
  });
}

/* ---------------- Categoria ---------------- */
function editarCategoria(id){
  const cat = id ? DB.categorias[id] : null;
  abrirDrawer({
    titulo: cat ? "Editar categoria" : "Nova categoria",
    subtitulo: "As categorias filtram os cursos na área do aluno.",
    campos: [
      { nome:"nome", rotulo:"Nome", tipo:"texto", obrigatorio:true, placeholder:"ex: Inteligência Artificial" },
      { nome:"cor", rotulo:"Cor", tipo:"cor", padrao:"#ff5a1f", dica:"Usada nas etiquetas e nos filtros." }
    ],
    valores: cat ? { nome:cat.nome, cor:cat.cor } : {},
    aoGuardar: v => {
      const idCat = id || novoId("cat");
      if(cat) Object.assign(cat, v);
      else DB.categorias[idCat] = { nome:v.nome, cor:v.cor };
      salvar("categoria", { id:idCat, nome:v.nome, cor:v.cor, ordem:Object.keys(DB.categorias).length });
      renderAdminConteudos();
      mostrarToast(cat ? "Categoria atualizada" : "Categoria criada");
    }
  });
}

function apagarCategoria(id){
  const usados = DB.cursos.filter(c=>c.categoria===id).length;
  if(usados){
    mostrarToast(`Move primeiro os ${usados} curso(s) desta categoria`);
    return;
  }
  confirmarAcao({
    titulo: "Apagar categoria",
    mensagem: `A categoria "${DB.categorias[id].nome}" deixa de aparecer nos filtros do aluno.`,
    aoConfirmar: () => {
      delete DB.categorias[id];
      remover("categoria", id);
      renderAdminConteudos();
      mostrarToast("Categoria apagada");
    }
  });
}

/* ============================================================
   Gestão de conteúdo: o curso, os seus módulos e as suas aulas
   ============================================================ */
function renderAdminCursoEditor(cursoId){
  if(cursoId) estado.cursoEditando = cursoId;
  const curso = cursoPorId(estado.cursoEditando);
  if(!curso){ irPara("admin-conteudos"); return; }
  const cat = categoriaDe(curso.categoria);
  const p = progressoCurso(curso);
  const total = contarAulas(curso);

  document.getElementById("content-admin").innerHTML = `
    <div class="back-link" id="btn-voltar-conteudos"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Conteúdos</div>
    <div class="gestao-head">
      <div>
        <h2>Gestão de conteúdo</h2>
        <p>Edita os detalhes, cria módulos e organiza as aulas deste curso.</p>
      </div>
      <div class="gestao-acoes">
        <button class="btn btn-secondary" id="btn-editar-curso">${ICONS.lapis} Editar curso</button>
        <button class="btn btn-secondary" id="btn-novo-modulo">+ Novo módulo</button>
        <button class="btn btn-primary" id="btn-novo-conteudo-curso">+ Novo conteúdo</button>
      </div>
    </div>

    <div class="gestao-grid">
      <div class="curso-resumo">
        <div class="curso-resumo-capa" style="${curso.capa?`background-image:url(${curso.capa})`:""}">
          ${curso.capa ? "" : `<span class="sigla-grande">${curso.sigla||siglaSugerida(curso.titulo)}</span>`}
          ${cursoPublicado(curso) ? "" : '<span class="cover-badge">RASCUNHO</span>'}
        </div>
        <h3>${curso.titulo}</h3>
        <p class="curso-resumo-sub">${curso.subtitulo||"Sem descrição"}</p>
        <p class="curso-resumo-meta">${total} conteúdo${total===1?"":"s"} <span class="cat-ligacao" style="color:${cat.cor}">${cat.nome}</span></p>
        <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div>
        <span class="curso-resumo-pct">${p.pct}%</span>
        <button class="btn btn-contorno btn-block" id="btn-comecar-agora">${total ? "ver como aluno" : "criar primeira aula"}</button>
        ${curso.urlVendas ? `<a class="ligacao-vendas" href="${linkExterno(curso.urlVendas)}" target="_blank" rel="noopener">Página de vendas ↗</a>` : ""}
      </div>

      <div id="lista-modulos-admin"></div>
    </div>
  `;

  document.getElementById("btn-voltar-conteudos").addEventListener("click", () => irPara("admin-conteudos"));
  document.getElementById("btn-editar-curso").addEventListener("click", () => abrirFormCurso(curso.id));
  document.getElementById("btn-novo-modulo").addEventListener("click", () => editarModulo(curso, null));
  document.getElementById("btn-novo-conteudo-curso").addEventListener("click", () => novoConteudo(curso));
  document.getElementById("btn-comecar-agora").addEventListener("click", () => {
    if(!total){ novoConteudo(curso); return; }
    const loc = primeiraAulaDoCurso(curso);
    estado.prevendoComoAluno = true;
    irPara("aula", curso.id, loc.aula.id);
  });

  renderModulosAdmin(curso);
}

/* Sem módulos não há onde pôr a aula: cria-se o primeiro pelo caminho. */
function novoConteudo(curso){
  if(!curso.modulos.length){
    const primeiro = { id:novoId("mod"), titulo:"Módulo 1", descricao:"", aulas:[], ordem:1 };
    curso.modulos.push(primeiro);
    salvar("modulo", Object.assign({}, primeiro, { cursoId:curso.id }));
  }
  abrirFormAula(curso.id, curso.modulos[0].id, null);
}

function renderModulosAdmin(curso){
  const wrap = document.getElementById("lista-modulos-admin");
  if(!wrap) return;
  if(!curso.modulos.length){
    wrap.innerHTML = `<div class="card painel"><div class="empty-note">Este curso ainda não tem módulos. Começa por criar o primeiro.</div></div>`;
    return;
  }
  const abertos = estado.modulosAbertos || (estado.modulosAbertos = {});

  wrap.innerHTML = curso.modulos.map((m, i) => {
    const aberto = abertos[m.id] !== false;
    return `
    <div class="card modulo-acordeao ${aberto?"aberto":""}">
      <div class="modulo-acordeao-head" data-abrir-modulo="${m.id}">
        <svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        <div class="modulo-acordeao-titulo">
          <h3>${m.titulo}</h3>
          ${m.descricao ? `<p>${m.descricao}</p>` : ""}
        </div>
        <span class="modulo-count">${m.aulas.length} aula${m.aulas.length===1?"":"s"}</span>
        <button class="btn-icone" data-menu-modulo="${m.id}" title="Opções">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
      </div>
      <div class="modulo-acordeao-corpo">
        ${m.aulas.length ? m.aulas.map((a, j) => `
          <div class="aula-linha" data-editar-aula="${a.id}" data-modulo="${m.id}">
            <span class="aula-linha-capa" style="${a.capa?`background-image:url(${a.capa})`:""}">${a.capa?"":`${i+1}.${j+1}`}</span>
            <div class="aula-linha-info">
              <span class="titulo">${a.titulo}</span>
              <span class="sub-celula">${etiquetasDaAula(a)}</span>
            </div>
            <span class="aula-duracao">${a.duracao||"--:--"}</span>
            <div class="acoes-linha" data-parar>
              <button class="btn-icone" data-mover-aula="${a.id}" data-modulo="${m.id}" data-dir="-1" ${j===0?"disabled":""} title="Subir"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg></button>
              <button class="btn-icone" data-mover-aula="${a.id}" data-modulo="${m.id}" data-dir="1" ${j===m.aulas.length-1?"disabled":""} title="Descer"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>
              <button class="btn-icone perigo" data-apagar-aula="${a.id}" data-modulo="${m.id}" title="Apagar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
            </div>
          </div>
        `).join("") : `<div class="empty-note">Nenhuma aula publicada ainda.</div>`}
        <button class="btn-nova-aula" data-nova-aula="${m.id}">+ Nova aula neste módulo</button>
      </div>
    </div>`;
  }).join("");

  const mod = id => moduloPorIdNoCurso(curso, id);

  wrap.querySelectorAll("[data-abrir-modulo]").forEach(h => h.addEventListener("click", e => {
    if(e.target.closest("[data-menu-modulo]")) return;
    const id = h.getAttribute("data-abrir-modulo");
    abertos[id] = abertos[id] === false;
    renderModulosAdmin(curso);
  }));

  wrap.querySelectorAll("[data-menu-modulo]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const m = mod(b.getAttribute("data-menu-modulo"));
    const i = curso.modulos.indexOf(m);
    abrirMenu(b, [
      { rotulo:"Editar módulo", accao:() => editarModulo(curso, m) },
      { rotulo:"Nova aula", accao:() => abrirFormAula(curso.id, m.id, null) },
      { rotulo:"Mover para cima", desativado:i===0, accao:() => { mover(curso.modulos, i, -1); salvarOrdem("modulo", curso.modulos, { cursoId:curso.id }); renderModulosAdmin(curso); } },
      { rotulo:"Mover para baixo", desativado:i===curso.modulos.length-1, accao:() => { mover(curso.modulos, i, 1); salvarOrdem("modulo", curso.modulos, { cursoId:curso.id }); renderModulosAdmin(curso); } },
      { rotulo:"Apagar módulo", perigo:true, accao:() => apagarModulo(curso, m) }
    ]);
  }));

  wrap.querySelectorAll("[data-nova-aula]").forEach(b => b.addEventListener("click", () => abrirFormAula(curso.id, b.getAttribute("data-nova-aula"), null)));
  wrap.querySelectorAll(".aula-linha").forEach(l => l.addEventListener("click", e => {
    if(e.target.closest("[data-parar]")) return;
    abrirFormAula(curso.id, l.getAttribute("data-modulo"), l.getAttribute("data-editar-aula"));
  }));
  wrap.querySelectorAll("[data-apagar-aula]").forEach(b => b.addEventListener("click", () => {
    const m = mod(b.getAttribute("data-modulo"));
    apagarAula(curso, m, m.aulas.find(a=>a.id===b.getAttribute("data-apagar-aula")));
  }));
  wrap.querySelectorAll("[data-mover-aula]").forEach(b => b.addEventListener("click", () => {
    const m = mod(b.getAttribute("data-modulo"));
    mover(m.aulas, m.aulas.findIndex(a=>a.id===b.getAttribute("data-mover-aula")), Number(b.getAttribute("data-dir")));
    salvarOrdem("aula", m.aulas, { moduloId:m.id });
    renderModulosAdmin(curso);
  }));
}

function etiquetasDaAula(a){
  const partes = [];
  partes.push(temVideo(a) ? "Vídeo" : "Sem vídeo");
  if((a.conteudo||"").trim()) partes.push("Texto");
  if((a.ficheiros||[]).length) partes.push(`${a.ficheiros.length} ficheiro${a.ficheiros.length===1?"":"s"}`);
  if((a.quiz||[]).length) partes.push(`Quiz de ${a.quiz.length}`);
  if(a.semComentarios) partes.push("Comentários desligados");
  return partes.join(" · ");
}

/* ---------------- Módulo ---------------- */
function editarModulo(curso, modulo){
  abrirDrawer({
    titulo: modulo ? "Editar módulo" : "Novo módulo",
    subtitulo: curso.titulo,
    campos: [
      { nome:"titulo", rotulo:"Título do módulo", tipo:"texto", obrigatorio:true, placeholder:"ex: Módulo 1: Fundamentos" },
      { nome:"descricao", rotulo:"Descrição", tipo:"textarea", placeholder:"O que o aluno vai aprender neste módulo." }
    ],
    valores: modulo ? { titulo:modulo.titulo, descricao:modulo.descricao } : { titulo:`Módulo ${curso.modulos.length+1}` },
    aoGuardar: v => {
      const alvo = modulo || { id:novoId("mod"), aulas:[], ordem:curso.modulos.length + 1 };
      Object.assign(alvo, v);
      if(!modulo) curso.modulos.push(alvo);
      salvar("modulo", Object.assign({}, alvo, { cursoId:curso.id }));
      renderAdminCursoEditor();
      mostrarToast(modulo ? "Módulo atualizado" : "Módulo criado");
    }
  });
}

function apagarModulo(curso, modulo){
  confirmarAcao({
    titulo: "Apagar módulo",
    mensagem: `"${modulo.titulo}" e as suas ${modulo.aulas.length} aulas serão removidos do curso.`,
    aoConfirmar: () => {
      curso.modulos = curso.modulos.filter(m=>m.id!==modulo.id);
      remover("modulo", modulo.id);
      renderAdminCursoEditor();
      mostrarToast("Módulo apagado");
    }
  });
}

function apagarAula(curso, modulo, aula){
  confirmarAcao({
    titulo: "Apagar aula",
    mensagem: `"${aula.titulo}" será removida do módulo. O progresso dos alunos nesta aula perde-se.`,
    aoConfirmar: () => {
      modulo.aulas = modulo.aulas.filter(a=>a.id!==aula.id);
      remover("aula", aula.id);
      renderAdminCursoEditor();
      mostrarToast("Aula apagada");
    }
  });
}

registarViews({
  "admin-conteudos": renderAdminConteudos,
  "admin-curso-form": renderFormCurso,
  "admin-curso-editor": renderAdminCursoEditor
});
