/* ============================================================
   Administração › Convites
   Quem entra na academia e a que conteúdos tem acesso.
   ============================================================ */

function membroPorEmail(email){
  const alvo = (email||"").trim().toLowerCase();
  return (DB.membros||[]).find(m => (m.email||"").toLowerCase() === alvo);
}
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
   Os cursos que um membro abre: os das matrículas próprias ativas e os das
   assinaturas ativas. Devolve null para quem abre tudo o que está publicado:
   quem tem acesso ilimitado, e quem ainda não tem nada definido (a
   demonstração nasceu assim, e os convidados de ensaio contam com isso). */
function cursosPermitidos(membro){
  if(!membro || membro.ilimitado === true) return null;
  const semeado = Array.isArray(membro.acessos) || Array.isArray(membro.assinaturas) || membro.nivelId || membro.matriculas;
  if(!semeado) return null;
  semearMembroDemo(membro);
  return viasDeAcesso(membro.acessos, membro.assinaturas).map(v => v.curso);
}

/* ============================================================
   Membros: em js/admin-membros.js (a lista, a ficha e o adicionar).
   Aqui ficam só as etiquetas do estado, que os Assinantes também usam.
   ============================================================ */
const ROTULOS_ACESSO = { ativo:"Ativo", inativo:"Inativo", bloqueado:"Suspenso" };
const PILLS_ACESSO = { ativo:"pill-ativo", inativo:"pill-inativo", bloqueado:"pill-quente" };

/* ============================================================
   Convites
   A entrada na academia é por convite. Os de quem paga nascem sozinhos,
   quando o Payflow confirma o pagamento; os outros envia-os a equipa daqui.
   Cada convite tem um prazo: o email leva o token dele, e o servidor só
   deixa entrar enquanto o convite valer (não aceite, não revogado, dentro
   do prazo). O email sai sempre pelo Resend. Um convite dá cursos (cada um
   numa turma), uma assinatura ou acesso ilimitado; os links de inscrição,
   que são convites abertos, estão em js/admin-links.js.
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
  /* Dois separadores: os convites por email e os links de inscrição. */
  if(estado.abaConvites === "links"){ renderLinksDeInscricao(); return; }
  /* «N inscritos →» num link traz para aqui só os convites que dele nasceram. */
  const doLink = estado.linkDosConvites ? linkDeInscricaoPorId(estado.linkDosConvites) : null;
  const convites = (DB.convites || []).filter(c => !doLink || c.linkId === doLink.id);
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
      descricao: "Os convites de quem paga são criados sozinhos quando o Payflow confirma o pagamento. Também pode enviar um à mão.",
      acaoRotulo: "Novo convite",
      acaoId: "btn-novo-convite"
    })}
    ${abasDosConvites("email")}
    <div class="card table-card convites-card">
      ${doLink ? `<div class="membros-filtro-ativo" id="convites-filtro-link">
        <span>Inscritos pelo link <strong>${textoSeguro(doLink.titulo)}</strong></span>
        <button class="btn btn-secondary btn-sm" type="button" id="btn-limpar-filtro-link">Ver todos os convites</button>
      </div>` : ""}
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
              : `<tr><td colspan="8"><div class="empty-note">${convites.length ? "Nenhum convite com este filtro." : "Ainda não enviou convites."}</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  ligarAbasDosConvites();
  const limpar = document.getElementById("btn-limpar-filtro-link");
  if(limpar) limpar.addEventListener("click", () => { estado.linkDosConvites = null; renderAdminConvites(); });
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
      <td class="sub-celula">${origemDoConvite(c)}</td>
      <td class="num">${dataCurtaDoConvite(c.criadoEm)}</td>
      <td class="convite-prazo">${prazoDoConvite(c)}</td>
      <td><span class="estado-convite ${est.classe}"><span class="estado-ponto" aria-hidden="true"></span>${est.rotulo}</span></td>
      <td><div class="acoes-linha">
        ${c.estado !== "aceite" ? `<button class="btn-icone" type="button" data-reenviar="${c.id}" title="Enviar outra vez" aria-label="Enviar outra vez a ${quem}">${ICONE_REENVIAR}</button>` : ""}
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

/* De onde veio o convite: de uma compra, de um link de inscrição (com o
   título dele) ou da equipa. */
function origemDoConvite(c){
  if(c.origem === "pagamento") return "Pagamento";
  if(c.origem === "link"){
    const l = (DB.linksDeInscricao || []).find(x => x.id === c.linkId);
    return "Inscrição" + (l ? `<div class="sub-celula">${textoSeguro(l.titulo)}</div>` : "");
  }
  return "Manual";
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

/* O que o convite dá: acesso ilimitado, uma assinatura, ou cursos (cada um
   na sua turma). O prazo é o da turma, ou o trial / a extensão do nível; só
   os convites de antes trazem um prazo próprio. */
function resumoDoConvite(c){
  if(c.ilimitado) return `Acesso ilimitado<div class="sub-celula">Tudo o que a escola tem publicado</div>`;
  const niveis = (c.niveis || []).map(nivelPorId).filter(Boolean);
  if(niveis.length) return niveis.map(n => {
    const dias = c.origem === "pagamento" ? n.extensaoDias : (n.trialDias || n.extensaoDias);
    return `Assinatura ${textoSeguro(n.nome)}<div class="sub-celula">Acesso ${dias ? prazoEmDias(dias) : "sem prazo"}</div>`;
  }).join("");
  const cursos = (c.cursos || []).map(id => DB.cursos.find(x => x.id === id)).filter(Boolean);
  const nomes = cursos.map(k => {
    const t = turmaDaOferta({ turmas:c.turmas }, k.id);
    return textoSeguro(k.titulo) + (t && !t.padrao ? ` <span class="sub-celula">(${textoSeguro(t.nome)})</span>` : "");
  });
  const oferta = (DB.ofertas||[]).find(o => String(o.id) === String(c.ofertaId));
  const prazos = [...new Set(cursos.map(k => (turmaDaOferta({ turmas:c.turmas }, k.id) || {}).prazoDias || 0))];
  const prazo = c.acessoDias ? `<div class="sub-celula">Acesso ${prazoDaOfertaEmTexto(c.acessoDias)}</div>`
    : prazos.some(Boolean) ? `<div class="sub-celula">Acesso ${prazos.length > 1 ? "o prazo de cada turma" : prazoDaTurmaEmTexto({ prazoDias:prazos[0] })}</div>` : "";
  if(nomes.length > 2) return `${nomes.slice(0, 2).join("<br>")}<div class="sub-celula">e mais ${nomes.length - 2}</div>${prazo}`;
  if(nomes.length) return nomes.join("<br>") + prazo;
  if(oferta) return textoSeguro(oferta.nome);
  return `<span class="sub-celula">Nenhum curso: entra na escola sem abrir cursos</span>`;
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

/* As três coisas que um convite ou um link de inscrição pode dar. */
const MODALIDADES_DO_CONVITE = [
  { valor:"cursos",     rotulo:"Cursos, cada um numa turma" },
  { valor:"assinatura", rotulo:"Uma assinatura" },
  { valor:"ilimitado",  rotulo:"Acesso ilimitado" }
];

function criarConvite(valores){
  /* O convite diz o que dá: cursos (cada um numa turma), uma assinatura ou
     acesso ilimitado. Já não tem duração própria: o prazo é o da turma, ou
     o do nível (17/11/2026). */
  const abertos = (DB.cursos || []).filter(c => c.abertoATodos === true && c.publicado !== false).map(c => c.titulo);
  const niveis = (DB.niveis || []).map(n => ({ valor:n.id, rotulo:n.nome }));
  const turmasEscolhidas = Object.assign({}, (valores && valores.turmas) || {});
  abrirDrawer({
    titulo: "Novo convite",
    subtitulo: "Enviamos por email um link pessoal. A pessoa entra e recebe só o que for escolhido aqui.",
    campos: [
      { nome:"email", rotulo:"Email", tipo:"texto", obrigatorio:true, placeholder:"nome@exemplo.co.mz" },
      { nome:"nome", rotulo:"Nome", tipo:"texto", placeholder:"ex.: Marta Lopes" },
      { nome:"idioma", rotulo:"Idioma", tipo:"select", meia:true,
        opcoes:[{ valor:"pt", rotulo:"Português" }, { valor:"en", rotulo:"English" }] },
      { nome:"dias", rotulo:"O link expira após", tipo:"select", meia:true,
        opcoes: PRAZOS_DO_CONVITE.map(n => ({ valor:String(n), rotulo: n === 1 ? "1 dia" : n + " dias" })) },
      { nome:"modalidade", rotulo:"O que este convite dá", tipo:"select", opcoes:MODALIDADES_DO_CONVITE,
        dica:"Se este email já tiver conta, recebe-o na próxima vez que a pessoa entrar." },
      { nome:"cursos", rotulo:"Cursos incluídos", tipo:"checklist", cartoes:true,
        opcoes: cursosParaConvidar(),
        dica: abertos.length ? `Além destes, abre ${abertos.length === 1 ? "o curso aberto" : "os cursos abertos"} a todos os membros: ${abertos.map(textoSeguro).join(", ")}.` : "" },
      { nome:"nivelId", rotulo:"Assinatura incluída", tipo:"select",
        opcoes: niveis.length ? niveis : [{ valor:"", rotulo:"Ainda não há assinaturas" }],
        dica:"Fica ativa pelo trial da assinatura; sem trial, pela extensão dela; sem nenhum dos dois, sem prazo." }
    ],
    valores: Object.assign({ idioma:"pt", dias:"7", modalidade:"cursos", cursos:[], nivelId:(niveis[0] || {}).valor || "" }, valores || {}),
    textoGuardar: "Enviar convite",
    aoGuardar: v => {
      if(!/^\S+@\S+\.\S+$/.test(v.email)){ mostrarToast("Esse email não parece válido"); return false; }
      const membro = membroPorEmail(v.email);
      if(membro && membro.papel !== "aluno"){
        mostrarToast("Esse email é de alguém da equipa, que já entra na academia"); return false;
      }
      if(v.modalidade === "assinatura" && !nivelPorId(v.nivelId)){
        mostrarToast("Escolha a assinatura que este convite dá. Criam-se em Assinaturas."); return false;
      }
      enviarConvite(Object.assign({}, v, {
        cursos: v.modalidade === "cursos" ? v.cursos : [],
        turmas: v.modalidade === "cursos" ? turmasParaGuardar(v.cursos, turmasEscolhidas) : {},
        niveis: v.modalidade === "assinatura" ? [v.nivelId] : [],
        ilimitado: v.modalidade === "ilimitado"
      }));
    }
  });
  ligarEscolhaDoQueSeDa({ seletor:"valor-modalidade", turmasEscolhidas,
    nota:"O prazo do acesso é o da turma, e conta do dia em que a pessoa entra. Muda-se em Turmas." });
}

/* Reenviar serve também a um convite revogado ou expirado (28/10/2026): sai
   um convite novo, com os mesmos cursos e o mesmo papel. Só um convite ainda
   vivo é substituído — o revogado já não dá entrada e conta como novo. */
function reenviarConvite(id){
  const convite = (DB.convites||[]).find(c=>c.id===id);
  if(!convite) return;
  const vivo = convite.estado === "enviado" || convite.estado === "aberto";
  confirmarAcao({
    titulo: "Enviar o convite outra vez",
    mensagem: vivo
      ? `Mandamos um link novo para "${textoSeguro(convite.email)}", válido por mais 7 dias. O link anterior deixa de servir.`
      : `Mandamos a "${textoSeguro(convite.email)}" um convite novo, que dá o mesmo, válido por 7 dias.`,
    textoConfirmar: "Enviar",
    aoConfirmar: () => enviarConvite({ email:convite.email, nome:convite.nome, ofertaId:convite.ofertaId,
                                       cursos:convite.cursos, idioma:convite.idioma, dias:"7", papel:convite.papel,
                                       turmas:convite.turmas || {}, niveis:convite.niveis || [], ilimitado:!!convite.ilimitado,
                                       acessoDias:convite.acessoDias || null,
                                       substitui: vivo || convite.estado === "expirado" ? convite.id : null })
  });
}

/* Os convites mudam também a partir da ficha de um membro: redesenha-se o
   ecrã que estiver aberto, e a ficha, se estiver. */
function depoisDeMudarConvites(){
  if(estado.viewAtual === "admin-convites") renderAdminConvites();
  else if(estado.viewAtual === "admin-membros") renderAdminMembros();
  else if(estado.viewAtual === "admin-curso-editor" && estado.cursoEditando) carregarResumoDoAcesso(estado.cursoEditando);
  if(typeof desenharFicha === "function" && fichaAberta) desenharFicha();
}

/* O envio é do servidor; aqui só damos notícia do que aconteceu. */
async function enviarConvite(v){
  const dias = PRAZOS_DO_CONVITE.includes(Number(v.dias)) ? Number(v.dias) : 7;
  /* Só um convite de antes, reenviado, ainda traz um prazo próprio. */
  const acessoDias = Number(v.acessoDias) > 0 ? Number(v.acessoDias) : null;
  const oQueDa = { turmas:v.turmas || {}, niveis:v.niveis || [], ilimitado:!!v.ilimitado, acessoDias };
  /* Um só link vivo por pessoa: convidar outra vez quem tem um convite manual
     por aceitar substitui-o (os de pagamento e os das inscrições ficam: cada
     um dá o que é seu). */
  if(!v.substitui){
    const email = (v.email || "").trim().toLowerCase();
    const vivo = (DB.convites || []).find(c => (c.email || "").toLowerCase() === email
      && (c.estado === "enviado" || c.estado === "aberto") && (c.origem || "manual") === "manual");
    if(vivo) v = Object.assign({}, v, { substitui: vivo.id });
  }
  if(modoDemonstracao()){
    DB.convites = DB.convites || [];
    if(v.substitui){
      const antigo = DB.convites.find(c => c.id === v.substitui);
      if(antigo && antigo.estado !== "aceite") antigo.estado = "revogado";
    }
    DB.convites.unshift({
      id:novoId("cv"), codigo:novoId("cv"), email:v.email.trim().toLowerCase(), nome:v.nome||"",
      ofertaId:v.ofertaId || null, cursos:v.cursos || [], idioma:v.idioma || "pt", origem:"manual",
      papel:v.papel || "aluno", turmas:oQueDa.turmas, niveis:oQueDa.niveis, ilimitado:oQueDa.ilimitado,
      acessoDias, estado:"enviado", criadoEm:new Date().toISOString(),
      expiraEm:new Date(Date.now() + dias * 864e5).toISOString()
    });
    guardarDB();
    depoisDeMudarConvites();
    mostrarToast("Convite criado");
    return;
  }
  mostrarToast("A enviar o convite...");
  try {
    const resposta = await API.convidar({
      email: v.email, nome: v.nome || "", idioma: v.idioma || "pt", dias,
      ofertaId: v.ofertaId || null, cursos: v.cursos || [], substitui: v.substitui || null,
      papel: v.papel || "aluno"
    });
    /* As turmas, a assinatura e o acesso ilimitado gravam-se no convite
       acabado de criar: é ele que os dá quando a pessoa entrar. */
    const leva = Object.keys(oQueDa.turmas).length || oQueDa.niveis.length || oQueDa.ilimitado || acessoDias;
    if(leva && resposta.convite && resposta.convite.id){
      try { await API.oQueOConviteDa(resposta.convite.id, oQueDa); }
      catch(e){ mostrarToast("O convite seguiu, mas não ficou gravado o que ele dá: " + (e.message || "")); }
    }
    try { await API.recarregarConvites(); }
    catch(e){ if(resposta.convite) DB.convites = [deConvite(resposta.convite)].concat(DB.convites || []); }
    depoisDeMudarConvites();
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
    mensagem: `${textoSeguro(aviso || "O email não chegou a sair.")}<br><br>Envie este link a <strong>${textoSeguro(email)}</strong>:
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
      depoisDeMudarConvites();
      mostrarToast("Convite revogado");
    }
  });
}

/* Só no modo de demonstração: sem servidor, é o login que transforma
   um convite pendente numa conta. Em produção isto acontece do lado
   do Supabase, quando a pessoa entra pelo link do email. */
function aceitarConvitePendente(email){
  const pendentes = (DB.convites||[]).filter(c => (c.estado==="enviado" || c.estado==="aberto") && (c.email||"").toLowerCase()===email.toLowerCase());
  if(!pendentes.length) return null;
  const convite = pendentes[0];
  let membro = membroPorEmail(email);
  if(!membro){
    membro = {
      id: novoId("membro"),
      nome: convite.nome || email.split("@")[0].replace(/[._]/g," ").replace(/\b\w/g, l=>l.toUpperCase()),
      email,
      telefone: "",
      papel: convite.papel && convite.papel !== "aluno" ? "administrador" : "aluno",
      funcao: convite.papel || "aluno",
      acesso: "ativo", matriculas: [],
      membroDesde: new Date().toISOString().slice(0,10),
      curso: "—", categoria:"negocios", origem:"Convite",
      ultimoAcesso:"hoje", engajamento:"morno", progresso:0, estagio:"ativo", responsavel:"—"
    };
    DB.membros.push(membro);
  }
  pendentes.forEach(c => aplicarConviteDemo(membro, c));
  guardarDB();
  return membro;
}

/* O que a base faz em aceitar_convite(): cada curso na turma do convite (o
   prazo é o dela), a assinatura pelo trial ou pela extensão, o acesso
   ilimitado, e o telefone se o membro ainda não tiver um. Quem a escola
   suspendeu não reabre por um link de inscrição. */
function aplicarConviteDemo(membro, c){
  if(c.origem === "link" && membro.acesso === "bloqueado") return;
  semearMembroDemo(membro);
  (c.cursos || []).forEach(curso => {
    if(!DB.cursos.some(k => k.id === curso) || membro.acessos.some(a => a.curso === curso)) return;
    const t = turmaDaOferta({ turmas:c.turmas }, curso);
    const dias = c.acessoDias || (t && t.prazoDias) || null;
    membro.acessos.push({ curso, origem:"convite", turma:t ? t.id : null, ativo:true, estado:"ativo", desde:hojeISO(),
                          expira: dias ? isoMaisDias(hojeISO(), dias) : null });
  });
  (c.niveis || []).forEach(id => {
    const n = nivelPorId(id); if(!n) return;
    const dias = c.origem === "pagamento" ? n.extensaoDias : (n.trialDias || n.extensaoDias);
    const lista = assinaturasDoMembro(membro), s = lista.find(k => k.nivel === id);
    const nova = { nivel:id, estado:"ativo", expira: dias ? isoMaisDias(hojeISO(), dias) : null, desde:hojeISO() };
    if(!s) lista.push(nova);
    else if(!assinaturaAtiva(s)) Object.assign(s, nova);
  });
  if(c.ilimitado) membro.ilimitado = true;
  if(c.telefone && !membro.telefone) membro.telefone = c.telefone;
  c.estado = "aceite";
}

registarViews({
  "admin-convites": renderAdminConvites
});
