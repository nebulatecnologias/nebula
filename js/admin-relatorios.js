/* ============================================================
   Administração › Relatórios e Assistente
   Leitura do que já está no sistema — nada aqui altera conteúdo,
   com a exceção do que o Assistente escreve quando lho pedes.
   ============================================================ */

function alunosDoSistema(){ return DB.membros.filter(m => m.papel !== "administrador"); }
function alunosAtivos(){ return alunosDoSistema().filter(m => m.acesso === "ativo"); }

/* Receita mensal recorrente: só os planos cobrados ao mês contam;
   um pagamento único não se repete e ficaria a inflacionar o número. */
function receitaMensal(){
  return alunosAtivos().reduce((s,m) => {
    const p = planoPorId(m.planoId);
    return s + (p && p.periodo === "mês" ? (p.preco||0) : 0);
  }, 0);
}
function receitaUnica(){
  return alunosAtivos().reduce((s,m) => {
    const p = planoPorId(m.planoId);
    return s + (p && p.periodo !== "mês" ? (p.preco||0) : 0);
  }, 0);
}

function mediaAvaliacoesDoCurso(cursoId){
  const av = (DB.avaliacoes||[]).filter(a => a.cursoId === cursoId && !a.oculto);
  if(!av.length) return null;
  return av.reduce((s,a)=>s+a.estrelas,0) / av.length;
}

/* Agrupa uma lista por um campo e devolve as contagens, da maior para a menor. */
function contarPor(lista, campo){
  const mapa = {};
  lista.forEach(x => { const k = x[campo] || "—"; mapa[k] = (mapa[k]||0)+1; });
  return Object.entries(mapa).sort((a,b)=>b[1]-a[1]);
}

function barrasHTML(pares, total){
  if(!pares.length) return '<div class="empty-note">Sem dados.</div>';
  return pares.map(([rotulo, n]) => `
    <div class="barra-linha">
      <span class="barra-rotulo">${rotulo}</span>
      <div class="barra-track"><div class="barra-fill" style="width:${total?Math.round(n/total*100):0}%"></div></div>
      <span class="barra-valor">${n}</span>
    </div>`).join("");
}

function renderAdminRelatorios(){
  const alunos = alunosDoSistema();
  const ativos = alunosAtivos();
  const progressoMedio = alunos.length ? Math.round(alunos.reduce((s,m)=>s+(m.progresso||0),0)/alunos.length) : 0;
  const avaliacoes = (DB.avaliacoes||[]).filter(a=>!a.oculto);
  const notaMedia = avaliacoes.length ? (avaliacoes.reduce((s,a)=>s+a.estrelas,0)/avaliacoes.length) : null;
  const emRisco = alunos.filter(m => m.estagio==="risco" || m.estagio==="inativo" || m.acesso==="bloqueado");

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Relatórios",
      descricao: "O retrato da academia a partir do que está registado: alunos, planos, cursos e avaliações.",
      acaoRotulo: "Exportar CSV",
      acaoId: "btn-exportar-csv"
    })}

    <div class="stat-row">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.people}</div><div class="stat-label">Alunos ativos</div><div class="stat-value">${ativos.length}<span>de ${alunos.length} registados</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.card}</div><div class="stat-label">Receita recorrente</div><div class="stat-value" style="font-size:20px;">${formatarPreco(receitaMensal())}<span>por mês</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chart}</div><div class="stat-label">Progresso médio</div><div class="stat-value">${progressoMedio}%<span>nos cursos em curso</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.star}</div><div class="stat-label">Nota média das aulas</div><div class="stat-value">${notaMedia ? notaMedia.toFixed(1) : "—"}<span>${avaliacoes.length} avaliações</span></div></div>
    </div>

    <div class="section-title"><h2>Desempenho por curso</h2></div>
    <div class="card table-card">
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Curso</th><th>Categoria</th><th class="num">Inscritos</th><th class="num">Conclusão</th><th class="num">Nota das aulas</th><th class="num">Aulas</th></tr></thead>
          <tbody>
            ${DB.cursos.length ? DB.cursos.map(c => {
              const st = statsCurso(c.id);
              const cat = categoriaDe(c.categoria);
              const nota = mediaAvaliacoesDoCurso(c.id);
              const aulas = c.modulos.reduce((n,m)=>n+m.aulas.length,0);
              return `<tr class="${st.conclusao < 25 ? "tint-risco" : ""}">
                <td><div class="nome" style="font-weight:600;">${c.titulo}</div>${c.publicado===false?'<div class="sub-celula">Rascunho</div>':""}</td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td class="num">${st.inscritos}</td>
                <td class="num">${st.conclusao}%</td>
                <td class="num">${nota ? nota.toFixed(1) : "—"}</td>
                <td class="num">${aulas}</td>
              </tr>`;
            }).join("") : '<tr><td colspan="6"><div class="empty-note">Ainda não há cursos.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="relatorio-duplo">
      <div class="card">
        <div class="table-card-head"><h3>Alunos por plano</h3><span class="count">${formatarPreco(receitaUnica())} em pagamentos únicos</span></div>
        ${barrasHTML(contarPor(ativos.map(m=>({ plano:(planoPorId(m.planoId)||{nome:"Sem plano"}).nome })), "plano"), ativos.length)}
      </div>
      <div class="card">
        <div class="table-card-head"><h3>Por onde chegaram</h3><span class="count">${ativos.length} alunos</span></div>
        ${barrasHTML(contarPor(ativos, "origem"), ativos.length)}
      </div>
    </div>

    <div class="section-title"><h2>Alunos a precisar de atenção</h2></div>
    <div class="card table-card">
      <div class="table-card-head"><h3>Em risco ou parados</h3><span class="count">${emRisco.length} de ${alunos.length}</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Aluno</th><th>Curso</th><th class="num">Progresso</th><th>Último acesso</th><th>Estado</th></tr></thead>
          <tbody>
            ${emRisco.length ? emRisco.map(m => `
              <tr class="tint-risco">
                <td><div class="cell-user"><div class="avatar">${iniciais(m.nome)}</div><div class="meta"><div class="nome">${m.nome}</div><div class="sub">${m.email}</div></div></div></td>
                <td>${m.curso}</td>
                <td class="num">${m.progresso||0}%</td>
                <td><span class="sub-celula">${m.ultimoAcesso||"—"}</span></td>
                <td><span class="pill pill-inativo">${m.acesso==="bloqueado" ? "Bloqueado" : m.estagio}</span></td>
              </tr>`).join("") : '<tr><td colspan="5"><div class="empty-note">Ninguém em risco. Bom sinal.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-exportar-csv").addEventListener("click", exportarRelatorioCSV);
}

function exportarRelatorioCSV(){
  const linhas = [["Aluno","Email","Plano","Curso","Progresso","Estado","Origem","Ultimo acesso","Membro desde"]];
  alunosDoSistema().forEach(m => linhas.push([
    m.nome, m.email, (planoPorId(m.planoId)||{nome:""}).nome, m.curso,
    (m.progresso||0)+"%", m.acesso, m.origem||"", m.ultimoAcesso||"", m.membroDesde||""
  ]));
  /* Aspas duplicadas para o caso de um nome trazer vírgulas. */
  const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  descarregarFicheiro(`kingdom-academy-alunos-${new Date().toISOString().slice(0,10)}.csv`, "﻿"+csv, "text/csv");
  mostrarToast("Relatório exportado");
}

/* ============================================================
   Assistente
   Escreve rascunhos a partir do conteúdo que já está na academia.
   Não há ligação a um modelo externo: são textos montados aqui,
   para o administrador rever e aplicar.
   ============================================================ */
const TAREFAS_IA = [
  { id:"descricao",  rotulo:"Descrição de curso",        precisa:"curso" },
  { id:"boasvindas", rotulo:"Email de boas-vindas",      precisa:"curso" },
  { id:"post",       rotulo:"Publicação para a comunidade", precisa:"curso" },
  { id:"risco",      rotulo:"Mensagem para alunos parados", precisa:"nada" },
  { id:"evento",     rotulo:"Convite para o próximo evento", precisa:"nada" }
];

function gerarTexto(tarefa, cursoId){
  const escola = DB.aparencia.nomeEscola;
  const curso = cursoPorId(cursoId);
  const cat = curso ? categoriaDe(curso.categoria) : null;
  /* Aulas marcadas como fora da busca por IA não entram nos rascunhos. */
  const aulas = curso ? curso.modulos.flatMap(m=>m.aulas).filter(a=>!a.semBuscaIA) : [];
  /* Os módulos costumam chamar-se "Módulo 2: Estrutura" — dentro de uma
     frase só interessa a parte depois dos dois pontos. */
  const temas = curso ? curso.modulos.map(m => m.titulo.replace(/^M[óo]dulo\s*\d+\s*[:.\-–—]\s*/i, "")) : [];

  if(tarefa === "descricao" && curso){
    return `${curso.titulo} é o percurso de ${cat.nome.toLowerCase()} da ${escola} para quem quer sair da teoria e passar à prática.

São ${curso.modulos.length} módulos e ${aulas.length} aulas, organizados assim:
${temas.map((t,i)=>`${i+1}. ${t}`).join("\n")}

No fim, sais com ${temas[temas.length-1] ? temas[temas.length-1].toLowerCase() : "o trabalho feito"} — não com apontamentos.`;
  }

  if(tarefa === "boasvindas" && curso){
    return `Assunto: Bem-vindo(a) ao ${curso.titulo}

Olá {nome},

A tua inscrição no ${curso.titulo} está confirmada. O curso já está aberto na tua área de membros.

Começa pela primeira aula — ${aulas[0] ? aulas[0].titulo : "a aula de abertura"} — e faz uma por dia. São ${aulas.length} aulas, ou seja, ${Math.max(1, Math.ceil(aulas.length/5))} semanas a um ritmo confortável.

Qualquer dúvida, responde a este email.

${DB.config.certificado.assinaturaNome}
${escola}`;
  }

  if(tarefa === "post" && curso){
    return `📌 Novidade no ${curso.titulo}

Se ainda não começaste, esta é a semana. O módulo "${temas[0]||"de abertura"}" responde à pergunta que mais recebemos por aqui.

Quem já fez, conta nos comentários: qual foi a ideia que te mudou a forma de trabalhar?`;
  }

  if(tarefa === "risco"){
    const parados = alunosDoSistema().filter(m => (m.progresso||0) < 25 && m.acesso === "ativo");
    return `Assunto: Ficaste a meio — e isso tem solução

Olá {nome},

Reparámos que ainda não avançaste no teu curso. Acontece, e não é motivo para desistires.

Propomos uma coisa simples: 20 minutos, uma aula, hoje. Só isso. Amanhã fazes outra.

${parados.length ? `Estás entre ${parados.length} alunos que vamos acompanhar de perto esta semana.` : ""}

Se houver alguma coisa a travar-te, responde e resolvemos.

${DB.config.certificado.assinaturaNome}
${escola}`;
  }

  if(tarefa === "evento"){
    const ev = [...DB.eventos].sort((a,b)=>a.data.localeCompare(b.data))[0];
    if(!ev) return "Ainda não há eventos marcados. Cria um em Eventos e volta aqui para gerar o convite.";
    return `🔴 ${ev.titulo}

${ev.data.split("-").reverse().join("/")} às ${ev.hora}, ao vivo.

${ev.descricao || "Encontro ao vivo com a mentoria."}

Confirma a tua presença na aba Calendário da tua área de membros — e guarda o lembrete para não te escapar.`;
  }

  return "Escolhe um curso para gerar este texto.";
}

function renderAdminIA(){
  const tarefa = estado.tarefaIA || "descricao";
  const cursoId = estado.cursoIA || (DB.cursos[0]||{}).id;
  const def = TAREFAS_IA.find(t=>t.id===tarefa);
  const texto = gerarTexto(tarefa, cursoId);

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Assistente",
      descricao: "Rascunhos escritos a partir do conteúdo da tua academia — cursos, módulos, eventos e alunos — para reveres e usares."
    })}

    <div class="card aviso-honesto">
      ${ICONS.spark}
      <div>
        <strong>Como isto funciona nesta fase</strong>
        <p>Os textos são montados aqui, no teu browser, a partir do que já registaste. Não há ligação a um modelo de linguagem — quando ligarmos um, este mesmo ecrã passa a servir de interface.</p>
      </div>
    </div>

    <div class="card ia-controlos">
      <div class="field" style="margin:0;">
        <label>O que queres escrever</label>
        <div class="select-wrap" style="display:block;">
          <select id="sel-tarefa" style="width:100%;">
            ${TAREFAS_IA.map(t=>`<option value="${t.id}" ${t.id===tarefa?"selected":""}>${t.rotulo}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field" style="margin:0;${def.precisa==="curso"?"":"opacity:.45;pointer-events:none;"}">
        <label>Sobre que curso</label>
        <div class="select-wrap" style="display:block;">
          <select id="sel-curso-ia" style="width:100%;">
            ${DB.cursos.map(c=>`<option value="${c.id}" ${c.id===cursoId?"selected":""}>${c.titulo}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>

    <div class="card ia-resultado">
      <div class="table-card-head"><h3>${def.rotulo}</h3><span class="count">${texto.trim().split(/\s+/).length} palavras</span></div>
      <textarea id="texto-ia" rows="16">${texto}</textarea>
      <div class="linha-acoes">
        <button class="btn btn-secondary" id="btn-copiar-ia">Copiar</button>
        <button class="btn btn-secondary" id="btn-regerar-ia">Gerar de novo</button>
        ${tarefa==="descricao" ? '<button class="btn btn-primary" id="btn-aplicar-ia">Usar como descrição do curso</button>' : ""}
        ${tarefa==="post" ? '<button class="btn btn-primary" id="btn-publicar-ia">Publicar na comunidade</button>' : ""}
      </div>
    </div>
  `;

  document.getElementById("sel-tarefa").addEventListener("change", e => {
    estado.tarefaIA = e.target.value; renderAdminIA();
  });
  document.getElementById("sel-curso-ia").addEventListener("change", e => {
    estado.cursoIA = e.target.value; renderAdminIA();
  });
  document.getElementById("btn-regerar-ia").addEventListener("click", renderAdminIA);
  document.getElementById("btn-copiar-ia").addEventListener("click", () => {
    const campo = document.getElementById("texto-ia");
    campo.select();
    navigator.clipboard ? navigator.clipboard.writeText(campo.value) : document.execCommand("copy");
    mostrarToast("Texto copiado");
  });

  const aplicar = document.getElementById("btn-aplicar-ia");
  if(aplicar) aplicar.addEventListener("click", () => {
    const curso = cursoPorId(cursoId);
    if(!curso) return;
    curso.descricao = document.getElementById("texto-ia").value.trim();
    guardarDB();
    mostrarToast(`Descrição de "${curso.titulo}" atualizada`);
  });

  const publicar = document.getElementById("btn-publicar-ia");
  if(publicar) publicar.addEventListener("click", () => {
    DB.posts.unshift({
      id: novoId("post"),
      espacoId: (espacosAtivos()[0]||{id:"geral"}).id,
      autor: DB.aparencia.nomeEscola,
      iniciais: iniciais(DB.aparencia.nomeEscola),
      categoria: (cursoPorId(cursoId)||{}).categoria || null,
      tempo: "agora",
      texto: document.getElementById("texto-ia").value.trim(),
      likes: 0, comentarios: 0, fixado: true, oculto: false
    });
    guardarDB();
    mostrarToast("Publicado na comunidade, já fixado");
  });
}

registarViews({
  "admin-relatorios": renderAdminRelatorios,
  "admin-ia": renderAdminIA
});
