/* ============================================================
   Administração › Membros, Convites e Assinaturas
   Quem entra na academia e a que conteúdos tem acesso.
   ============================================================ */

function planoPorId(id){ return (DB.planos||[]).find(p=>p.id===id); }
function membroPorEmail(email){
  const alvo = (email||"").trim().toLowerCase();
  return (DB.membros||[]).find(m => (m.email||"").toLowerCase() === alvo);
}
function opcoesPlanos(){ return (DB.planos||[]).map(p => ({ valor:p.id, rotulo:p.nome })); }
function opcoesCursos(){ return DB.cursos.map(c => ({ valor:c.id, rotulo:c.titulo })); }
function formatarPreco(v){ return (v||0).toLocaleString("pt-PT") + " MT"; }

/* Um membro sem plano, ou com plano de acesso total, vê tudo o que está publicado. */
function cursosPermitidos(membro){
  const plano = membro && planoPorId(membro.planoId);
  if(!plano || plano.acessoTotal) return null;
  return plano.cursos || [];
}

/* ============================================================
   Membros
   ============================================================ */
const ROTULOS_ACESSO = { ativo:"Ativo", inativo:"Inativo", bloqueado:"Bloqueado" };
const PILLS_ACESSO = { ativo:"pill-ativo", inativo:"pill-inativo", bloqueado:"pill-quente" };

function renderAdminMembros(){
  const busca = (estado.buscaMembros||"").trim().toLowerCase();
  const lista = DB.membros.filter(m => !busca || m.nome.toLowerCase().includes(busca) || (m.email||"").toLowerCase().includes(busca));
  const ativos = DB.membros.filter(m=>m.acesso==="ativo").length;
  const admins = DB.membros.filter(m=>m.papel==="administrador").length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Membros",
      descricao: "Quem tem acesso à academia. O email só pode ser alterado aqui, pelo administrador.",
      acaoRotulo: "Novo membro",
      acaoId: "btn-novo-membro"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.people}</div><div class="stat-label">Membros ativos</div><div class="stat-value">${ativos}<span>/ ${DB.membros.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.card}</div><div class="stat-label">Planos em uso</div><div class="stat-value">${new Set(DB.membros.map(m=>m.planoId)).size}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.gear}</div><div class="stat-label">Administradores</div><div class="stat-value">${admins}</div></div>
    </div>
    <div class="filter-bar">
      <div class="search-pill"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="text" id="membros-busca" placeholder="Procurar por nome ou email..." value="${estado.buscaMembros||""}"></div>
    </div>
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Todos os membros</h3>
        <span class="count">${lista.length} de ${DB.membros.length} registos</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Membro</th><th>Plano</th><th>Papel</th><th>Acesso</th><th>Membro desde</th><th>Último acesso</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(m => {
              const plano = planoPorId(m.planoId);
              return `<tr class="${m.acesso==="bloqueado"?"tint-risco":""}">
                <td><div class="cell-user"><div class="avatar">${iniciais(m.nome)}</div><div class="meta"><div class="nome">${m.nome}</div><div class="sub">${m.email}</div></div></div></td>
                <td>${plano ? plano.nome : "<span class='sub-celula'>Sem plano</span>"}</td>
                <td>${m.papel==="administrador" ? '<span class="pill pill-morno">Administrador</span>' : '<span class="sub-celula">Aluno</span>'}</td>
                <td><span class="pill ${PILLS_ACESSO[m.acesso]||"pill-inativo"}">${ROTULOS_ACESSO[m.acesso]||"—"}</span></td>
                <td>${m.membroDesde||"—"}</td>
                <td>${m.ultimoAcesso||"—"}</td>
                <td>${acoesLinha(m.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="7"><div class="empty-note">Nenhum membro encontrado.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-novo-membro").addEventListener("click", () => editarMembro(null));
  document.getElementById("membros-busca").addEventListener("input", e => {
    estado.buscaMembros = e.target.value;
    renderAdminMembros();
  });
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarMembro(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarMembro(b.getAttribute("data-apagar"))));
}

function editarMembro(id){
  const membro = id ? DB.membros.find(m=>m.id===id) : null;
  abrirDrawer({
    titulo: membro ? "Editar membro" : "Novo membro",
    subtitulo: membro ? membro.email : "O membro entra com este email na área de alunos.",
    campos: [
      { nome:"nome", rotulo:"Nome completo", tipo:"texto", obrigatorio:true },
      { nome:"email", rotulo:"Email", tipo:"texto", obrigatorio:true, dica:"O aluno não pode alterar o próprio email — só aqui." },
      { nome:"telefone", rotulo:"Telefone", tipo:"texto", placeholder:"+258 ..." },
      { nome:"planoId", rotulo:"Plano", tipo:"select", opcoes:opcoesPlanos(), dica:"Define a que cursos este membro tem acesso." },
      { nome:"papel", rotulo:"Papel", tipo:"select", opcoes:[{valor:"aluno",rotulo:"Aluno"},{valor:"administrador",rotulo:"Administrador"}] },
      { nome:"acesso", rotulo:"Estado do acesso", tipo:"select", opcoes:[{valor:"ativo",rotulo:"Ativo"},{valor:"inativo",rotulo:"Inativo"},{valor:"bloqueado",rotulo:"Bloqueado"}] },
      { nome:"membroDesde", rotulo:"Membro desde", tipo:"data" },
      { nome:"responsavel", rotulo:"Responsável", tipo:"texto", placeholder:"Mentor que acompanha este aluno" }
    ],
    valores: membro || { papel:"aluno", acesso:"ativo", planoId:(DB.planos[0]||{}).id, membroDesde:new Date().toISOString().slice(0,10) },
    aoGuardar: v => {
      if(soNoCRM("Os membros")) return false;
      const repetido = DB.membros.find(m => (m.email||"").toLowerCase()===v.email.toLowerCase() && m.id!==(membro||{}).id);
      if(repetido){ mostrarToast("Já existe um membro com esse email"); return false; }
      if(membro) Object.assign(membro, v);
      else DB.membros.push({ id:novoId("membro"), ultimoAcesso:"nunca", engajamento:"morno", progresso:0, estagio:"ativo", categoria:"negocios", origem:"Painel", curso:"—", ...v });
      guardarDB();
      if(membro && estado.membroId===membro.id) sincronizarSessaoComMembro(membro);
      renderAdminMembros();
      mostrarToast(membro ? "Membro atualizado" : "Membro criado");
    }
  });
}

function apagarMembro(id){
  if(soNoCRM("Os membros")) return;
  const membro = DB.membros.find(m=>m.id===id);
  confirmarAcao({
    titulo: "Remover membro",
    mensagem: `"${membro.nome}" perde o acesso à academia. O histórico de progresso deixa de estar associado a uma conta.`,
    textoConfirmar: "Remover",
    aoConfirmar: () => {
      DB.membros = DB.membros.filter(m=>m.id!==id);
      guardarDB();
      renderAdminMembros();
      mostrarToast("Membro removido");
    }
  });
}

/* ============================================================
   Convites
   A entrada na academia é só por convite da equipa. O convite cria a
   conta, manda o email com o link de entrada e fica registado: é ele
   que liberta os cursos escolhidos assim que a pessoa entra.
   ============================================================ */
function renderAdminConvites(){
  const convites = DB.convites || [];
  const pendentes = convites.filter(c=>c.estado==="pendente").length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Convites",
      descricao: "Convida alguém para a academia. Recebe um email com o link de entrada e, ao entrar, os cursos escolhidos ficam logo disponíveis.",
      acaoRotulo: "Novo convite",
      acaoId: "btn-novo-convite"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.mail}</div><div class="stat-label">À espera de entrar</div><div class="stat-value">${pendentes}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.people}</div><div class="stat-label">Já entraram</div><div class="stat-value">${convites.filter(c=>c.estado==="aceite").length}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chart}</div><div class="stat-label">Total enviados</div><div class="stat-value">${convites.length}</div></div>
    </div>
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Convites</h3>
        <span class="count">${convites.length} registos</span>
        <button class="btn btn-secondary btn-sm" type="button" id="btn-atualizar-convites">Atualizar</button>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Quem foi convidado</th><th>Abre desde já</th><th>Enviado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${convites.length ? convites.map(c => `
              <tr class="${c.estado==="aceite"?"tint-concluido":""}">
                <td>
                  <div class="nome" style="font-weight:600;">${c.email}</div>
                  <div class="sub-celula">${c.nome || "Sem nome"}</div>
                </td>
                <td>${resumoDoConvite(c)}</td>
                <td>${c.criadoEm}</td>
                <td><span class="pill ${estadoDoConvite(c.estado).classe}">${estadoDoConvite(c.estado).rotulo}</span></td>
                <td><div class="acoes-linha">
                  ${c.estado==="aceite" ? "" : `<button class="btn-icone" data-reenviar="${c.id}" title="Enviar outra vez"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg></button>`}
                  <button class="btn-icone perigo" data-revogar="${c.id}" title="Revogar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
                </div></td>
              </tr>`).join("") : `<tr><td colspan="5"><div class="empty-note">Ainda não enviaste convites.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-novo-convite").addEventListener("click", () => criarConvite());
  document.getElementById("btn-atualizar-convites").addEventListener("click", async e => {
    if(modoDemonstracao()){ renderAdminConvites(); return; }
    const botao = e.currentTarget;
    botao.disabled = true; botao.textContent = "A ler...";
    try { await API.recarregarConvites(); renderAdminConvites(); }
    catch(erro){ mostrarToast(erro.message || "Não foi possível ler os convites."); botao.disabled = false; botao.textContent = "Atualizar"; }
  });
  document.querySelectorAll("#content-admin [data-reenviar]").forEach(b =>
    b.addEventListener("click", () => reenviarConvite(b.getAttribute("data-reenviar"))));
  document.querySelectorAll("#content-admin [data-revogar]").forEach(b =>
    b.addEventListener("click", () => revogarConvite(b.getAttribute("data-revogar"))));
}

function estadoDoConvite(estado){
  if(estado === "aceite")   return { rotulo:"Já entrou", classe:"pill-ativo" };
  if(estado === "expirado") return { rotulo:"Expirado",  classe:"pill-frio" };
  return { rotulo:"À espera", classe:"pill-morno" };
}

/* O que este convite abre já: os cursos escolhidos à mão, ou a oferta
   do CRM que traz consigo os cursos todos dessa inscrição. */
function resumoDoConvite(c){
  const oferta = (DB.ofertas||[]).find(o => String(o.id) === String(c.ofertaId));
  const nomes = (c.cursos||[]).map(id => (DB.cursos.find(x=>x.id===id)||{}).titulo).filter(Boolean);
  if(oferta && nomes.length) return `${oferta.nome} · ${nomes.length} curso${nomes.length>1?"s":""}`;
  if(oferta) return oferta.nome;
  if(nomes.length === 1) return nomes[0];
  if(nomes.length) return nomes.length + " cursos";
  return `<span class="sub-celula">Só o que vier das inscrições</span>`;
}

function criarConvite(valores){
  abrirDrawer({
    titulo: "Novo convite",
    subtitulo: "A pessoa recebe um email com o link para escolher a password e entrar.",
    campos: [
      { nome:"email", rotulo:"Email a convidar", tipo:"texto", obrigatorio:true, placeholder:"nome@empresa.co" },
      { nome:"nome", rotulo:"Nome", tipo:"texto", placeholder:"Como queres tratá-la no email." },
      { nome:"ofertaId", rotulo:"Oferta do CRM", tipo:"select",
        opcoes:[{ valor:"", rotulo:"— nenhuma —" }].concat((DB.ofertas||[]).map(o => ({ valor:String(o.id), rotulo:o.nome }))),
        dica:"Se escolheres, o acesso acompanha as inscrições dessa oferta." },
      { nome:"cursos", rotulo:"Cursos a abrir desde já", tipo:"checklist",
        opcoes:(DB.cursos||[]).map(c => ({ valor:c.id, rotulo:c.titulo })),
        dica:"Além do que vier das inscrições. Podes deixar tudo por marcar." }
    ],
    valores: valores || { ofertaId:"", cursos:[] },
    textoGuardar: "Enviar convite",
    aoGuardar: v => {
      if(!/^\S+@\S+\.\S+$/.test(v.email)){ mostrarToast("Esse email não parece válido"); return false; }
      const membro = membroPorEmail(v.email);
      if(membro && membro.papel !== "aluno"){
        mostrarToast("Esse email é de alguém da equipa, que já entra na academia"); return false;
      }
      /* Já ter conta não é motivo para não convidar: pode nunca ter
         entrado, ou precisar de um link novo. Avisa-se e segue-se. */
      if(membro){
        confirmarAcao({
          titulo: "Essa pessoa já tem conta",
          mensagem: `Já existe uma conta para "${v.email}". Podemos enviar-lhe um link de entrada novo e abrir os cursos que escolheste — o link anterior deixa de servir.`,
          textoConfirmar: "Enviar mesmo assim",
          aoConfirmar: () => enviarConvite(v)
        });
        return;
      }
      enviarConvite(v);
    }
  });
}

function reenviarConvite(id){
  const convite = (DB.convites||[]).find(c=>c.id===id);
  if(!convite) return;
  confirmarAcao({
    titulo: "Enviar o convite outra vez",
    mensagem: `Mandamos um novo link de entrada para "${convite.email}". O link anterior deixa de servir.`,
    textoConfirmar: "Enviar",
    aoConfirmar: () => enviarConvite({ email:convite.email, nome:convite.nome, ofertaId:convite.ofertaId, cursos:convite.cursos })
  });
}

/* O envio é do servidor; aqui só damos notícia do que aconteceu. */
async function enviarConvite(v){
  if(modoDemonstracao()){
    DB.convites = DB.convites || [];
    DB.convites.unshift({
      id:novoId("cv"), codigo:novoId("cv"), email:v.email, nome:v.nome||"",
      ofertaId:v.ofertaId || null, cursos:v.cursos || [],
      estado:"pendente", criadoEm:new Date().toISOString().slice(0,10)
    });
    guardarDB();
    renderAdminConvites();
    mostrarToast("Convite criado");
    return;
  }
  mostrarToast("A enviar o convite...");
  try {
    const resposta = await API.convidar({
      email: v.email, nome: v.nome || "",
      ofertaId: v.ofertaId || null, cursos: v.cursos || []
    });
    DB.convites = DB.convites || [];
    DB.convites = DB.convites.filter(c => c.id !== (resposta.convite||{}).id);
    if(resposta.convite) DB.convites.unshift(deConvite(resposta.convite));
    renderAdminConvites();
    if(resposta.enviado) mostrarToast("Convite enviado para " + v.email);
    else mostrarLinkDoConvite(v.email, resposta.link, resposta.aviso);
  } catch(erro){
    mostrarToast(erro.message || "Não foi possível enviar o convite.");
  }
}

/* Se o email não saiu, o link não se perde: fica aqui para copiar. */
function mostrarLinkDoConvite(email, link, aviso){
  const seguro = String(link || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  confirmarAcao({
    titulo: "O convite ficou criado",
    mensagem: `${aviso || "O email não chegou a sair."}<br><br>Envia este link a <strong>${email}</strong>:
      <span style="display:block;margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--surface-raised);font-size:12px;word-break:break-all;">${seguro}</span>`,
    textoConfirmar: "Copiar link",
    aoConfirmar: () => {
      if(navigator.clipboard) navigator.clipboard.writeText(link).catch(()=>{});
      mostrarToast("Link copiado");
    }
  });
}

function revogarConvite(id){
  const convite = (DB.convites||[]).find(c=>c.id===id);
  if(!convite) return;
  confirmarAcao({
    titulo: "Revogar convite",
    mensagem: `O convite para "${convite.email}" deixa de dar acesso aos cursos escolhidos.`,
    textoConfirmar: "Revogar",
    aoConfirmar: () => {
      DB.convites = DB.convites.filter(c=>c.id!==id);
      remover("convite", id);
      renderAdminConvites();
      mostrarToast("Convite revogado");
    }
  });
}

/* Só no modo de demonstração: sem servidor, é o login que transforma
   um convite pendente numa conta. Em produção isto acontece do lado
   do Supabase, quando a pessoa entra pelo link do email. */
function aceitarConvitePendente(email){
  const convite = (DB.convites||[]).find(c => c.estado==="pendente" && (c.email||"").toLowerCase()===email.toLowerCase());
  if(!convite) return null;
  const membro = {
    id: novoId("membro"),
    nome: convite.nome || email.split("@")[0].replace(/[._]/g," ").replace(/\b\w/g, l=>l.toUpperCase()),
    email,
    telefone: "",
    papel: "aluno",
    planoId: (DB.planos[0]||{}).id,
    acesso: "ativo",
    membroDesde: new Date().toISOString().slice(0,10),
    curso: "—", categoria:"negocios", origem:"Convite",
    ultimoAcesso:"hoje", engajamento:"morno", progresso:0, estagio:"ativo", responsavel:"—"
  };
  DB.membros.push(membro);
  convite.estado = "aceite";
  guardarDB();
  return membro;
}

/* ============================================================
   Assinaturas (planos + assinantes)
   ============================================================ */
function renderAdminAssinaturas(){
  const aba = estado.abaAssinaturas || "planos";
  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Assinaturas",
      descricao: "Os planos definem o preço e a que cursos cada aluno tem acesso.",
      acaoRotulo: aba==="planos" ? "Novo plano" : null,
      acaoId: "btn-novo-plano"
    })}
    <div class="filter-bar">
      <div class="segmented" id="assinaturas-segmented">
        <button data-aba="planos" class="${aba==="planos"?"active":""}">Planos</button>
        <button data-aba="assinantes" class="${aba==="assinantes"?"active":""}">Assinantes</button>
      </div>
    </div>
    ${aba==="planos" ? tabelaPlanosHTML() : tabelaAssinantesHTML()}
  `;

  document.querySelectorAll("#assinaturas-segmented button").forEach(b => b.addEventListener("click", () => {
    estado.abaAssinaturas = b.getAttribute("data-aba");
    renderAdminAssinaturas();
  }));
  const btnNovo = document.getElementById("btn-novo-plano");
  if(btnNovo) btnNovo.addEventListener("click", () => editarPlano(null));
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => aba==="planos" ? editarPlano(b.getAttribute("data-editar")) : editarMembro(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarPlano(b.getAttribute("data-apagar"))));
}

function tabelaPlanosHTML(){
  const planos = DB.planos || [];
  return `
    <div class="card table-card">
      <div class="table-card-head"><h3>Planos</h3><span class="count">${planos.length} registos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Plano</th><th>Preço</th><th>Acesso</th><th>Assinantes</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${planos.length ? planos.map(p => {
              const assinantes = DB.membros.filter(m=>m.planoId===p.id).length;
              const acesso = p.acessoTotal ? "Todos os cursos" : `${(p.cursos||[]).length} curso(s)`;
              return `<tr>
                <td><div class="nome" style="font-weight:600;">${p.nome}</div><div class="sub-celula">por ${p.periodo}</div></td>
                <td class="num">${formatarPreco(p.preco)}</td>
                <td>${acesso}</td>
                <td class="num">${assinantes}</td>
                <td><span class="pill ${p.ativo!==false?"pill-ativo":"pill-inativo"}">${p.ativo!==false?"Ativo":"Inativo"}</span></td>
                <td>${acoesLinha(p.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="6"><div class="empty-note">Ainda não há planos.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function tabelaAssinantesHTML(){
  return `
    <div class="card table-card">
      <div class="table-card-head"><h3>Assinantes</h3><span class="count">${DB.membros.length} registos</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Membro</th><th>Plano</th><th>Valor</th><th>Desde</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${DB.membros.map(m => {
              const plano = planoPorId(m.planoId);
              return `<tr class="${m.acesso==="bloqueado"?"tint-risco":""}">
                <td><div class="cell-user"><div class="avatar">${iniciais(m.nome)}</div><div class="meta"><div class="nome">${m.nome}</div><div class="sub">${m.email}</div></div></div></td>
                <td>${plano ? plano.nome : "<span class='sub-celula'>Sem plano</span>"}</td>
                <td class="num">${plano ? formatarPreco(plano.preco) : "—"}</td>
                <td>${m.membroDesde||"—"}</td>
                <td><span class="pill ${PILLS_ACESSO[m.acesso]||"pill-inativo"}">${ROTULOS_ACESSO[m.acesso]||"—"}</span></td>
                <td><div class="acoes-linha"><button class="btn-icone" data-editar="${m.id}" title="Editar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button></div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function editarPlano(id){
  const plano = id ? planoPorId(id) : null;
  abrirDrawer({
    titulo: plano ? "Editar plano" : "Novo plano",
    subtitulo: "Define o preço e o que o aluno passa a ver.",
    campos: [
      { nome:"nome", rotulo:"Nome do plano", tipo:"texto", obrigatorio:true, placeholder:"ex: Kingdom All Access" },
      { nome:"preco", rotulo:"Preço (MT)", tipo:"numero", placeholder:"2500" },
      { nome:"periodo", rotulo:"Período", tipo:"select", opcoes:[{valor:"mês",rotulo:"Mensal"},{valor:"ano",rotulo:"Anual"},{valor:"único",rotulo:"Pagamento único"}] },
      { nome:"acessoTotal", rotulo:"Acesso a todos os cursos", tipo:"toggle", padrao:true, dica:"Se desligares, escolhe abaixo os cursos incluídos." },
      { nome:"cursos", rotulo:"Cursos incluídos", tipo:"checklist", opcoes:opcoesCursos(), dica:"Só usado quando o acesso total está desligado." },
      { nome:"ativo", rotulo:"Plano ativo", tipo:"toggle", padrao:true }
    ],
    valores: plano || { periodo:"mês", acessoTotal:true, ativo:true, cursos:[] },
    aoGuardar: v => {
      if(soNoCRM("Os planos")) return false;
      if(plano) Object.assign(plano, v);
      else DB.planos.push({ id:novoId("plano"), ...v });
      guardarDB();
      renderAdminAssinaturas();
      mostrarToast(plano ? "Plano atualizado" : "Plano criado");
    }
  });
}

function apagarPlano(id){
  if(soNoCRM("Os planos")) return;
  const plano = planoPorId(id);
  const emUso = DB.membros.filter(m=>m.planoId===id).length;
  if(emUso){ mostrarToast(`Move primeiro os ${emUso} membro(s) deste plano`); return; }
  confirmarAcao({
    titulo: "Apagar plano",
    mensagem: `O plano "${plano.nome}" deixa de estar disponível.`,
    aoConfirmar: () => {
      DB.planos = DB.planos.filter(p=>p.id!==id);
      guardarDB();
      renderAdminAssinaturas();
      mostrarToast("Plano apagado");
    }
  });
}

registarViews({
  "admin-membros": renderAdminMembros,
  "admin-convites": renderAdminConvites,
  "admin-assinaturas": renderAdminAssinaturas
});
