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
/* «MZ 1 500,00» — símbolo à frente, duas casas, vírgula decimal, a mesma
   disposição do Payflow e dos relatórios financeiros da empresa. Era
   «1 500 MT»: sufixo e sem casas decimais. */
function formatarPreco(v, moedaOuSimbolo){
  return simboloDaMoeda(moedaOuSimbolo) + " " + Number(v||0)
    .toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2,
                               useGrouping: "always" });
}

/* Uma oferta do mercado sul-africano paga-se em rands, e a Vitrine mostra as duas
   ao lado. Aceita já o símbolo ou o código da moeda: quem chama nem sempre sabe
   qual dos dois tem na mão. */
function simboloDaMoeda(m){
  const s = String(m || "").toUpperCase();
  if(!s) return "MZ";
  return { MZN: "MZ", ZAR: "R", NGN: "₦", GHS: "GH₵", KES: "KSh",
           USD: "$", EUR: "€" }[s] || s;
}

/* Só serve à demonstração: com servidor, quem decide é a base de dados.
   Um membro sem plano vê tudo o que está publicado; com plano, vê o que o
   plano leva dentro. */
function cursosPermitidos(membro){
  const plano = membro && planoPorId(membro.planoId);
  if(!plano) return null;
  return plano.cursos || [];
}

/* O que um plano custa é o que custa a oferta que o vende. */
function precoDoPlano(plano){
  const o = plano && ofertaDoPlano(plano);
  return o ? { preco:o.preco, periodo:o.periodo } : null;
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
      <div class="table-wrap" tabindex="0">
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
   A entrada na academia é por convite. Os de quem paga nascem sozinhos,
   quando o Payflow confirma o pagamento; os outros envia-os a equipa daqui.
   Cada convite tem um prazo: o email leva o token dele, e o servidor só
   deixa entrar enquanto o convite valer (não aceite, não revogado, dentro
   do prazo). O email sai sempre pelo Resend.
   ============================================================ */
const ESTADOS_DO_CONVITE = [
  { id:"todos",    rotulo:"Todos" },
  { id:"enviado",  rotulo:"Enviado" },
  { id:"aberto",   rotulo:"Aberto" },
  { id:"aceite",   rotulo:"Aceite" },
  { id:"expirado", rotulo:"Expirado" },
  { id:"revogado", rotulo:"Revogado" }
];
const PRAZOS_DO_CONVITE = [1, 3, 7, 14, 30];

function renderAdminConvites(){
  const convites = DB.convites || [];
  const filtro = estado.filtroConvites || "todos";
  const busca = (estado.buscaConvites || "").trim().toLowerCase();
  const contagem = Object.fromEntries(ESTADOS_DO_CONVITE.map(e =>
    [e.id, e.id === "todos" ? convites.length : convites.filter(c => c.estado === e.id).length]));
  const visiveis = convites.filter(c =>
    (filtro === "todos" || c.estado === filtro) &&
    (!busca || (c.email + " " + (c.nome || "")).toLowerCase().includes(busca)));

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Convites",
      descricao: "Os convites de quem paga são criados sozinhos quando o Payflow confirma o pagamento. Também podes enviar um à mão.",
      acaoRotulo: "Novo convite",
      acaoId: "btn-novo-convite"
    })}
    <div class="card table-card convites-card">
      <div class="convites-barra">
        <div class="convites-estados" role="group" aria-label="Filtrar por estado">
          ${ESTADOS_DO_CONVITE.map(e => `
            <button type="button" class="estado-chip ${filtro===e.id?"active":""}" data-estado-convite="${e.id}" aria-pressed="${filtro===e.id}">
              ${e.rotulo}<span class="estado-chip-conta">${contagem[e.id]}</span>
            </button>`).join("")}
        </div>
        <div class="search-pill convites-busca">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="convites-busca" placeholder="Procurar por nome ou email" aria-label="Procurar por nome ou email" value="${textoSeguro(estado.buscaConvites || "").replace(/"/g,"&quot;")}">
        </div>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table convites-tabela">
          <thead><tr><th>Pessoa</th><th>Cursos</th><th>Idioma</th><th>Origem</th><th>Enviado</th><th>Expira</th><th>Estado</th><th><span class="so-leitor">Ações</span></th></tr></thead>
          <tbody>
            ${visiveis.length ? visiveis.map(linhaDoConvite).join("")
              : `<tr><td colspan="8"><div class="empty-note">${convites.length ? "Nenhum convite com este filtro." : "Ainda não enviaste convites."}</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-novo-convite").addEventListener("click", () => criarConvite());
  document.querySelectorAll("#content-admin [data-estado-convite]").forEach(b =>
    b.addEventListener("click", () => { estado.filtroConvites = b.getAttribute("data-estado-convite"); renderAdminConvites(); }));
  const campoBusca = document.getElementById("convites-busca");
  campoBusca.addEventListener("input", () => {
    estado.buscaConvites = campoBusca.value;
    const pos = campoBusca.selectionStart;
    renderAdminConvites();
    const novo = document.getElementById("convites-busca");
    novo.focus(); novo.setSelectionRange(pos, pos);
  });
  document.querySelectorAll("#content-admin [data-reenviar]").forEach(b =>
    b.addEventListener("click", () => reenviarConvite(b.getAttribute("data-reenviar"))));
  document.querySelectorAll("#content-admin [data-copiar]").forEach(b =>
    b.addEventListener("click", () => copiarLinkDoConvite(b.getAttribute("data-copiar"))));
  document.querySelectorAll("#content-admin [data-revogar]").forEach(b =>
    b.addEventListener("click", () => revogarConvite(b.getAttribute("data-revogar"))));
}

const ICONE_REENVIAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`;
const ICONE_COPIAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>`;
const ICONE_REVOGAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function linhaDoConvite(c){
  const nome = c.nome || c.email.split("@")[0];
  const vivo = c.estado === "enviado" || c.estado === "aberto";
  const est = estadoDoConvite(c.estado);
  const quem = textoSeguro(c.email);
  return `
    <tr data-convite="${c.id}">
      <td>
        <div class="pessoa-celula">
          <span class="avatar-iniciais" style="--c:${corDaPessoa(c.email)}" aria-hidden="true">${textoSeguro(iniciais(nome))}</span>
          <div>
            <div class="nome">${textoSeguro(nome)}</div>
            <div class="sub-celula">${quem}</div>
          </div>
        </div>
      </td>
      <td class="convite-cursos">${resumoDoConvite(c)}</td>
      <td><span class="etiqueta-idioma">${(c.idioma || "pt").toUpperCase()}</span></td>
      <td class="sub-celula">${c.origem === "pagamento" ? "Pagamento" : "Manual"}</td>
      <td class="num">${dataCurtaDoConvite(c.criadoEm)}</td>
      <td class="convite-prazo">${prazoDoConvite(c)}</td>
      <td><span class="estado-convite ${est.classe}"><span class="estado-ponto" aria-hidden="true"></span>${est.rotulo}</span></td>
      <td><div class="acoes-linha">
        ${vivo || c.estado === "expirado" ? `<button class="btn-icone" type="button" data-reenviar="${c.id}" title="Enviar outra vez" aria-label="Enviar outra vez a ${quem}">${ICONE_REENVIAR}</button>` : ""}
        ${vivo ? `<button class="btn-icone" type="button" data-copiar="${c.id}" title="Copiar o link" aria-label="Copiar o link do convite de ${quem}">${ICONE_COPIAR}</button>` : ""}
        ${vivo ? `<button class="btn-icone perigo" type="button" data-revogar="${c.id}" title="Revogar" aria-label="Revogar o convite de ${quem}">${ICONE_REVOGAR}</button>` : ""}
      </div></td>
    </tr>`;
}

function estadoDoConvite(estadoDaLinha){
  return ({
    enviado:  { rotulo:"Enviado",  classe:"e-enviado" },
    aberto:   { rotulo:"Aberto",   classe:"e-aberto" },
    aceite:   { rotulo:"Aceite",   classe:"e-aceite" },
    expirado: { rotulo:"Expirado", classe:"e-parado" },
    revogado: { rotulo:"Revogado", classe:"e-parado" }
  })[estadoDaLinha] || { rotulo:"Enviado", classe:"e-enviado" };
}

/* A cor do avatar sai do email: a mesma pessoa tem sempre a mesma cor. */
function corDaPessoa(email){
  const cores = ["#c2410c", "#b91c1c", "#15803d", "#1d4ed8", "#7e22ce", "#0f766e", "#a16207"];
  let h = 0;
  for(const ch of String(email || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cores[h % cores.length];
}

function dataCurtaDoConvite(iso){
  if(!iso) return "—";
  const d = new Date(iso);
  if(isNaN(d)) return "—";
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

/* «Expira em 6 dias», «Expira em 5 h», «Expirou a 28/09», ou um traço quando
   o prazo já não conta (aceite ou revogado). */
function prazoDoConvite(c){
  if(c.estado === "aceite" || c.estado === "revogado" || !c.expiraEm) return `<span class="sub-celula">—</span>`;
  if(c.estado === "expirado") return `<span class="sub-celula">Expirou a ${dataCurtaDoConvite(c.expiraEm)}</span>`;
  const horas = (new Date(c.expiraEm) - Date.now()) / 36e5;
  if(horas < 24) return `<span class="prazo-perto">Expira ${horas < 1 ? "dentro de minutos" : "em " + Math.ceil(horas) + " h"}</span>`;
  const dias = Math.ceil(horas / 24);
  return `Expira em ${dias} dia${dias > 1 ? "s" : ""}`;
}

/* Os cursos que o convite abre, pelo nome. */
function resumoDoConvite(c){
  const nomes = (c.cursos||[]).map(id => (DB.cursos.find(x=>x.id===id)||{}).titulo).filter(Boolean).map(textoSeguro);
  const oferta = (DB.ofertas||[]).find(o => String(o.id) === String(c.ofertaId));
  if(nomes.length > 2) return `${nomes.slice(0, 2).join("<br>")}<div class="sub-celula">e mais ${nomes.length - 2}</div>`;
  if(nomes.length) return nomes.join("<br>");
  if(oferta) return textoSeguro(oferta.nome);
  return `<span class="sub-celula">Só o que vier das inscrições</span>`;
}

/* Os cursos, como cartões com a capa: «Oculto» se ainda não está publicado,
   «Em breve» se ainda não tem aulas. */
function cursosParaConvidar(){
  return (DB.cursos||[]).map(c => {
    const aulas = (c.modulos||[]).reduce((n, m) => n + (m.aulas||[]).length, 0);
    return {
      valor: c.id, rotulo: c.titulo, imagem: c.capa || "",
      iniciais: c.sigla || iniciais(c.titulo), cor: (DB.categorias[c.categoria]||{}).cor || "",
      etiqueta: c.publicado === false ? "Oculto" : (aulas === 0 ? "Em breve" : "")
    };
  });
}

function criarConvite(valores){
  abrirDrawer({
    titulo: "Novo convite",
    subtitulo: "Enviamos por email um link pessoal para criar conta com estes cursos.",
    campos: [
      { nome:"email", rotulo:"Email", tipo:"texto", obrigatorio:true, placeholder:"nome@exemplo.co.mz" },
      { nome:"nome", rotulo:"Nome", tipo:"texto", placeholder:"ex.: Marta Lopes" },
      { nome:"idioma", rotulo:"Idioma", tipo:"select", meia:true,
        opcoes:[{ valor:"pt", rotulo:"Português" }, { valor:"en", rotulo:"English" }] },
      { nome:"dias", rotulo:"O link expira após", tipo:"select", meia:true,
        opcoes: PRAZOS_DO_CONVITE.map(n => ({ valor:String(n), rotulo: n === 1 ? "1 dia" : n + " dias" })) },
      { nome:"cursos", rotulo:"Cursos incluídos", tipo:"checklist", cartoes:true,
        opcoes: cursosParaConvidar(),
        dica:"Se este email já tiver conta, os cursos abrem na próxima vez que a pessoa entrar." }
    ],
    valores: Object.assign({ idioma:"pt", dias:"7", cursos:[] }, valores || {}),
    textoGuardar: "Enviar convite",
    aoGuardar: v => {
      if(!/^\S+@\S+\.\S+$/.test(v.email)){ mostrarToast("Esse email não parece válido"); return false; }
      const membro = membroPorEmail(v.email);
      if(membro && membro.papel !== "aluno"){
        mostrarToast("Esse email é de alguém da equipa, que já entra na academia"); return false;
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
    mensagem: `Mandamos um link novo para "${textoSeguro(convite.email)}", válido por mais 7 dias. O link anterior deixa de servir.`,
    textoConfirmar: "Enviar",
    aoConfirmar: () => enviarConvite({ email:convite.email, nome:convite.nome, ofertaId:convite.ofertaId,
                                       cursos:convite.cursos, idioma:convite.idioma, dias:"7", substitui:convite.id })
  });
}

/* O envio é do servidor; aqui só damos notícia do que aconteceu. */
async function enviarConvite(v){
  const dias = PRAZOS_DO_CONVITE.includes(Number(v.dias)) ? Number(v.dias) : 7;
  if(modoDemonstracao()){
    DB.convites = DB.convites || [];
    if(v.substitui){
      const antigo = DB.convites.find(c => c.id === v.substitui);
      if(antigo && antigo.estado !== "aceite") antigo.estado = "revogado";
    }
    DB.convites.unshift({
      id:novoId("cv"), codigo:novoId("cv"), email:v.email.trim().toLowerCase(), nome:v.nome||"",
      ofertaId:v.ofertaId || null, cursos:v.cursos || [], idioma:v.idioma || "pt", origem:"manual",
      estado:"enviado", criadoEm:new Date().toISOString(),
      expiraEm:new Date(Date.now() + dias * 864e5).toISOString()
    });
    guardarDB();
    renderAdminConvites();
    mostrarToast("Convite criado");
    return;
  }
  mostrarToast("A enviar o convite...");
  try {
    const resposta = await API.convidar({
      email: v.email, nome: v.nome || "", idioma: v.idioma || "pt", dias,
      ofertaId: v.ofertaId || null, cursos: v.cursos || [], substitui: v.substitui || null
    });
    try { await API.recarregarConvites(); }
    catch(e){ if(resposta.convite) DB.convites = [deConvite(resposta.convite)].concat(DB.convites || []); }
    renderAdminConvites();
    if(resposta.enviado) mostrarToast("Convite enviado para " + v.email);
    else mostrarLinkDoConvite(v.email, resposta.link, resposta.aviso);
  } catch(erro){
    mostrarToast(erro.message || "Não foi possível enviar o convite.");
  }
}

/* O link do convite é o do email: a morada da academia com o token. */
function linkDoConvite(c){
  return location.origin + location.pathname.replace(/index\.html$/, "") + "?convite=" + encodeURIComponent(c.codigo);
}

function copiarLinkDoConvite(id){
  const convite = (DB.convites||[]).find(c=>c.id===id);
  if(!convite) return;
  const link = linkDoConvite(convite);
  const aMao = () => mostrarLinkDoConvite(convite.email, link, "Não foi possível copiar sozinho.");
  if(navigator.clipboard) navigator.clipboard.writeText(link).then(
    () => mostrarToast("Link copiado. Vale até " + dataCurtaDoConvite(convite.expiraEm)), aMao);
  else aMao();
}

/* Se o email não saiu, o link não se perde: fica aqui para copiar. */
function mostrarLinkDoConvite(email, link, aviso){
  const seguro = String(link || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  confirmarAcao({
    titulo: "O link do convite",
    mensagem: `${textoSeguro(aviso || "O email não chegou a sair.")}<br><br>Envia este link a <strong>${textoSeguro(email)}</strong>:
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
    mensagem: `O link enviado a "${textoSeguro(convite.email)}" deixa de servir e os cursos escolhidos não abrem. O convite fica na lista, como revogado.`,
    textoConfirmar: "Revogar",
    aoConfirmar: async () => {
      if(!modoDemonstracao()){
        try { await API.revogarConvite(id); }
        catch(erro){ mostrarToast(erro.message || "Não foi possível revogar."); return; }
      }
      convite.estado = "revogado";
      guardarDB();
      renderAdminConvites();
      mostrarToast("Convite revogado");
    }
  });
}

/* Só no modo de demonstração: sem servidor, é o login que transforma
   um convite pendente numa conta. Em produção isto acontece do lado
   do Supabase, quando a pessoa entra pelo link do email. */
function aceitarConvitePendente(email){
  const convite = (DB.convites||[]).find(c => (c.estado==="enviado" || c.estado==="aberto") && (c.email||"").toLowerCase()===email.toLowerCase());
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
      descricao: "Um plano junta cursos sob um nome; a oferta que o vende, no Payflow, é que diz quanto custa.",
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

/* Um plano é um pacote de cursos com nome. Quanto custa e como se cobra é da
   oferta que o vende, no Payflow — aqui só se diz o que vai dentro. Enquanto
   nenhuma oferta o vender, o plano existe e não entrega nada a ninguém: é isso
   que a coluna "Vendido por" serve para mostrar sem se ter de ir lá ver. */
function ofertaDoPlano(plano){
  return plano.ofertaId ? (DB.ofertas || []).find(o => String(o.id) === String(plano.ofertaId)) : null;
}

function tabelaPlanosHTML(){
  const planos = DB.planos || [];
  return `
    <div class="card table-card">
      <div class="table-card-head">
        <h3>Planos</h3>
        <span class="count">${planos.length} ${planos.length === 1 ? "plano" : "planos"} · o preço é o da oferta que o vende</span>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Plano</th><th>Cursos</th><th>Vendido por</th><th>Preço</th><th></th></tr></thead>
          <tbody>
            ${planos.length ? planos.map(p => {
              const oferta = ofertaDoPlano(p);
              const dentro = (p.cursos || []).map(id => (DB.cursos.find(c => c.id === id) || {}).titulo).filter(Boolean);
              const vazios = (p.cursos || []).filter(id => {
                const c = DB.cursos.find(x => x.id === id);
                return c && !(c.modulos || []).some(m => (m.aulas || []).length);
              }).length;
              return `<tr>
                <td><div class="nome" style="font-weight:500;">${p.nome}</div>
                    <div class="sub-celula">${dentro.join(" · ") || "sem cursos"}</div></td>
                <td class="num">${(p.cursos || []).length}${vazios ? `<div class="sub-celula">${vazios} sem aulas</div>` : ""}</td>
                <td>${oferta ? oferta.nome : `<span class="sub-celula">ninguém — não entrega nada</span>`}</td>
                <td class="num">${oferta ? formatarPreco(oferta.preco) + (oferta.periodo === "mês" ? "/mês" : "") : "—"}</td>
                <td>${acoesLinha(p.id)}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="5"><div class="empty-note">Ainda não há planos. Um plano junta vários cursos sob um nome, para uma oferta os vender de uma vez.</div></td></tr>`}
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
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Membro</th><th>Plano</th><th>Valor</th><th>Desde</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${DB.membros.map(m => {
              const plano = planoPorId(m.planoId);
              return `<tr class="${m.acesso==="bloqueado"?"tint-risco":""}">
                <td><div class="cell-user"><div class="avatar">${iniciais(m.nome)}</div><div class="meta"><div class="nome">${m.nome}</div><div class="sub">${m.email}</div></div></div></td>
                <td>${plano ? plano.nome : "<span class='sub-celula'>Sem plano</span>"}</td>
                <td class="num">${(() => { const v = precoDoPlano(plano); return v ? formatarPreco(v.preco) : "—"; })()}</td>
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

/* Os cursos, com um aviso ao lado dos que não têm nenhuma aula: pôr um curso
   vazio dentro de um plano é vender uma porta fechada, e já aconteceu. */
function opcoesCursosDoPlano(){
  return DB.cursos.map(c => {
    const aulas = (c.modulos || []).reduce((s,m) => s + (m.aulas || []).length, 0);
    return { valor:c.id, rotulo: aulas ? c.titulo : `${c.titulo} — ainda sem aulas` };
  });
}

function editarPlano(id){
  const plano = id ? planoPorId(id) : null;
  const oferta = plano ? ofertaDoPlano(plano) : null;
  abrirDrawer({
    titulo: plano ? "Editar plano" : "Novo plano",
    subtitulo: oferta
      ? `Vendido pela oferta "${oferta.nome}". O preço e a cobrança são de lá.`
      : "Junta vários cursos sob um nome. O preço é da oferta que o vender, no Payflow.",
    campos: [
      { nome:"nome", rotulo:"Nome do plano", tipo:"texto", obrigatorio:true, placeholder:"ex: Kingdom All Access" },
      { nome:"descricao", rotulo:"Descrição", tipo:"texto", placeholder:"Para que serve este pacote." },
      { nome:"cursos", rotulo:"Cursos incluídos", tipo:"checklist", opcoes:opcoesCursosDoPlano(),
        dica:"Quem comprar a oferta que vende este plano abre todos estes cursos." }
    ],
    valores: plano || { cursos:[] },
    aoGuardar: async v => {
      const alvo = plano || { id:null, ordem:(DB.planos || []).length + 1 };
      Object.assign(alvo, v);
      alvo.cursos = v.cursos || [];
      const novoIdDado = await salvarPlano(alvo);
      if(!plano){ alvo.id = novoIdDado; DB.planos.push(alvo); }
      renderAdminAssinaturas();
      mostrarToast(plano ? "Plano atualizado" : "Plano criado");
    }
  });
}

function apagarPlano(id){
  const plano = planoPorId(id);
  const oferta = ofertaDoPlano(plano);
  /* Apagar um plano que uma oferta ainda vende deixa a oferta a cobrar e a não
     entregar nada. Desliga-se lá primeiro, onde a ligação foi feita. */
  if(oferta){
    mostrarToast(`A oferta "${oferta.nome}" ainda vende este plano — desliga-a no Payflow primeiro`);
    return;
  }
  confirmarAcao({
    titulo: "Apagar plano",
    mensagem: `O plano "${plano.nome}" deixa de existir. Os cursos ficam onde estão; quem já tem acesso não o perde.`,
    aoConfirmar: async () => {
      DB.planos = DB.planos.filter(p=>p.id!==id);
      await remover("plano", id);
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
