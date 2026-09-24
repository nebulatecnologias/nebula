/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const geral = progressoGeral();
  const cursosCompletos = cursosVisiveis().filter(c=>progressoCurso(c).pct===100).length;
  const emAndamento = cursosVisiveis().filter(c=>{ const p=progressoCurso(c); return p.pct>0 && p.pct<100; });
  const hojeTexto = new Date().toLocaleDateString("pt-PT", { weekday:"long", day:"numeric", month:"long" });
  const hoje = hojeTexto.charAt(0).toUpperCase() + hojeTexto.slice(1);

  /* O último curso visto pode já não existir, ter passado a rascunho ou
     saído do plano do aluno. Nesse caso continuamos com o primeiro curso
     à mão, em vez de rebentar o ecrã. */
  const visiveis = cursosVisiveis();
  const cursoPrincipal = visiveis.find(c => c.id === estado.ultimoCurso) || emAndamento[0] || visiveis[0] || null;
  const locPrincipal = cursoPrincipal
    ? (localizarAula(cursoPrincipal.id, estado.ultimaAulaPorCurso[cursoPrincipal.id]) || primeiraAulaDoCurso(cursoPrincipal))
    : null;
  const aulaPrincipalId = locPrincipal ? locPrincipal.aula.id : null;
  const pPrincipal = cursoPrincipal ? progressoCurso(cursoPrincipal) : { pct:0 };
  const outrosEmAndamento = emAndamento.filter(c => !cursoPrincipal || c.id !== cursoPrincipal.id);

  const eventosOrdenados = DB.eventos.map(e=>({...e, dt:new Date(e.data+"T"+e.hora+":00")})).sort((a,b)=>a.dt-b.dt);
  const proximoEvento = eventosOrdenados.find(e=>e.dt>new Date());
  const catProximo = proximoEvento ? categoriaDe(proximoEvento.categoria) : null;

  const unlockedIds = [...badgesDesbloqueados()];
  const conquistaDestaque = unlockedIds.length ? DB.conquistas.find(b=>b.id===unlockedIds[unlockedIds.length-1]) : null;
  const idxDestaque = conquistaDestaque ? DB.conquistas.indexOf(conquistaDestaque) : -1;

  const destaques = (emAndamento.length ? emAndamento : cursosVisiveis()).slice(0,3);

  document.getElementById("content-dashboard").innerHTML = `
    <div class="page-head">
      <h1>Olá, ${estado.nome.split(" ")[0]}.</h1>
      <p class="desc"><span class="data-hoje">${hoje}.</span> Continua a construir: aqui está o ponto em que ficaste no teu percurso.</p>
    </div>
    ${carrosselBannersHTML("carrossel-inicio")}
    ${trilhaHTML()}
    <div class="stat-row">
      <div class="card stat-card"><div class="stat-label">Progresso geral</div><div class="stat-value">${geral.pct}<span>%</span></div></div>
      <div class="card stat-card"><div class="stat-label">Aulas concluídas</div><div class="stat-value">${geral.concluidas}<span>/ ${geral.total}</span></div></div>
      <div class="card stat-card"><div class="stat-label">Cursos concluídos</div><div class="stat-value">${cursosCompletos}<span>/ ${cursosVisiveis().length}</span></div></div>
      <div class="card stat-card"><div class="stat-label">Sequência atual</div><div class="stat-value">${estado.streakDias}<span>dia${estado.streakDias===1?"":"s"}</span></div></div>
    </div>

    <div class="section-title"><h2>Continuar de onde parei</h2></div>
    ${locPrincipal ? `
    <div class="card continue-card" id="btn-continuar">
      <div class="continue-thumb" style="--field:${campoDoCurso(cursoPrincipal.id)};${(locPrincipal.aula.capa||cursoPrincipal.capa)?`background-image:url(${locPrincipal.aula.capa||cursoPrincipal.capa})`:""}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg></div>
      <div class="continue-body">
        <h3>${locPrincipal.aula.titulo}</h3>
        <p class="continue-onde">${locPrincipal.modulo.titulo} · ${cursoPrincipal.titulo}</p>
        <div class="continue-meta">
          <div class="progress-track"><div class="progress-fill" style="width:${pPrincipal.pct}%"></div></div>
          <span class="pct">${pPrincipal.pct}% do curso</span>
        </div>
      </div>
      <button class="btn btn-primary" type="button">Continuar ${setaCirculo()}</button>
    </div>` : `
    <div class="card" style="padding:26px;margin-bottom:16px;">
      <p style="margin:0;">Ainda não tens nenhum curso disponível. Assim que a tua mentoria libertar o acesso, ele aparece aqui.</p>
    </div>`}
    ${outrosEmAndamento.length ? `
    <div class="continue-row">
      ${outrosEmAndamento.map(c=>{
        const p = progressoCurso(c); const cat = categoriaDe(c.categoria);
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
        <div class="widget-label"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>Próximo encontro ao vivo</div>
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
        <div class="widget-label"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/></svg>Conquista em destaque</div>
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

    <div class="section-title"><h2>Os teus cursos</h2><span class="see-all" id="btn-ver-todos-cursos" role="link" tabindex="0">Ver todos ${setaCirculo()}</span></div>
    <div class="course-grid">
      ${destaques.map(c=>renderCourseCardHTML(c)).join("")}
    </div>
  `;

  iniciarCarrosselBanners("#carrossel-inicio");
  ligarTrilha();
  const btnContinuar = document.getElementById("btn-continuar");
  if(btnContinuar) btnContinuar.addEventListener("click", () => irPara("aula", cursoPrincipal.id, aulaPrincipalId));
  document.querySelectorAll(".continue-mini").forEach(el => el.addEventListener("click", () => {
    const cid = el.getAttribute("data-curso");
    irPara("aula", cid, estado.ultimaAulaPorCurso[cid]);
  }));
  const btnCal = document.getElementById("btn-ir-calendario"); if(btnCal) btnCal.addEventListener("click", () => irPara("calendario"));
  document.getElementById("btn-ir-conquistas").addEventListener("click", () => irPara("conquistas"));
  document.getElementById("btn-ver-todos-cursos").addEventListener("click", () => irPara("catalogo"));
  document.querySelectorAll(".course-card").forEach(el => el.addEventListener("click", () => irPara("curso", el.getAttribute("data-curso"))));
}

/* O mesmo cartão serve o aluno e o painel: em "admin" troca o progresso
   pessoal pela conclusão média da turma e junta as ações de gestão. */
function renderCourseCardHTML(c, opcoes){
  const admin = opcoes && opcoes.admin;
  const cat = categoriaDe(c.categoria);
  const p = progressoCurso(c);
  const pct = admin ? statsCurso(c.id).conclusao : p.pct;
  const aulas = c.modulos.reduce((n,m)=>n+m.aulas.length, 0);
  const legenda = admin
    ? `${c.modulos.length} módulo${c.modulos.length===1?"":"s"} · ${aulas} aula${aulas===1?"":"s"}`
    : `${p.concluidas} de ${p.total} aulas`;

  return `<div class="card course-card ${admin?"admin":""}" data-curso="${c.id}">
    <div class="course-cover ${c.capa?"com-capa":""}" style="--field:${campoDoCurso(c.id)};${c.capa?`background-image:url(${c.capa})`:""}">
      ${c.capa ? "" : `<span class="cover-sigla" aria-hidden="true">${c.sigla || ""}</span>`}
      <span class="cover-badge" style="--c:${cat.cor}">${cat.nome}</span>
      ${admin ? `
        ${c.publicado===false ? '<span class="cover-badge estado">Rascunho</span>' : ""}
        ${c.publicado!==false && c.vitrine===false ? '<span class="cover-badge estado">Fora da vitrine</span>' : ""}
        <div class="course-card-acoes" data-parar>
          <button class="btn-icone" data-editar="${c.id}" title="Editar curso">${ICONS.lapis}</button>
          <button class="btn-icone perigo" data-apagar="${c.id}" title="Apagar curso"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
        </div>`
      : (p.pct===100 ? '<span class="cover-badge done">Concluído</span>' : "")}
    </div>
    <div class="course-body">
      <h3>${c.titulo}</h3>
      <p class="course-desc">${c.subtitulo||""}</p>
      <div class="course-progress-row"><span class="course-legenda">${legenda}</span><span class="pct">${pct}%</span></div>
      <div class="progress-track thin"><div class="progress-fill mini" style="width:${pct}%"></div></div>
    </div>
  </div>`;
}

/* ---------------- Catálogo (Meus Cursos) ---------------- */
function renderCatalogo(){
  const geral = progressoGeral();
  const html = `
    <div class="page-head">
      <h1>Meus cursos</h1>
      <p class="desc">Todos os teus programas, mentorias e mastermind num só lugar — ${geral.pct}% de progresso geral.</p>
    </div>
    <div class="chip-row" id="chip-row"></div>
    <div class="course-grid" id="catalogo-grid"></div>
  `;
  document.getElementById("content-catalogo").innerHTML = html;

  const chipRow = document.getElementById("chip-row");
  /* Só mostra categorias que tenham cursos ao alcance deste aluno. */
  const comCursos = new Set(cursosVisiveis().map(c=>c.categoria));
  const chips = [{ id:"todos", nome:"Todos", cor:null },
    ...Object.entries(DB.categorias).filter(([id])=>comCursos.has(id)).map(([id,c])=>({ id, nome:c.nome, cor:c.cor }))];
  chipRow.innerHTML = chips.map(ch => `<div class="chip ${estado.filtroCategoria===ch.id?"active":""}" data-cat="${ch.id}">${ch.cor?`<span class="dot" style="--c:${ch.cor}"></span>`:""}${ch.nome}</div>`).join("");
  chipRow.querySelectorAll(".chip").forEach(el => el.addEventListener("click", () => {
    estado.filtroCategoria = el.getAttribute("data-cat");
    renderCatalogo();
  }));

  const lista = estado.filtroCategoria==="todos" ? cursosVisiveis() : cursosVisiveis().filter(c=>c.categoria===estado.filtroCategoria);
  const grid = document.getElementById("catalogo-grid");
  /* Sem nenhum curso ao alcance, a pessoa não fica a olhar para o
     vazio sem perceber porquê: dizemos-lhe onde estão os cursos. */
  const semNada = !cursosVisiveis().length;
  grid.innerHTML = lista.length
    ? lista.map(c=>renderCourseCardHTML(c)).join("")
    : semNada
      ? `<div class="empty-note">
           Ainda não tens nenhum curso aberto. Assim que a mentoria te der acesso, aparece aqui.
           <br><button class="btn btn-secondary btn-sm" id="btn-ir-vitrine" style="margin-top:12px;">Ver o que há na Vitrine ${setaCirculo()}</button>
         </div>`
      : `<div class="empty-note">Nenhum curso nesta categoria ainda.</div>`;
  const irVitrine = document.getElementById("btn-ir-vitrine");
  if(irVitrine) irVitrine.addEventListener("click", () => irPara("vitrine"));
  grid.querySelectorAll(".course-card").forEach(el => el.addEventListener("click", () => irPara("curso", el.getAttribute("data-curso"))));
}

/* ---------------- Vitrine ----------------
   O que está à venda, e não os cursos soltos. Um cartão é uma OFERTA: pode
   trazer um curso ou um plano inteiro, e leva ao checkout onde se paga.

   Quem decide o que aparece aqui é a base de dados — a função
   vitrine_do_aluno() só devolve ofertas activas, mandadas mostrar, com
   conteúdo publicado e com pelo menos uma aula lá dentro. Este ecrã desenha
   o que recebe; não tem critério nenhum próprio, de propósito. Um botão de
   947 MT em cima de um curso vazio é uma coisa que já aconteceu a uma pessoa
   a sério, e não é decisão para ficar no browser. */
function renderVitrine(){
  const montra = DB.vitrine || [];
  document.getElementById("content-vitrine").innerHTML = `
    <div class="page-head">
      <h1>Disponível para desbloquear</h1>
      <p class="desc">O que ainda não faz parte do teu acesso. Toca num para veres como entrar.</p>
    </div>
    <div class="course-grid" id="vitrine-grid">
      ${montra.length ? montra.map(cartaoDaVitrine).join("")
        : `<div class="empty-note">Já tens acesso a tudo o que está disponível. Bom trabalho.</div>`}
    </div>
  `;
  document.querySelectorAll("#vitrine-grid .course-card").forEach(el =>
    el.addEventListener("click", () => abrirOferta(el.getAttribute("data-oferta"))));
}

function cartaoDaVitrine(o){
  /* A capa e a categoria são do primeiro curso; num plano, é a cara do
     pacote. O resto vai na legenda, que é onde cabe dizer quantos são. */
  const primeiro = o.cursos[0] || {};
  const cat = categoriaDe(primeiro.categoria);
  const varios = o.cursos.length > 1;
  const legenda = varios
    ? `${o.cursos.length} cursos · ${o.aulas} aula${o.aulas === 1 ? "" : "s"}`
    : `${primeiro.modulos || 0} módulo${primeiro.modulos === 1 ? "" : "s"} · ${o.aulas} aula${o.aulas === 1 ? "" : "s"}`;

  return `<div class="card course-card bloqueado vitrine" data-oferta="${o.ofertaId}">
    <div class="course-cover ${primeiro.capa?"com-capa":""}" style="--field:${campoDoCurso(primeiro.id || o.ofertaId)};${primeiro.capa?`background-image:url(${primeiro.capa})`:""}">
      ${primeiro.capa ? "" : `<span class="cover-sigla" aria-hidden="true">${primeiro.sigla || (primeiro.titulo||o.nome||"").split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,3).toUpperCase()}</span>`}
      <span class="cover-badge" style="--c:${cat.cor}">${varios ? "Plano" : cat.nome}</span>
      <span class="cadeado" aria-label="Por desbloquear">${ICONS.cadeado}</span>
    </div>
    <div class="course-body">
      <h3>${varios ? o.nome : primeiro.titulo}</h3>
      <p class="course-desc">${o.chamada || (varios ? o.cursos.map(c=>c.titulo).join(" · ") : (primeiro.subtitulo||""))}</p>
      <div class="course-progress-row">
        <span class="course-legenda">${legenda}</span>
      </div>
      <div class="oferta-linha">
        <span class="oferta-preco">${ICONS.cadeado}${formatarPreco(o.preco, o.moeda)}${o.mensal ? "<span>/mês</span>" : ""}</span>
      </div>
      <button class="btn btn-secondary btn-block btn-sm" data-desbloquear="${o.ofertaId}">
        ${o.checkout ? "Quero este acesso" : "Saber como entrar"} ${setaCirculo()}</button>
    </div>
  </div>`;
}

/* O destino é o checkout da oferta. Só na falta de atalho é que se cai para a
   página de vendas — e se não houver nenhuma das duas, diz-se em vez de abrir
   uma janela em branco. */
function abrirOferta(ofertaId){
  const o = (DB.vitrine || []).find(x => String(x.ofertaId) === String(ofertaId));
  if(!o) return;
  if(!o.destino){ mostrarToast("Fala com a tua mentoria para desbloqueares isto."); return; }
  abrirLink(o.destino);
}

/* "2026-09-01" → "1 de setembro". */
function dataCurta(iso){
  if(!iso) return "—";
  const [a,m,d] = String(iso).split("-").map(Number);
  if(!a || !m || !d) return iso;
  return new Date(a, m-1, d).toLocaleDateString("pt-PT", { day:"numeric", month:"long" });
}

/* Soma as durações "mm:ss" das aulas e devolve "2h 54m". */
function duracaoDoCurso(curso){
  let segundos = 0;
  curso.modulos.forEach(m => m.aulas.forEach(a => {
    /* Uma aula longa vem como H:MM:SS; as outras como MM:SS. */
    const partes = duracaoLegivel(a).split(":").map(Number);
    if(partes.length===3 && !partes.some(isNaN)) segundos += partes[0]*3600 + partes[1]*60 + partes[2];
    else if(partes.length===2 && !partes.some(isNaN)) segundos += partes[0]*60 + partes[1];
  }));
  if(!segundos) return null;
  const h = Math.floor(segundos/3600), min = Math.round((segundos%3600)/60);
  return h ? `${h}h ${String(min).padStart(2,"0")}m` : `${min}m`;
}

function renderCurso(cursoId){
  const curso = cursoPorId(cursoId);
  if(!curso){ document.getElementById("content-curso").innerHTML = '<div class="empty-note">Este curso não foi encontrado.</div>'; return; }

  /* Agora que um curso tem morada, qualquer pessoa pode escrever a de um curso
     que nao comprou. O conteudo nao vai com ela -- a base de dados nao lhe da
     modulos nem aulas -- mas isso, sozinho, desenhava-lhe um curso vazio: uma
     porta fechada pintada de porta aberta, que e a coisa que a Vitrine existe
     para evitar. Diz-se-lhe por palavras, e manda-se para onde ela pode
     resolver. */
  if(!cursosVisiveis().some(c => c.id === curso.id)){
    /* O caminho para comprar é o mesmo da Vitrine, e vem já guardado de lá.
       Escrever aqui uma segunda maneira de encontrar a oferta era arranjar um
       sítio onde as guardas do servidor não se aplicam. */
    const oferta = ofertaNaVitrinePara(curso.id);
    document.getElementById("content-curso").innerHTML = `
      <div class="back-link" id="btn-voltar-catalogo"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Meus cursos</div>
      <div class="card" style="padding:32px; text-align:center">
        <h1 style="margin:0 0 8px">${curso.titulo}</h1>
        <p class="sub" style="margin:0 0 20px">Ainda não tens acesso a este curso.</p>
        <p style="margin:0 0 22px; color:var(--muted)">
          Se acabaste de pagar, o acesso abre-se assim que confirmarmos — avisamos-te por email.
        </p>
        ${oferta && oferta.destino
          ? `<a class="btn btn-primary" href="${oferta.destino}" target="_blank" rel="noopener">
               ${oferta.checkout ? "Quero este acesso" : "Ver como ter acesso"} · ${formatarPreco(oferta.preco, oferta.moeda)}${oferta.mensal ? "/mês" : ""}</a>`
          : `<button class="btn btn-secondary" id="btn-ir-vitrine">Ver o que está disponível</button>`}
      </div>`;
    const voltar = document.getElementById("btn-voltar-catalogo");
    if(voltar) voltar.addEventListener("click", () => irPara("catalogo"));
    const vitrine = document.getElementById("btn-ir-vitrine");
    if(vitrine) vitrine.addEventListener("click", () => irPara("vitrine"));
    return;
  }
  const p = progressoCurso(curso);
  const cat = categoriaDe(curso.categoria);
  const turmaDoCurso = turmasDoMembro(membroAtual()).find(t => t.cursoId === curso.id);
  const total = contarAulas(curso);
  const duracao = duracaoDoCurso(curso);
  const loc = localizarAula(curso.id, estado.ultimaAulaPorCurso[curso.id]) || primeiraAulaDoCurso(curso);
  const assinatura = DB.config.certificado.assinaturaNome;
  const html = `
    <div class="back-link" id="btn-voltar-catalogo"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Meus cursos</div>
    <div class="card curso-hero ${curso.capa?"com-capa":""}" style="--field:${campoDoCurso(curso.id)};">
      <div class="curso-hero-arte" aria-hidden="true" style="${curso.capa?`background-image:url(${curso.capa})`:""}">${curso.capa ? "" : `<span class="cover-sigla">${curso.sigla || ""}</span>`}</div>
      <div class="curso-hero-conteudo">
        <span class="eyebrow" style="--c:${cat.cor}">${cat.nome}${turmaDoCurso ? " · " + turmaDoCurso.nome : ""}</span>
        <h1>${curso.titulo}</h1>
        <p class="curso-hero-desc">${curso.subtitulo||""}</p>
        <div class="curso-hero-meta">
          ${duracao ? `<span>${duracao}</span>` : ""}
          <span>${total} conteúdo${total===1?"":"s"}</span>
          ${assinatura ? `<strong>Originais · ${assinatura}</strong>` : ""}
        </div>
        ${turmaDoCurso ? `<p class="curso-hero-turma">Turma de ${dataCurta(turmaDoCurso.inicio)} a ${dataCurta(turmaDoCurso.fim)}.</p>` : ""}
        <div class="curso-hero-progresso">
          <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div>
          <span>${p.pct}%</span>
        </div>
        <div class="curso-hero-acoes">
          ${loc ? `<button class="btn btn-primary" id="btn-continuar-curso">${p.concluidas ? "Continuar de onde parei" : "Começar agora"} ${setaCirculo()}</button>` : ""}
          ${certificadoDesbloqueado(curso) ? `<button class="btn btn-secondary" id="btn-ver-certificado-curso">Ver certificado</button>` : ""}
        </div>
      </div>
    </div>
    <div class="section-title"><h2>Conteúdo do curso</h2><span class="sub-celula">${curso.modulos.length} módulo${curso.modulos.length===1?"":"s"} · ${p.concluidas} de ${p.total} aulas concluídas</span></div>
    <div id="lista-modulos"></div>
  `;
  document.getElementById("content-curso").innerHTML = html;
  document.getElementById("btn-voltar-catalogo").addEventListener("click", () => irPara("catalogo"));
  const btnContinuar = document.getElementById("btn-continuar-curso");
  if(btnContinuar) btnContinuar.addEventListener("click", () => irPara("aula", curso.id, loc.aula.id));
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
        <span class="aula-duracao">${duracaoLegivel(aula)}</span>
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
  /* Se a aula pedida já não existir (foi apagada ou renomeada no painel),
     abre a primeira do curso em vez de deixar o ecrã vazio. */
  const curso0 = cursoPorId(cursoId);
  const loc = localizarAula(cursoId, aulaId) || (curso0 ? primeiraAulaDoCurso(curso0) : null);
  if(!loc){ document.getElementById("content-aula").innerHTML = '<div class="empty-note">Esta aula já não está disponível.</div>'; return; }
  const { curso, modulo, aula } = loc;
  estado.ultimaAulaPorCurso[curso.id] = aula.id;
  estado.ultimoCurso = curso.id;

  const { anterior, proxima } = aulaAnteriorProxima(curso, aula.id);
  const concluida = !!estado.progresso[aula.id];

  document.getElementById("content-aula").innerHTML = `
    <div class="back-link" id="btn-voltar-curso"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar ao curso</div>
    <div class="aula-layout">
      <div>
        <div class="player-wrap">${playerHTML(aula, aula.titulo)}</div>
        <div class="aula-header-row">
          <div>
            <div class="aula-breadcrumb">${curso.titulo} · ${modulo.titulo}</div>
            <h1>${aula.titulo}</h1>
          </div>
          <div class="aula-actions">
            <span id="aula-duracao" class="aula-duracao" style="align-self:center;margin-right:4px;">${aula.duracao && aula.duracao !== "00:00" ? aula.duracao : ""}</span>
            <button class="btn btn-secondary" id="btn-concluir" data-done="${concluida}">
              <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>
              <span id="btn-concluir-label">${concluida ? "Aula concluída" : "Marcar como concluída"}</span>
            </button>
          </div>
        </div>
        <p class="aula-desc">${aula.descricao||""}</p>
        ${(aula.conteudo||"").trim() ? `<div class="card conteudo-aula">${aula.conteudo}</div>` : ""}
        ${materiaisHTML(aula)}
        ${quizHTML(aula)}
        ${aula.semComentarios ? "" : `<div class="card avaliacao-aula">
          <h4>Avalia esta aula</h4>
          <div class="estrelas" id="estrelas-aula">
            ${[1,2,3,4,5].map(n => `<button class="estrela" type="button" data-estrela="${n}">${ICONS.star}</button>`).join("")}
          </div>
          <textarea id="comentario-aula" placeholder="Deixa um comentário sobre esta aula (opcional)...">${(minhaAvaliacao(aula.id)||{}).comentario || ""}</textarea>
          <button class="btn btn-primary btn-sm" id="btn-enviar-avaliacao">Enviar avaliação</button>
          ${curso.moderacao ? '<p class="hint" style="margin:10px 0 0;">Os comentários deste curso são revistos antes de aparecerem.</p>' : ""}
        </div>`}
        <div class="nav-pager">
          <div class="pager-btn prev ${anterior ? "" : "disabled"}" id="pager-anterior">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span><span class="pager-label">Aula anterior</span><span class="pager-title">${anterior ? anterior.titulo : "—"}</span></span>
          </div>
          <div class="pager-btn next ${proxima ? "" : "disabled"}" id="pager-proxima">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <span><span class="pager-label">Próxima aula</span><span class="pager-title">${proxima ? proxima.titulo : "—"}</span></span>
          </div>
        </div>
      </div>
      <aside class="card sidebar-lessons">
        <h4>${modulo.titulo}</h4>
        <div id="sidebar-lessons-lista"></div>
      </aside>
    </div>
  `;

  /* A duração vem do leitor. Se ainda não estiver gravada e for a
     equipa a ver, fica gravada — para o aluno seguinte já a encontrar
     feita, sem ninguém ter cronometrado nada. */
  const leitor = document.querySelector("#content-aula iframe.player-embed");
  if(leitor) medirDuracao(leitor, texto => {
    const etiqueta = document.getElementById("aula-duracao");
    if(etiqueta) etiqueta.textContent = texto;
    if(texto && texto !== aula.duracao){
      aula.duracao = texto;
      if(papelEfetivo() === "administrador") salvar("aula", Object.assign({}, aula, { moduloId:modulo.id }));
    }
  });

  document.getElementById("btn-voltar-curso").addEventListener("click", () => irPara("curso", curso.id));
  if(anterior) document.getElementById("pager-anterior").addEventListener("click", () => irPara("aula", curso.id, anterior.id));
  if(proxima) document.getElementById("pager-proxima").addEventListener("click", () => irPara("aula", curso.id, proxima.id));

  document.getElementById("btn-concluir").addEventListener("click", () => {
    const antes = badgesDesbloqueados();
    estado.progresso[aula.id] = !estado.progresso[aula.id];
    salvarProgresso(aula.id, estado.progresso[aula.id]);
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

  ligarMateriais(aula);
  ligarQuiz(aula);

  /* O bloco de avaliação pode estar desligado nesta aula. */
  const estrelasEl = document.getElementById("estrelas-aula");
  if(estrelasEl){
    const estrelaAtual = () => (minhaAvaliacao(aula.id)||{}).estrelas || 0;
    const pintarEstrelas = valor => estrelasEl.querySelectorAll(".estrela").forEach(btn => btn.classList.toggle("ativa", Number(btn.getAttribute("data-estrela"))<=valor));
    pintarEstrelas(estrelaAtual());
    estrelasEl.querySelectorAll(".estrela").forEach(btn => {
      const n = Number(btn.getAttribute("data-estrela"));
      btn.addEventListener("mouseenter", () => pintarEstrelas(n));
      btn.addEventListener("mouseleave", () => pintarEstrelas(estrelaAtual()));
      btn.addEventListener("click", () => {
        guardarAvaliacao(curso, aula, { estrelas:n });
        pintarEstrelas(n);
      });
    });
    document.getElementById("btn-enviar-avaliacao").addEventListener("click", () => {
      const comentario = document.getElementById("comentario-aula").value.trim();
      guardarAvaliacao(curso, aula, { comentario });
      mostrarToast(curso.moderacao
        ? "Avaliação enviada. Aparece assim que a mentoria a aprovar."
        : "Avaliação enviada. Obrigado pelo feedback!");
    });
  }

  atualizarSidebarGlobal();
}

/* ---------------- Materiais e quiz da aula ---------------- */
function materiaisHTML(aula){
  const fs = aula.ficheiros || [];
  if(!fs.length) return "";
  return `
    <div class="card materiais-aula">
      <h4>Materiais desta aula</h4>
      ${fs.map((f,i) => `
        <button class="material-linha" data-material="${i}">
          ${ICONS.ficheiro}
          <span class="material-info"><strong>${f.nome}</strong><span class="sub-celula">${f.tamanho||"Descarregar"}</span></span>
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
        </button>`).join("")}
    </div>`;
}

function ligarMateriais(aula){
  document.querySelectorAll("#content-aula [data-material]").forEach(b => b.addEventListener("click", () => {
    const f = (aula.ficheiros||[])[Number(b.getAttribute("data-material"))];
    if(f) abrirFicheiroPrivado(f.url, f.nome);
  }));
}

function quizHTML(aula){
  const q = aula.quiz || [];
  if(!q.length) return "";
  return `
    <div class="card quiz-aula" id="quiz-aula">
      <h4>Testa o que ficou</h4>
      ${q.map((p,i) => `
        <div class="quiz-pergunta-aluno" data-pergunta="${i}">
          <p class="quiz-enunciado"><span class="quiz-num">${i+1}</span>${p.pergunta}</p>
          <div class="quiz-opcoes-aluno">
            ${p.opcoes.map((o,j) => `<button class="quiz-opcao-aluno" data-resposta="${i}-${j}">${o}</button>`).join("")}
          </div>
        </div>`).join("")}
      <div class="quiz-resultado hidden" id="quiz-resultado"></div>
    </div>`;
}

function ligarQuiz(aula){
  const bloco = document.getElementById("quiz-aula");
  if(!bloco) return;
  const respostas = {};
  bloco.querySelectorAll("[data-resposta]").forEach(b => b.addEventListener("click", () => {
    const [i,j] = b.getAttribute("data-resposta").split("-").map(Number);
    const pergunta = aula.quiz[i];
    if(respostas[i] !== undefined) return;             // uma resposta por pergunta
    respostas[i] = j;
    const linha = bloco.querySelector(`[data-pergunta="${i}"]`);
    linha.querySelectorAll(".quiz-opcao-aluno").forEach((op, k) => {
      op.classList.toggle("certa", k === pergunta.certa);
      op.classList.toggle("errada", k === j && j !== pergunta.certa);
      op.disabled = true;
    });
    if(Object.keys(respostas).length === aula.quiz.length){
      const certas = aula.quiz.filter((p,idx) => respostas[idx] === p.certa).length;
      const res = document.getElementById("quiz-resultado");
      res.className = "quiz-resultado " + (certas === aula.quiz.length ? "tudo-certo" : "");
      res.textContent = `${certas} de ${aula.quiz.length} certas.` + (certas === aula.quiz.length ? " Perfeito." : " Revê a aula e tenta de novo.");
    }
  }));
}

/* Cria ou atualiza a avaliação desta aula feita por quem está na sessão. */
function guardarAvaliacao(curso, aula, campos){
  const membro = membroAtual();
  let registo = minhaAvaliacao(aula.id);
  if(!registo){
    registo = {
      id: novoId("av"),
      cursoId: curso.id,
      aulaId: aula.id,
      membroId: membro ? membro.id : null,
      nome: estado.nome,
      estrelas: 0,
      comentario: "",
      data: new Date().toISOString().slice(0,10),
      /* Curso com moderação ligada: só aparece depois de aprovado. */
      oculto: curso.moderacao === true
    };
    DB.avaliacoes.push(registo);
  }
  Object.assign(registo, campos);
  salvar("avaliacao", registo);
}

/* ---------------- Comunidade ---------------- */
function renderComunidade(){
  const espacos = espacosAtivos();
  const atual = espacos.find(e => e.id === estado.espacoComunidade) || espacos[0];
  const equipa = papelEfetivo()==="administrador";
  const podePublicar = atual
    && (!atual.soAdminPublica || equipa)
    && (DB.config.alunosPublicam !== false || equipa);
  const aResponder = estado.respondendoA ? DB.posts.find(p => String(p.id) === String(estado.respondendoA)) : null;

  document.getElementById("content-comunidade").innerHTML = `
    <div class="page-head">
      <h1>Comunidade</h1>
      <p class="desc">${atual ? atual.descricao : "Partilha vitórias, faz perguntas e aprende com quem está a percorrer o mesmo caminho."}</p>
    </div>
    <div class="chip-row" id="espacos-row">
      ${espacos.map(e => `<div class="chip ${atual && e.id===atual.id?"active":""}" data-espaco="${e.id}"><span class="dot" style="--c:${e.cor}"></span>${e.nome}</div>`).join("")}
    </div>
    <div class="card chat">
      <div class="chat-mensagens" id="feed-posts"></div>
      ${podePublicar ? `
      <div class="chat-composer">
        ${aResponder ? `
          <div class="chat-resposta-a">
            <span>A responder a <strong>${aResponder.autor}</strong>: ${resumoTexto(aResponder.texto, 60)}</span>
            <button class="btn-icone" id="btn-cancelar-resposta" title="Cancelar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
          </div>` : ""}
        <div id="anexo-previa"></div>
        <div class="chat-caixa">
          <div class="avatar">${avatarConteudo()}</div>
          <textarea id="novo-post" rows="1" placeholder="Escreve em ${atual.nome}..."></textarea>
          <button class="btn-icone" id="btn-anexar" title="Anexar ficheiro (até 3 MB)">
            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21.4 11.05 12.2 20.3a5 5 0 0 1-7.07-7.07l9.19-9.2a3.33 3.33 0 0 1 4.72 4.72l-9.2 9.19a1.67 1.67 0 0 1-2.35-2.36l8.49-8.48"/></svg>
          </button>
          <input type="file" class="hidden" id="ficheiro-post">
          <button class="btn btn-primary btn-sm" id="btn-publicar">Enviar</button>
        </div>
      </div>` : `
      <div class="chat-fechado">
        ${DB.config.alunosPublicam === false
          ? "O mural está em modo de leitura. Por agora, só a equipa da academia publica."
          : `Só a equipa da academia publica em ${atual ? atual.nome : "este espaço"}.`}
      </div>`}
    </div>
  `;

  document.querySelectorAll("#espacos-row .chip").forEach(c => c.addEventListener("click", () => {
    estado.espacoComunidade = c.getAttribute("data-espaco");
    renderComunidade();
  }));

  const btnPublicar = document.getElementById("btn-publicar");
  if(btnPublicar){
    const textarea = document.getElementById("novo-post");
    /* A caixa cresce com o texto, como num chat. */
    const crescer = () => { textarea.style.height = "auto"; textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px"; };
    textarea.addEventListener("input", crescer);
    textarea.addEventListener("keydown", e => {
      if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); enviarMensagem(atual); }
    });
    btnPublicar.addEventListener("click", () => enviarMensagem(atual));

    const input = document.getElementById("ficheiro-post");
    document.getElementById("btn-anexar").addEventListener("click", () => input.click());
    input.addEventListener("change", e => escolherAnexo(e.target.files[0]));
    renderPreviaAnexo();

    const cancelar = document.getElementById("btn-cancelar-resposta");
    if(cancelar) cancelar.addEventListener("click", () => { estado.respondendoA = null; renderComunidade(); });
  }

  renderFeedPosts();
}

const LIMITE_ANEXO = 3 * 1024 * 1024;   // 3 MB

function resumoTexto(t, n){
  const limpo = String(t||"").replace(/\s+/g," ").trim();
  return limpo.length > n ? limpo.slice(0,n) + "…" : limpo;
}

/* ---------------- Anexos ---------------- */
async function escolherAnexo(ficheiro){
  if(!ficheiro) return;
  if(ficheiro.size > LIMITE_ANEXO){
    mostrarToast(`"${ficheiro.name}" tem ${formatarTamanho(ficheiro.size)}. O limite é 3 MB.`);
    return;
  }
  const botao = document.getElementById("btn-anexar");
  if(botao) botao.disabled = true;
  try {
    const eu = API.utilizador ? API.utilizador.id : "demo";
    const url = await enviarAnexo(ficheiro, "comunidade/" + eu);
    estado.anexoPendente = {
      nome: ficheiro.name,
      tipo: ficheiro.type || "",
      tamanho: formatarTamanho(ficheiro.size),
      url
    };
    renderPreviaAnexo();
  } catch(erro){
    mostrarToast(erro.message || "Não foi possível enviar o ficheiro.");
  } finally {
    if(botao) botao.disabled = false;
  }
}

function renderPreviaAnexo(){
  const wrap = document.getElementById("anexo-previa");
  if(!wrap) return;
  const a = estado.anexoPendente;
  if(!a){ wrap.innerHTML = ""; return; }
  const imagem = a.tipo.startsWith("image/") && !String(a.url).startsWith("storage:");
  wrap.innerHTML = `
    <div class="anexo-chip">
      ${imagem ? `<img src="${a.url}" alt="">` : ICONS.ficheiro}
      <span class="anexo-info"><strong>${a.nome}</strong><span class="sub-celula">${a.tamanho}</span></span>
      <button class="btn-icone" id="btn-tirar-anexo" title="Remover"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`;
  document.getElementById("btn-tirar-anexo").addEventListener("click", () => {
    estado.anexoPendente = null;
    renderPreviaAnexo();
  });
}

/* ---------------- Enviar ---------------- */
async function enviarMensagem(espaco){
  const textarea = document.getElementById("novo-post");
  const texto = textarea.value.trim();
  const anexo = estado.anexoPendente;
  if(!texto && !anexo) return;

  const mensagem = {
    id: novoId("post"), autor: estado.nome, iniciais: iniciais(estado.nome),
    autorId: API.utilizador ? API.utilizador.id : null,
    tempo: "agora", categoria: null, espacoId: espaco.id, fixado: false, oculto: false,
    texto, likes: 0, curtido: false,
    respostaA: estado.respondendoA || null,
    ficheiro: anexo || null,
    criadoEm: new Date().toISOString()
  };
  /* O DB guarda as publicações da mais recente para a mais antiga; a
     conversa inverte-as para a última ficar em baixo. */
  DB.posts.unshift(mensagem);

  /* Em demonstração, um anexo grande pode não caber no armazenamento
     do browser. Se a gravação falhar, desfazemos em vez de deixar a
     mensagem a mentir. */
  if(modoDemonstracao() && !escreverArmazenado(DB_CHAVE, DB)){
    DB.posts = DB.posts.filter(p => p.id !== mensagem.id);
    mostrarToast("Não há espaço neste browser para este ficheiro. Tenta um mais pequeno.");
    return;
  }

  estado.anexoPendente = null;
  estado.respondendoA = null;
  textarea.value = "";
  renderComunidade();
  const lista = document.getElementById("feed-posts");
  if(lista) lista.scrollTop = lista.scrollHeight;

  /* A mensagem aparece já no ecrã, mas quem a lê é o servidor. Se não
     chegar lá, sai do ecrã: mais vale perdê-la do que fingir que os
     outros a receberam. */
  if(modoDemonstracao()) return;
  try {
    await API.guardar("mensagem", mensagem);
  } catch(erro){
    DB.posts = DB.posts.filter(p => p.id !== mensagem.id);
    renderComunidade();
    const caixa = document.getElementById("novo-post");
    if(caixa) caixa.value = texto;          // o que escreveu não se perde
    mostrarToast(erro.message || "A mensagem não chegou a sair. Tenta outra vez.");
  }
}

/* ---------------- O mural, em formato de conversa ---------------- */
function renderFeedPosts(){
  const feed = document.getElementById("feed-posts");
  if(!feed) return;
  const espacoAtual = estado.espacoComunidade || (espacosAtivos()[0]||{}).id;
  const doEspaco = postsVisiveis().filter(p => (p.espacoId||"geral") === espacoAtual);
  const fixadas = doEspaco.filter(p => p.fixado);
  /* postsVisiveis() põe as fixadas à frente; na conversa a ordem é a da
     chegada, com as fixadas destacadas por cima. */
  const conversa = doEspaco.filter(p => !p.fixado).slice().reverse();

  if(!doEspaco.length){
    feed.innerHTML = `<div class="empty-note">Ainda não há mensagens neste espaço. Começa tu.</div>`;
    return;
  }

  const eu = estado.nome;
  let autorAnterior = null;

  feed.innerHTML = `
    ${fixadas.map(p => mensagemHTML(p, false, true)).join("")}
    ${conversa.map(p => {
      const agrupada = p.autor === autorAnterior;
      autorAnterior = p.autor;
      return mensagemHTML(p, agrupada, false, p.autor === eu);
    }).join("")}
  `;

  feed.querySelectorAll("[data-like]").forEach(el => el.addEventListener("click", () => {
    const post = DB.posts.find(p=>String(p.id)===el.getAttribute("data-like"));
    post.curtido = !post.curtido;
    post.likes += post.curtido ? 1 : -1;
    salvarReacao(post.id, post.curtido);
    renderFeedPosts();
  }));
  feed.querySelectorAll("[data-responder]").forEach(el => el.addEventListener("click", () => {
    estado.respondendoA = el.getAttribute("data-responder");
    renderComunidade();
    const caixa = document.getElementById("novo-post");
    if(caixa) caixa.focus();
  }));
  feed.querySelectorAll("[data-abrir-anexo]").forEach(el => el.addEventListener("click", () => {
    const post = DB.posts.find(p=>String(p.id)===el.getAttribute("data-abrir-anexo"));
    if(post && post.ficheiro) abrirFicheiroPrivado(post.ficheiro.url, post.ficheiro.nome);
  }));
  feed.querySelectorAll("[data-ir-mensagem]").forEach(el => el.addEventListener("click", () => {
    const alvo = feed.querySelector(`[data-mensagem="${el.getAttribute("data-ir-mensagem")}"]`);
    if(!alvo) return;
    alvo.scrollIntoView({ behavior:"smooth", block:"center" });
    alvo.classList.add("realcada");
    setTimeout(() => alvo.classList.remove("realcada"), 1200);
  }));
}

function mensagemHTML(post, agrupada, fixada, minha){
  const cat = post.categoria ? categoriaDe(post.categoria) : null;
  const citada = post.respostaA ? DB.posts.find(p => String(p.id) === String(post.respostaA)) : null;
  const f = post.ficheiro;
  const imagem = f && (f.tipo||"").startsWith("image/") && !String(f.url).startsWith("storage:");

  return `<div class="msg ${agrupada?"agrupada":""} ${fixada?"fixada":""} ${minha?"minha":""}" data-mensagem="${post.id}">
    <div class="msg-avatar">${agrupada ? "" : `<div class="avatar">${post.iniciais}</div>`}</div>
    <div class="msg-corpo">
      ${citada ? `<button class="msg-citada" data-ir-mensagem="${citada.id}"><span class="msg-citada-autor">${citada.autor}</span><span>${resumoTexto(citada.texto, 70) || (citada.ficheiro ? citada.ficheiro.nome : "")}</span></button>` : ""}
      ${agrupada ? "" : `<div class="msg-head">
        <span class="msg-autor">${post.autor}</span>
        <span class="msg-tempo">${post.tempo}</span>
        ${fixada ? '<span class="pill pill-morno msg-pin">Fixado</span>' : ""}
        ${cat ? `<span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span>` : ""}
      </div>`}
      ${post.texto ? `<p class="msg-texto">${post.texto}</p>` : ""}
      ${f ? (imagem
        ? `<button class="msg-imagem" data-abrir-anexo="${post.id}"><img src="${f.url}" alt="${f.nome}"></button>`
        : `<button class="msg-ficheiro" data-abrir-anexo="${post.id}">${ICONS.ficheiro}<span class="anexo-info"><strong>${f.nome}</strong><span class="sub-celula">${f.tamanho||""}</span></span></button>`) : ""}
      <div class="msg-acoes">
        <button class="msg-accao ${post.curtido?"liked":""}" data-like="${post.id}">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="${post.curtido?"currentColor":"none"}" stroke="currentColor" stroke-width="1.8"><path d="M14 9V5a3 3 0 0 0-3-3l-1 9v10h8.28a2 2 0 0 0 2-1.7l1.35-9A2 2 0 0 0 19.65 8H14ZM7 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3v12Z"/></svg>${post.likes||0}
        </button>
        <button class="msg-accao" data-responder="${post.id}">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>Responder
        </button>
      </div>
    </div>
  </div>`;
}

/* ---------------- Conquistas ---------------- */
function renderConquistas(){
  const xp = calcularXP();
  const nivel = calcularNivel();
  const noNivel = xpNoNivelAtual();
  document.getElementById("content-conquistas").innerHTML = `
    <div class="page-head">
      <h1>Conquistas</h1>
      <p class="desc">Cada aula concluída soma pontos de experiência e aproxima-te da próxima conquista.</p>
    </div>
    <div class="card xp-card">
      <div class="xp-badge">Nv.${nivel}</div>
      <div class="xp-info">
        <h3>Nível ${nivel}</h3>
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums;"><span>${xp} XP acumulados</span><span>${noNivel}/${DB.config.gamificacao.xpPorNivel} para o nível ${nivel+1}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${(noNivel/DB.config.gamificacao.xpPorNivel*100)}%"></div></div>
      </div>
      <span class="streak-pill"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>${estado.streakDias} dia${estado.streakDias===1?"":"s"} seguido${estado.streakDias===1?"":"s"}</span>
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
    "DESCRIPTION:"+(evento.tipo||"")+" - Kingdom Academy"+(evento.link?" - "+evento.link:""),
    ...(evento.link ? ["URL:"+evento.link] : []),
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
/* Um só carrossel, usado no Início e no Calendário — cada um com o seu id,
   para os dois não disputarem os mesmos elementos. */
function carrosselBannersHTML(id){
  const banners = bannersAtivos();
  if(!banners.length) return "";
  return `
    <div class="banner-carousel" id="${id}">
      <div class="banner-track">
        ${banners.map(b => `<a class="banner-slide" href="${linkExterno(b.link) || "#"}" target="_blank" rel="noopener" style="${fundoBanner(b)}">
          <span class="banner-eyebrow">${b.eyebrow}</span>
          <span class="banner-title">${b.titulo}</span>
          <span class="banner-cta">${b.cta} ${setaCirculo()}</span>
        </a>`).join("")}
      </div>
      <div class="banner-dots">
        ${banners.map((_,i)=>`<span class="banner-dot ${i===0?"active":""}" data-slide="${i}"></span>`).join("")}
      </div>
    </div>`;
}

function iniciarCarrosselBanners(seletorRaiz){
  const raiz = document.querySelector(seletorRaiz);
  if(!raiz) return;
  const track = raiz.querySelector(".banner-track");
  if(!track) return;
  let idx = 0;
  const total = track.children.length;
  function mostrarBanner(i){
    idx = (i+total)%total;
    track.scrollTo({ left: track.clientWidth*idx, behavior:"smooth" });
    raiz.querySelectorAll(".banner-dot").forEach((d,n)=>d.classList.toggle("active", n===idx));
  }
  raiz.querySelectorAll(".banner-dot").forEach(d => d.addEventListener("click", () => mostrarBanner(Number(d.getAttribute("data-slide")))));
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => mostrarBanner(idx+1), (DB.config.bannerIntervalo||60)*1000);
}

function renderCalendario(){
  const agora = new Date();
  const comData = DB.eventos.map(e=>({...e, dt:new Date(e.data+"T"+e.hora+":00")})).sort((a,b)=>a.dt-b.dt);
  const proximos = comData.filter(e=>e.dt>agora);
  const passados = comData.filter(e=>e.dt<=agora).sort((a,b)=>b.dt-a.dt);

  function linhaEvento(e, passado){
    const cat = categoriaDe(e.categoria);
    const { dia, mes } = formatarDataEvento(e.data);
    const dias = diasAte(e.dt);
    const confirmado = !!estado.presencasConfirmadas[e.id];
    const aberto = estado.eventoAberto === e.id;
    const dataLonga = e.dt.toLocaleDateString("pt-PT", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    return `<div class="event-row ${aberto?"aberto":""} ${passado?"passado":""}" data-evento="${e.id}">
      <div class="event-linha">
        <div class="event-date-badge"><span class="day">${dia}</span><span class="mon">${mes}</span></div>
        <div class="event-info">
          <h4>${e.titulo}</h4>
          <div class="event-meta">
            <span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span>
            <span class="etiqueta-acesso ${e.acesso||"gratuito"}">${ROTULO_ACESSO[e.acesso] || "Gratuito"}</span>
            <span>${e.tipo}</span>
            <span>${e.hora}</span>
            ${!passado ? `<span>· ${dias===0?"hoje":dias===1?"amanhã":"daqui a "+dias+" dias"}</span>` : ""}
          </div>
        </div>
        <span class="event-status-pill ${passado?"past":"upcoming"}">${passado?"Realizado":"Em breve"}</span>
        <svg class="icon event-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="event-detalhe">
        <div class="event-detalhe-corpo">
          <p class="event-descricao">${e.descricao || "Sem descrição para este encontro."}</p>
          <div class="event-campos">
            <div><span class="rotulo">Quando</span><strong>${dataLonga}, às ${e.hora}</strong></div>
            <div><span class="rotulo">Formato</span><strong>${e.tipo}</strong></div>
            <div><span class="rotulo">Onde</span><strong>${e.local || (e.link ? "Online" : "A anunciar")}</strong></div>
            <div><span class="rotulo">Acesso</span><strong>${ROTULO_ACESSO[e.acesso] || "Gratuito"}</strong></div>
            <div><span class="rotulo">Área</span><strong>${cat.nome}</strong></div>
            ${confirmado && !passado ? '<div><span class="rotulo">A tua presença</span><strong class="confirmada">Confirmada</strong></div>' : ""}
          </div>
          <div class="event-acoes">
            ${passado
              ? `<button class="btn btn-secondary btn-sm" data-toast="Resumo disponível na comunidade">Ver resumo</button>`
              : `${e.link ? `<a class="btn btn-primary btn-sm" href="${linkExterno(e.link)}" target="_blank" rel="noopener">Entrar na sala ${setaCirculo()}</a>` : ""}
                 ${e.local ? `<a class="btn btn-secondary btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.local)}" target="_blank" rel="noopener">Ver no mapa ${setaCirculo()}</a>` : ""}
                 <button class="btn btn-secondary btn-sm" data-lembrete="${e.id}">Guardar lembrete</button>
                 <button class="btn btn-secondary btn-sm" data-confirmar="${e.id}" data-done="${confirmado}">${confirmado?iconeCheck()+" Presença confirmada":"Confirmar presença"}</button>`
            }
          </div>
        </div>
      </div>
    </div>`;
  }

  document.getElementById("content-calendario").innerHTML = `
    <div class="page-head">
      <h1>Calendário</h1>
      <p class="desc">Mentorias em grupo, masterclasses e encontros ao vivo com a Kingdom Academy.</p>
    </div>
    ${carrosselBannersHTML("carrossel-aluno")}
    <div class="section-title"><h2>Próximos encontros</h2></div>
    <div class="card" style="margin-bottom:24px;">
      ${proximos.length ? proximos.map(e=>linhaEvento(e,false)).join("") : '<div class="empty-note">Sem encontros agendados de momento.</div>'}
    </div>
    <div class="section-title"><h2>Encontros anteriores</h2></div>
    <div class="card">
      ${passados.length ? passados.map(e=>linhaEvento(e,true)).join("") : '<div class="empty-note">Ainda não houve encontros.</div>'}
    </div>
  `;
  /* O cartão abre para baixo; os botões lá dentro não voltam a fechá-lo. */
  document.querySelectorAll("#content-calendario .event-linha").forEach(linha => linha.addEventListener("click", () => {
    const id = linha.closest(".event-row").getAttribute("data-evento");
    estado.eventoAberto = estado.eventoAberto === id ? null : id;
    renderCalendario();
  }));
  document.querySelectorAll("#content-calendario .event-detalhe").forEach(d => d.addEventListener("click", e => e.stopPropagation()));
  document.querySelectorAll("#content-calendario [data-toast]").forEach(el => el.addEventListener("click", () => mostrarToast(el.getAttribute("data-toast"))));
  document.querySelectorAll("#content-calendario [data-lembrete]").forEach(el => el.addEventListener("click", () => {
    const evento = DB.eventos.find(x=>x.id===el.getAttribute("data-lembrete"));
    if(evento) baixarLembrete(evento);
  }));
  document.querySelectorAll("#content-calendario [data-confirmar]").forEach(el => el.addEventListener("click", () => {
    const id = el.getAttribute("data-confirmar");
    estado.presencasConfirmadas[id] = !estado.presencasConfirmadas[id];
    salvarPresenca(id, estado.presencasConfirmadas[id]);
    renderCalendario();
    if(estado.presencasConfirmadas[id]) mostrarToast("Presença confirmada!");
  }));
  iniciarCarrosselBanners("#carrossel-aluno");
}

/* ---------------- Certificados ---------------- */
function abrirCertificado(curso){
  document.getElementById("modal-cert-conteudo").innerHTML = certificadoHTML({
    nome: estado.nome,
    curso: curso.titulo,
    data: new Date().toLocaleDateString("pt-PT", { day:"numeric", month:"long", year:"numeric" }),
    comFechar: true
  });
  document.getElementById("btn-fechar-certificado").addEventListener("click", fecharCertificado);
  document.getElementById("modal-certificado").classList.remove("hidden");
}
function fecharCertificado(){ document.getElementById("modal-certificado").classList.add("hidden"); }

function renderCertificados(){
  document.getElementById("content-certificados").innerHTML = `
    <div class="page-head">
      <h1>Certificados</h1>
      <p class="desc">Um certificado é desbloqueado automaticamente quando concluis ${regraCertificado()}% de um curso.</p>
    </div>
    <div class="cert-grid" id="cert-grid"></div>
  `;
  const grid = document.getElementById("cert-grid");
  grid.innerHTML = cursosVisiveis().map(c => {
    const p = progressoCurso(c);
    const concluido = certificadoDesbloqueado(c);
    return `<div class="card cert-card ${concluido?"":"locked"}" data-curso="${c.id}">
      <div class="cert-preview">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/></svg>
        <span>${concluido?"Certificado disponível":"Por desbloquear"}</span>
      </div>
      <div class="cert-body">
        <h4>${c.titulo}</h4>
        ${concluido
          ? `<button class="btn btn-secondary btn-sm btn-block">Ver certificado</button>`
          : `<div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div><div class="cert-locked-note">${p.pct}% de ${regraCertificado()}% — continua para desbloquear</div>`
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
        ${DB.config.integracoes.suporteUrl ? `
        <div class="card bloco-apoio">
          <div>
            <div class="t-title">Precisas de ajuda?</div>
            <div class="t-sub">Fala diretamente com quem acompanha o teu percurso.</div>
          </div>
          <a class="btn btn-secondary" href="${linkExterno(DB.config.integracoes.suporteUrl)}" target="_blank" rel="noopener">${DB.config.integracoes.suporteRotulo || "Falar com a mentoria"}</a>
        </div>` : ""}
      </div>
      <div class="card settings-card">
        <h3>Resumo da conta</h3>
        <div class="account-row"><span>Plano</span><span>${(planoPorId((membroAtual()||{}).planoId)||{}).nome || "Sem plano"}</span></div>
        <div class="account-row"><span>Membro desde</span><span>${(membroAtual()||{}).membroDesde || "—"}</span></div>
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
  document.getElementById("input-foto").addEventListener("change", async e => {
    const file = e.target.files[0];
    if(!file) return;
    try {
      const eu = API.utilizador ? API.utilizador.id : "demo";
      estado.fotoUrl = await enviarImagem(file, "perfis/" + eu);
      salvarPerfil();
      atualizarSidebarGlobal();
      renderDefinicoes();
      mostrarToast("Foto de perfil atualizada");
    } catch(erro){ mostrarToast(erro.message || "Não foi possível enviar a foto."); }
  });
  const btnRemoverFoto = document.getElementById("btn-remover-foto");
  if(btnRemoverFoto) btnRemoverFoto.addEventListener("click", () => {
    estado.fotoUrl = null;
    salvarPerfil();
    atualizarSidebarGlobal();
    renderDefinicoes();
  });

  document.getElementById("btn-guardar-definicoes").addEventListener("click", () => {
    const novoNome = document.getElementById("input-nome").value.trim();
    if(novoNome){
      estado.nome = novoNome;
      const membro = membroAtual();
      if(membro) membro.nome = novoNome;
      salvarNome(novoNome);
    }
    salvarPerfil();

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
  vitrine: renderVitrine,
  curso: renderCurso,
  aula: renderAula,
  comunidade: renderComunidade,
  conquistas: renderConquistas,
  calendario: renderCalendario,
  certificados: renderCertificados,
  definicoes: renderDefinicoes
});
