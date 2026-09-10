/* ============================================================
   Administração › Turmas e Certificados
   Turmas agrupam alunos num curso com datas próprias e dão acesso
   a esse curso. Certificados define a regra e o desenho do diploma.
   ============================================================ */

function turmaPorId(id){ return (DB.turmas||[]).find(t=>t.id===id); }
function opcoesMembros(){ return DB.membros.filter(m=>m.papel!=="administrador").map(m=>({ valor:m.id, rotulo:`${m.nome} · ${m.email}` })); }

/* Cursos a que um membro tem acesso por estar inscrito numa turma ativa. */
function cursosPorTurma(membro){
  if(!membro) return [];
  return (DB.turmas||[])
    .filter(t => t.ativa !== false && (t.membros||[]).includes(membro.id))
    .map(t => t.cursoId);
}

function turmasDoMembro(membro){
  if(!membro) return [];
  return (DB.turmas||[]).filter(t => (t.membros||[]).includes(membro.id));
}

/* ============================================================
   Turmas
   ============================================================ */
function renderAdminTurmas(){
  const turmas = DB.turmas || [];
  const ativas = turmas.filter(t=>t.ativa!==false).length;
  const inscritos = new Set(turmas.flatMap(t=>t.membros||[])).size;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Turmas",
      descricao: "Agrupa alunos num curso com datas próprias. Estar numa turma ativa dá acesso ao curso, mesmo fora do plano.",
      acaoRotulo: "Nova turma",
      acaoId: "btn-nova-turma"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.layers}</div><div class="stat-label">Turmas ativas</div><div class="stat-value">${ativas}<span>/ ${turmas.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.people}</div><div class="stat-label">Alunos em turmas</div><div class="stat-value">${inscritos}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Cursos com turma</div><div class="stat-value">${new Set(turmas.map(t=>t.cursoId)).size}</div></div>
    </div>
    <div class="card table-card">
      <div class="table-card-head"><h3>Todas as turmas</h3><span class="count">${turmas.length} registos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Turma</th><th>Curso</th><th>Período</th><th>Alunos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${turmas.length ? turmas.map(t => {
              const curso = cursoPorId(t.cursoId);
              return `<tr>
                <td><div class="nome" style="font-weight:600;">${t.nome}</div></td>
                <td>${curso ? curso.titulo : "<span class='sub-celula'>Curso removido</span>"}</td>
                <td>${t.inicio||"—"} <span class="sub-celula">até</span> ${t.fim||"—"}</td>
                <td class="num">${(t.membros||[]).length}</td>
                <td><span class="pill ${t.ativa!==false?"pill-ativo":"pill-inativo"}">${t.ativa!==false?"Ativa":"Encerrada"}</span></td>
                <td>${acoesLinha(t.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="6"><div class="empty-note">Ainda não há turmas.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nova-turma").addEventListener("click", () => editarTurma(null));
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarTurma(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarTurma(b.getAttribute("data-apagar"))));
}

function editarTurma(id){
  const turma = id ? turmaPorId(id) : null;
  abrirDrawer({
    titulo: turma ? "Editar turma" : "Nova turma",
    subtitulo: "Os alunos inscritos passam a ver este curso na sua área.",
    campos: [
      { nome:"nome", rotulo:"Nome da turma", tipo:"texto", obrigatorio:true, placeholder:"ex: Kingdom Tracktion · Turma 2" },
      { nome:"cursoId", rotulo:"Curso", tipo:"select", opcoes:opcoesCursos(), obrigatorio:true },
      { nome:"inicio", rotulo:"Início", tipo:"data" },
      { nome:"fim", rotulo:"Fim", tipo:"data" },
      { nome:"membros", rotulo:"Alunos inscritos", tipo:"checklist", opcoes:opcoesMembros(), dica:"Estar aqui dá acesso ao curso, mesmo que o plano não o inclua." },
      { nome:"ativa", rotulo:"Turma ativa", tipo:"toggle", padrao:true, dica:"Ao encerrar, os alunos perdem o acesso que vinha da turma." }
    ],
    valores: turma || { ativa:true, membros:[], cursoId:(DB.cursos[0]||{}).id },
    aoGuardar: v => {
      if(turma) Object.assign(turma, v);
      else DB.turmas.push({ id:novoId("turma"), ...v });
      guardarDB();
      renderAdminTurmas();
      mostrarToast(turma ? "Turma atualizada" : "Turma criada");
    }
  });
}

function apagarTurma(id){
  const turma = turmaPorId(id);
  confirmarAcao({
    titulo: "Apagar turma",
    mensagem: `"${turma.nome}" é removida. Os ${(turma.membros||[]).length} aluno(s) perdem o acesso que vinha desta turma.`,
    aoConfirmar: () => {
      DB.turmas = DB.turmas.filter(t=>t.id!==id);
      guardarDB();
      renderAdminTurmas();
      mostrarToast("Turma apagada");
    }
  });
}

/* ============================================================
   Certificados
   ============================================================ */
function renderAdminCertificados(){
  const aba = estado.abaCertificados || "modelo";
  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Certificados",
      descricao: "O diploma que o aluno descarrega, e a partir de que percentagem é emitido.",
      acaoRotulo: aba==="modelo" ? "Editar modelo" : null,
      acaoId: "btn-editar-modelo"
    })}
    <div class="filter-bar">
      <div class="segmented" id="cert-segmented">
        <button data-aba="modelo" class="${aba==="modelo"?"active":""}">Modelo</button>
        <button data-aba="emitidos" class="${aba==="emitidos"?"active":""}">Emitidos</button>
      </div>
    </div>
    ${aba==="modelo" ? modeloCertificadoHTML() : emitidosCertificadoHTML()}
  `;

  document.querySelectorAll("#cert-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaCertificados = b.getAttribute("data-aba");
    renderAdminCertificados();
  }));
  const btnModelo = document.getElementById("btn-editar-modelo");
  if(btnModelo) btnModelo.addEventListener("click", editarModeloCertificado);
  document.querySelectorAll("#content-admin [data-curso-cert]").forEach(t =>
    t.addEventListener("click", () => {
      const curso = cursoPorId(t.getAttribute("data-curso-cert"));
      curso.certificado = curso.certificado === false;
      guardarDB();
      renderAdminCertificados();
      mostrarToast(curso.certificado ? "Curso passa a emitir certificado" : "Curso deixa de emitir certificado");
    }));
}

function modeloCertificadoHTML(){
  const c = DB.config.certificado;
  return `
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.cert}</div><div class="stat-label">Emitido a partir de</div><div class="stat-value">${c.regraPct}<span>%</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Cursos que emitem</div><div class="stat-value">${DB.cursos.filter(cursoEmiteCertificado).length}<span>/ ${DB.cursos.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.people}</div><div class="stat-label">Assinado por</div><div class="stat-value" style="font-size:16px;">${c.assinaturaNome||"—"}</div></div>
    </div>

    <div class="section-title"><h2>Pré-visualização</h2><span class="count" style="font-size:12.5px;color:var(--text-faint);">Exatamente como o aluno o vê</span></div>
    <div class="cert-previa-wrap">
      <div class="modal-cert cert-previa">
        ${certificadoHTML({ nome:"Nome do Aluno", curso:(DB.cursos[0]||{}).titulo||"Curso", data:"10 de setembro de 2026" })}
      </div>
    </div>

    <div class="card table-card">
      <div class="table-card-head"><h3>Que cursos emitem certificado</h3><span class="count">${DB.cursos.length} cursos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Curso</th><th>Categoria</th><th>Emite certificado</th></tr></thead>
          <tbody>
            ${DB.cursos.map(curso => {
              const cat = categoriaDe(curso.categoria);
              return `<tr>
                <td><div class="nome" style="font-weight:600;">${curso.titulo}</div></td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td><div class="toggle ${cursoEmiteCertificado(curso)?"on":""}" data-curso-cert="${curso.id}" style="cursor:pointer;"><div class="knob"></div></div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function emitidosCertificadoHTML(){
  const regra = regraCertificado();
  const emitidos = DB.membros.filter(m => m.papel!=="administrador" && (m.progresso||0) >= regra);
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Certificados emitidos</h3>
        <span class="count">${emitidos.length} alunos chegaram aos ${regra}%</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Aluno</th><th>Curso</th><th>Progresso</th><th>Estado</th></tr></thead>
          <tbody>
            ${emitidos.length ? emitidos.map(m => `
              <tr class="tint-concluido">
                <td><div class="cell-user"><div class="avatar">${iniciais(m.nome)}</div><div class="meta"><div class="nome">${m.nome}</div><div class="sub">${m.email}</div></div></div></td>
                <td>${m.curso||"—"}</td>
                <td class="num">${m.progresso}%</td>
                <td><span class="pill pill-ativo">Emitido</span></td>
              </tr>
            `).join("") : `<tr><td colspan="4"><div class="empty-note">Ainda nenhum aluno atingiu os ${regra}% necessários.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function editarModeloCertificado(){
  const c = DB.config.certificado;
  abrirDrawer({
    titulo: "Modelo do certificado",
    subtitulo: "Muda o texto e a regra de emissão. A pré-visualização atualiza logo.",
    campos: [
      { nome:"regraPct", rotulo:"Emitir a partir de (%)", tipo:"numero", obrigatorio:true, dica:"Percentagem do curso que o aluno tem de concluir." },
      { nome:"titulo", rotulo:"Título", tipo:"texto", obrigatorio:true },
      { nome:"frase", rotulo:"Frase de conclusão", tipo:"texto", placeholder:"concluiu com sucesso o curso" },
      { nome:"rodape", rotulo:"Rodapé", tipo:"texto", placeholder:"na Kingdom Academy" },
      { nome:"assinaturaNome", rotulo:"Assinatura — nome", tipo:"texto", dica:"Deixa vazio para não mostrar assinatura." },
      { nome:"assinaturaCargo", rotulo:"Assinatura — cargo", tipo:"texto" }
    ],
    valores: c,
    aoGuardar: v => {
      v.regraPct = Math.min(100, Math.max(1, v.regraPct || 100));
      Object.assign(DB.config.certificado, v);
      guardarDB();
      renderAdminCertificados();
      mostrarToast("Modelo atualizado");
    }
  });
}

registarViews({
  "admin-turmas": renderAdminTurmas,
  "admin-certificados": renderAdminCertificados
});
