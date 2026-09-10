/* ---------------- Administrador: Visão geral ---------------- */
function renderAdminVisaoGeral(){
  const totalInscritos = Object.values(DB.cursoStats).reduce((s,c)=>s+c.inscritos,0);
  const conclusaoMedia = Math.round(Object.values(DB.cursoStats).reduce((s,c)=>s+c.conclusao,0)/DB.cursos.length);
  document.getElementById("content-admin").innerHTML = `
    <div class="page-head-flex">
      <div class="page-head">
        <span class="eyebrow">PAINEL DE ADMINISTRAÇÃO</span>
        <h1>Visão geral</h1>
        <p class="desc">Todos os teus alunos, cursos e resultados num só lugar.</p>
      </div>
    </div>
    <div class="stat-row">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.people}</div><div class="stat-label">Alunos ativos</div><div class="stat-value">${totalInscritos}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Cursos publicados</div><div class="stat-value">${DB.cursos.length}<span>${Object.keys(DB.categorias).length} categorias</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.cert}</div><div class="stat-label">Certificados emitidos</div><div class="stat-value">156</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chart}</div><div class="stat-label">Conclusão média</div><div class="stat-value">${conclusaoMedia}<span>%</span></div></div>
    </div>
    <div class="filter-bar">
      <div class="segmented" id="admin-segmented">
        <button data-aba="alunos" class="${estado.abaAdmin==="alunos"?"active":""}">Alunos</button>
        <button data-aba="cursos" class="${estado.abaAdmin==="cursos"?"active":""}">Cursos</button>
      </div>
      <div class="search-pill"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" id="admin-busca" placeholder="Procurar por nome ou curso..." value="${estado.buscaAdmin}"></div>
      <div class="select-wrap"><select id="admin-filtro-categoria">
        <option value="todos">Todas as categorias</option>
        ${Object.entries(DB.categorias).map(([id,c])=>`<option value="${id}" ${estado.filtroCategoriaAdmin===id?"selected":""}>${c.nome}</option>`).join("")}
      </select></div>
    </div>
    <div id="admin-tabela-wrap"></div>
  `;
  document.querySelectorAll("#admin-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaAdmin = b.getAttribute("data-aba");
    document.querySelectorAll("#admin-segmented button").forEach(x=>x.classList.toggle("active", x===b));
    renderAdminTabela();
  }));
  document.getElementById("admin-busca").addEventListener("input", e => { estado.buscaAdmin = e.target.value; renderAdminTabela(); });
  document.getElementById("admin-filtro-categoria").addEventListener("change", e => { estado.filtroCategoriaAdmin = e.target.value; renderAdminTabela(); });
  renderAdminTabela();
}

function renderAdminTabela(){
  const wrap = document.getElementById("admin-tabela-wrap");
  if(!wrap) return;
  wrap.innerHTML = estado.abaAdmin==="cursos" ? tabelaAdminCursosHTML() : tabelaAdminAlunosHTML();
}

function tabelaAdminAlunosHTML(){
  const busca = estado.buscaAdmin.trim().toLowerCase();
  const lista = DB.membros.filter(a => {
    const passaCategoria = estado.filtroCategoriaAdmin==="todos" || a.categoria===estado.filtroCategoriaAdmin;
    const passaBusca = !busca || a.nome.toLowerCase().includes(busca) || a.curso.toLowerCase().includes(busca);
    return passaCategoria && passaBusca;
  });
  const PILL_ENG = { quente:"pill-quente", morno:"pill-morno", frio:"pill-frio" };
  const LABEL_ENG = { quente:"Quente", morno:"Morno", frio:"Frio" };
  const PILL_EST = { ativo:"pill-ativo", risco:"pill-risco", concluido:"pill-concluido", inativo:"pill-inativo" };
  const LABEL_EST = { ativo:"Ativo", risco:"Em risco", concluido:"Concluído", inativo:"Inativo" };
  const TINT_EST = { risco:"tint-risco", concluido:"tint-concluido" };
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Atividade dos alunos</h3>
        <span class="count">${lista.length} de ${DB.membros.length} registos</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Aluno</th><th>Curso</th><th>Categoria</th><th>Último acesso</th><th>Engajamento</th><th>Progresso</th><th>Estágio</th><th>Responsável</th>
          </tr></thead>
          <tbody>
            ${lista.length ? lista.map(a => {
              const cat = DB.categorias[a.categoria];
              return `<tr class="${TINT_EST[a.estagio]||""}">
                <td><div class="cell-user"><div class="avatar">${iniciais(a.nome)}</div><div class="meta"><div class="nome">${a.nome}</div><div class="sub">${a.email}</div></div></div></td>
                <td>${a.curso}</td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td>${a.ultimoAcesso}</td>
                <td><span class="pill ${PILL_ENG[a.engajamento]}">${LABEL_ENG[a.engajamento]}</span></td>
                <td><div class="mini-progress"><div class="progress-track thin"><div class="progress-fill mini" style="width:${a.progresso}%"></div></div><span>${a.progresso}%</span></div></td>
                <td><span class="pill ${PILL_EST[a.estagio]}">${LABEL_EST[a.estagio]}</span></td>
                <td>${a.responsavel}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="8"><div class="empty-note">Nenhum aluno encontrado com estes filtros.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tabelaAdminCursosHTML(){
  const busca = estado.buscaAdmin.trim().toLowerCase();
  const lista = DB.cursos.filter(c => {
    const passaCategoria = estado.filtroCategoriaAdmin==="todos" || c.categoria===estado.filtroCategoriaAdmin;
    const passaBusca = !busca || c.titulo.toLowerCase().includes(busca);
    return passaCategoria && passaBusca;
  });
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Cursos publicados</h3>
        <span class="count">${lista.length} de ${DB.cursos.length} registos</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Curso</th><th>Categoria</th><th>Módulos</th><th>Alunos inscritos</th><th>Conclusão média</th><th>Avaliação</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${lista.length ? lista.map(c => {
              const cat = DB.categorias[c.categoria];
              const st = DB.cursoStats[c.id];
              return `<tr>
                <td>${c.titulo}</td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td class="num">${c.modulos.length}</td>
                <td class="num">${st.inscritos}</td>
                <td><div class="mini-progress"><div class="progress-track thin"><div class="progress-fill mini" style="width:${st.conclusao}%"></div></div><span>${st.conclusao}%</span></div></td>
                <td class="num">★ ${st.avaliacao}</td>
                <td><span class="pill pill-publicado">Publicado</span></td>
              </tr>`;
            }).join("") : `<tr><td colspan="7"><div class="empty-note">Nenhum curso encontrado com estes filtros.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------------- Administrador: abas por construir ---------------- */
function renderAdminPlaceholder(view){
  let label = view, icon = ICONS.gear;
  for(const grupo of NAV_ADMIN){ const item = grupo.itens.find(i=>i.view===view); if(item){ label = item.label; icon = item.icon; break; } }
  document.getElementById("content-admin").innerHTML = `
    <div class="page-head"><span class="eyebrow">PAINEL DE ADMINISTRAÇÃO</span><h1>${label}</h1></div>
    <div class="card admin-placeholder">
      <div class="ph-icon">${icon}</div>
      <h2>Esta aba vai ser construída na próxima etapa</h2>
      <p>Vamos aplicar aqui o mesmo sistema de design da Visão Geral — cores, tabelas e componentes — quando avançarmos para "${label}".</p>
    </div>
  `;
}


registarViews({ "admin-visao": renderAdminVisaoGeral });
