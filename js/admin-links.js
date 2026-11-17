/* ============================================================
   Links de inscrição (17/11/2026, passo 5 da especificação «Convites,
   Assinaturas e Turmas»)
   Um convite aberto: a escola divulga um endereço, a pessoa preenche nome,
   email e (se pedido) WhatsApp, e fica inscrita. Cada inscrição é um convite
   como os outros (origem «link»): segue por email, e é ao abri-lo que a
   pessoa entra e recebe o que o link dá: cursos (cada um numa turma), uma
   assinatura ou acesso ilimitado. Não se apagam: arquivam-se, e as
   inscrições ficam.

   Vivem no separador «Links de inscrição» do ecrã dos Convites. Com servidor
   é a tabela academia.links_de_inscricao, com as suas regras; a página
   pública lê public.link_de_inscricao e inscreve pela função inscricao.
   ============================================================ */
const ICONE_ARQUIVAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>`;
const ICONE_REPOR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`;
const ICONE_EDITAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

function linkDeInscricaoPorId(id){ return (DB.linksDeInscricao || []).find(l => l.id === id); }

/* As inscrições de um link são os convites que dele nasceram. Uma inscrição
   ocupa vaga enquanto está viva: aceite, ou ainda dentro do prazo do email
   dela. Revogar uma liberta a vaga. */
function inscricoesDoLink(l){
  return (DB.convites || []).filter(c => c.linkId === l.id && c.estado !== "revogado");
}
function vagasOcupadasDoLink(l){
  return inscricoesDoLink(l).filter(c => c.estado !== "expirado").length;
}
/* aberto, arquivado, esgotado ou indisponivel (já não tem nada para dar). */
function estadoDoLink(l){
  if(l.arquivado) return "arquivado";
  if(l.modalidade === "cursos" && !(l.cursos || []).some(id => DB.cursos.some(c => c.id === id))) return "indisponivel";
  if(l.modalidade === "assinatura" && !nivelPorId(l.nivelId)) return "indisponivel";
  if(l.limite && vagasOcupadasDoLink(l) >= l.limite) return "esgotado";
  return "aberto";
}

/* O endereço que se divulga. O código diz de que escola é: não precisa de
   mais nada. */
function enderecoDoLink(l){
  return location.origin + location.pathname.replace(/index\.html$/, "")
    + (modoDemonstracao() ? "?demo=1&inscricao=" : "?inscricao=") + encodeURIComponent(l.codigo);
}

/* O que o link dá, numa linha. */
function oQueOLinkDa(l){
  if(l.modalidade === "ilimitado") return "Acesso ilimitado";
  if(l.modalidade === "assinatura"){
    const n = nivelPorId(l.nivelId);
    return n ? `Assinatura ${textoSeguro(n.nome)}` : `<span class="erro">A assinatura já não existe</span>`;
  }
  const nomes = (l.cursos || []).map(id => {
    const c = DB.cursos.find(x => x.id === id); if(!c) return "";
    const t = turmaDaOferta({ turmas:l.turmas }, id);
    return textoSeguro(c.titulo) + (t && !t.padrao ? ` (${textoSeguro(t.nome)})` : "");
  }).filter(Boolean);
  if(!nomes.length) return `<span class="erro">Os cursos já não existem</span>`;
  return nomes.slice(0, 2).join(", ") + (nomes.length > 2 ? ` e mais ${nomes.length - 2}` : "");
}

/* Os dois separadores do ecrã dos Convites. */
function abasDosConvites(ativa){
  const A = [["email", "Convites por email", (DB.convites || []).length],
             ["links", "Links de inscrição", (DB.linksDeInscricao || []).filter(l => !l.arquivado).length]];
  return `<div class="int-abas" role="tablist" aria-label="Convites">
    ${A.map(([k, r, n]) => `<button type="button" role="tab" class="int-aba${ativa === k ? " ativa" : ""}" aria-selected="${ativa === k}" data-aba-convites="${k}">${r}<span class="int-aba-n">${n}</span></button>`).join("")}
  </div>`;
}
function ligarAbasDosConvites(){
  document.querySelectorAll("#content-admin [data-aba-convites]").forEach(b =>
    b.addEventListener("click", () => { estado.abaConvites = b.getAttribute("data-aba-convites"); renderAdminConvites(); }));
}

function renderLinksDeInscricao(){
  const todos = DB.linksDeInscricao || [];
  const arquivados = estado.linksArquivados === true;
  const busca = (estado.buscaLinks || "").trim().toLowerCase();
  const n = { ativos: todos.filter(l => !l.arquivado).length, arquivados: todos.filter(l => l.arquivado).length };
  const visiveis = todos.filter(l => !!l.arquivado === arquivados
    && (!busca || (l.titulo + " " + (l.descricao || "")).toLowerCase().includes(busca)))
    .sort((x, y) => String(y.criadoEm || "").localeCompare(String(x.criadoEm || "")));

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Convites",
      descricao: "Um link de inscrição é um convite aberto: divulgue o endereço e quem se inscrever recebe por email o link para entrar, com o que este link dá.",
      acaoRotulo: "Novo link",
      acaoId: "btn-novo-link"
    })}
    ${abasDosConvites("links")}
    <div class="card table-card convites-card">
      <div class="convites-barra">
        <div class="convites-estados" role="group" aria-label="Ativos ou arquivados">
          <button type="button" class="estado-chip ${!arquivados ? "active" : ""}" data-links-arquivados="nao" aria-pressed="${!arquivados}">Ativos<span class="estado-chip-conta">${n.ativos}</span></button>
          <button type="button" class="estado-chip ${arquivados ? "active" : ""}" data-links-arquivados="sim" aria-pressed="${arquivados}">Arquivados<span class="estado-chip-conta">${n.arquivados}</span></button>
        </div>
        <div class="search-pill convites-busca">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="links-busca" placeholder="Pesquisar link" aria-label="Pesquisar link" value="${textoSeguro(estado.buscaLinks || "").replace(/"/g, "&quot;")}">
        </div>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table links-tabela">
          <thead><tr><th>Texto de chamada</th><th>O que dá</th><th>Inscritos</th><th>Link de divulgação</th><th><span class="so-leitor">Ações</span></th></tr></thead>
          <tbody>
            ${visiveis.length ? visiveis.map(linhaDoLink).join("")
              : `<tr><td colspan="5"><div class="empty-note">${todos.length ? (busca ? "Nenhum link com esse texto." : arquivados ? "Nenhum link arquivado." : "Nenhum link ativo.") : "Ainda não criou links de inscrição."}</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  ligarAbasDosConvites();
  document.getElementById("btn-novo-link").addEventListener("click", () => editarLink(null));
  document.querySelectorAll("#content-admin [data-links-arquivados]").forEach(b =>
    b.addEventListener("click", () => { estado.linksArquivados = b.getAttribute("data-links-arquivados") === "sim"; renderAdminConvites(); }));
  const campo = document.getElementById("links-busca");
  campo.addEventListener("input", () => {
    estado.buscaLinks = campo.value;
    const pos = campo.selectionStart;
    renderAdminConvites();
    const novo = document.getElementById("links-busca");
    novo.focus(); novo.setSelectionRange(pos, pos);
  });
  document.querySelectorAll("#content-admin [data-editar-link]").forEach(b =>
    b.addEventListener("click", () => editarLink(b.getAttribute("data-editar-link"))));
  document.querySelectorAll("#content-admin [data-copiar-link]").forEach(b =>
    b.addEventListener("click", () => copiarEnderecoDoLink(b.getAttribute("data-copiar-link"), b)));
  document.querySelectorAll("#content-admin [data-arquivar-link]").forEach(b =>
    b.addEventListener("click", () => arquivarLink(b.getAttribute("data-arquivar-link"), true)));
  document.querySelectorAll("#content-admin [data-repor-link]").forEach(b =>
    b.addEventListener("click", () => arquivarLink(b.getAttribute("data-repor-link"), false)));
  document.querySelectorAll("#content-admin [data-inscritos-do-link]").forEach(b =>
    b.addEventListener("click", () => verInscritosDoLink(b.getAttribute("data-inscritos-do-link"))));
  document.querySelectorAll("#content-admin .link-endereco input").forEach(i => i.addEventListener("focus", () => i.select()));
}

/* A descrição na lista: sem as marcas do negrito, do itálico e dos links, e
   só o começo. */
function resumoDaDescricaoDoLink(texto){
  const limpo = String(texto || "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
  return limpo.length > 110 ? limpo.slice(0, 110) + "…" : limpo;
}

function linhaDoLink(l){
  const inscritos = inscricoesDoLink(l);
  const entraram = inscritos.filter(c => c.estado === "aceite").length;
  const est = estadoDoLink(l);
  const aviso = est === "esgotado" ? `<span class="pill pill-quente">Esgotado</span>`
    : est === "indisponivel" ? `<span class="pill pill-risco">Sem nada para dar</span>` : "";
  const titulo = textoSeguro(l.titulo);
  return `
    <tr data-link="${l.id}">
      <td class="link-chamada">
        <div class="nome">${titulo} ${aviso}</div>
        ${l.descricao ? `<div class="sub-celula">${textoSeguro(resumoDaDescricaoDoLink(l.descricao))}</div>` : ""}
      </td>
      <td class="link-da">${oQueOLinkDa(l)}${l.telefoneObrigatorio ? `<div class="sub-celula">Pede o WhatsApp</div>` : ""}</td>
      <td>
        <button type="button" class="link-inscritos" data-inscritos-do-link="${l.id}" ${inscritos.length ? "" : "disabled"}>
          ${inscritos.length} ${inscritos.length === 1 ? "inscrito" : "inscritos"}${l.limite ? ` de ${l.limite}` : ""}${inscritos.length ? " →" : ""}
        </button>
        ${inscritos.length ? `<div class="sub-celula">${entraram === 1 ? "1 já entrou" : entraram + " já entraram"}</div>` : ""}
      </td>
      <td>
        <div class="link-endereco">
          <input type="text" readonly value="${enderecoDoLink(l).replace(/"/g, "&quot;")}" aria-label="Endereço do link «${titulo.replace(/"/g, "&quot;")}»">
          <button class="btn-icone" type="button" data-copiar-link="${l.id}" title="Copiar" aria-label="Copiar o endereço do link «${titulo.replace(/"/g, "&quot;")}»">${ICONE_COPIAR}</button>
        </div>
      </td>
      <td><div class="acoes-linha">
        <button class="btn-icone" type="button" data-editar-link="${l.id}" title="Editar" aria-label="Editar o link «${titulo.replace(/"/g, "&quot;")}»">${ICONE_EDITAR}</button>
        ${l.arquivado
          ? `<button class="btn-icone" type="button" data-repor-link="${l.id}" title="Reverter arquivamento" aria-label="Reverter o arquivamento do link «${titulo.replace(/"/g, "&quot;")}»">${ICONE_REPOR}</button>`
          : `<button class="btn-icone" type="button" data-arquivar-link="${l.id}" title="Arquivar" aria-label="Arquivar o link «${titulo.replace(/"/g, "&quot;")}»">${ICONE_ARQUIVAR}</button>`}
      </div></td>
    </tr>`;
}

function copiarEnderecoDoLink(id, botao){
  const l = linkDeInscricaoPorId(id);
  if(!l) return;
  const endereco = enderecoDoLink(l);
  const feito = () => { mostrarToast("Copiado"); if(botao){ botao.classList.add("copiado"); setTimeout(() => botao.classList.remove("copiado"), 1500); } };
  const aMao = () => {
    const campo = document.querySelector(`tr[data-link="${id}"] .link-endereco input`);
    if(campo){ campo.focus(); campo.select(); }
    mostrarToast("Não foi possível copiar sozinho: o endereço ficou selecionado.");
  };
  if(navigator.clipboard) navigator.clipboard.writeText(endereco).then(feito, aMao);
  else aMao();
}

/* «N inscritos →» leva aos convites que nasceram deste link. */
function verInscritosDoLink(id){
  const l = linkDeInscricaoPorId(id);
  if(!l) return;
  estado.abaConvites = "email";
  estado.filtroConvites = "todos";
  estado.linkDosConvites = id;
  estado.buscaConvites = "";
  renderAdminConvites();
}

function editarLink(id){
  const l = id ? linkDeInscricaoPorId(id) : null;
  if(id && !l) return;
  const niveis = (DB.niveis || []).map(n => ({ valor:n.id, rotulo:n.nome }));
  const turmasEscolhidas = Object.assign({}, (l && l.turmas) || {});
  abrirDrawer({
    titulo: l ? "Editar link de inscrição" : "Novo link de inscrição",
    subtitulo: "Quem preencher o formulário recebe por email o link para entrar, com o que for escolhido aqui.",
    campos: [
      { nome:"titulo", rotulo:"Título", tipo:"texto", obrigatorio:true, placeholder:"O título que aparece na página do convite" },
      { nome:"limite", rotulo:"Limite de inscrições", tipo:"numero", placeholder:"Em branco: sem limite",
        dica:"Chegado o limite, a página deixa de aceitar inscrições." },
      { nome:"descricao", rotulo:"Descrição", tipo:"textarea", placeholder:"Uma breve descrição do que a pessoa recebe",
        dica:"Aceita **negrito**, *itálico* e [links](https://exemplo.com)." },
      { nome:"telefoneObrigatorio", rotulo:"WhatsApp obrigatório", tipo:"toggle",
        dica:"Ligado, a pessoa só se inscreve se der o número." },
      { nome:"modalidade", rotulo:"O que este link dá", tipo:"select", opcoes:MODALIDADES_DO_CONVITE },
      { nome:"cursos", rotulo:"Cursos incluídos", tipo:"checklist", cartoes:true, opcoes: cursosParaConvidar() },
      { nome:"nivelId", rotulo:"Assinatura incluída", tipo:"select",
        opcoes: niveis.length ? niveis : [{ valor:"", rotulo:"Ainda não há assinaturas" }],
        dica:"Fica ativa pelo trial da assinatura; sem trial, pela extensão dela; sem nenhum dos dois, sem prazo." },
      { nome:"fundo", rotulo:"Imagem de fundo", tipo:"imagem", pasta:"convites",
        dica:"Enche o ecrã atrás do cartão. Evite imagens com texto. Tamanho recomendado: 1920 × 1080 px." }
    ],
    valores: l ? Object.assign({}, l, { limite: l.limite || "", nivelId: l.nivelId || (niveis[0] || {}).valor || "" })
               : { modalidade:"cursos", cursos:[], nivelId:(niveis[0] || {}).valor || "", telefoneObrigatorio:false, limite:"" },
    textoGuardar: l ? "Guardar" : "Criar link",
    aoGuardar: v => {
      if(!String(v.titulo || "").trim()){ mostrarToast("O link de inscrição precisa de um título."); return false; }
      const limite = v.limite === "" || v.limite === null || v.limite === undefined ? null : Number(v.limite);
      if(limite !== null && (!Number.isInteger(limite) || limite < 1)){ mostrarToast("O limite de inscrições é um número inteiro a partir de 1, ou fica em branco."); return false; }
      if(v.modalidade === "cursos" && !(v.cursos || []).length){ mostrarToast("Escolha pelo menos um curso para este link."); return false; }
      if(v.modalidade === "assinatura" && !nivelPorId(v.nivelId)){ mostrarToast("Escolha a assinatura que este link dá. Criam-se em Assinaturas."); return false; }
      guardarLink(l, {
        titulo: String(v.titulo).trim(), descricao: String(v.descricao || "").trim(), limite,
        telefoneObrigatorio: !!v.telefoneObrigatorio, modalidade: v.modalidade,
        cursos: v.modalidade === "cursos" ? v.cursos : [],
        turmas: v.modalidade === "cursos" ? turmasParaGuardar(v.cursos, turmasEscolhidas) : {},
        nivelId: v.modalidade === "assinatura" ? v.nivelId : null,
        fundo: v.fundo || ""
      });
      /* A gaveta fica aberta até a base responder. */
      return false;
    }
  });
  ligarEscolhaDoQueSeDa({ seletor:"valor-modalidade", turmasEscolhidas,
    nota:"O prazo do acesso é o da turma, e conta do dia em que a pessoa entra. Muda-se em Turmas." });
}

/* Seis caracteres, sem 0, O, 1, l e I, que se confundem ao copiar à mão. */
function novoCodigoDeLink(){
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let codigo;
  do {
    codigo = Array.from({ length:6 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join("");
  } while((DB.linksDeInscricao || []).some(x => x.codigo === codigo));
  return codigo;
}

async function guardarLink(antigo, dados){
  try {
    if(modoDemonstracao()){
      DB.linksDeInscricao = DB.linksDeInscricao || [];
      if(antigo) Object.assign(antigo, dados);
      else DB.linksDeInscricao.unshift(Object.assign({ id:novoId("lk"), codigo:novoCodigoDeLink(), arquivado:false, criadoEm:new Date().toISOString() }, dados));
      guardarDB();
    } else {
      await API.guardarLink(antigo ? antigo.id : null, dados);
      await API.recarregarLinks();
    }
    fecharDrawer();
    estado.linksArquivados = antigo ? !!antigo.arquivado : false;
    renderAdminConvites();
    mostrarToast(antigo ? "Link guardado" : "Link criado");
  } catch(e){ mostrarToast(e.message || "Não foi possível guardar o link."); }
}

function arquivarLink(id, arquivar){
  const l = linkDeInscricaoPorId(id);
  if(!l) return;
  const fazer = async () => {
    try {
      if(modoDemonstracao()){ l.arquivado = arquivar; guardarDB(); }
      else { await API.arquivarLink(id, arquivar); await API.recarregarLinks(); }
      renderAdminConvites();
      mostrarToast(arquivar ? "Link arquivado" : "O link voltou a aceitar inscrições");
    } catch(e){ mostrarToast(e.message || "Não foi possível mudar o link."); }
  };
  if(!arquivar){ fazer(); return; }
  confirmarAcao({
    titulo: "Arquivar o link",
    mensagem: `«${textoSeguro(l.titulo)}» deixa de aceitar inscrições. Quem já se inscreveu fica com o que recebeu, e pode reverter o arquivamento quando quiser.`,
    textoConfirmar: "Arquivar",
    aoConfirmar: fazer
  });
}
