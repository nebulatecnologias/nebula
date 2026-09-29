/* ============================================================
   Administração › Comentários e Comunidades
   Modera o que os alunos escrevem nas aulas, e gere os grupos de cada
   programa (WhatsApp, Telegram) que o aluno vê na aba Comunidade.
   ============================================================ */

function tituloAula(aulaId){
  for(const c of DB.cursos){
    for(const m of c.modulos){
      const a = m.aulas.find(x=>x.id===aulaId);
      if(a) return `${c.titulo} · ${a.titulo}`;
    }
  }
  return "Aula removida";
}

function estrelasHTML(n){
  return `<span class="estrelas-mini">${[1,2,3,4,5].map(i=>`<span class="${i<=n?"cheia":""}">${ICONS.star}</span>`).join("")}</span>`;
}

/* ============================================================
   Comentários (avaliações das aulas + publicações)
   ============================================================ */
function renderAdminComentarios(){
  const aba = estado.abaComentarios || "avaliacoes";
  const avaliacoes = DB.avaliacoes || [];
  const comTexto = avaliacoes.filter(a => (a.comentario||"").trim());
  const media = avaliacoes.length
    ? (avaliacoes.reduce((s,a)=>s+(a.estrelas||0),0) / avaliacoes.length).toFixed(1)
    : "—";

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Comentários",
      descricao: "As avaliações que os alunos deixam nas aulas e as publicações da comunidade. Ocultar retira da vista do aluno sem apagar."
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.star.replace('<svg','<svg class="icon"')}</div><div class="stat-label">Média das aulas</div><div class="stat-value">${media}<span>/ 5</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chat}</div><div class="stat-label">Com comentário escrito</div><div class="stat-value">${comTexto.length}<span>/ ${avaliacoes.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.people}</div><div class="stat-label">Publicações</div><div class="stat-value">${(DB.posts||[]).length}</div></div>
    </div>
    <div class="filter-bar">
      <div class="segmented" id="coment-segmented">
        <button data-aba="avaliacoes" class="${aba==="avaliacoes"?"active":""}">Avaliações das aulas</button>
        <button data-aba="publicacoes" class="${aba==="publicacoes"?"active":""}">Publicações</button>
      </div>
    </div>
    ${aba==="avaliacoes" ? tabelaAvaliacoesHTML() : tabelaPublicacoesHTML()}
  `;

  document.querySelectorAll("#coment-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaComentarios = b.getAttribute("data-aba");
    renderAdminComentarios();
  }));
  ligarAcoesModeracao();
}

function tabelaAvaliacoesHTML(){
  const lista = [...(DB.avaliacoes||[])].sort((a,b) => (b.data||"").localeCompare(a.data||""));
  return `
    <div class="card table-card">
      <div class="table-card-head"><h3>Avaliações das aulas</h3><span class="count">${lista.length} registos</span></div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Aluno</th><th>Aula</th><th>Nota</th><th>Comentário</th><th>Data</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(a => `
              <tr class="${a.oculto?"tint-risco":""}">
                <td><div class="cell-user"><div class="avatar">${iniciais(a.nome||"?")}</div><div class="meta"><div class="nome">${a.nome||"—"}</div></div></div></td>
                <td>${tituloAula(a.aulaId)}</td>
                <td>${estrelasHTML(a.estrelas||0)}</td>
                <td class="celula-texto">${(a.comentario||"").trim() || "<span class='sub-celula'>Sem comentário</span>"}</td>
                <td>${a.data||"—"}</td>
                <td><span class="pill ${a.oculto?"pill-inativo":"pill-ativo"}">${a.oculto?"Oculta":"Visível"}</span></td>
                <td><div class="acoes-linha">
                  <button class="btn-icone" data-ocultar-av="${a.id}" title="${a.oculto?"Mostrar":"Ocultar"}">${a.oculto?ICONS.star.replace('<svg','<svg class="icon icon-sm"'):'<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.3 3.4M6.2 6.7A11.6 11.6 0 0 0 3 12c0 2.5 4 7 9 7a9.9 9.9 0 0 0 3.5-.6"/></svg>'}</button>
                  <button class="btn-icone perigo" data-apagar-av="${a.id}" title="Apagar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
                </div></td>
              </tr>
            `).join("") : `<tr><td colspan="7"><div class="empty-note">Ainda não há avaliações. Aparecem aqui assim que um aluno avaliar uma aula.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tabelaPublicacoesHTML(){
  const lista = DB.posts || [];
  return `
    <div class="card table-card">
      <div class="table-card-head"><h3>Publicações do chat antigo</h3><span class="count">${lista.length} registos</span></div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Autor</th><th>Espaço</th><th>Publicação</th><th>Reações</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(p => {
              const esp = espacoPorId(p.espacoId);
              return `<tr class="${p.oculto?"tint-risco":(p.fixado?"tint-concluido":"")}">
                <td><div class="cell-user"><div class="avatar">${p.iniciais||iniciais(p.autor||"?")}</div><div class="meta"><div class="nome">${p.autor}</div><div class="sub">${p.tempo||""}</div></div></div></td>
                <td><span class="cat-tag" style="--c:${esp.cor}">${esp.nome}</span></td>
                <td class="celula-texto">${p.texto}</td>
                <td class="num">${p.likes||0}</td>
                <td><span class="pill ${p.oculto?"pill-inativo":"pill-ativo"}">${p.oculto?"Oculta":"Visível"}</span>${p.fixado?' <span class="pill pill-morno">Fixada</span>':""}</td>
                <td><div class="acoes-linha">
                  <button class="btn-icone" data-fixar="${p.id}" title="${p.fixado?"Desafixar":"Fixar no topo"}"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="${p.fixado?"currentColor":"none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3-1-7Z"/></svg></button>
                  <button class="btn-icone" data-ocultar-post="${p.id}" title="${p.oculto?"Mostrar":"Ocultar"}"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.3 3.4M6.2 6.7A11.6 11.6 0 0 0 3 12c0 2.5 4 7 9 7a9.9 9.9 0 0 0 3.5-.6"/></svg></button>
                  <button class="btn-icone perigo" data-apagar-post="${p.id}" title="Apagar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
                </div></td>
              </tr>`;
            }).join("") : `<tr><td colspan="6"><div class="empty-note">Ainda não há publicações.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function ligarAcoesModeracao(){
  document.querySelectorAll("#content-admin [data-ocultar-av]").forEach(b => b.addEventListener("click", () => {
    const a = DB.avaliacoes.find(x=>x.id===b.getAttribute("data-ocultar-av"));
    a.oculto = !a.oculto;
    salvar("avaliacao", a); renderAdminComentarios();
    mostrarToast(a.oculto ? "Avaliação ocultada" : "Avaliação visível outra vez");
  }));
  document.querySelectorAll("#content-admin [data-apagar-av]").forEach(b => b.addEventListener("click", () => {
    const a = DB.avaliacoes.find(x=>x.id===b.getAttribute("data-apagar-av"));
    confirmarAcao({
      titulo: "Apagar avaliação",
      mensagem: `A avaliação de ${a.nome} desaparece definitivamente.`,
      aoConfirmar: () => {
        DB.avaliacoes = DB.avaliacoes.filter(x=>x.id!==a.id);
        remover("avaliacao", a.id); renderAdminComentarios(); mostrarToast("Avaliação apagada");
      }
    });
  }));
  document.querySelectorAll("#content-admin [data-fixar]").forEach(b => b.addEventListener("click", () => {
    const p = DB.posts.find(x=>String(x.id)===b.getAttribute("data-fixar"));
    p.fixado = !p.fixado;
    salvar("mensagem", p); renderAdminComentarios();
    mostrarToast(p.fixado ? "Publicação fixada no topo" : "Publicação desafixada");
  }));
  document.querySelectorAll("#content-admin [data-ocultar-post]").forEach(b => b.addEventListener("click", () => {
    const p = DB.posts.find(x=>String(x.id)===b.getAttribute("data-ocultar-post"));
    p.oculto = !p.oculto;
    salvar("mensagem", p); renderAdminComentarios();
    mostrarToast(p.oculto ? "Publicação ocultada" : "Publicação visível outra vez");
  }));
  document.querySelectorAll("#content-admin [data-apagar-post]").forEach(b => b.addEventListener("click", () => {
    const p = DB.posts.find(x=>String(x.id)===b.getAttribute("data-apagar-post"));
    confirmarAcao({
      titulo: "Apagar publicação",
      mensagem: `A publicação de ${p.autor} desaparece da comunidade.`,
      aoConfirmar: () => {
        DB.posts = DB.posts.filter(x=>x.id!==p.id);
        remover("mensagem", p.id); renderAdminComentarios(); mostrarToast("Publicação apagada");
      }
    });
  }));
}

/* ============================================================
   Comunidades (espaços do feed)
   ============================================================ */
/* ============================================================
   Comunidades (fase 5, pedido do Shelton a 27/09/2026)
   Os grupos de cada programa, fora da Academia: WhatsApp, Telegram ou
   outro. O chat interno saiu; as mensagens antigas ficam guardadas.

   Cada grupo pertence a uma ou mais ofertas, e só quem tem inscrição numa
   delas o vê — a base é que o garante, porque o link de um grupo deixa
   entrar quem o tiver. «Todos os alunos» abre-o a quem tem conta activa.
   ============================================================ */
const CANAIS_ADMIN = [
  { valor:"whatsapp", rotulo:"WhatsApp" },
  { valor:"telegram", rotulo:"Telegram" },
  { valor:"outro",    rotulo:"Outro" }
];

function nomesDasOfertas(ids){
  return (ids || []).map(id => (DB.ofertas || []).find(o => String(o.id) === String(id)))
    .filter(Boolean).map(o => o.nome);
}

function renderAdminComunidades(){
  const lista = (DB.comunidades || []).slice().sort((x, y) => (x.ordem || 0) - (y.ordem || 0));
  const ativas = lista.filter(c => c.ativa !== false).length;
  const semPublico = lista.filter(c => c.ativa !== false && !c.todos && !(c.ofertas || []).length).length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Comunidades",
      descricao: "Os grupos que o aluno encontra na aba Comunidade. Cada um pertence a uma ou mais ofertas: só quem está inscrito nelas o vê, e só essa pessoa recebe o link.",
      acaoRotulo: "Nova comunidade",
      acaoId: "btn-nova-comunidade"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.globe}</div><div class="stat-label">Comunidades ativas</div><div class="stat-value">${ativas}<span>/ ${lista.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.people}</div><div class="stat-label">Abertas a todos os alunos</div><div class="stat-value">${lista.filter(c => c.todos && c.ativa !== false).length}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.gear}</div><div class="stat-label">Sem ninguém que as veja</div><div class="stat-value">${semPublico}</div></div>
    </div>
    <div class="card table-card">
      <div class="table-card-head"><h3>Grupos</h3><span class="count">${lista.length} ${lista.length === 1 ? "grupo" : "grupos"}</span></div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Comunidade</th><th>Canal</th><th>Quem vê</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(linhaDaComunidade).join("")
              : `<tr><td colspan="5"><div class="empty-note">Ainda não há comunidades. Cria uma para cada grupo de WhatsApp ou Telegram dos teus programas.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nova-comunidade").addEventListener("click", () => editarComunidade(null));
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarComunidade(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarComunidade(b.getAttribute("data-apagar"))));
}

function linhaDaComunidade(c){
  const ofertas = nomesDasOfertas(c.ofertas);
  const quem = c.todos ? "Todos os alunos"
    : ofertas.length ? ofertas.map(textoSeguro).join(", ")
    : `<span class="erro">Ninguém: escolhe uma oferta ou abre a todos</span>`;
  const canal = (CANAIS_ADMIN.find(x => x.valor === c.canal) || CANAIS_ADMIN[2]).rotulo;
  return `<tr class="${c.ativa !== false && !c.todos && !ofertas.length ? "tint-risco" : ""}">
    <td><div style="font-weight:500">${textoSeguro(c.nome)}</div><div class="sub-celula">${textoSeguro(c.descricao || "")}</div></td>
    <td>${canal}</td>
    <td>${quem}</td>
    <td><span class="pill ${c.ativa !== false ? "pill-ativo" : "pill-inativo"}">${c.ativa !== false ? "Ativa" : "Escondida"}</span></td>
    <td>${acoesLinha(c.id)}</td>
  </tr>`;
}

function editarComunidade(id){
  const c = id ? DB.comunidades.find(x => x.id === id) : null;
  const ofertas = (DB.ofertas || []).map(o => ({ valor:String(o.id), rotulo:o.nome }));
  abrirDrawer({
    titulo: c ? "Editar comunidade" : "Nova comunidade",
    subtitulo: "Aparece na aba Comunidade de quem está inscrito nas ofertas escolhidas.",
    campos: [
      { nome:"nome", rotulo:"Nome do grupo", tipo:"texto", obrigatorio:true, placeholder:"ex: Kingdom Founders · Turma 3" },
      { nome:"descricao", rotulo:"Descrição", tipo:"textarea", placeholder:"Uma linha a dizer para que serve o grupo." },
      { nome:"canal", rotulo:"Canal", tipo:"select", opcoes:CANAIS_ADMIN },
      { nome:"link", rotulo:"Link de convite", tipo:"url", obrigatorio:true, placeholder:"https://chat.whatsapp.com/…",
        dica:"Só chega a quem tem inscrição numa das ofertas abaixo." },
      { nome:"imagem", rotulo:"Fotografia do grupo", tipo:"imagem", pasta:"comunidades", dica:"Quadrada. Sem ela, aparecem as iniciais." },
      { nome:"ofertas", rotulo:"Ofertas", tipo:"checklist", opcoes:ofertas,
        dica: ofertas.length ? "Quem está inscrito numa delas vê este grupo." : "Não há ofertas para escolher." },
      { nome:"todos", rotulo:"Aberta a todos os alunos", tipo:"toggle", dica:"Qualquer aluno com conta activa, com ou sem oferta." },
      { nome:"ativa", rotulo:"Comunidade ativa", tipo:"toggle", padrao:true }
    ],
    valores: c || { canal:"whatsapp", ativa:true, todos:false, ofertas:[] },
    aoGuardar: v => {
      const link = linkExterno(v.link);
      if(!/^https:\/\//i.test(link)){ mostrarToast("O link tem de começar por https://"); return false; }
      const alvo = c || { id:novoId("com"), ordem:(DB.comunidades || []).length + 1 };
      Object.assign(alvo, v, { link });
      if(!c){ DB.comunidades = DB.comunidades || []; DB.comunidades.push(alvo); }
      salvar("comunidade", alvo);
      renderAdminComunidades();
      mostrarToast(!v.todos && !(v.ofertas || []).length
        ? "Guardada, mas nenhum aluno a vê: falta escolher uma oferta"
        : (c ? "Comunidade atualizada" : "Comunidade criada"));
    }
  });
}

function apagarComunidade(id){
  const c = DB.comunidades.find(x => x.id === id);
  if(!c) return;
  confirmarAcao({
    titulo: "Apagar comunidade",
    mensagem: `"${textoSeguro(c.nome)}" deixa de aparecer aos alunos. O grupo em si continua a existir no ${(CANAIS_ADMIN.find(x => x.valor === c.canal) || CANAIS_ADMIN[2]).rotulo}.`,
    aoConfirmar: () => {
      DB.comunidades = DB.comunidades.filter(x => x.id !== id);
      remover("comunidade", id);
      renderAdminComunidades();
      mostrarToast("Comunidade apagada");
    }
  });
}

registarViews({
  "admin-comentarios": renderAdminComentarios,
  "admin-comunidades": renderAdminComunidades
});
