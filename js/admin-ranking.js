/* ============================================================
   Administração › Ranking
   A gamificação que o aluno vê em Conquistas: XP, níveis e emblemas.
   ============================================================ */

const TIPOS_REGRA = [
  { valor:"aulas",       rotulo:"Aulas concluídas",                sufixo:"aula(s)" },
  { valor:"modulos",     rotulo:"Módulos concluídos por inteiro",  sufixo:"módulo(s)" },
  { valor:"cursos",      rotulo:"Cursos concluídos",               sufixo:"curso(s)" },
  { valor:"percentagem", rotulo:"Percentagem do progresso geral",  sufixo:"%" },
  { valor:"categorias",  rotulo:"Áreas de conhecimento diferentes", sufixo:"área(s)" },
  { valor:"sequencia",   rotulo:"Dias seguidos de estudo",         sufixo:"dia(s)" },
  { valor:"manual",      rotulo:"Atribuição manual (por agora, bloqueada)", sufixo:"" }
];

function descreverRegra(regra){
  const tipo = TIPOS_REGRA.find(t=>t.valor===(regra||{}).tipo);
  if(!tipo) return "—";
  if(tipo.valor==="manual") return tipo.rotulo;
  return `${regra.valor} ${tipo.sufixo}`;
}

function renderAdminRanking(){
  const aba = estado.abaRanking || "emblemas";
  const g = DB.config.gamificacao;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Ranking",
      descricao: "Quanto vale cada aula, quando sobe de nível e que emblemas os alunos podem desbloquear.",
      acaoRotulo: aba==="emblemas" ? "Novo emblema" : null,
      acaoId: "btn-novo-emblema"
    })}
    <div class="stat-row tres">
      <div class="card stat-card" style="cursor:pointer;" id="card-xp"><div class="stat-icon accent">${ICONS.spark}</div><div class="stat-label">XP por aula</div><div class="stat-value">${g.xpPorAula}</div></div>
      <div class="card stat-card" style="cursor:pointer;" id="card-nivel"><div class="stat-icon">${ICONS.flag}</div><div class="stat-label">XP por nível</div><div class="stat-value">${g.xpPorNivel}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.trophy}</div><div class="stat-label">Emblemas</div><div class="stat-value">${(DB.conquistas||[]).length}</div></div>
    </div>
    <div class="filter-bar">
      <div class="segmented" id="ranking-segmented">
        <button data-aba="emblemas" class="${aba==="emblemas"?"active":""}">Emblemas</button>
        <button data-aba="lideres" class="${aba==="lideres"?"active":""}">Tabela de líderes</button>
      </div>
    </div>
    ${aba==="emblemas" ? tabelaEmblemasHTML() : tabelaLideresHTML()}
  `;

  document.querySelectorAll("#ranking-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaRanking = b.getAttribute("data-aba");
    renderAdminRanking();
  }));
  document.getElementById("card-xp").addEventListener("click", editarGamificacao);
  document.getElementById("card-nivel").addEventListener("click", editarGamificacao);
  const btnNovo = document.getElementById("btn-novo-emblema");
  if(btnNovo) btnNovo.addEventListener("click", () => editarEmblema(null));
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarEmblema(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarEmblema(b.getAttribute("data-apagar"))));
  document.querySelectorAll("#content-admin [data-mover-emblema]").forEach(b =>
    b.addEventListener("click", () => {
      mover(DB.conquistas, DB.conquistas.findIndex(x=>x.id===b.getAttribute("data-mover-emblema")), Number(b.getAttribute("data-dir")));
      guardarDB();
      renderAdminRanking();
    }));
}

function tabelaEmblemasHTML(){
  const lista = DB.conquistas || [];
  return `
    <div class="card table-card">
      <div class="table-card-head"><h3>Emblemas</h3><span class="count">${lista.length} registos · a ordem é a que o aluno vê</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Emblema</th><th>Desbloqueia com</th><th>Ordem</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map((b, i) => `
              <tr>
                <td><div class="cell-user">
                  <div class="badge-icon-sm">${ICONS_BADGE[i % ICONS_BADGE.length]}</div>
                  <div class="meta"><div class="nome">${b.titulo}</div><div class="sub">${b.desc||""}</div></div>
                </div></td>
                <td>${descreverRegra(b.regra)}</td>
                <td><div class="acoes-linha">
                  <button class="btn-icone" data-mover-emblema="${b.id}" data-dir="-1" ${i===0?"disabled":""} title="Subir"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg></button>
                  <button class="btn-icone" data-mover-emblema="${b.id}" data-dir="1" ${i===lista.length-1?"disabled":""} title="Descer"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>
                </div></td>
                <td>${acoesLinha(b.id)}</td>
              </tr>
            `).join("") : `<tr><td colspan="4"><div class="empty-note">Ainda não há emblemas.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tabelaLideresHTML(){
  const g = DB.config.gamificacao;
  const alunos = DB.membros
    .filter(m => m.papel !== "administrador")
    .map(m => {
      const aulas = Math.round(((m.progresso||0)/100) * 6);   /* estimativa a partir do progresso registado */
      const xp = aulas * g.xpPorAula;
      return { ...m, xp, nivel: Math.floor(xp/g.xpPorNivel)+1 };
    })
    .sort((a,b) => b.xp - a.xp);

  return `
    <div class="card table-card">
      <div class="table-card-head"><h3>Tabela de líderes</h3><span class="count">${alunos.length} alunos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>#</th><th>Aluno</th><th>Progresso</th><th>XP</th><th>Nível</th></tr></thead>
          <tbody>
            ${alunos.map((m, i) => `
              <tr class="${i===0?"tint-concluido":""}">
                <td class="num" style="width:40px;">${i+1}</td>
                <td><div class="cell-user"><div class="avatar">${iniciais(m.nome)}</div><div class="meta"><div class="nome">${m.nome}</div><div class="sub">${m.curso||"—"}</div></div></div></td>
                <td><div class="mini-progress"><div class="progress-track thin"><div class="progress-fill mini" style="width:${m.progresso||0}%"></div></div><span>${m.progresso||0}%</span></div></td>
                <td class="num">${m.xp}</td>
                <td class="num">Nv.${m.nivel}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function editarGamificacao(){
  abrirDrawer({
    titulo: "Pontuação e níveis",
    subtitulo: "Muda o que o aluno vê na página Conquistas.",
    campos: [
      { nome:"xpPorAula", rotulo:"XP por aula concluída", tipo:"numero", obrigatorio:true },
      { nome:"xpPorNivel", rotulo:"XP necessário por nível", tipo:"numero", obrigatorio:true, dica:"Quanto maior, mais devagar os alunos sobem de nível." }
    ],
    valores: DB.config.gamificacao,
    aoGuardar: v => {
      DB.config.gamificacao.xpPorAula = Math.max(1, v.xpPorAula || 50);
      DB.config.gamificacao.xpPorNivel = Math.max(10, v.xpPorNivel || 500);
      guardarDB();
      renderAdminRanking();
      mostrarToast("Pontuação atualizada");
    }
  });
}

function editarEmblema(id){
  const emblema = id ? DB.conquistas.find(b=>b.id===id) : null;
  abrirDrawer({
    titulo: emblema ? "Editar emblema" : "Novo emblema",
    subtitulo: "Aparece na página Conquistas e desbloqueia sozinho quando a regra é cumprida.",
    campos: [
      { nome:"titulo", rotulo:"Nome do emblema", tipo:"texto", obrigatorio:true, placeholder:"ex: Primeiro Passo" },
      { nome:"desc", rotulo:"Descrição", tipo:"texto", placeholder:"O que o aluno fez para o merecer." },
      { nome:"tipo", rotulo:"Desbloqueia com", tipo:"select", opcoes:TIPOS_REGRA },
      { nome:"valor", rotulo:"Quantidade", tipo:"numero", dica:"Número de aulas, cursos, dias ou a percentagem, conforme a regra." }
    ],
    valores: emblema
      ? { titulo:emblema.titulo, desc:emblema.desc, tipo:(emblema.regra||{}).tipo, valor:(emblema.regra||{}).valor }
      : { tipo:"aulas", valor:1 },
    aoGuardar: v => {
      const dados = { titulo:v.titulo, desc:v.desc, regra:{ tipo:v.tipo, valor:v.valor||0 } };
      if(emblema) Object.assign(emblema, dados);
      else DB.conquistas.push({ id:novoId("emb"), ...dados });
      guardarDB();
      renderAdminRanking();
      mostrarToast(emblema ? "Emblema atualizado" : "Emblema criado");
    }
  });
}

function apagarEmblema(id){
  const emblema = DB.conquistas.find(b=>b.id===id);
  confirmarAcao({
    titulo: "Apagar emblema",
    mensagem: `"${emblema.titulo}" desaparece da página Conquistas, mesmo para quem já o tinha.`,
    aoConfirmar: () => {
      DB.conquistas = DB.conquistas.filter(b=>b.id!==id);
      guardarDB();
      renderAdminRanking();
      mostrarToast("Emblema apagado");
    }
  });
}

registarViews({ "admin-ranking": renderAdminRanking });
