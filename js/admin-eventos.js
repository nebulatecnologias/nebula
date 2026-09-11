/* ============================================================
   Administração › Eventos
   Mentorias, masterclasses e encontros ao vivo que aparecem no
   Calendário do aluno.
   ============================================================ */

function dataHoraEvento(e){ return new Date(e.data + "T" + (e.hora||"00:00") + ":00"); }
function eventoRealizado(e){ return dataHoraEvento(e) <= new Date(); }

function renderAdminEventos(){
  const ordenados = [...DB.eventos].sort((a,b) => dataHoraEvento(b) - dataHoraEvento(a));
  const busca = (estado.buscaEventos||"").trim().toLowerCase();
  const lista = ordenados.filter(e => !busca || e.titulo.toLowerCase().includes(busca));
  const proximos = DB.eventos.filter(e => !eventoRealizado(e)).length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Eventos",
      descricao: "Os encontros ao vivo que o aluno vê no Calendário, com lembrete e confirmação de presença.",
      acaoRotulo: "Novo evento",
      acaoId: "btn-novo-evento"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.cal}</div><div class="stat-label">Próximos encontros</div><div class="stat-value">${proximos}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.layers}</div><div class="stat-label">Total de eventos</div><div class="stat-value">${DB.eventos.length}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chart}</div><div class="stat-label">Já realizados</div><div class="stat-value">${DB.eventos.length - proximos}</div></div>
    </div>
    <div class="filter-bar">
      <div class="search-pill"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" id="eventos-busca" placeholder="Procurar evento..." value="${estado.buscaEventos||""}"></div>
    </div>
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Todos os eventos</h3>
        <span class="count">${lista.length} de ${DB.eventos.length} registos</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Data</th><th>Evento</th><th>Categoria</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(e => {
              const cat = categoriaDe(e.categoria);
              const { dia, mes } = formatarDataEvento(e.data);
              const passado = eventoRealizado(e);
              return `<tr class="${passado?"":"tint-concluido"}">
                <td><div class="cell-user"><div class="event-date-badge"><span class="day">${dia}</span><span class="mon">${mes}</span></div><div class="meta"><div class="sub-celula">${e.hora}</div></div></div></td>
                <td><div class="nome" style="font-weight:600;">${e.titulo}</div><div class="sub-celula">${e.link ? e.link : "Sem link de acesso"}</div></td>
                <td><span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span></td>
                <td>${e.tipo||"—"}</td>
                <td><span class="pill ${passado?"pill-inativo":"pill-ativo"}">${passado?"Realizado":"Agendado"}</span></td>
                <td>${acoesLinha(e.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="6"><div class="empty-note">Ainda não há eventos agendados.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-novo-evento").addEventListener("click", () => editarEvento(null));
  document.getElementById("eventos-busca").addEventListener("input", e => {
    estado.buscaEventos = e.target.value;
    renderAdminEventos();
  });
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarEvento(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarEvento(b.getAttribute("data-apagar"))));
}

function editarEvento(id){
  const evento = id ? DB.eventos.find(e=>e.id===id) : null;
  abrirDrawer({
    titulo: evento ? "Editar evento" : "Novo evento",
    subtitulo: "Aparece no Calendário do aluno, com lembrete e confirmação de presença.",
    campos: [
      { nome:"titulo", rotulo:"Título", tipo:"texto", obrigatorio:true, placeholder:"ex: Mentoria em Grupo: Plano de 90 Dias" },
      { nome:"tipo", rotulo:"Tipo de encontro", tipo:"texto", placeholder:"ex: Mentoria ao vivo" },
      { nome:"categoria", rotulo:"Categoria", tipo:"select", opcoes:opcoesCategorias() },
      { nome:"data", rotulo:"Data", tipo:"data", obrigatorio:true },
      { nome:"hora", rotulo:"Hora", tipo:"hora", obrigatorio:true },
      { nome:"link", rotulo:"Link de acesso", tipo:"url", placeholder:"https://zoom.us/j/...", dica:"Fica guardado no lembrete que o aluno adiciona à agenda." }
    ],
    valores: evento || { hora:"19:00" },
    aoGuardar: v => {
      const alvo = evento || { id:novoId("evento") };
      Object.assign(alvo, v);
      if(!evento) DB.eventos.push(alvo);
      salvar("evento", alvo);
      renderAdminEventos();
      mostrarToast(evento ? "Evento atualizado" : "Evento criado");
    }
  });
}

function apagarEvento(id){
  const evento = DB.eventos.find(e=>e.id===id);
  confirmarAcao({
    titulo: "Apagar evento",
    mensagem: `"${evento.titulo}" deixa de aparecer no calendário dos alunos.`,
    aoConfirmar: () => {
      DB.eventos = DB.eventos.filter(e=>e.id!==id);
      remover("evento", id);
      renderAdminEventos();
      mostrarToast("Evento apagado");
    }
  });
}

registarViews({ "admin-eventos": renderAdminEventos });
