/* ============================================================
   Administração › Comentários e Comunidades
   Modera o que os alunos escrevem e organiza os espaços do feed.
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
      <div class="table-wrap">
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
      <div class="table-card-head"><h3>Publicações da comunidade</h3><span class="count">${lista.length} registos</span></div>
      <div class="table-wrap">
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
function renderAdminComunidades(){
  const espacos = DB.espacos || [];

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Comunidades",
      descricao: "Os espaços que o aluno encontra na aba Comunidade. Podes reservar um deles só para avisos da equipa.",
      acaoRotulo: "Novo espaço",
      acaoId: "btn-novo-espaco"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.globe}</div><div class="stat-label">Espaços ativos</div><div class="stat-value">${espacos.filter(e=>e.ativo!==false).length}<span>/ ${espacos.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chat}</div><div class="stat-label">Publicações visíveis</div><div class="stat-value">${postsVisiveis().length}</div></div>
      <div class="card stat-card" style="cursor:pointer;" id="card-publicar"><div class="stat-icon">${ICONS.spark}</div><div class="stat-label">Comunicar</div><div class="stat-value" style="font-size:17px;">Publicar como Academia</div></div>
    </div>
    <div class="card table-card">
      <div class="table-card-head"><h3>Espaços</h3><span class="count">${espacos.length} registos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Espaço</th><th>Publicações</th><th>Quem publica</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${espacos.length ? espacos.map(e => `
              <tr>
                <td><span class="cat-tag" style="--c:${e.cor}">${e.nome}</span><div class="sub-celula">${e.descricao||""}</div></td>
                <td class="num">${(DB.posts||[]).filter(p=>(p.espacoId||"geral")===e.id).length}</td>
                <td>${e.soAdminPublica ? "Só a equipa" : "Todos os alunos"}</td>
                <td><span class="pill ${e.ativo!==false?"pill-ativo":"pill-inativo"}">${e.ativo!==false?"Ativo":"Escondido"}</span></td>
                <td>${acoesLinha(e.id)}</td>
              </tr>
            `).join("") : `<tr><td colspan="5"><div class="empty-note">Ainda não há espaços.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-novo-espaco").addEventListener("click", () => editarEspaco(null));
  document.getElementById("card-publicar").addEventListener("click", publicarComoAcademia);
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarEspaco(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarEspaco(b.getAttribute("data-apagar"))));
}

function editarEspaco(id){
  const espaco = id ? DB.espacos.find(e=>e.id===id) : null;
  abrirDrawer({
    titulo: espaco ? "Editar espaço" : "Novo espaço",
    subtitulo: "Aparece como filtro na aba Comunidade do aluno.",
    campos: [
      { nome:"nome", rotulo:"Nome do espaço", tipo:"texto", obrigatorio:true, placeholder:"ex: Vitórias" },
      { nome:"descricao", rotulo:"Descrição", tipo:"textarea", placeholder:"Aparece por baixo do título, a explicar o espaço." },
      { nome:"cor", rotulo:"Cor", tipo:"cor", padrao:"#f4621d" },
      { nome:"soAdminPublica", rotulo:"Só a equipa publica", tipo:"toggle", dica:"Os alunos leem, mas não escrevem neste espaço." },
      { nome:"ativo", rotulo:"Espaço ativo", tipo:"toggle", padrao:true }
    ],
    valores: espaco || { ativo:true, soAdminPublica:false, cor:"#f4621d" },
    aoGuardar: v => {
      const alvo = espaco || { id:novoId("esp"), ordem:DB.espacos.length + 1 };
      Object.assign(alvo, v);
      if(!espaco) DB.espacos.push(alvo);
      salvar("espaco", alvo);
      renderAdminComunidades();
      mostrarToast(espaco ? "Espaço atualizado" : "Espaço criado");
    }
  });
}

function apagarEspaco(id){
  const espaco = DB.espacos.find(e=>e.id===id);
  const posts = (DB.posts||[]).filter(p=>(p.espacoId||"geral")===id).length;
  if(posts){ mostrarToast(`Move ou apaga primeiro as ${posts} publicações deste espaço`); return; }
  confirmarAcao({
    titulo: "Apagar espaço",
    mensagem: `"${espaco.nome}" deixa de aparecer na Comunidade.`,
    aoConfirmar: () => {
      DB.espacos = DB.espacos.filter(e=>e.id!==id);
      remover("espaco", id);
      renderAdminComunidades();
      mostrarToast("Espaço apagado");
    }
  });
}

function publicarComoAcademia(){
  abrirDrawer({
    titulo: "Publicar como Academia",
    subtitulo: "A publicação aparece assinada pela academia, e pode ficar fixada no topo.",
    campos: [
      { nome:"texto", rotulo:"Mensagem", tipo:"textarea", obrigatorio:true, placeholder:"O que queres comunicar aos alunos?" },
      { nome:"espacoId", rotulo:"Espaço", tipo:"select", opcoes:(DB.espacos||[]).map(e=>({valor:e.id, rotulo:e.nome})) },
      { nome:"fixado", rotulo:"Fixar no topo", tipo:"toggle", padrao:true }
    ],
    valores: { espacoId:"avisos", fixado:true },
    textoGuardar: "Publicar",
    aoGuardar: v => {
      const mensagem = {
        id: novoId("post"),
        autor: DB.aparencia.nomeEscola,
        iniciais: iniciais(DB.aparencia.nomeEscola),
        tempo: "agora", categoria: null,
        espacoId: v.espacoId, fixado: v.fixado, oculto: false,
        texto: v.texto, likes: 0, curtido: false
      };
      DB.posts.unshift(mensagem);
      salvar("mensagem", mensagem);
      renderAdminComunidades();
      mostrarToast("Publicado na comunidade");
    }
  });
}

registarViews({
  "admin-comentarios": renderAdminComentarios,
  "admin-comunidades": renderAdminComunidades
});
