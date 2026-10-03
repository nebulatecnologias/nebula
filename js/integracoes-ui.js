/* ============================================================
   Integrações — as peças que a escola e a consola partilham
   (pedido do Shelton a 02/10/2026, no modelo da Memberkit):
   separadores Instaladas · Disponíveis · Histórico, um cartão por
   aplicação e, ao abrir o cartão, a ficha com as instruções.

   Só desenho: cada página diz o que está instalado e o que a ficha
   leva dentro. Os logótipos são marcas nominais (o nome da aplicação
   na cor dela), para se reconhecer a aplicação de relance.
   ============================================================ */

const IntegracoesUI = (() => {
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ""}>${d}</svg>`;

  /* O desenho de cada aplicação: um sinal pequeno e o nome. */
  const MARCAS = {
    payflow:  { cor:"#842DE3", sinal:`<span class="int-sinal" style="background:#842DE3;color:#fff">F</span>`, nome:"Payflow" },
    youtube:  { cor:"#0f0f0f", sinal:`<span class="int-sinal int-sinal-yt"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="5" width="22" height="14" rx="4.5" fill="#ff0033"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/></svg></span>`, nome:"YouTube" },
    vimeo:    { cor:"#17a9d9", sinal:"", nome:"vimeo", classe:"int-nome-vimeo" },
    panda:    { cor:"#1c1a17", sinal:`<span class="int-sinal" style="background:#1c1a17;color:#fff">${svg('<circle cx="8.5" cy="10" r="1.6" fill="currentColor"/><circle cx="15.5" cy="10" r="1.6" fill="currentColor"/><path d="M9 15c1.8 1.3 4.2 1.3 6 0"/>')}</span>`, nome:"panda video" },
    bunny:    { cor:"#f27c10", sinal:`<span class="int-sinal" style="background:#ffefe0;color:#f27c10">${svg('<path d="M9 3c-1 3 0 6 2 8M15 3c1 3 0 6-2 8"/><ellipse cx="12" cy="15.5" rx="5" ry="4.5"/>')}</span>`, nome:"bunny.net" },
    zoom:     { cor:"#0b5cff", sinal:`<span class="int-sinal" style="background:#0b5cff;color:#fff">${svg('<rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="m15 11 5-3v8l-5-3"/>')}</span>`, nome:"zoom" },
    meet:     { cor:"#1e8e3e", sinal:`<span class="int-sinal" style="background:#e6f4ea;color:#1e8e3e">${svg('<rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="m15 11 5-3v8l-5-3"/>')}</span>`, nome:"Google Meet" },
    whatsapp: { cor:"#1faa53", sinal:`<span class="int-sinal" style="background:#25d366;color:#fff">${svg('<path d="M4.5 19.5 6 15.6A7.5 7.5 0 1 1 8.6 18z"/><path d="M9.5 9.5c.3 2 2.2 3.9 4.6 4.6"/>')}</span>`, nome:"WhatsApp" },
    email:    { cor:"#3b3732", sinal:`<span class="int-sinal" style="background:var(--sunken);color:var(--ink-2)">${svg('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/>')}</span>`, nome:"Email" },
    webhook:  { cor:"#c2185b", sinal:`<span class="int-sinal" style="background:#fde8f0;color:#c2185b">${svg('<path d="M10 4.5a3.5 3.5 0 0 0-2 6.3L5 16"/><path d="M13.5 6.3a3.5 3.5 0 1 1 1.6 5.2L12 16.5"/><path d="M5 16a3.5 3.5 0 1 0 3.5 3.5H17"/><circle cx="18.5" cy="19.5" r="1.5"/>')}</span>`, nome:"Webhooks" },
    resend:   { cor:"#1c1a17", sinal:`<span class="int-sinal" style="background:#1c1a17;color:#fff">R</span>`, nome:"Resend" },
    vercel:   { cor:"#1c1a17", sinal:`<span class="int-sinal" style="background:#1c1a17;color:#fff"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6 19 18H5z" fill="currentColor"/></svg></span>`, nome:"Vercel" }
  };

  function logo(id, grande){
    const m = MARCAS[id] || { cor:"var(--ink)", sinal:"", nome:id };
    return `<span class="int-logo${grande ? " grande" : ""}">${m.sinal}<span class="int-nome ${m.classe || ""}" style="color:${m.cor}">${esc(m.nome)}</span></span>`;
  }

  function abas(ativa, n){
    const A = [["instaladas", "Instaladas", n.instaladas], ["disponiveis", "Disponíveis", n.disponiveis], ["historico", "Histórico", n.historico]];
    return `<div class="int-abas" role="tablist" aria-label="Integrações">
      ${A.map(([k, r, c]) => `<button type="button" role="tab" class="int-aba${ativa === k ? " ativa" : ""}" aria-selected="${ativa === k}" data-int-aba="${k}">${r}<span class="int-aba-n">${c}</span></button>`).join("")}
    </div>`;
  }

  /* Disponíveis: um cartão por aplicação, o logótipo grande e a categoria. */
  function cartao(app){
    const breve = app.estado === "em_breve";
    return `<button type="button" class="int-cartao${breve ? " em-breve" : ""}" data-int-abrir="${esc(app.id)}" aria-label="${esc(app.nome)} — ${esc(app.categoria)}${breve ? ", em breve" : ""}">
      <span class="int-cartao-logo">${logo(app.marca || app.id, true)}</span>
      <span class="int-cartao-pe"><span>${esc(app.categoria)}</span>
        ${app.instalada ? `<span class="pill pill-ativo">Instalada</span>` : breve ? `<span class="pill pill-teste">Em breve</span>` : app.indicada ? `<span class="pill int-indicada">Indicada</span>` : ""}</span>
    </button>`;
  }

  /* Instaladas: uma linha por aplicação ligada. */
  function linha(app){
    return `<div class="int-linha" data-int-instalada="${esc(app.id)}">
      <span class="int-linha-logo">${(MARCAS[app.marca || app.id] || {}).sinal || ""}</span>
      <div class="int-linha-texto"><strong>${esc(app.titulo || app.nome)}</strong><span>${esc(app.descricao)}</span></div>
      <span class="pill ${app.tom === "aviso" ? "pill-risco" : "pill-ativo"}">${esc(app.estadoTexto || "Ativo")}</span>
      <button type="button" class="btn-icone int-config" data-int-abrir="${esc(app.id)}" aria-label="Configurar ${esc(app.nome)}" title="Configurar">${svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>', 'class="icon icon-sm"')}</button>
    </div>`;
  }

  /* A ficha: o logótipo e as acções à esquerda, as instruções à direita. */
  function ficha(app, accoes, corpo){
    return `<div class="int-ficha" data-int-ficha="${esc(app.id)}">
      <div class="int-ficha-topo">
        <div><h1>${esc(app.nome)}</h1><p>${esc(app.categoria)}${app.instalada ? " · instalada" : app.estado === "em_breve" ? " · em breve" : ""}</p></div>
        <button type="button" class="btn btn-secondary" data-int-voltar>${svg('<path d="M19 12H5M12 19l-7-7 7-7"/>', 'class="icon icon-sm"')}Voltar</button>
      </div>
      <div class="int-ficha-grelha">
        <div class="int-ficha-lado">
          <div class="int-ficha-logo">${logo(app.marca || app.id, true)}</div>
          ${accoes || ""}
        </div>
        <div class="int-ficha-corpo">${corpo}</div>
      </div>
    </div>`;
  }

  /* Um valor para copiar (o endereço que recebe, por exemplo). */
  function copiar(valor, rotulo){
    return `<div class="int-copiar">
      <label>${esc(rotulo)}</label>
      <div><code class="int-copiar-valor" aria-label="${esc(rotulo)}">${esc(valor)}</code><button type="button" class="btn btn-secondary btn-sm" data-int-copiar>Copiar</button></div>
    </div>`;
  }

  function ligarCopiar(raiz){
    raiz.querySelectorAll("[data-int-copiar]").forEach(b => b.addEventListener("click", () => {
      const valor = b.parentElement.querySelector(".int-copiar-valor").textContent;
      try { navigator.clipboard.writeText(valor); }
      catch(e){ const r = document.createRange(); r.selectNodeContents(b.parentElement.querySelector(".int-copiar-valor")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { document.execCommand("copy"); } catch(_){} }
      b.textContent = "Copiado";
      setTimeout(() => { b.textContent = "Copiar"; }, 1600);
    }));
  }

  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  function quando(iso){
    const d = new Date(iso); if(isNaN(d)) return "";
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return { MARCAS, logo, abas, cartao, linha, ficha, copiar, ligarCopiar, quando, esc };
})();
