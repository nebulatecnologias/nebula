/* ============================================================
   Administração › Ofertas
   O que se vende, e como aparece ao aluno que ainda não tem acesso.
   ============================================================ */

function ofertasAtivas(){ return (DB.ofertas||[]).filter(o=>o.ativa!==false); }

/* A oferta que desbloqueia um curso, através do plano que concede. */
function ofertaParaCurso(cursoId){
  return ofertasAtivas().find(o => {
    const plano = planoPorId(o.planoId);
    return plano && (plano.acessoTotal || (plano.cursos||[]).includes(cursoId));
  }) || ofertasAtivas().find(o => o.destaque) || ofertasAtivas()[0];
}

/* Cursos publicados que este aluno ainda não pode abrir. */
function cursosBloqueados(){
  const abertos = new Set(cursosVisiveis().map(c=>c.id));
  return DB.cursos.filter(c => c.publicado !== false && !abertos.has(c.id));
}

function renderAdminOfertas(){
  const ofertas = DB.ofertas || [];

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Ofertas",
      descricao: "O que vendes e o plano que cada oferta desbloqueia. Aparecem ao aluno nos cursos a que ainda não tem acesso.",
      acaoRotulo: "Nova oferta",
      acaoId: "btn-nova-oferta"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.tag}</div><div class="stat-label">Ofertas ativas</div><div class="stat-value">${ofertasAtivas().length}<span>/ ${ofertas.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.card}</div><div class="stat-label">Planos ligados</div><div class="stat-value">${new Set(ofertas.map(o=>o.planoId)).size}</div></div>
      <div class="card stat-card" style="cursor:pointer;" id="card-bloqueados">
        <div class="stat-icon">${ICONS.book}</div>
        <div class="stat-label">Mostrar cursos bloqueados</div>
        <div class="stat-value" style="font-size:17px;">${DB.config.mostrarCursosBloqueados!==false ? "Sim, com oferta" : "Não mostrar"}</div>
      </div>
    </div>
    <div class="card table-card">
      <div class="table-card-head"><h3>Ofertas</h3><span class="count">${ofertas.length} registos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Oferta</th><th>Preço</th><th>Desbloqueia</th><th>Destino</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${ofertas.length ? ofertas.map(o => {
              const plano = planoPorId(o.planoId);
              return `<tr class="${o.destaque?"tint-concluido":""}">
                <td><div class="nome" style="font-weight:600;">${o.nome}${o.destaque?' <span class="pill pill-morno">Destaque</span>':""}</div><div class="sub-celula">${o.descricao||""}</div></td>
                <td class="num">${formatarPreco(o.preco)}${o.precoAntes ? `<div class="sub-celula" style="text-decoration:line-through;">${formatarPreco(o.precoAntes)}</div>` : ""}</td>
                <td>${plano ? plano.nome : "<span class='sub-celula'>Sem plano</span>"}</td>
                <td><span class="sub-celula">${o.link && o.link!=="#" ? o.link : "Sem link"}</span></td>
                <td><span class="pill ${o.ativa!==false?"pill-ativo":"pill-inativo"}">${o.ativa!==false?"Ativa":"Inativa"}</span></td>
                <td>${acoesLinha(o.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="6"><div class="empty-note">Ainda não há ofertas.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-nova-oferta").addEventListener("click", () => editarOferta(null));
  document.getElementById("card-bloqueados").addEventListener("click", () => {
    DB.config.mostrarCursosBloqueados = DB.config.mostrarCursosBloqueados === false;
    guardarDB();
    renderAdminOfertas();
    mostrarToast(DB.config.mostrarCursosBloqueados
      ? "Os alunos passam a ver os cursos bloqueados, com a oferta"
      : "Os cursos bloqueados deixam de aparecer aos alunos");
  });
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarOferta(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarOferta(b.getAttribute("data-apagar"))));
}

function editarOferta(id){
  const oferta = id ? DB.ofertas.find(o=>o.id===id) : null;
  abrirDrawer({
    titulo: oferta ? "Editar oferta" : "Nova oferta",
    subtitulo: "O aluno vê-a quando encontra um curso que o plano dele não inclui.",
    campos: [
      { nome:"nome", rotulo:"Nome da oferta", tipo:"texto", obrigatorio:true, placeholder:"ex: Kingdom All Access" },
      { nome:"descricao", rotulo:"Descrição", tipo:"textarea", placeholder:"O que está incluído." },
      { nome:"preco", rotulo:"Preço (MT)", tipo:"numero" },
      { nome:"precoAntes", rotulo:"Preço antes (MT)", tipo:"numero", dica:"Opcional. Aparece riscado ao lado do preço." },
      { nome:"periodo", rotulo:"Período", tipo:"select", opcoes:[{valor:"mês",rotulo:"Mensal"},{valor:"ano",rotulo:"Anual"},{valor:"único",rotulo:"Pagamento único"}] },
      { nome:"planoId", rotulo:"Plano que desbloqueia", tipo:"select", opcoes:opcoesPlanos(), dica:"Define que cursos o aluno passa a ver ao comprar." },
      { nome:"link", rotulo:"Link de pagamento", tipo:"url", placeholder:"https://..." },
      { nome:"destaque", rotulo:"Oferta em destaque", tipo:"toggle", dica:"Usada quando nenhuma outra oferta serve o curso bloqueado." },
      { nome:"ativa", rotulo:"Oferta ativa", tipo:"toggle", padrao:true }
    ],
    valores: oferta || { periodo:"mês", ativa:true, destaque:false, planoId:(DB.planos[0]||{}).id },
    aoGuardar: v => {
      if(oferta) Object.assign(oferta, v);
      else DB.ofertas.push({ id:novoId("oferta"), ...v });
      guardarDB();
      renderAdminOfertas();
      mostrarToast(oferta ? "Oferta atualizada" : "Oferta criada");
    }
  });
}

function apagarOferta(id){
  const oferta = DB.ofertas.find(o=>o.id===id);
  confirmarAcao({
    titulo: "Apagar oferta",
    mensagem: `"${oferta.nome}" deixa de ser proposta aos alunos.`,
    aoConfirmar: () => {
      DB.ofertas = DB.ofertas.filter(o=>o.id!==id);
      guardarDB();
      renderAdminOfertas();
      mostrarToast("Oferta apagada");
    }
  });
}

registarViews({ "admin-ofertas": renderAdminOfertas });
