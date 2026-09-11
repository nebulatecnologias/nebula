/* ============================================================
   Componentes partilhados do painel de administração.
   Um só motor de formulários alimenta todas as abas: cada ecrã
   descreve os campos e recebe os valores de volta ao guardar.
   ============================================================ */

/* Campos suportados: texto, textarea, numero, select, toggle, cor, url, data, hora, imagem, gradiente */
function abrirDrawer({ titulo, subtitulo, campos, valores = {}, textoGuardar = "Guardar", aoGuardar }){
  fecharDrawer();

  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  overlay.id = "drawer-overlay";
  overlay.innerHTML = `
    <div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head">
        <div>
          <h3>${titulo}</h3>
          ${subtitulo ? `<p class="drawer-sub">${subtitulo}</p>` : ""}
        </div>
        <button class="modal-close" type="button" data-fechar><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="drawer-body">${campos.map(c=>campoHTML(c, valores[c.nome])).join("")}</div>
      <div class="drawer-foot">
        <button class="btn btn-secondary" type="button" data-fechar>Cancelar</button>
        <button class="btn btn-primary" type="button" id="drawer-guardar">${textoGuardar}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", fecharDrawer));
  overlay.addEventListener("click", e => { if(e.target===overlay) fecharDrawer(); });

  overlay.querySelectorAll(".campo-toggle").forEach(t => t.addEventListener("click", () => t.classList.toggle("on")));
  overlay.querySelectorAll(".checklist-item input").forEach(i =>
    i.addEventListener("change", () => i.closest(".checklist-item").classList.toggle("escolhido", i.checked)));
  overlay.querySelectorAll("[data-imagem]").forEach(botao => {
    const nome = botao.getAttribute("data-imagem");
    const input = overlay.querySelector(`#ficheiro-${nome}`);
    botao.addEventListener("click", () => input.click());
    input.addEventListener("change", e => {
      const ficheiro = e.target.files[0];
      if(!ficheiro) return;
      const leitor = new FileReader();
      leitor.onload = ev => {
        overlay.querySelector(`#valor-${nome}`).value = ev.target.result;
        const previa = overlay.querySelector(`#previa-${nome}`);
        previa.style.backgroundImage = `url(${ev.target.result})`;
        previa.classList.add("tem-imagem");
      };
      leitor.readAsDataURL(ficheiro);
    });
  });

  document.getElementById("drawer-guardar").addEventListener("click", () => {
    const recolhidos = {};
    let erro = null;
    campos.forEach(c => {
      const el = overlay.querySelector(`#valor-${c.nome}`);
      let valor;
      if(c.tipo==="toggle") valor = el.classList.contains("on");
      else if(c.tipo==="checklist") valor = [...el.querySelectorAll("input:checked")].map(i=>i.value);
      else if(c.tipo==="numero") valor = el.value==="" ? null : Number(el.value);
      else valor = el.value.trim();
      if(c.obrigatorio && (valor===null || valor==="" || (Array.isArray(valor) && !valor.length))) erro = erro || `Preenche o campo "${c.rotulo}".`;
      recolhidos[c.nome] = valor;
    });
    if(erro){ mostrarToast(erro); return; }
    /* Se o ecrã recusar os valores (devolvendo false), o drawer fica
       aberto para a pessoa corrigir sem perder o que escreveu. */
    if(aoGuardar(recolhidos) === false) return;
    fecharDrawer();
  });

  requestAnimationFrame(() => overlay.classList.add("aberto"));
  document.addEventListener("keydown", fecharDrawerComEsc);
}

function campoHTML(c, valor){
  const v = valor === undefined || valor === null ? (c.padrao !== undefined ? c.padrao : "") : valor;
  const dica = c.dica ? `<p class="hint">${c.dica}</p>` : "";

  if(c.tipo==="toggle"){
    return `<div class="toggle-row" style="border-top:none;padding:10px 0;">
      <div><div class="t-title">${c.rotulo}</div>${c.dica?`<div class="t-sub">${c.dica}</div>`:""}</div>
      <div class="toggle campo-toggle ${v?"on":""}" id="valor-${c.nome}"><div class="knob"></div></div>
    </div>`;
  }
  if(c.tipo==="textarea"){
    return `<div class="field"><label>${c.rotulo}</label><textarea id="valor-${c.nome}" rows="3" placeholder="${c.placeholder||""}">${v}</textarea>${dica}</div>`;
  }
  if(c.tipo==="select"){
    return `<div class="field"><label>${c.rotulo}</label>
      <div class="select-wrap" style="display:block;"><select id="valor-${c.nome}" style="width:100%;">
        ${c.opcoes.map(o=>`<option value="${o.valor}" ${String(o.valor)===String(v)?"selected":""}>${o.rotulo}</option>`).join("")}
      </select></div>${dica}</div>`;
  }
  if(c.tipo==="checklist"){
    const escolhidos = Array.isArray(v) ? v : [];
    return `<div class="field"><label>${c.rotulo}</label>
      <div class="checklist" id="valor-${c.nome}">
        ${c.opcoes.map(o => `
          <label class="checklist-item ${escolhidos.includes(o.valor)?"escolhido":""}">
            <input type="checkbox" value="${o.valor}" ${escolhidos.includes(o.valor)?"checked":""}>
            <span>${o.rotulo}</span>
          </label>`).join("")}
      </div>${dica}</div>`;
  }
  if(c.tipo==="cor"){
    return `<div class="field"><label>${c.rotulo}</label>
      <div class="campo-cor"><input type="color" id="valor-${c.nome}" value="${v||"#ff5a1f"}"><span>${c.dica||"Cor da categoria"}</span></div></div>`;
  }
  if(c.tipo==="imagem"){
    return `<div class="field"><label>${c.rotulo}</label>
      <div class="campo-imagem">
        <div class="previa-imagem ${v?"tem-imagem":""}" id="previa-${c.nome}" style="${v?`background-image:url(${v})`:""}"></div>
        <div>
          <button class="btn btn-secondary btn-sm" type="button" data-imagem="${c.nome}">Escolher imagem</button>
          <input type="file" accept="image/*" class="hidden" id="ficheiro-${c.nome}">
          ${dica}
        </div>
      </div>
      <input type="hidden" id="valor-${c.nome}" value="${v}">
    </div>`;
  }
  const tipoInput = c.tipo==="numero" ? "number" : c.tipo==="data" ? "date" : c.tipo==="hora" ? "time" : c.tipo==="url" ? "url" : "text";
  return `<div class="field"><label>${c.rotulo}</label><input type="${tipoInput}" id="valor-${c.nome}" value="${v}" placeholder="${c.placeholder||""}">${dica}</div>`;
}

function fecharDrawerComEsc(e){ if(e.key==="Escape") fecharDrawer(); }

function fecharDrawer(){
  const overlay = document.getElementById("drawer-overlay");
  if(!overlay) return;
  document.removeEventListener("keydown", fecharDrawerComEsc);
  overlay.classList.remove("aberto");
  setTimeout(() => overlay.remove(), 180);
}

/* Confirmação para ações destrutivas (apagar curso, aula, evento...) */
function confirmarAcao({ titulo, mensagem, textoConfirmar = "Apagar", aoConfirmar }){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="card confirm-card">
      <h3>${titulo}</h3>
      <p>${mensagem}</p>
      <div class="confirm-acoes">
        <button class="btn btn-secondary" type="button" data-cancelar>Cancelar</button>
        <button class="btn btn-perigo" type="button" data-confirmar>${textoConfirmar}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fechar = () => overlay.remove();
  overlay.querySelector("[data-cancelar]").addEventListener("click", fechar);
  overlay.addEventListener("click", e => { if(e.target===overlay) fechar(); });
  overlay.querySelector("[data-confirmar]").addEventListener("click", () => { fechar(); aoConfirmar(); });
}

/* Cabeçalho comum das páginas de administração */
function cabecalhoAdmin({ titulo, descricao, acaoRotulo, acaoId }){
  return `
    <div class="page-head-flex">
      <div class="page-head">
        <span class="eyebrow">PAINEL DE ADMINISTRAÇÃO</span>
        <h1>${titulo}</h1>
        ${descricao ? `<p class="desc">${descricao}</p>` : ""}
      </div>
      ${acaoRotulo ? `<button class="btn btn-primary" id="${acaoId}">+ ${acaoRotulo}</button>` : ""}
    </div>
  `;
}

/* Botões de linha das tabelas de administração */
function acoesLinha(id){
  return `<div class="acoes-linha">
    <button class="btn-icone" data-editar="${id}" title="Editar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
    <button class="btn-icone perigo" data-apagar="${id}" title="Apagar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
  </div>`;
}


/* Opções de categoria para os campos "select" das várias abas */
function opcoesCategorias(){
  return Object.entries(DB.categorias).map(([id,c]) => ({ valor:id, rotulo:c.nome }));
}

/* Troca um item de posição numa lista (usado para reordenar módulos, aulas, banners) */
function mover(lista, indice, direcao){
  const destino = indice + direcao;
  if(indice<0 || destino<0 || destino>=lista.length) return;
  [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
}


/* ============================================================
   Peças dos formulários de página inteira (curso e aula)
   ============================================================ */

/* Caixa de escolha com título e explicação, como nas páginas de curso. */
function checkCardHTML(id, marcado, titulo, sub){
  return `<div class="check-card ${marcado?"marcado":""}" id="${id}">
    <span class="check-quadro">${iconeCheck()}</span>
    <div><strong>${titulo}</strong>${sub?`<span>${sub}</span>`:""}</div>
  </div>`;
}
function ligarCheckCards(raiz){
  (raiz||document).querySelectorAll(".check-card").forEach(c =>
    c.addEventListener("click", () => c.classList.toggle("marcado")));
}

/* Zona de imagem: mostra a capa atual, aceita um ficheiro e guarda-o
   como data URL no input escondido que o formulário lê ao gravar. */
function uploadHTML(nome, valor, dica, tamanho){
  return `<div class="upload-box ${tamanho||""} ${valor?"tem-imagem":""}" id="caixa-${nome}" style="${valor?`background-image:url(${valor})`:""}">
    <span class="upload-dica">${dica}</span>
    <div class="upload-acoes">
      <button class="btn btn-secondary btn-sm" type="button" data-escolher="${nome}">${valor?"Trocar imagem":"Escolher imagem"}</button>
      <button class="btn btn-secondary btn-sm ${valor?"":"hidden"}" type="button" data-limpar="${nome}">Remover</button>
    </div>
    <input type="file" accept="image/*" class="hidden" id="ficheiro-${nome}">
    <input type="hidden" id="valor-${nome}" value="${valor||""}">
  </div>`;
}
function ligarUploads(raiz){
  const r = raiz || document;
  r.querySelectorAll("[data-escolher]").forEach(b => {
    const nome = b.getAttribute("data-escolher");
    const input = r.querySelector(`#ficheiro-${nome}`);
    b.addEventListener("click", () => input.click());
    input.addEventListener("change", e => {
      const ficheiro = e.target.files[0];
      if(!ficheiro) return;
      const leitor = new FileReader();
      leitor.onload = ev => aplicarImagem(r, nome, ev.target.result);
      leitor.readAsDataURL(ficheiro);
    });
  });
  r.querySelectorAll("[data-limpar]").forEach(b =>
    b.addEventListener("click", () => aplicarImagem(r, b.getAttribute("data-limpar"), "")));
}
function aplicarImagem(raiz, nome, url){
  const caixa = raiz.querySelector(`#caixa-${nome}`);
  raiz.querySelector(`#valor-${nome}`).value = url;
  caixa.style.backgroundImage = url ? `url(${url})` : "";
  caixa.classList.toggle("tem-imagem", !!url);
  caixa.querySelector("[data-escolher]").textContent = url ? "Trocar imagem" : "Escolher imagem";
  caixa.querySelector("[data-limpar]").classList.toggle("hidden", !url);
}

/* Menu de três pontos, ancorado ao botão que o abriu. */
function abrirMenu(botao, itens){
  fecharMenus();
  const menu = document.createElement("div");
  menu.className = "menu-flutuante";
  menu.innerHTML = itens.map((it,i) =>
    `<button type="button" data-i="${i}" class="${it.perigo?"perigo":""}" ${it.desativado?"disabled":""}>${it.rotulo}</button>`).join("");
  document.body.appendChild(menu);

  const r = botao.getBoundingClientRect();
  /* Abre para cima quando não há espaço por baixo. */
  const altura = menu.offsetHeight;
  const paraCima = r.bottom + altura + 8 > window.innerHeight;
  menu.style.top = (paraCima ? r.top - altura - 6 : r.bottom + 6) + window.scrollY + "px";
  menu.style.left = Math.max(12, r.right - menu.offsetWidth) + window.scrollX + "px";

  menu.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    const it = itens[Number(b.getAttribute("data-i"))];
    fecharMenus();
    if(!it.desativado) it.accao();
  }));
  setTimeout(() => document.addEventListener("click", fecharMenus, { once:true }), 0);
}
function fecharMenus(){ document.querySelectorAll(".menu-flutuante").forEach(m => m.remove()); }
