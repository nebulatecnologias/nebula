/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const geral = progressoGeral();
  const cursosCompletos = cursosVisiveis().filter(c=>progressoCurso(c).pct===100).length;
  const emAndamento = cursosVisiveis().filter(c=>{ const p=progressoCurso(c); return p.pct>0 && p.pct<100; });
  const hoje = new Date().toLocaleDateString("pt-PT", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();

  const cursoPrincipal = cursoPorId(estado.ultimoCurso);
  const aulaPrincipalId = estado.ultimaAulaPorCurso[estado.ultimoCurso];
  const locPrincipal = localizarAula(cursoPrincipal.id, aulaPrincipalId);
  const pPrincipal = progressoCurso(cursoPrincipal);
  const outrosEmAndamento = emAndamento.filter(c=>c.id!==estado.ultimoCurso);

  const eventosOrdenados = DB.eventos.map(e=>({...e, dt:new Date(e.data+"T"+e.hora+":00")})).sort((a,b)=>a.dt-b.dt);
  const proximoEvento = eventosOrdenados.find(e=>e.dt>new Date());
  const catProximo = proximoEvento ? DB.categorias[proximoEvento.categoria] : null;

  const unlockedIds = [...badgesDesbloqueados()];
  const conquistaDestaque = unlockedIds.length ? DB.conquistas.find(b=>b.id===unlockedIds[unlockedIds.length-1]) : null;
  const idxDestaque = conquistaDestaque ? DB.conquistas.indexOf(conquistaDestaque) : -1;

  const destaques = (emAndamento.length ? emAndamento : cursosVisiveis()).slice(0,3);

  document.getElementById("content-dashboard").innerHTML = `
    <div class="page-head">
      <span class="eyebrow">${hoje}</span>
      <h1>Olá, ${estado.nome.split(" ")[0]}.</h1>
      <p class="desc">Continua a construir. Aqui está o ponto em que ficaste no teu percurso.</p>
    </div>
    <div class="stat-row">
      <div class="card stat-card"><div class="stat-label">Progresso geral</div><div class="stat-value">${geral.pct}<span>%</span></div></div>
      <div class="card stat-card"><div class="stat-label">Aulas concluídas</div><div class="stat-value">${geral.concluidas}<span>/ ${geral.total}</span></div></div>
      <div class="card stat-card"><div class="stat-label">Cursos concluídos</div><div class="stat-value">${cursosCompletos}<span>/ ${cursosVisiveis().length}</span></div></div>
      <div class="card stat-card"><div class="stat-label">Sequência atual</div><div class="stat-value">${estado.streakDias}<span>dias 🔥</span></div></div>
    </div>

    <div class="section-title"><h2>Continuar de onde parei</h2></div>
    <div class="card continue-card" id="btn-continuar">
      <div class="continue-thumb"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      <div class="continue-body">
        <div class="tag">${locPrincipal.modulo.titulo.toUpperCase()}</div>
        <h3>${locPrincipal.aula.titulo}</h3>
        <div class="continue-meta">
          <div class="progress-track"><div class="progress-fill" style="width:${pPrincipal.pct}%"></div></div>
          <span class="pct">${pPrincipal.pct}% de ${cursoPrincipal.titulo}</span>
        </div>
      </div>
      <div class="btn btn-secondary">Continuar</div>
    </div>
    ${outrosEmAndamento.length ? `
    <div class="continue-row">
      ${outrosEmAndamento.map(c=>{
        const p = progressoCurso(c); const cat = DB.categorias[c.categoria];
        return `<div class="card continue-mini" data-curso="${c.id}">
          <span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span>
          <h4>${c.titulo}</h4>
          <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div>
          <span class="pct-label">${p.pct}% concluído</span>
        </div>`;
      }).join("")}
    </div>` : ""}

    <div class="widget-row">
      <div class="card widget-card">
        <div class="widget-label"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>PRÓXIMO ENCONTRO AO VIVO</div>
        ${proximoEvento ? `
        <div class="widget-body">
          <div class="event-date-badge"><span class="day">${formatarDataEvento(proximoEvento.data).dia}</span><span class="mon">${formatarDataEvento(proximoEvento.data).mes}</span></div>
          <div>
            <div class="widget-title">${proximoEvento.titulo}</div>
            <div class="widget-sub" style="--c:${catProximo.cor}">${catProximo.nome} · ${proximoEvento.hora}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-ir-calendario">Ver calendário</button>
        ` : `<p style="margin:0;">Sem eventos agendados de momento.</p>`}
      </div>
      <div class="card widget-card">
        <div class="widget-label"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/></svg>CONQUISTA EM DESTAQUE</div>
        ${conquistaDestaque ? `
        <div class="widget-body">
          <div class="badge-icon-sm">${ICONS_BADGE[idxDestaque % ICONS_BADGE.length]}</div>
          <div>
            <div class="widget-title">${conquistaDestaque.titulo}</div>
            <div class="widget-sub">${conquistaDestaque.desc}</div>
          </div>
        </div>` : `<p style="margin:0;">Conclui a tua primeira aula para desbloquear a primeira conquista.</p>`}
        <button class="btn btn-secondary btn-sm" id="btn-ir-conquistas">Ver todas as conquistas</button>
      </div>
    </div>

    <div class="section-title"><h2>Os teus cursos</h2><span class="see-all" id="btn-ver-todos-cursos">Ver todos →</span></div>
    <div class="course-grid">
      ${destaques.map(c=>renderCourseCardHTML(c)).join("")}
    </div>
  `;

  document.getElementById("btn-continuar").addEventListener("click", () => irPara("aula", cursoPrincipal.id, aulaPrincipalId));
  document.querySelectorAll(".continue-mini").forEach(el => el.addEventListener("click", () => {
    const cid = el.getAttribute("data-curso");
    irPara("aula", cid, estado.ultimaAulaPorCurso[cid]);
  }));
  const btnCal = document.getElementById("btn-ir-calendario"); if(btnCal) btnCal.addEventListener("click", () => irPara("calendario"));
  document.getElementById("btn-ir-conquistas").addEventListener("click", () => irPara("conquistas"));
  document.getElementById("btn-ver-todos-cursos").addEventListener("click", () => irPara("catalogo"));
  document.querySelectorAll(".course-card").forEach(el => el.addEventListener("click", () => irPara("curso", el.getAttribute("data-curso"))));
}

function renderCourseCardHTML(c){
  const p = progressoCurso(c);
  const cat = DB.categorias[c.categoria];
  return `<div class="card course-card" data-curso="${c.id}">
    <div class="course-cover">
      <span class="cover-badge" style="color:${cat.cor};border-color:${cat.cor}66;">${cat.nome}</span>
      ${p.pct===100 ? '<span class="cover-badge done">CONCLUÍDO</span>' : ""}
    </div>
    <div class="course-body">
      <h3>${c.titulo}</h3>
      <p class="course-desc">${c.subtitulo}</p>
      <div class="course-progress-row"><span style="font-size:12.5px;color:var(--text-faint);">${p.concluidas} de ${p.total} aulas</span><span class="pct">${p.pct}%</span></div>
      <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div>
    </div>
  </div>`;
}

/* ---------------- Catálogo (Meus Cursos) ---------------- */
function renderCatalogo(){
  const geral = progressoGeral();
  const html = `
    <div class="page-head">
      <span class="eyebrow">BIBLIOTECA</span>
      <h1>Meus cursos</h1>
      <p class="desc">Todos os teus programas, mentorias e mastermind num só lugar — ${geral.pct}% de progresso geral.</p>
    </div>
    <div class="chip-row" id="chip-row"></div>
    <div class="course-grid" id="catalogo-grid"></div>
  `;
  document.getElementById("content-catalogo").innerHTML = html;

  const chipRow = document.getElementById("chip-row");
  const chips = [{ id:"todos", nome:"Todos", cor:null }, ...Object.entries(DB.categorias).map(([id,c])=>({ id, nome:c.nome, cor:c.cor }))];
  chipRow.innerHTML = chips.map(ch => `<div class="chip ${estado.filtroCategoria===ch.id?"active":""}" data-cat="${ch.id}">${ch.cor?`<span class="dot" style="--c:${ch.cor}"></span>`:""}${ch.nome}</div>`).join("");
  chipRow.querySelectorAll(".chip").forEach(el => el.addEventListener("click", () => {
    estado.filtroCategoria = el.getAttribute("data-cat");
    renderCatalogo();
  }));

  const lista = estado.filtroCategoria==="todos" ? cursosVisiveis() : cursosVisiveis().filter(c=>c.categoria===estado.filtroCategoria);
  const grid = document.getElementById("catalogo-grid");
  grid.innerHTML = lista.length ? lista.map(c=>renderCourseCardHTML(c)).join("") : `<div class="empty-note">Nenhum curso nesta categoria ainda.</div>`;
  grid.querySelectorAll(".course-card").forEach(el => el.addEventListener("click", () => irPara("curso", el.getAttribute("data-curso"))));
}

/* ---------------- Curso ---------------- */
function renderCurso(cursoId){
  const curso = cursoPorId(cursoId);
  if(!curso){ document.getElementById("content-curso").innerHTML = '<div class="empty-note">Este curso não foi encontrado.</div>'; return; }
  const p = progressoCurso(curso);
  const cat = DB.categorias[curso.categoria];
  const html = `
    <div class="back-link" id="btn-voltar-catalogo"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Meus cursos</div>
    <div class="page-head">
      <span class="eyebrow" style="--c:${cat.cor}">${cat.nome.toUpperCase()}</span>
      <h1>${curso.titulo}</h1>
      <p class="desc">${curso.subtitulo}</p>
    </div>
    <div class="card" style="padding:20px 22px;margin-bottom:28px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--text-dim);font-weight:600;"><span>Progresso geral do curso</span><span>${p.pct}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${p.pct}%"></div></div>
      </div>
      <span style="font-size:12.5px;color:var(--text-faint);white-space:nowrap;">${p.concluidas} de ${p.total} aulas</span>
      ${p.pct===100 ? `<button class="btn btn-secondary btn-sm" id="btn-ver-certificado-curso">Ver certificado</button>` : ""}
    </div>
    <div id="lista-modulos"></div>
  `;
  document.getElementById("content-curso").innerHTML = html;
  document.getElementById("btn-voltar-catalogo").addEventListener("click", () => irPara("catalogo"));
  const btnCert = document.getElementById("btn-ver-certificado-curso");
  if(btnCert) btnCert.addEventListener("click", () => abrirCertificado(curso));

  const container = document.getElementById("lista-modulos");
  curso.modulos.forEach((modulo, mIdx) => {
    const pm = progressoModulo(modulo);
    const contemUltima = modulo.aulas.some(a => a.id === estado.ultimaAulaPorCurso[curso.id]);
    const abrir = mIdx===0 || contemUltima;
    const el = document.createElement("div");
    el.className = "card modulo" + (abrir ? " open" : "");
    const aulasHtml = modulo.aulas.map(aula => {
      const st = estadoDaAula(curso.id, aula.id);
      const icon = st==="concluida" ? iconeCheck() : (st==="progresso" ? iconePlay() : "");
      return `<div class="aula-row" data-status="${st}" data-aula="${aula.id}">
        <span class="aula-status">${icon}</span>
        <span class="aula-info"><span class="titulo">${aula.titulo}</span></span>
        <span class="aula-duracao">${aula.duracao}</span>
        <svg class="icon icon-sm aula-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>`;
    }).join("");
    el.innerHTML = `
      <div class="modulo-head">
        <div class="modulo-num">${String(mIdx+1).padStart(2,"0")}</div>
        <div class="modulo-info"><h3>${modulo.titulo}</h3><p class="modulo-desc">${modulo.descricao}</p></div>
        <div class="modulo-meta"><span class="modulo-count">${pm.concluidas}/${pm.total} aulas</span><svg class="icon modulo-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div>
      </div>
      <div class="modulo-body">${aulasHtml}</div>
    `;
    const head = el.querySelector(".modulo-head");
    const body = el.querySelector(".modulo-body");
    function ajustar(){ body.style.maxHeight = el.classList.contains("open") ? body.scrollHeight+"px" : "0px"; }
    head.addEventListener("click", () => { el.classList.toggle("open"); ajustar(); });
    el.querySelectorAll(".aula-row").forEach(row => {
      row.addEventListener("click", () => irPara("aula", curso.id, row.getAttribute("data-aula")));
    });
    container.appendChild(el);
    if(abrir) requestAnimationFrame(ajustar);
  });
}

/* ---------------- Aula ---------------- */
function renderAula(cursoId, aulaId){
  const loc = localizarAula(cursoId, aulaId);
  if(!loc){ document.getElementById("content-aula").innerHTML = '<div class="empty-note">Esta aula não foi encontrada.</div>'; return; }
  const { curso, modulo, aula } = loc;
  estado.ultimaAulaPorCurso[curso.id] = aula.id;
  estado.ultimoCurso = curso.id;

  const { anterior, proxima } = aulaAnteriorProxima(curso, aula.id);
  const concluida = !!estado.progresso[aula.id];

  document.getElementById("content-aula").innerHTML = `
    <div class="back-link" id="btn-voltar-curso"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar ao curso</div>
    <div class="aula-layout">
      <div>
        <div class="player-wrap">
          <!-- PANDA_VIDEO_EMBED_AQUI -->
          <div class="placeholder-inner">
            <div class="play-badge"><svg class="icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
            <div class="placeholder-label">PLACEHOLDER DE VÍDEO — PANDA VIDEO</div>
            <div class="placeholder-sub">O embed real entra aqui após a integração</div>
          </div>
        </div>
        <div class="aula-header-row">
          <div>
            <div class="aula-breadcrumb">${curso.titulo.toUpperCase()} · ${modulo.titulo.toUpperCase()}</div>
            <h1>${aula.titulo}</h1>
          </div>
          <div class="aula-actions">
            <span style="align-self:center;font-size:13px;color:var(--text-faint);font-weight:600;margin-right:4px;">${aula.duracao}</span>
            <button class="btn btn-secondary" id="btn-concluir" data-done="${concluida}">
              <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>
              <span id="btn-concluir-label">${concluida ? "Aula concluída" : "Marcar como concluída"}</span>
            </button>
          </div>
        </div>
        <p class="aula-desc">${aula.descricao}</p>
        <div class="card avaliacao-aula">
          <h4>Avalia esta aula</h4>
          <div class="estrelas" id="estrelas-aula">
            ${[1,2,3,4,5].map(n => `<button class="estrela" type="button" data-estrela="${n}">${ICONS.star}</button>`).join("")}
          </div>
          <textarea id="comentario-aula" placeholder="Deixa um comentário sobre esta aula (opcional)...">${(estado.avaliacoes[aula.id] && estado.avaliacoes[aula.id].comentario) || ""}</textarea>
          <button class="btn btn-primary btn-sm" id="btn-enviar-avaliacao">Enviar avaliação</button>
        </div>
        <div class="nav-pager">
          <div class="pager-btn prev ${anterior ? "" : "disabled"}" id="pager-anterior">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span><span class="pager-label">AULA ANTERIOR</span><span class="pager-title">${anterior ? anterior.titulo : "—"}</span></span>
          </div>
          <div class="pager-btn next ${proxima ? "" : "disabled"}" id="pager-proxima">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <span><span class="pager-label">PRÓXIMA AULA</span><span class="pager-title">${proxima ? proxima.titulo : "—"}</span></span>
          </div>
        </div>
      </div>
      <aside class="card sidebar-lessons">
        <h4>${modulo.titulo.toUpperCase()}</h4>
        <div id="sidebar-lessons-lista"></div>
      </aside>
    </div>
  `;

  document.getElementById("btn-voltar-curso").addEventListener("click", () => irPara("curso", curso.id));
  if(anterior) document.getElementById("pager-anterior").addEventListener("click", () => irPara("aula", curso.id, anterior.id));
  if(proxima) document.getElementById("pager-proxima").addEventListener("click", () => irPara("aula", curso.id, proxima.id));

  document.getElementById("btn-concluir").addEventListener("click", () => {
    const antes = badgesDesbloqueados();
    estado.progresso[aula.id] = !estado.progresso[aula.id];
    guardarEstado();
    const depois = badgesDesbloqueados();
    atualizarSidebarGlobal();
    renderAula(curso.id, aula.id);
    if(estado.progresso[aula.id]){
      [...depois].filter(id=>!antes.has(id)).forEach(id => {
        const b = DB.conquistas.find(x=>x.id===id);
        mostrarToast("Nova conquista desbloqueada: " + b.titulo);
      });
    }
  });

  const lista = document.getElementById("sidebar-lessons-lista");
  lista.innerHTML = modulo.aulas.map(a => {
    const st = estadoDaAula(curso.id, a.id);
    const icon = st==="concluida" ? iconeCheck() : "";
    return `<div class="mini-aula ${a.id===aula.id?"active":""}" data-status="${st}" data-aula="${a.id}">
      <span class="mini-status">${icon}</span><span class="mini-titulo">${a.titulo}</span><span class="mini-dur">${a.duracao}</span>
    </div>`;
  }).join("");
  lista.querySelectorAll(".mini-aula").forEach(el => el.addEventListener("click", () => irPara("aula", curso.id, el.getAttribute("data-aula"))));

  const estrelasEl = document.getElementById("estrelas-aula");
  const estrelaAtual = () => (estado.avaliacoes[aula.id] && estado.avaliacoes[aula.id].estrelas) || 0;
  function pintarEstrelas(valor){ estrelasEl.querySelectorAll(".estrela").forEach(btn => btn.classList.toggle("ativa", Number(btn.getAttribute("data-estrela"))<=valor)); }
  pintarEstrelas(estrelaAtual());
  estrelasEl.querySelectorAll(".estrela").forEach(btn => {
    const n = Number(btn.getAttribute("data-estrela"));
    btn.addEventListener("mouseenter", () => pintarEstrelas(n));
    btn.addEventListener("mouseleave", () => pintarEstrelas(estrelaAtual()));
    btn.addEventListener("click", () => {
      estado.avaliacoes[aula.id] = estado.avaliacoes[aula.id] || {};
      estado.avaliacoes[aula.id].estrelas = n;
      guardarEstado();
      pintarEstrelas(n);
    });
  });
  document.getElementById("btn-enviar-avaliacao").addEventListener("click", () => {
    const comentario = document.getElementById("comentario-aula").value.trim();
    estado.avaliacoes[aula.id] = estado.avaliacoes[aula.id] || {};
    estado.avaliacoes[aula.id].comentario = comentario;
    guardarEstado();
    mostrarToast("Avaliação enviada. Obrigado pelo feedback!");
  });

  atualizarSidebarGlobal();
}

/* ---------------- Comunidade ---------------- */
function renderComunidade(){
  document.getElementById("content-comunidade").innerHTML = `
    <div class="page-head">
      <span class="eyebrow">ESPAÇO DOS ALUNOS</span>
      <h1>Comunidade</h1>
      <p class="desc">Partilha vitórias, faz perguntas e aprende com quem está a percorrer o mesmo caminho.</p>
    </div>
    <div class="card post-composer">
      <div class="avatar">${avatarConteudo()}</div>
      <div style="flex:1;">
        <textarea id="novo-post" placeholder="Partilha uma vitória, uma dúvida ou um insight com a comunidade..."></textarea>
        <div class="post-composer-actions"><button class="btn btn-primary btn-sm" id="btn-publicar">Publicar</button></div>
      </div>
    </div>
    <div id="feed-posts"></div>
  `;
  document.getElementById("btn-publicar").addEventListener("click", () => {
    const textarea = document.getElementById("novo-post");
    const texto = textarea.value.trim();
    if(!texto) return;
    DB.posts.unshift({ id: Date.now(), autor: estado.nome, iniciais: iniciais(estado.nome), tempo: "agora", categoria: null, texto, likes: 0, curtido: false });
    mostrarToast("Publicação criada na comunidade");
    renderComunidade();
  });
  renderFeedPosts();
}

function renderFeedPosts(){
  const feed = document.getElementById("feed-posts");
  feed.innerHTML = DB.posts.map(post => {
    const cat = post.categoria ? DB.categorias[post.categoria] : null;
    return `<div class="card post-card">
      <div class="post-head">
        <div class="avatar">${post.iniciais}</div>
        <div><div class="post-author">${post.autor}</div><div class="post-meta">${post.tempo}</div></div>
        ${cat ? `<span class="post-tag cat-tag" style="--c:${cat.cor}">${cat.nome}</span>` : ""}
      </div>
      <p class="post-text">${post.texto}</p>
      <div class="post-actions">
        <div class="post-action ${post.curtido?"liked":""}" data-like="${post.id}">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="${post.curtido?"currentColor":"none"}" stroke="currentColor" stroke-width="1.8"><path d="M14 9V5a3 3 0 0 0-3-3l-1 9v10h8.28a2 2 0 0 0 2-1.7l1.35-9A2 2 0 0 0 19.65 8H14ZM7 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3v12Z"/></svg>
          ${post.likes}
        </div>
      </div>
    </div>`;
  }).join("");
  feed.querySelectorAll("[data-like]").forEach(el => el.addEventListener("click", () => {
    const id = Number(el.getAttribute("data-like"));
    const post = DB.posts.find(p=>p.id===id);
    post.curtido = !post.curtido;
    post.likes += post.curtido ? 1 : -1;
    renderFeedPosts();
  }));
}

/* ---------------- Conquistas ---------------- */
function renderConquistas(){
  const xp = calcularXP();
  const nivel = calcularNivel();
  const noNivel = xpNoNivelAtual();
  document.getElementById("content-conquistas").innerHTML = `
    <div class="page-head">
      <span class="eyebrow">GAMIFICAÇÃO</span>
      <h1>Conquistas</h1>
      <p class="desc">Cada aula concluída soma pontos de experiência e aproxima-te da próxima conquista.</p>
    </div>
    <div class="card xp-card">
      <div class="xp-badge">Nv.${nivel}</div>
      <div class="xp-info">
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;"><span>${xp} XP acumulados</span><span>${noNivel}/${DB.config.gamificacao.xpPorNivel} para o Nível ${nivel+1}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${(noNivel/DB.config.gamificacao.xpPorNivel*100)}%"></div></div>
      </div>
      <span class="streak-pill">🔥 ${estado.streakDias} dias seguidos</span>
    </div>
    <div class="section-title"><h2>Emblemas</h2></div>
    <div class="badge-grid">
      ${DB.conquistas.map((b, i) => {
        const desbloqueada = conquistaDesbloqueada(b);
        return `<div class="card badge-card ${desbloqueada?"":"locked"}">
          <div class="badge-icon">${ICONS_BADGE[i % ICONS_BADGE.length]}</div>
          <h4>${b.titulo}</h4>
          <p>${b.desc}</p>
        </div>`;
      }).join("")}
    </div>
  `;
}

/* ---------------- Calendário ---------------- */
function paraICSData(dataStr, horaStr, offsetMin){
  const [y,m,d] = dataStr.split("-").map(Number);
  const [hh,mm] = horaStr.split(":").map(Number);
  const dt = new Date(y, m-1, d, hh, mm);
  if(offsetMin) dt.setMinutes(dt.getMinutes()+offsetMin);
  const pad = n => String(n).padStart(2,"0");
  return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function baixarLembrete(evento){
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",
    "UID:"+evento.id+"@kingdomacademy",
    "DTSTART:"+paraICSData(evento.data, evento.hora, 0),
    "DTEND:"+paraICSData(evento.data, evento.hora, 60),
    "SUMMARY:"+evento.titulo,
    "DESCRIPTION:"+evento.tipo+" - Kingdom Academy",
    "END:VEVENT","END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type:"text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  mostrarToast("A abrir o evento na tua agenda...");
}

let bannerTimer = null;
function iniciarCarrosselBanners(){
  const track = document.getElementById("banner-track");
  if(!track) return;
  let idx = 0;
  const total = track.children.length;
  function mostrarBanner(i){
    idx = (i+total)%total;
    track.scrollTo({ left: track.clientWidth*idx, behavior:"smooth" });
    document.querySelectorAll("#banner-dots .banner-dot").forEach((d,n)=>d.classList.toggle("active", n===idx));
  }
  document.querySelectorAll("#banner-dots .banner-dot").forEach(d => d.addEventListener("click", () => mostrarBanner(Number(d.getAttribute("data-slide")))));
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => mostrarBanner(idx+1), 60000);
}

function renderCalendario(){
  const agora = new Date();
  const comData = DB.eventos.map(e=>({...e, dt:new Date(e.data+"T"+e.hora+":00")})).sort((a,b)=>a.dt-b.dt);
  const proximos = comData.filter(e=>e.dt>agora);
  const passados = comData.filter(e=>e.dt<=agora).sort((a,b)=>b.dt-a.dt);

  function linhaEvento(e, passado){
    const cat = DB.categorias[e.categoria];
    const { dia, mes } = formatarDataEvento(e.data);
    const dias = diasAte(e.dt);
    const confirmado = !!estado.presencasConfirmadas[e.id];
    return `<div class="event-row">
      <div class="event-date-badge"><span class="day">${dia}</span><span class="mon">${mes}</span></div>
      <div class="event-info">
        <h4>${e.titulo}</h4>
        <div class="event-meta">
          <span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span>
          <span>${e.tipo}</span>
          <span>${e.hora}</span>
          ${!passado ? `<span>· em ${dias===0?"hoje":dias+" dia"+(dias===1?"":"s")}</span>` : ""}
        </div>
      </div>
      <span class="event-status-pill ${passado?"past":"upcoming"}">${passado?"Realizado":"Em breve"}</span>
      ${passado
        ? `<button class="btn btn-secondary btn-sm" data-toast="Resumo disponível na comunidade">Ver resumo</button>`
        : `<button class="btn btn-secondary btn-sm" data-lembrete="${e.id}">Guardar lembrete</button>
           <button class="btn btn-secondary btn-sm" data-confirmar="${e.id}" data-done="${confirmado}">${confirmado?"✓ Presença confirmada":"Confirmar presença"}</button>`
      }
    </div>`;
  }

  document.getElementById("content-calendario").innerHTML = `
    <div class="page-head">
      <span class="eyebrow">AO VIVO</span>
      <h1>Calendário</h1>
      <p class="desc">Mentorias em grupo, masterclasses e encontros ao vivo com a Kingdom Academy.</p>
    </div>
    <div class="banner-carousel">
      <div class="banner-track" id="banner-track">
        ${DB.banners.map(b => `<a class="banner-slide" href="${b.link}" target="_blank" rel="noopener" style="background:${b.gradiente}">
          <span class="banner-eyebrow">${b.eyebrow}</span>
          <span class="banner-title">${b.titulo}</span>
          <span class="banner-cta">${b.cta} →</span>
        </a>`).join("")}
      </div>
      <div class="banner-dots" id="banner-dots">
        ${DB.banners.map((_,i)=>`<span class="banner-dot ${i===0?"active":""}" data-slide="${i}"></span>`).join("")}
      </div>
    </div>
    <div class="section-title"><h2>Próximos encontros</h2></div>
    <div class="card" style="margin-bottom:24px;">
      ${proximos.length ? proximos.map(e=>linhaEvento(e,false)).join("") : '<div class="empty-note">Sem encontros agendados de momento.</div>'}
    </div>
    <div class="section-title"><h2>Encontros anteriores</h2></div>
    <div class="card">
      ${passados.length ? passados.map(e=>linhaEvento(e,true)).join("") : '<div class="empty-note">Ainda não houve encontros.</div>'}
    </div>
  `;
  document.querySelectorAll("#content-calendario [data-toast]").forEach(el => el.addEventListener("click", () => mostrarToast(el.getAttribute("data-toast"))));
  document.querySelectorAll("#content-calendario [data-lembrete]").forEach(el => el.addEventListener("click", () => {
    const evento = DB.eventos.find(x=>x.id===el.getAttribute("data-lembrete"));
    if(evento) baixarLembrete(evento);
  }));
  document.querySelectorAll("#content-calendario [data-confirmar]").forEach(el => el.addEventListener("click", () => {
    const id = el.getAttribute("data-confirmar");
    estado.presencasConfirmadas[id] = !estado.presencasConfirmadas[id];
    guardarEstado();
    renderCalendario();
    if(estado.presencasConfirmadas[id]) mostrarToast("Presença confirmada!");
  }));
  iniciarCarrosselBanners();
}

/* ---------------- Certificados ---------------- */
function abrirCertificado(curso){
  document.getElementById("cert-nome").textContent = estado.nome;
  document.getElementById("cert-curso").textContent = curso.titulo;
  document.getElementById("cert-data").textContent = "Emitido em " + new Date().toLocaleDateString("pt-PT", { day:"numeric", month:"long", year:"numeric" });
  document.getElementById("modal-certificado").classList.remove("hidden");
}
function fecharCertificado(){ document.getElementById("modal-certificado").classList.add("hidden"); }

function renderCertificados(){
  document.getElementById("content-certificados").innerHTML = `
    <div class="page-head">
      <span class="eyebrow">RECONHECIMENTO</span>
      <h1>Certificados</h1>
      <p class="desc">Um certificado é desbloqueado automaticamente quando concluis 100% de um curso.</p>
    </div>
    <div class="cert-grid" id="cert-grid"></div>
  `;
  const grid = document.getElementById("cert-grid");
  grid.innerHTML = cursosVisiveis().map(c => {
    const p = progressoCurso(c);
    const concluido = p.pct===100;
    return `<div class="card cert-card ${concluido?"":"locked"}" data-curso="${c.id}">
      <div class="cert-preview">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/></svg>
        <span>${concluido?"CERTIFICADO DISPONÍVEL":"POR DESBLOQUEAR"}</span>
      </div>
      <div class="cert-body">
        <h4>${c.titulo}</h4>
        ${concluido
          ? `<button class="btn btn-secondary btn-sm btn-block">Ver certificado</button>`
          : `<div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div><div class="cert-locked-note">${p.pct}% concluído — continua para desbloquear</div>`
        }
      </div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".cert-card:not(.locked)").forEach(el => el.addEventListener("click", () => {
    const curso = cursoPorId(el.getAttribute("data-curso"));
    abrirCertificado(curso);
  }));
}

/* ---------------- Definições ---------------- */
function renderDefinicoes(){
  document.getElementById("content-definicoes").innerHTML = `
    <div class="page-head">
      <span class="eyebrow">CONTA</span>
      <h1>Definições</h1>
      <p class="desc">Gere o teu perfil e as tuas preferências de notificação.</p>
    </div>
    <div class="settings-grid">
      <div>
        <div class="card settings-card">
          <h3>Perfil</h3>
          <div class="avatar-upload-row">
            <div class="avatar avatar-lg" id="avatar-preview">${avatarConteudo()}</div>
            <div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-mudar-foto" type="button">Alterar foto</button>
                ${estado.fotoUrl ? `<button class="btn btn-secondary btn-sm" id="btn-remover-foto" type="button">Remover</button>` : ""}
              </div>
              <input type="file" accept="image/*" id="input-foto" class="hidden">
              <p class="hint" style="margin:8px 0 0;">PNG ou JPG. Sem foto, ficam as tuas iniciais.</p>
            </div>
          </div>
          <div class="field"><label>Nome completo</label><input type="text" id="input-nome" value="${estado.nome}"></div>
          <div class="field" style="margin-bottom:0;"><label>Email</label><input type="email" value="${estado.email}" disabled></div>
          <p class="hint" style="margin:8px 0 0;">O email só pode ser alterado por um administrador.</p>
        </div>
        <div class="card settings-card">
          <h3>Segurança</h3>
          <div class="field"><label>Password atual</label><input type="password" id="input-pass-atual" placeholder="••••••••"></div>
          <div class="field"><label>Nova password</label><input type="password" id="input-pass-nova" placeholder="••••••••"></div>
          <div class="field" style="margin-bottom:0;"><label>Confirmar nova password</label><input type="password" id="input-pass-confirma" placeholder="••••••••"></div>
        </div>
        <div class="card settings-card">
          <h3>Notificações</h3>
          <div class="toggle-row">
            <div><div class="t-title">Notificações por email</div><div class="t-sub">Novidades e lembretes importantes</div></div>
            <div class="toggle ${estado.notificacoes.email?"on":""}" data-toggle="email"><div class="knob"></div></div>
          </div>
          <div class="toggle-row">
            <div><div class="t-title">Lembretes de aulas</div><div class="t-sub">Continuar de onde ficaste</div></div>
            <div class="toggle ${estado.notificacoes.lembretes?"on":""}" data-toggle="lembretes"><div class="knob"></div></div>
          </div>
          <div class="toggle-row">
            <div><div class="t-title">Atividade da comunidade</div><div class="t-sub">Novas publicações e respostas</div></div>
            <div class="toggle ${estado.notificacoes.comunidade?"on":""}" data-toggle="comunidade"><div class="knob"></div></div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-guardar-definicoes">Guardar alterações</button>
      </div>
      <div class="card settings-card">
        <h3>Resumo da conta</h3>
        <div class="account-row"><span>Plano</span><span>Kingdom All Access</span></div>
        <div class="account-row"><span>Membro desde</span><span>Jan 2026</span></div>
        <div class="account-row"><span>Cursos ativos</span><span>${cursosVisiveis().length}</span></div>
        <div class="account-row"><span>Nível atual</span><span>Nível ${calcularNivel()}</span></div>
      </div>
    </div>
  `;
  document.querySelectorAll("#content-definicoes [data-toggle]").forEach(el => el.addEventListener("click", () => {
    const key = el.getAttribute("data-toggle");
    estado.notificacoes[key] = !estado.notificacoes[key];
    el.classList.toggle("on", estado.notificacoes[key]);
  }));
  document.getElementById("btn-mudar-foto").addEventListener("click", () => document.getElementById("input-foto").click());
  document.getElementById("input-foto").addEventListener("change", e => {
    const file = e.target.files[0];
    if(!file) return;
    const leitor = new FileReader();
    leitor.onload = ev => {
      estado.fotoUrl = ev.target.result;
      guardarEstado();
      atualizarSidebarGlobal();
      renderDefinicoes();
      mostrarToast("Foto de perfil atualizada");
    };
    leitor.readAsDataURL(file);
  });
  const btnRemoverFoto = document.getElementById("btn-remover-foto");
  if(btnRemoverFoto) btnRemoverFoto.addEventListener("click", () => {
    estado.fotoUrl = null;
    guardarEstado();
    atualizarSidebarGlobal();
    renderDefinicoes();
  });

  document.getElementById("btn-guardar-definicoes").addEventListener("click", () => {
    const novoNome = document.getElementById("input-nome").value.trim();
    if(novoNome) estado.nome = novoNome;
    guardarEstado();

    const passAtual = document.getElementById("input-pass-atual").value;
    const passNova = document.getElementById("input-pass-nova").value;
    const passConfirma = document.getElementById("input-pass-confirma").value;
    if(passAtual || passNova || passConfirma){
      if(passNova.length < 6){ mostrarToast("A nova password deve ter pelo menos 6 caracteres"); return; }
      if(passNova !== passConfirma){ mostrarToast("As passwords não coincidem"); return; }
    }

    atualizarSidebarGlobal();
    mostrarToast(passNova ? "Password e alterações guardadas com sucesso" : "Alterações guardadas com sucesso");
    renderDefinicoes();
  });
}


registarViews({
  dashboard: renderDashboard,
  catalogo: renderCatalogo,
  curso: renderCurso,
  aula: renderAula,
  comunidade: renderComunidade,
  conquistas: renderConquistas,
  calendario: renderCalendario,
  certificados: renderCertificados,
  definicoes: renderDefinicoes
});
