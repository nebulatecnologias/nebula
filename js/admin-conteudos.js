/* ============================================================
   Administração › Conteúdos
   Cursos, categorias, módulos e aulas — tudo o que o aluno vê
   em "Meus cursos" e no leitor de vídeo.
   ============================================================ */

function contarAulas(curso){ return curso.modulos.reduce((s,m)=>s+m.aulas.length, 0); }
function cursoPublicado(c){ return c.publicado !== false; }

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
    if((estado.abaConteudos||"cursos")==="cursos") editarCurso(null); else editarCategoria(null);
  });

  renderTabelaConteudos();
}

function renderTabelaConteudos(){
  const wrap = document.getElementById("conteudos-tabela");
  if(!wrap) return;
  wrap.innerHTML = (estado.abaConteudos||"cursos")==="categorias" ? tabelaCategoriasHTML() : tabelaCursosAdminHTML();
  ligarAcoesConteudos();
}

/* ---------------- Tabela de cursos ---------------- */
function tabelaCursosAdminHTML(){
  const busca = (estado.buscaConteudos||"").trim().toLowerCase();
  const lista = DB.cursos.filter(c => !busca || c.titulo.toLowerCase().includes(busca));
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Cursos</h3>
        <span class="count">${lista.length} de ${DB.cursos.length} registos</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Curso</th><th>Categoria</th><th>Módulos</th><th>Aulas</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(c => {
              const cat = categoriaDe(c.categoria);
              return `<tr>
                <td><button class="ligacao-tabela" data-abrir="${c.id}">${c.titulo}</button><div class="sub-celula">${c.subtitulo||""}</div></td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td class="num">${c.modulos.length}</td>
                <td class="num">${contarAulas(c)}</td>
                <td><span class="pill ${cursoPublicado(c)?"pill-publicado":"pill-inativo"}">${cursoPublicado(c)?"Publicado":"Rascunho"}</span></td>
                <td>${acoesLinha(c.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="6"><div class="empty-note">Ainda não há cursos. Cria o primeiro em "Novo curso".</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
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
          <thead><tr><th>Categoria</th><th>Cor</th><th>Cursos</th><th></th></tr></thead>
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
  document.querySelectorAll("#conteudos-tabela [data-abrir]").forEach(b =>
    b.addEventListener("click", () => irPara("admin-curso-editor", b.getAttribute("data-abrir"))));
  document.querySelectorAll("#conteudos-tabela [data-editar]").forEach(b =>
    b.addEventListener("click", () => emCursos ? editarCurso(b.getAttribute("data-editar")) : editarCategoria(b.getAttribute("data-editar"))));
  document.querySelectorAll("#conteudos-tabela [data-apagar]").forEach(b =>
    b.addEventListener("click", () => emCursos ? apagarCurso(b.getAttribute("data-apagar")) : apagarCategoria(b.getAttribute("data-apagar"))));
}

/* ---------------- Curso: criar / editar / apagar ---------------- */
function editarCurso(id){
  const curso = id ? cursoPorId(id) : null;
  abrirDrawer({
    titulo: curso ? "Editar curso" : "Novo curso",
    subtitulo: "Aparece em “Meus cursos” na área do aluno.",
    campos: [
      { nome:"titulo", rotulo:"Título do curso", tipo:"texto", obrigatorio:true, placeholder:"ex: Mentalidade Inquebrável" },
      { nome:"subtitulo", rotulo:"Descrição curta", tipo:"textarea", placeholder:"Uma frase que explique a promessa do curso." },
      { nome:"categoria", rotulo:"Categoria", tipo:"select", opcoes:opcoesCategorias() },
      { nome:"publicado", rotulo:"Publicado", tipo:"toggle", padrao:true, dica:"Se desligares, o curso deixa de aparecer para os alunos." }
    ],
    valores: curso ? { titulo:curso.titulo, subtitulo:curso.subtitulo, categoria:curso.categoria, publicado:cursoPublicado(curso) } : { publicado:true },
    aoGuardar: v => {
      if(curso){
        Object.assign(curso, v);
      } else {
        DB.cursos.push({ id:novoId("curso"), titulo:v.titulo, subtitulo:v.subtitulo, categoria:v.categoria, publicado:v.publicado, modulos:[] });
      }
      guardarDB();
      renderAdminConteudos();
      mostrarToast(curso ? "Curso atualizado" : "Curso criado");
    }
  });
}

function apagarCurso(id){
  const curso = cursoPorId(id);
  confirmarAcao({
    titulo: "Apagar curso",
    mensagem: `"${curso.titulo}" e os seus ${curso.modulos.length} módulos deixam de estar disponíveis para os alunos. Esta ação não pode ser desfeita.`,
    aoConfirmar: () => {
      DB.cursos = DB.cursos.filter(c=>c.id!==id);
      guardarDB();
      renderAdminConteudos();
      mostrarToast("Curso apagado");
    }
  });
}

/* ---------------- Categoria: criar / editar / apagar ---------------- */
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
      if(cat){ Object.assign(cat, v); }
      else { DB.categorias[novoId("cat")] = { nome:v.nome, cor:v.cor }; }
      guardarDB();
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
      guardarDB();
      renderAdminConteudos();
      mostrarToast("Categoria apagada");
    }
  });
}

/* ============================================================
   Editor de um curso: módulos e aulas
   ============================================================ */
function renderAdminCursoEditor(cursoId){
  if(cursoId) estado.cursoEditando = cursoId;
  const curso = cursoPorId(estado.cursoEditando);
  if(!curso){ irPara("admin-conteudos"); return; }
  const cat = categoriaDe(curso.categoria);

  document.getElementById("content-admin").innerHTML = `
    <div class="back-link" id="btn-voltar-conteudos"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Conteúdos</div>
    <div class="page-head-flex">
      <div class="page-head">
        <span class="eyebrow" style="--c:${cat.cor}">${cat.nome.toUpperCase()}</span>
        <h1>${curso.titulo}</h1>
        <p class="desc">${curso.subtitulo||""}</p>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-secondary" id="btn-editar-curso">Editar curso</button>
        <button class="btn btn-primary" id="btn-novo-modulo">+ Novo módulo</button>
      </div>
    </div>
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon">${ICONS.layers}</div><div class="stat-label">Módulos</div><div class="stat-value">${curso.modulos.length}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Aulas</div><div class="stat-value">${contarAulas(curso)}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chart}</div><div class="stat-label">Estado</div><div class="stat-value" style="font-size:20px;">${cursoPublicado(curso)?"Publicado":"Rascunho"}</div></div>
    </div>
    <div id="lista-modulos-admin"></div>
  `;

  document.getElementById("btn-voltar-conteudos").addEventListener("click", () => irPara("admin-conteudos"));
  document.getElementById("btn-editar-curso").addEventListener("click", () => editarCurso(curso.id));
  document.getElementById("btn-novo-modulo").addEventListener("click", () => editarModulo(curso, null));

  renderModulosAdmin(curso);
}

function renderModulosAdmin(curso){
  const wrap = document.getElementById("lista-modulos-admin");
  if(!curso.modulos.length){
    wrap.innerHTML = `<div class="card"><div class="empty-note">Este curso ainda não tem módulos. Começa por criar o primeiro.</div></div>`;
    return;
  }
  wrap.innerHTML = curso.modulos.map((m, i) => `
    <div class="card modulo-admin">
      <div class="modulo-admin-head">
        <div class="modulo-num">${String(i+1).padStart(2,"0")}</div>
        <div class="modulo-info">
          <h3>${m.titulo}</h3>
          <p class="modulo-desc">${m.descricao||"Sem descrição"}</p>
        </div>
        <span class="modulo-count">${m.aulas.length} aula${m.aulas.length===1?"":"s"}</span>
        <div class="acoes-linha">
          <button class="btn-icone" data-mover-modulo="${m.id}" data-dir="-1" ${i===0?"disabled":""} title="Subir"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg></button>
          <button class="btn-icone" data-mover-modulo="${m.id}" data-dir="1" ${i===curso.modulos.length-1?"disabled":""} title="Descer"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>
          <button class="btn-icone" data-editar-modulo="${m.id}" title="Editar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="btn-icone perigo" data-apagar-modulo="${m.id}" title="Apagar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>
      <div class="aulas-admin">
        ${m.aulas.map((a, j) => `
          <div class="aula-admin">
            <span class="aula-admin-num">${i+1}.${j+1}</span>
            <div class="aula-admin-info">
              <span class="titulo">${a.titulo}</span>
              <span class="sub-celula">${a.videoId ? "Vídeo: "+a.videoId : "Sem vídeo associado"}</span>
            </div>
            <span class="aula-duracao">${a.duracao||"--:--"}</span>
            <div class="acoes-linha">
              <button class="btn-icone" data-mover-aula="${a.id}" data-modulo="${m.id}" data-dir="-1" ${j===0?"disabled":""} title="Subir"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg></button>
              <button class="btn-icone" data-mover-aula="${a.id}" data-modulo="${m.id}" data-dir="1" ${j===m.aulas.length-1?"disabled":""} title="Descer"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>
              <button class="btn-icone" data-editar-aula="${a.id}" data-modulo="${m.id}" title="Editar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="btn-icone perigo" data-apagar-aula="${a.id}" data-modulo="${m.id}" title="Apagar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
            </div>
          </div>
        `).join("")}
        <button class="btn-nova-aula" data-nova-aula="${m.id}">+ Nova aula neste módulo</button>
      </div>
    </div>
  `).join("");

  const moduloPorId = id => curso.modulos.find(m=>m.id===id);

  wrap.querySelectorAll("[data-editar-modulo]").forEach(b => b.addEventListener("click", () => editarModulo(curso, moduloPorId(b.getAttribute("data-editar-modulo")))));
  wrap.querySelectorAll("[data-apagar-modulo]").forEach(b => b.addEventListener("click", () => apagarModulo(curso, moduloPorId(b.getAttribute("data-apagar-modulo")))));
  wrap.querySelectorAll("[data-nova-aula]").forEach(b => b.addEventListener("click", () => editarAula(curso, moduloPorId(b.getAttribute("data-nova-aula")), null)));
  wrap.querySelectorAll("[data-mover-modulo]").forEach(b => b.addEventListener("click", () => {
    mover(curso.modulos, curso.modulos.findIndex(m=>m.id===b.getAttribute("data-mover-modulo")), Number(b.getAttribute("data-dir")));
    guardarDB(); renderModulosAdmin(curso);
  }));
  wrap.querySelectorAll("[data-editar-aula]").forEach(b => {
    const m = moduloPorId(b.getAttribute("data-modulo"));
    b.addEventListener("click", () => editarAula(curso, m, m.aulas.find(a=>a.id===b.getAttribute("data-editar-aula"))));
  });
  wrap.querySelectorAll("[data-apagar-aula]").forEach(b => {
    const m = moduloPorId(b.getAttribute("data-modulo"));
    b.addEventListener("click", () => apagarAula(curso, m, m.aulas.find(a=>a.id===b.getAttribute("data-apagar-aula"))));
  });
  wrap.querySelectorAll("[data-mover-aula]").forEach(b => b.addEventListener("click", () => {
    const m = moduloPorId(b.getAttribute("data-modulo"));
    mover(m.aulas, m.aulas.findIndex(a=>a.id===b.getAttribute("data-mover-aula")), Number(b.getAttribute("data-dir")));
    guardarDB(); renderModulosAdmin(curso);
  }));
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
    valores: modulo ? { titulo:modulo.titulo, descricao:modulo.descricao } : {},
    aoGuardar: v => {
      if(modulo) Object.assign(modulo, v);
      else curso.modulos.push({ id:novoId("mod"), titulo:v.titulo, descricao:v.descricao, aulas:[] });
      guardarDB();
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
      guardarDB();
      renderAdminCursoEditor();
      mostrarToast("Módulo apagado");
    }
  });
}

/* ---------------- Aula ---------------- */
function editarAula(curso, modulo, aula){
  abrirDrawer({
    titulo: aula ? "Editar aula" : "Nova aula",
    subtitulo: `${curso.titulo} · ${modulo.titulo}`,
    campos: [
      { nome:"titulo", rotulo:"Título da aula", tipo:"texto", obrigatorio:true, placeholder:"ex: A identidade do fundador" },
      { nome:"duracao", rotulo:"Duração", tipo:"texto", placeholder:"12:34", dica:"Formato minutos:segundos." },
      { nome:"descricao", rotulo:"Descrição", tipo:"textarea", placeholder:"Texto que aparece por baixo do vídeo." },
      { nome:"videoId", rotulo:"ID do vídeo", tipo:"texto", placeholder:"ID no Panda Video", dica:"Deixa vazio enquanto o vídeo não estiver carregado." }
    ],
    valores: aula ? { titulo:aula.titulo, duracao:aula.duracao, descricao:aula.descricao, videoId:aula.videoId } : {},
    aoGuardar: v => {
      if(aula) Object.assign(aula, v);
      else modulo.aulas.push({ id:novoId("aula"), titulo:v.titulo, duracao:v.duracao||"00:00", descricao:v.descricao, videoId:v.videoId });
      guardarDB();
      renderAdminCursoEditor();
      mostrarToast(aula ? "Aula atualizada" : "Aula criada");
    }
  });
}

function apagarAula(curso, modulo, aula){
  confirmarAcao({
    titulo: "Apagar aula",
    mensagem: `"${aula.titulo}" será removida do módulo. O progresso dos alunos nesta aula perde-se.`,
    aoConfirmar: () => {
      modulo.aulas = modulo.aulas.filter(a=>a.id!==aula.id);
      guardarDB();
      renderAdminCursoEditor();
      mostrarToast("Aula apagada");
    }
  });
}

registarViews({
  "admin-conteudos": renderAdminConteudos,
  "admin-curso-editor": renderAdminCursoEditor
});
