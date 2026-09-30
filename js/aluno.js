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
      <p class="desc"><span class="data-hoje">${hoje}.</span> Continue a construir: aqui está o ponto em que ficou no seu percurso.</p>
    </div>

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
      <p style="margin:0;">Ainda não tem nenhum curso disponível. Assim que a sua mentoria libertar o acesso, ele aparece aqui.</p>
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

    <div class="stat-row">
      <div class="card stat-card"><div class="stat-label">Progresso geral</div><div class="stat-value">${geral.pct}<span>%</span></div></div>
      <div class="card stat-card"><div class="stat-label">Aulas concluídas</div><div class="stat-value">${geral.concluidas}<span>/ ${geral.total}</span></div></div>
      <div class="card stat-card"><div class="stat-label">Cursos concluídos</div><div class="stat-value">${cursosCompletos}<span>/ ${cursosVisiveis().length}</span></div></div>
      <div class="card stat-card"><div class="stat-label">Sequência atual</div><div class="stat-value">${estado.streakDias}<span>dia${estado.streakDias===1?"":"s"}</span></div></div>
    </div>
    ${trilhaHTML()}
    ${carrosselBannersHTML("carrossel-inicio")}
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
        </div>` : `<p style="margin:0;">Conclua a sua primeira aula para desbloquear a primeira conquista.</p>`}
        <button class="btn btn-secondary btn-sm" id="btn-ir-conquistas">Ver todas as conquistas</button>
      </div>
    </div>

    <div class="section-title"><h2>Os seus cursos</h2><span class="see-all" id="btn-ver-todos-cursos" role="link" tabindex="0">Ver todos ${setaCirculo()}</span></div>
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
        <div class="course-card-acoes" data-parar>
          <button class="btn-icone" data-editar="${c.id}" title="Editar curso">${ICONS.lapis}</button>
          <button class="btn-icone perigo" data-apagar="${c.id}" title="Apagar curso"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
        </div>`
      : (p.pct===100 ? '<span class="cover-badge done">Concluído</span>' : "")}
    </div>
    <div class="course-body">
      <h3>${c.titulo}</h3>
      <p class="course-desc">${c.subtitulo||""}</p>
      ${admin ? `
        <div class="course-progress-row"><span class="course-legenda">${legenda}</span><span class="pct">${pct}%</span></div>
        <div class="progress-track thin"><div class="progress-fill mini" style="width:${pct}%"></div></div>`
      : detalhesDoCartaoHTML(c, p)}
    </div>
  </div>`;
}

/* O que o aluno precisa de saber num cartão, pedido pelo Shelton a 27/09/2026:
   duração, avaliação e quem dá o curso. O progresso só aparece depois de
   começar -- uma barra a 0% num curso novo não diz nada. */
function detalhesDoCartaoHTML(c, p){
  const progresso = p.concluidas > 0 ? `
    <div class="course-progress-row"><span class="course-legenda">${p.concluidas} de ${p.total} aulas</span><span class="pct">${p.pct}%</span></div>
    <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div>` : "";
  return metaDoCartaoHTML({ duracao: duracaoDoCurso(c), nota: avaliacaoDoCurso(c.id),
                            facilitador: c.facilitador, facilitadorFoto: c.facilitadorFoto })
    + (progresso ? `<div class="course-progresso">${progresso}</div>` : "");
}

/* Duração, avaliação e facilitador: o mesmo bloco no cartão do curso e no da
   Vitrine, para os dois se lerem da mesma maneira. */
function metaDoCartaoHTML({ duracao, nota, facilitador, facilitadorFoto }){
  const meta = [
    duracao ? `<span class="course-meta-item">${ICONE_RELOGIO}${duracao}</span>` : "",
    nota ? `<span class="course-meta-item nota" title="${nota.n} avaliaç${nota.n === 1 ? "ão" : "ões"}">${ICONS.star}${nota.texto}<span class="nota-n">(${nota.n})</span></span>` : ""
  ].filter(Boolean).join("");
  const quem = facilitador ? `
    <div class="course-facilitador">
      <span class="facilitador-foto" ${facilitadorFoto ? `style="background-image:url(${facilitadorFoto})"` : ""}>${facilitadorFoto ? "" : iniciais(facilitador)}</span>
      <span class="facilitador-nome">${textoSeguro(facilitador)}</span>
    </div>` : "";
  return `${meta ? `<div class="course-meta">${meta}</div>` : ""}${quem}`;
}

const ICONE_RELOGIO = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

/* A média das avaliações visíveis do curso, em pt-PT (4,5). Sem nenhuma,
   não se mostra nada: um "0,0" leria-se como um curso mal avaliado. */
function avaliacaoDoCurso(cursoId){
  const notas = (DB.avaliacoes || []).filter(a => a.cursoId === cursoId && !a.oculto && a.estrelas > 0).map(a => Number(a.estrelas));
  if(!notas.length) return null;
  return notaEmTexto(notas.reduce((x, y) => x + y, 0) / notas.length, notas.length);
}
function notaEmTexto(media, n){
  if(!n || !(media > 0)) return null;
  return { media, n, texto: Number(media).toLocaleString("pt-PT", { minimumFractionDigits:1, maximumFractionDigits:1 }) };
}

/* ---------------- Catálogo (Meus Cursos) ---------------- */
function renderCatalogo(){
  const geral = progressoGeral();
  const html = `
    <div class="page-head">
      <h1>Meus cursos</h1>
      <p class="desc">Todos os seus programas, mentorias e mastermind num só lugar — ${geral.pct}% de progresso geral.</p>
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
           Ainda não tem nenhum curso aberto. Assim que a mentoria lhe der acesso, aparece aqui.
           <br><button class="btn btn-secondary btn-sm" id="btn-ir-vitrine" style="margin-top:12px;">Ver o que há na Vitrine ${setaCirculo()}</button>
         </div>`
      : `<div class="empty-note">Nenhum curso nesta categoria ainda.</div>`;
  const irVitrine = document.getElementById("btn-ir-vitrine");
  if(irVitrine) irVitrine.addEventListener("click", () => irPara("vitrine"));
  grid.querySelectorAll(".course-card").forEach(el => el.addEventListener("click", () => irPara("curso", el.getAttribute("data-curso"))));
}

/* ---------------- Vitrine ----------------
   O que está à venda, e não os cursos soltos. Um cartão é uma OFERTA: pode
   trazer um curso ou um plano inteiro, e abre a página da oferta, onde está o
   botão que leva ao checkout.

   Quem decide o que aparece aqui é a base de dados — a função
   vitrine_do_aluno() só devolve ofertas activas, mandadas mostrar, com
   conteúdo publicado e com pelo menos uma aula lá dentro, ou postas em
   pré-venda pela equipa. Este ecrã desenha o que recebe; não tem critério
   nenhum próprio, de propósito. Um botão de 947 MT em cima de um curso vazio
   é uma coisa que já aconteceu a uma pessoa a sério, e não é decisão para
   ficar no browser.

   As categorias são as dos cursos (decisão do Shelton, 27/09/2026); um pacote
   de vários cursos fica em «Planos». Só aparecem as que têm alguma coisa. */
function categoriaDaOferta(o){
  return (o.entrega === "Plano" || o.cursos.length > 1) ? "planos" : ((o.cursos[0] || {}).categoria || "");
}

function renderVitrine(){
  const montra = DB.vitrine || [];
  const presentes = new Set(montra.map(categoriaDaOferta));
  const chips = [{ id:"todos", nome:"Todas" },
    ...Object.entries(DB.categorias).filter(([id]) => presentes.has(id)).map(([id, c]) => ({ id, nome:c.nome, cor:c.cor })),
    ...(presentes.has("planos") ? [{ id:"planos", nome:"Planos" }] : [])];
  if(!chips.some(c => c.id === estado.filtroVitrine)) estado.filtroVitrine = "todos";
  const lista = estado.filtroVitrine === "todos" ? montra : montra.filter(o => categoriaDaOferta(o) === estado.filtroVitrine);

  document.getElementById("content-vitrine").innerHTML = `
    <div class="page-head">
      <h1>Disponível para desbloquear</h1>
      <p class="desc">O que ainda não faz parte do seu acesso. Toque num para ver como entrar.</p>
    </div>
    ${chips.length > 2 ? `<div class="chip-row" id="vitrine-chips" role="group" aria-label="Categorias">
      ${chips.map(ch => `<button type="button" class="chip ${estado.filtroVitrine === ch.id ? "active" : ""}" data-cat="${ch.id}" aria-pressed="${estado.filtroVitrine === ch.id}">${ch.cor ? `<span class="dot" style="--c:${ch.cor}"></span>` : ""}${ch.nome}</button>`).join("")}
    </div>` : ""}
    <div class="course-grid" id="vitrine-grid">
      ${lista.length ? lista.map(cartaoDaVitrine).join("")
        : montra.length ? `<div class="empty-note">Nada nesta categoria de momento.</div>`
        : `<div class="empty-note">Já tem acesso a tudo o que está disponível. Bom trabalho.</div>`}
    </div>
  `;
  document.querySelectorAll("#vitrine-chips .chip").forEach(el => el.addEventListener("click", () => {
    estado.filtroVitrine = el.getAttribute("data-cat");
    renderVitrine();
  }));
  /* O cartão abre a página da oferta, cá dentro. O checkout é o botão dela:
     ninguém é mandado para fora sem antes ver o que está a comprar. */
  document.querySelectorAll("#vitrine-grid .course-card").forEach(el => {
    const abrir = () => irPara("oferta", el.getAttribute("data-oferta"));
    el.addEventListener("click", abrir);
    el.addEventListener("keydown", ev => { if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); abrir(); } });
  });
}

/* «Pré-venda: as aulas abrem a 1 de novembro». Sem data, «em breve». */
function textoDaPreVenda(abreEm){
  return abreEm ? `Pré-venda: as aulas abrem a ${dataCurta(abreEm)}` : "Pré-venda: as aulas abrem em breve";
}

function cartaoDaVitrine(o){
  /* A capa e a categoria são do primeiro curso; num plano, é a cara do
     pacote. O cartão é o do curso (duração, avaliação, facilitador), com o
     preço por baixo. */
  const primeiro = o.cursos[0] || {};
  const cat = categoriaDe(primeiro.categoria);
  const varios = o.cursos.length > 1;
  const titulo = varios ? o.nome : (primeiro.titulo || o.nome);
  const meta = varios
    ? metaDoCartaoHTML({ duracao: duracaoEmTexto(o.segundos) })
    : metaDoCartaoHTML({ duracao: duracaoEmTexto(primeiro.segundos), nota: notaEmTexto(primeiro.nota, primeiro.avaliacoes),
                         facilitador: primeiro.facilitador, facilitadorFoto: primeiro.facilitadorFoto });
  const legenda = o.emBreve && !o.aulas
    ? `<span class="pre-venda">${textoDaPreVenda(o.abreEm)}</span>`
    : varios ? `${o.cursos.length} cursos · ${o.aulas} aula${o.aulas === 1 ? "" : "s"}`
    : `${primeiro.modulos || 0} módulo${primeiro.modulos === 1 ? "" : "s"} · ${o.aulas} aula${o.aulas === 1 ? "" : "s"}`;

  return `<div class="card course-card bloqueado vitrine" data-oferta="${o.ofertaId}" role="link" tabindex="0" aria-label="${textoSeguro(titulo)}">
    <div class="course-cover ${primeiro.capa?"com-capa":""}" style="--field:${campoDoCurso(primeiro.id || o.ofertaId)};${primeiro.capa?`background-image:url(${primeiro.capa})`:""}">
      ${primeiro.capa ? "" : `<span class="cover-sigla" aria-hidden="true">${primeiro.sigla || (primeiro.titulo||o.nome||"").split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,3).toUpperCase()}</span>`}
      <span class="cover-badge" style="--c:${cat.cor}">${varios ? "Plano" : cat.nome}</span>
      ${o.emBreve ? '<span class="cover-badge estado em-breve">Em breve</span>' : ""}
      <span class="cadeado" aria-label="Por desbloquear">${ICONS.cadeado}</span>
    </div>
    <div class="course-body">
      <h3>${textoSeguro(titulo)}</h3>
      <p class="course-desc">${textoSeguro(o.chamada || (varios ? o.cursos.map(c=>c.titulo).join(" · ") : (primeiro.subtitulo||"")))}</p>
      ${meta}
      <div class="course-progress-row"><span class="course-legenda">${legenda}</span></div>
      <div class="oferta-linha">
        <span class="oferta-preco">${ICONS.cadeado}${formatarPreco(o.preco, o.moeda)}${o.mensal ? "<span>/mês</span>" : ""}</span>
      </div>
      <button class="btn btn-secondary btn-block btn-sm" data-desbloquear="${o.ofertaId}" tabindex="-1">
        ${o.emBreve ? "Garantir na pré-venda" : "Ver como desbloquear"} ${setaCirculo()}</button>
    </div>
  </div>`;
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
  return duracaoEmTexto(segundos);
}
function duracaoEmTexto(segundos){
  if(!(segundos > 0)) return null;
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
    /* Com uma oferta à venda, a página do curso é a página da oferta: a mesma
       que a Vitrine e os banners abrem, para haver um só sítio onde se compra. */
    if(oferta){ irPara("oferta", oferta.ofertaId); return; }
    document.getElementById("content-curso").innerHTML = `
      <div class="back-link" id="btn-voltar-catalogo"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Meus cursos</div>
      <div class="card" style="padding:32px; text-align:center">
        <h1 style="margin:0 0 8px">${curso.titulo}</h1>
        <p class="sub" style="margin:0 0 20px">Ainda não tem acesso a este curso.</p>
        <p style="margin:0 0 22px; color:var(--muted)">
          Se acabou de pagar, o acesso abre-se assim que confirmarmos — avisamo-lo por email.
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
  /* Quem comprou em pré-venda entra aqui antes de haver aulas: em vez de um
     curso vazio, diz-se quando abrem (decisão do Shelton, 27/09/2026). O
     servidor é que sabe se o curso está em pré-venda. */
  const preVenda = !total && (DB.preVenda || []).find(x => x.cursoId === curso.id);
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
          ${preVenda ? '<span class="pre-venda">Pré-venda</span>' : `<span>${total} conteúdo${total===1?"":"s"}</span>`}
          ${(() => { const nota = avaliacaoDoCurso(curso.id); return nota ? `<span class="course-meta-item nota">${ICONS.star}${nota.texto} <span class="nota-n">(${nota.n})</span></span>` : ""; })()}
          ${curso.facilitador
            ? `<span class="course-facilitador no-hero"><span class="facilitador-foto" ${curso.facilitadorFoto ? `style="background-image:url(${curso.facilitadorFoto})"` : ""}>${curso.facilitadorFoto ? "" : iniciais(curso.facilitador)}</span><strong>Com ${textoSeguro(curso.facilitador)}</strong></span>`
            : (assinatura ? `<strong>Originais · ${assinatura}</strong>` : "")}
        </div>
        ${turmaDoCurso ? `<p class="curso-hero-turma">Turma de ${dataCurta(turmaDoCurso.inicio)} a ${dataCurta(turmaDoCurso.fim)}.</p>` : ""}
        ${preVenda ? "" : `<div class="curso-hero-progresso">
          <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div>
          <span>${p.pct}%</span>
        </div>
        <div class="curso-hero-acoes">
          ${loc ? `<button class="btn btn-primary" id="btn-continuar-curso">${p.concluidas ? "Continuar de onde parei" : "Começar agora"} ${setaCirculo()}</button>` : ""}
          ${certificadoDesbloqueado(curso) ? `<button class="btn btn-secondary" id="btn-ver-certificado-curso">Ver certificado</button>` : ""}
        </div>`}
      </div>
    </div>
    ${preVenda
      ? `<div class="aviso-pre-venda" role="status">${ICONE_RELOGIO}<div>
           <h2>${textoDaPreVenda(preVenda.abreEm)}</h2>
           <p>Comprou na pré-venda. O curso já é seu; as aulas aparecem aqui assim que abrirem.</p>
         </div></div>`
      : `<div class="section-title"><h2>Conteúdo do curso</h2><span class="sub-celula">${curso.modulos.length} módulo${curso.modulos.length===1?"":"s"} · ${p.concluidas} de ${p.total} aulas concluídas</span></div>`}
    <div id="lista-modulos"></div>
  `;
  document.getElementById("content-curso").innerHTML = html;
  document.getElementById("btn-voltar-catalogo").addEventListener("click", () => irPara("catalogo"));
  const btnContinuar = document.getElementById("btn-continuar-curso");
  if(btnContinuar) btnContinuar.addEventListener("click", () => irPara("aula", curso.id, loc.aula.id));
  const btnCert = document.getElementById("btn-ver-certificado-curso");
  if(btnCert) btnCert.addEventListener("click", () => abrirCertificado(curso.id));

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
            <h1>${aula.titulo}</h1>
            <div class="aula-breadcrumb">${curso.titulo} · ${modulo.titulo}</div>
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
          <textarea id="comentario-aula" placeholder="Deixe um comentário sobre esta aula (opcional)...">${(minhaAvaliacao(aula.id)||{}).comentario || ""}</textarea>
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
    const concluiu = estado.progresso[aula.id];
    /* O certificado lê-se depois de a aula ficar gravada: é a base que o grava. */
    salvarProgresso(aula.id, concluiu)
      .then(() => concluiu ? atualizarCertificados() : [])
      .then(novos => {
        if(!novos.length) return;
        atualizarSidebarGlobal();
        mostrarToast(novos.length > 1 ? "Os seus certificados ficaram gravados"
                                      : `Concluiu ${textoSeguro(novos[0].titulo)}: o seu certificado ficou gravado`);
      });
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
      res.textContent = `${certas} de ${aula.quiz.length} certas.` + (certas === aula.quiz.length ? " Perfeito." : " Reveja a aula e tente de novo.");
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

/* ---------------- Comunidade ----------------
   Os grupos de cada programa, como a lista de grupos do WhatsApp (decisão do
   Shelton, 27/09/2026: o chat interno saiu). Cada linha é um grupo com o seu
   botão; o link abre fora da Academia.

   Quem vê o quê é a base que decide: a linha, e com ela o link, só chega a
   quem tem inscrição numa das ofertas da comunidade. Este ecrã desenha o que
   recebe e não filtra nada por conta própria. */
const CANAIS = {
  whatsapp: { nome:"WhatsApp", cor:"#25d366",
    icone:`<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>` },
  telegram: { nome:"Telegram", cor:"#2aabee",
    icone:`<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3Z"/></svg>` },
  outro:    { nome:"Comunidade", cor:"#7b72e8", icone:ICONS.people }
};

function renderComunidade(){
  const lista = (DB.comunidades || []).filter(c => c.ativa !== false);
  document.getElementById("content-comunidade").innerHTML = `
    <div class="page-head">
      <h1>Comunidade</h1>
      <p class="desc">Os grupos dos seus programas. Entre para conversar com a sua turma e com a equipa.</p>
    </div>
    ${lista.length ? `<div class="card lista-comunidades" role="list">
      ${lista.map(comunidadeHTML).join("")}
    </div>` : `<div class="card empty-note">Ainda não há grupos para os seus programas. Quando houver, aparecem aqui.</div>`}
  `;
}

/* «Kingdom · Geral» → «KG»: só contam as palavras que começam por letra. */
function iniciaisDoGrupo(nome){
  return String(nome || "").split(/\s+/).filter(w => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

function comunidadeHTML(c){
  const canal = CANAIS[c.canal] || CANAIS.outro;
  const foto = c.imagem
    ? `<span class="comunidade-foto" style="background-image:url(${c.imagem})" aria-hidden="true"></span>`
    : `<span class="comunidade-foto sem-foto" style="--c:${canal.cor}" aria-hidden="true">${iniciaisDoGrupo(c.nome)}</span>`;
  return `<div class="comunidade" role="listitem">
    ${foto}
    <div class="comunidade-info">
      <div class="comunidade-nome">${textoSeguro(c.nome)}</div>
      ${c.descricao ? `<div class="comunidade-desc">${textoSeguro(c.descricao)}</div>` : ""}
      <span class="comunidade-canal" style="--c:${canal.cor}">${canal.icone}${canal.nome}</span>
    </div>
    <a class="btn btn-secondary btn-sm comunidade-entrar" href="${linkExterno(c.link)}" target="_blank" rel="noopener"
       aria-label="Entrar em ${textoSeguro(c.nome)} (${canal.nome}, abre fora da Academia)">Entrar ${setaCirculo()}</a>
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
      <p class="desc">Cada aula concluída soma pontos de experiência e aproxima-o da próxima conquista.</p>
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
  mostrarToast("A abrir o evento na sua agenda...");
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
        ${banners.map(b => `<a class="banner-slide" href="${destinoDoBanner(b)}" style="${fundoBanner(b)}" aria-label="${textoSeguro(b.titulo)}">
          ${b.eyebrow ? `<span class="banner-etiqueta">${b.eyebrow}</span>` : ""}
          <span class="banner-title">${b.titulo}</span>
          ${b.cta ? `<span class="banner-cta">${b.cta} ${setaCirculo()}</span>` : ""}
          <span class="banner-saber">Saber mais ${setaCirculo()}</span>
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
            ${confirmado && !passado ? '<div><span class="rotulo">A sua presença</span><strong class="confirmada">Confirmada</strong></div>' : ""}
          </div>
          <div class="event-acoes">
            ${passado
              ? `<a class="btn btn-secondary btn-sm" href="#/evento/${encodeURIComponent(e.id)}">Ver página</a>`
              : (e.acesso === "pago" && !e.link)
              /* O link da sala só chega a quem comprou: sem ele, falta o lugar.
                 Compra-se na página do evento, que é o único sítio de compra. */
              ? `<a class="btn btn-primary btn-sm" href="#/evento/${encodeURIComponent(e.id)}">Garantir lugar ${setaCirculo()}</a>`
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
/* O certificado mostra-se como ficou gravado: o nome, o curso e a data do dia
   em que o aluno concluiu, e não os de hoje. */
function abrirCertificado(cursoId){
  const cert = certificadoDoCurso(cursoId);
  if(!cert) return;
  const curso = cursoPorId(cursoId);
  document.getElementById("modal-cert-conteudo").innerHTML = certificadoHTML({
    nome: textoSeguro(cert.nome || estado.nome),
    curso: textoSeguro(cert.cursoTitulo || (curso && curso.titulo) || ""),
    data: dataDoCertificado(cert.emitidoEm),
    codigo: cert.codigo,
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
      <p class="desc">O certificado fica gravado quando conclui ${regraCertificado()}% de um curso, e é seu para sempre.</p>
    </div>
    <div class="cert-grid" id="cert-grid"></div>
  `;
  const grid = document.getElementById("cert-grid");
  const icone = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/></svg>`;
  const gravado = cert => `<div class="card cert-card" data-curso="${cert.cursoId}">
      <div class="cert-preview">${icone}<span>Certificado gravado</span></div>
      <div class="cert-body">
        <h4>${textoSeguro(cert.cursoTitulo)}</h4>
        <div class="cert-emitido">Emitido em ${dataDoCertificado(cert.emitidoEm)}</div>
        <button class="btn btn-secondary btn-sm btn-block">Ver certificado</button>
      </div>
    </div>`;
  const visiveis = cursosVisiveis().filter(cursoEmiteCertificado);
  const cartoes = visiveis.map(c => {
    const cert = certificadoDoCurso(c.id);
    if(cert) return gravado(Object.assign({}, cert, { cursoTitulo: cert.cursoTitulo || c.titulo }));
    const p = progressoCurso(c);
    return `<div class="card cert-card locked" data-curso="${c.id}">
      <div class="cert-preview">${icone}<span>Por desbloquear</span></div>
      <div class="cert-body">
        <h4>${c.titulo}</h4>
        <div class="progress-track thin"><div class="progress-fill mini" style="width:${p.pct}%"></div></div><div class="cert-locked-note">${p.pct}% de ${regraCertificado()}% — continue para desbloquear</div>
      </div>
    </div>`;
  });
  /* Um certificado fica mesmo que o curso já não esteja à vista: foi fechado,
     deixou de emitir, ou o acesso acabou. */
  const aVista = new Set(visiveis.map(c => c.id));
  meusCertificados().filter(cert => !aVista.has(cert.cursoId)).forEach(cert => cartoes.push(gravado(cert)));
  grid.innerHTML = cartoes.join("") || `<div class="empty-note">Ainda não há cursos com certificado.</div>`;
  grid.querySelectorAll(".cert-card:not(.locked)").forEach(el => el.addEventListener("click", () => {
    abrirCertificado(el.getAttribute("data-curso"));
  }));
}

/* ---------------- Definições ---------------- */
function renderDefinicoes(){
  document.getElementById("content-definicoes").innerHTML = `
    <div class="page-head">
      <h1>Definições</h1>
      <p class="desc">Faça a gestão do seu perfil e das suas preferências de notificação.</p>
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
              <p class="hint" style="margin:8px 0 0;">PNG ou JPG. Sem foto, ficam as suas iniciais.</p>
            </div>
          </div>
          <div class="field"><label for="input-nome">Nome completo</label><input type="text" id="input-nome" autocomplete="name" value="${textoSeguro(estado.nome).replace(/"/g,"&quot;")}"></div>
          <div class="field" style="margin-bottom:0;"><label for="input-email-conta">Email</label><input type="email" id="input-email-conta" value="${textoSeguro(estado.email).replace(/"/g,"&quot;")}" disabled></div>
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
            <div><div class="t-title">Lembretes de aulas</div><div class="t-sub">Continuar de onde ficou</div></div>
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
            <div class="t-title">Precisa de ajuda?</div>
            <div class="t-sub">Fale diretamente com quem acompanha o seu percurso.</div>
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
