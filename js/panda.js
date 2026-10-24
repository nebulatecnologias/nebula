/* ============================================================
   Panda Video nativo (pedido do Shelton a 19/10/2026)
   Cada escola liga a conta Panda dela uma vez, em Integrações, com a
   chave da API. A partir daí, o separador Vídeo da aula mostra a
   biblioteca inteira (pastas, procura, miniaturas) e a escolha liga o
   vídeo à aula, com a duração já preenchida.

   24/10/2026: a biblioteca abre já aberta no separador Vídeo, e escolhe
   vários vídeos de uma vez para criar as aulas de um módulo (também a
   partir do editor do curso). Com mais de um provedor ligado, escolhe-se
   o provedor dentro da própria biblioteca.

   A chave nunca vem ao browser: quem fala com o Panda é a Edge Function
   panda-video, que só devolve a lista. O que fica gravado na aula é o
   endereço do leitor (video_player), como se tivesse sido colado:
   o resto da Academia (playerHTML, urlDoVideo) não muda.
   ============================================================ */

const Panda = (() => {
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let estado = null;      // { ligada, chaveFim, ligadaEm, podeLigar }
  let pastasLidas = null; // cache da sessão: as pastas mudam pouco

  /* ---------------- Demonstração ---------------- */
  function demo(){
    if(!DB.pandaDemo){
      const pastas = [
        { id:"d0000000-0000-4000-8000-000000000001", nome:"Programa principal", pai:null, videos:4 },
        { id:"d0000000-0000-4000-8000-000000000002", nome:"Módulo 1 · Fundamentos", pai:"d0000000-0000-4000-8000-000000000001", videos:3 },
        { id:"d0000000-0000-4000-8000-000000000003", nome:"Encontros ao vivo", pai:null, videos:2 }
      ];
      const v = (n, titulo, pasta, duracao, estado = "CONVERTED") => ({
        id:`e0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`, titulo, estado, duracao, miniatura:null,
        player:`https://player-vz-demo.tv.pandavideo.com.br/embed/?v=demo${n}`, externo:`demo${n}`, pasta, criado:new Date(Date.now() - n * 864e5).toISOString()
      });
      DB.pandaDemo = {
        estado: { ligada:false, chaveFim:null, ligadaEm:null, podeLigar:true },
        pastas,
        videos: [
          v(1, "Boas-vindas à academia.mp4", null, 184),
          v(2, "O mapa do programa", "d0000000-0000-4000-8000-000000000001", 412),
          v(3, "Aula 1 · O ponto de partida", "d0000000-0000-4000-8000-000000000002", 1325),
          v(4, "Aula 2 · O erro mais comum", "d0000000-0000-4000-8000-000000000002", 978),
          v(5, "Aula 3 · O plano da semana", "d0000000-0000-4000-8000-000000000002", 1504, "CONVERTING"),
          v(6, "Encontro de março", "d0000000-0000-4000-8000-000000000003", 3720),
          v(7, "Encontro de abril", "d0000000-0000-4000-8000-000000000003", 3488)
        ]
      };
    }
    return DB.pandaDemo;
  }

  async function chamar(accao, dados = {}){
    if(modoDemonstracao()) return chamarDemo(accao, dados);
    return API.panda(accao, dados);
  }

  function chamarDemo(accao, dados){
    const d = demo();
    if(accao === "estado") return Object.assign({}, d.estado);
    if(accao === "ligar"){
      if(!/^[A-Za-z0-9._-]{16,300}$/.test(dados.chave || "")) throw new Error("O Panda não aceitou a chave. Copie-a outra vez em Configurações › Avançado › Chave da API, no Panda.");
      d.estado = { ligada:true, chaveFim:dados.chave.slice(-4), ligadaEm:new Date().toISOString(), podeLigar:true };
      guardarDB(); return Object.assign({}, d.estado);
    }
    if(accao === "desligar"){ d.estado = { ligada:false, chaveFim:null, ligadaEm:null, podeLigar:true }; guardarDB(); return Object.assign({}, d.estado); }
    if(!d.estado.ligada) throw new Error("O Panda ainda não está ligado nesta escola. Ligue-o em Integrações.");
    if(accao === "pastas") return { pastas: d.pastas };
    if(accao === "duracoes"){
      const ids = new Set(dados.ids || []);
      return { duracoes: Object.fromEntries(d.videos.filter(v => ids.has(v.externo)).map(v => [v.externo, v.duracao])) };
    }
    const t = String(dados.titulo || "").toLowerCase();
    const lista = d.videos.filter(v => t ? v.titulo.toLowerCase().includes(t)
      : dados.pasta ? v.pasta === dados.pasta : dados.raiz ? !v.pasta : true);
    return { videos: lista, pagina: 1, porPagina: 48, mais: false };
  }

  /* ---------------- Estado da ligação ---------------- */
  async function lerEstado(forcar){
    if(estado && !forcar) return estado;
    try { estado = await chamar("estado"); }
    catch(e){ estado = { ligada:false, podeLigar:false, erro:e.message }; }
    return estado;
  }
  async function ligar(chave){
    estado = await chamar("ligar", { chave });
    pastasLidas = null;
    return estado;
  }
  async function desligar(){
    estado = await chamar("desligar");
    pastasLidas = null;
    return estado;
  }

  /* As durações que faltam, pelo id público do vídeo (o ?v= do leitor). */
  function idDoLeitor(url){
    try {
      const u = new URL(url);
      return /pandavideo\.com(\.br)?$/i.test(u.hostname) ? (u.searchParams.get("v") || "") : "";
    } catch(e){ return ""; }
  }
  async function duracoes(ids){
    if(!ids.length) return {};
    return (await chamar("duracoes", { ids })).duracoes || {};
  }

  /* ---------------- Os provedores com biblioteca ----------------
     Hoje só o Panda liga de verdade. Outro (Bunny, Vimeo…) entra aqui com
     o mesmo contrato: { id, nome, ligado(), chamar(accao, dados) }, e a
     biblioteca passa a mostrar a escolha do provedor sozinha. */
  const PROVEDORES = [
    { id:"panda", nome:"Panda Video", ligado: () => !!(estado && estado.ligada), chamar }
  ];
  function provedoresLigados(){ return PROVEDORES.filter(p => p.ligado()); }

  /* «Aula 1.mp4» dá uma aula chamada «Aula 1». */
  function tituloDaAula(t){
    return String(t || "").replace(/\.(mp4|mov|m4v|mkv|webm|avi|wmv|mpe?g)$/i, "").replace(/\s+/g, " ").trim() || "Aula sem título";
  }

  function duracao(segundos){
    return typeof formatarDuracao === "function" ? formatarDuracao(segundos) : "";
  }

  /* ---------------- A biblioteca ----------------
     montar(alvo, opcoes) pinta a biblioteca dentro de `alvo`:
       atual          endereço do leitor já ligado (o cartão vem marcado)
       aoEscolher(v)  escolher um vídeo (v: { id, titulo, duracao, player, miniatura })
       varios         { modulos:[{ id, titulo }], modulo, aoCriar(videos, moduloId) }
                      liga a seleção de vários, para criar as aulas de um módulo
       emVarios       abre já a escolher vários
       janela         { aoFechar } quando vive numa janela
     Devolve { focar }. */
  function montar(alvo, opcoes = {}){
    const { atual, aoEscolher, varios, janela } = opcoes;
    const ligados = provedoresLigados();
    let provedor = ligados[0] || PROVEDORES[0];
    const sel = { pasta:"", raiz:false, titulo:"", pagina:1, videos:[], mais:false, aCarregar:false, erro:"",
                  multiplo: !!(varios && opcoes.emVarios), escolhidos:[], aCriar:false };
    let pastas = pastasLidas || [];
    let temporizador = null;
    const uid = "pb" + Math.random().toString(36).slice(2, 7);

    alvo.innerHTML = `
      <div class="panda-bib${janela ? " em-janela" : ""}">
        <div class="panda-barra">
          ${ligados.length > 1 ? `<div class="panda-provedores" role="group" aria-label="Provedor de vídeo">
            ${ligados.map(p => `<button type="button" data-provedor="${esc(p.id)}" aria-pressed="${p === provedor}">${esc(p.nome)}</button>`).join("")}</div>` : ""}
          <label class="panda-procura"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <span class="hidden">Procurar pelo título</span><input type="search" id="${uid}-procura" data-panda-procura placeholder="Procurar em toda a biblioteca" autocomplete="off"></label>
          ${varios ? `<button type="button" class="btn btn-secondary btn-sm panda-varios" data-panda-varios aria-pressed="${sel.multiplo}">${iconeVarios()}<span>Selecionar vários</span></button>` : ""}
        </div>
        <div class="panda-corpo">
          <nav class="panda-pastas" aria-label="Pastas"></nav>
          <section class="panda-lado">
            <label class="panda-pasta-movel"><span class="hidden">Pasta</span><select data-panda-movel></select></label>
            <p class="panda-dica"></p>
            <div class="panda-grelha" aria-live="polite"></div>
            <div class="panda-mais"></div>
          </section>
        </div>
        ${varios ? `<div class="panda-acao" hidden>
          <span class="panda-acao-conta" aria-live="polite"></span>
          <button type="button" class="btn btn-texto btn-sm" data-panda-limpar>Limpar</button>
          <label class="panda-acao-modulo"><span>Criar no módulo</span>
            <select data-panda-modulo>${varios.modulos.map(m => `<option value="${esc(m.id)}"${m.id === varios.modulo ? " selected" : ""}>${esc(m.titulo)}</option>`).join("")}</select></label>
          <button type="button" class="btn btn-primary btn-sm" data-panda-criar></button>
        </div>` : ""}
      </div>`;

    const raiz = alvo.querySelector(".panda-bib");
    const nav = raiz.querySelector(".panda-pastas");
    const grelha = raiz.querySelector(".panda-grelha");
    const mais = raiz.querySelector(".panda-mais");
    const dica = raiz.querySelector(".panda-dica");
    const procura = raiz.querySelector("[data-panda-procura]");
    const movel = raiz.querySelector("[data-panda-movel]");
    const barraAcao = raiz.querySelector(".panda-acao");

    function iconeVarios(){
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="m15 17.5 2 2 4-4"/></svg>`;
    }

    /* As pastas, em árvore: cada uma por baixo da mãe. */
    function arvore(){
      const filhos = {};
      pastas.forEach(p => { (filhos[p.pai || ""] = filhos[p.pai || ""] || []).push(p); });
      Object.values(filhos).forEach(l => l.sort((a, b) => a.nome.localeCompare(b.nome, "pt")));
      const linhas = [];
      const ids = new Set(pastas.map(p => p.id));
      const descer = (pai, nivel) => (filhos[pai] || []).forEach(p => { linhas.push({ p, nivel }); descer(p.id, nivel + 1); });
      descer("", 0);
      /* Uma pasta cuja mãe não veio na lista fica na raiz, para não se perder. */
      pastas.filter(p => p.pai && !ids.has(p.pai)).forEach(p => { linhas.push({ p, nivel:0 }); descer(p.id, 1); });
      return linhas;
    }

    function pintarPastas(){
      const linhas = arvore();
      const ativo = k => (!sel.titulo && ((k === "" && !sel.pasta && !sel.raiz) || (k === "raiz" && sel.raiz) || (k && k === sel.pasta))) ? ' aria-current="true"' : "";
      nav.innerHTML = `
        <button type="button" data-pasta=""${ativo("")}><span>Todos os vídeos</span></button>
        <button type="button" data-pasta="raiz"${ativo("raiz")}><span>Fora das pastas</span></button>
        ${linhas.map(({ p, nivel }) => `<button type="button" data-pasta="${esc(p.id)}" style="--nivel:${nivel}"${ativo(p.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
          <span>${esc(p.nome)}</span>${p.videos ? `<small>${p.videos}</small>` : ""}</button>`).join("")}`;
      movel.innerHTML = `<option value="">Todos os vídeos</option><option value="raiz">Fora das pastas</option>
        ${linhas.map(({ p, nivel }) => `<option value="${esc(p.id)}">${"— ".repeat(nivel)}${esc(p.nome)}</option>`).join("")}`;
      movel.value = sel.raiz ? "raiz" : sel.pasta;
      nav.querySelectorAll("[data-pasta]").forEach(b => b.addEventListener("click", () => irPara(b.dataset.pasta)));
    }

    function irPara(k){
      sel.raiz = k === "raiz"; sel.pasta = sel.raiz ? "" : k;
      sel.titulo = ""; procura.value = "";
      pintarPastas(); carregar(true);
    }
    movel.addEventListener("change", () => irPara(movel.value));

    procura.addEventListener("input", () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { sel.titulo = procura.value.trim(); pintarPastas(); carregar(true); }, 350);
    });

    raiz.querySelectorAll("[data-provedor]").forEach(b => b.addEventListener("click", () => {
      const p = ligados.find(x => x.id === b.dataset.provedor);
      if(!p || p === provedor) return;
      provedor = p; pastas = []; sel.escolhidos = [];
      raiz.querySelectorAll("[data-provedor]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      irPara(""); carregarPastas(true); pintarAcao();
    }));

    const botaoVarios = raiz.querySelector("[data-panda-varios]");
    if(botaoVarios) botaoVarios.addEventListener("click", () => {
      sel.multiplo = !sel.multiplo;
      if(!sel.multiplo) sel.escolhidos = [];
      botaoVarios.setAttribute("aria-pressed", String(sel.multiplo));
      pintarVideos(); pintarAcao();
    });

    function pintarDica(){
      dica.textContent = sel.multiplo
        ? "Toque nos vídeos pela ordem das aulas. Cada vídeo dá uma aula, com o título e a duração dele."
        : (aoEscolher ? "Toque num vídeo para o ligar a esta aula. A duração vem com ele." : "");
      dica.hidden = !dica.textContent;
    }

    function cartao(v){
      const pronto = v.estado === "CONVERTED" && v.player;
      const naAula = atual && v.player && atual === v.player;
      const ordem = sel.escolhidos.findIndex(x => x.id === v.id) + 1;
      const tempo = duracao(v.duracao);
      return `<button type="button" class="panda-video${naAula ? " escolhido" : ""}${ordem ? " marcado" : ""}" data-video="${esc(v.id)}"${pronto ? "" : " disabled"}${sel.multiplo ? ` aria-pressed="${!!ordem}"` : ""}>
        <span class="panda-capa">${v.miniatura ? `<img src="${esc(v.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>`}
          ${tempo ? `<span class="panda-tempo">${esc(tempo)}</span>` : ""}
          ${naAula && !sel.multiplo ? `<span class="panda-marca">Nesta aula</span>` : ""}
          ${sel.multiplo && pronto ? `<span class="panda-ordem" aria-hidden="true">${ordem || ""}</span>` : ""}</span>
        <span class="panda-nome">${esc(v.titulo)}</span>
        ${pronto ? "" : `<span class="panda-sub">${v.estado === "CONVERTING" || v.estado === "DRAFT" ? "Ainda a converter no Panda" : "Indisponível no Panda"}</span>`}
      </button>`;
    }

    function pintarVideos(){
      pintarDica();
      if(sel.erro){
        grelha.innerHTML = `<div class="panda-vazio erro" role="alert">${esc(sel.erro)} <button class="btn btn-secondary btn-sm" type="button" data-panda-repetir>Tentar outra vez</button></div>`;
        grelha.querySelector("[data-panda-repetir]").addEventListener("click", () => carregar(true));
        mais.innerHTML = ""; return;
      }
      if(!sel.videos.length){
        grelha.innerHTML = sel.aCarregar ? Array.from({ length: 6 }, () => `<span class="panda-video esqueleto" aria-hidden="true"><span class="panda-capa"></span><span class="panda-nome"></span></span>`).join("")
          : `<div class="panda-vazio">${sel.titulo ? "Nenhum vídeo com esse título." : "Esta pasta não tem vídeos."}</div>`;
        mais.innerHTML = ""; return;
      }
      grelha.innerHTML = sel.videos.map(cartao).join("");
      grelha.querySelectorAll("[data-video]").forEach(b => b.addEventListener("click", () => {
        const v = sel.videos.find(x => x.id === b.dataset.video);
        if(!v) return;
        if(sel.multiplo){
          const i = sel.escolhidos.findIndex(x => x.id === v.id);
          if(i >= 0) sel.escolhidos.splice(i, 1); else sel.escolhidos.push(v);
          pintarVideos(); pintarAcao();
          const igual = grelha.querySelector(`[data-video="${CSS.escape(v.id)}"]`);
          if(igual) igual.focus();
          return;
        }
        if(janela && janela.aoFechar) janela.aoFechar();
        aoEscolher && aoEscolher({ id:v.id, titulo:v.titulo, duracao:v.duracao, player:v.player, miniatura:v.miniatura });
      }));
      mais.innerHTML = sel.mais ? `<button class="btn btn-secondary btn-sm" type="button" ${sel.aCarregar ? "disabled" : ""}>${sel.aCarregar ? "A carregar…" : "Carregar mais"}</button>` : "";
      const b = mais.querySelector("button");
      if(b) b.addEventListener("click", () => { sel.pagina += 1; carregar(false); });
    }

    function pintarAcao(){
      if(!barraAcao) return;
      const n = sel.escolhidos.length;
      barraAcao.hidden = !sel.multiplo;
      raiz.classList.toggle("com-acao", sel.multiplo);
      barraAcao.querySelector(".panda-acao-conta").textContent = n ? `${n} ${n === 1 ? "vídeo escolhido" : "vídeos escolhidos"}` : "Nenhum vídeo escolhido";
      barraAcao.querySelector("[data-panda-limpar]").hidden = !n;
      const criar = barraAcao.querySelector("[data-panda-criar]");
      criar.disabled = !n || sel.aCriar;
      criar.textContent = sel.aCriar ? "A criar…" : n > 1 ? `Criar ${n} aulas` : "Criar a aula";
    }

    if(barraAcao){
      barraAcao.querySelector("[data-panda-limpar]").addEventListener("click", () => { sel.escolhidos = []; pintarVideos(); pintarAcao(); });
      barraAcao.querySelector("[data-panda-criar]").addEventListener("click", async () => {
        if(!sel.escolhidos.length || sel.aCriar) return;
        sel.aCriar = true; pintarAcao();
        const lista = sel.escolhidos.map(v => ({ id:v.id, titulo:tituloDaAula(v.titulo), duracao:v.duracao, player:v.player, miniatura:v.miniatura }));
        try {
          await varios.aoCriar(lista, barraAcao.querySelector("[data-panda-modulo]").value);
          sel.escolhidos = [];
        } catch(e){ mostrarToast(e.message || "Não foi possível criar as aulas."); }
        sel.aCriar = false;
        if(raiz.isConnected){ pintarVideos(); pintarAcao(); }
      });
    }

    let pedido = 0;
    async function carregar(doInicio){
      const este = ++pedido;
      if(doInicio){ sel.pagina = 1; sel.videos = []; }
      sel.aCarregar = true; sel.erro = "";
      pintarVideos();
      try {
        const r = await provedor.chamar("videos", { pasta: sel.titulo ? "" : sel.pasta, raiz: !sel.titulo && sel.raiz, titulo: sel.titulo, pagina: sel.pagina });
        if(este !== pedido) return;   // entretanto pediu-se outra coisa
        sel.videos = doInicio ? r.videos : sel.videos.concat(r.videos);
        sel.mais = !!r.mais;
      } catch(e){
        if(este !== pedido) return;
        sel.erro = e.message;
      }
      sel.aCarregar = false;
      if(raiz.isConnected) pintarVideos();
    }

    async function carregarPastas(forcar){
      if(pastasLidas && !forcar && provedor.id === "panda"){ pastas = pastasLidas; pintarPastas(); return; }
      try {
        const lidas = (await provedor.chamar("pastas")).pastas || [];
        if(provedor.id === "panda") pastasLidas = lidas;
        pastas = lidas;
        if(raiz.isConnected) pintarPastas();
      } catch(e){ /* sem pastas, a lista de todos os vídeos e a procura continuam a servir */ }
    }

    pintarPastas();
    pintarAcao();
    carregar(true);
    carregarPastas();
    return { focar: () => procura.focus() };
  }

  /* A mesma biblioteca numa janela (o editor do curso usa-a para criar as
     aulas de um módulo de uma vez). */
  function abrirBiblioteca(opcoes = {}){
    const anterior = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="card panda-janela" role="dialog" aria-modal="true" aria-labelledby="panda-titulo">
        <header class="panda-topo">
          <div>
            <h2 id="panda-titulo">${esc(opcoes.titulo || "Biblioteca de vídeos")}</h2>
            <p>${esc(opcoes.subtitulo || "Escolha os vídeos. A duração vem com eles.")}</p>
          </div>
          <button class="btn-icone" type="button" data-panda-fechar aria-label="Fechar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </header>
        <div class="panda-janela-corpo"></div>
      </div>`;
    document.body.appendChild(overlay);
    function fechar(){
      document.removeEventListener("keydown", teclas);
      overlay.remove();
      if(anterior && anterior.focus) anterior.focus();
    }
    function teclas(e){ if(e.key === "Escape") fechar(); }
    document.addEventListener("keydown", teclas);
    overlay.addEventListener("click", e => { if(e.target === overlay) fechar(); });
    overlay.querySelector("[data-panda-fechar]").addEventListener("click", fechar);
    const bib = montar(overlay.querySelector(".panda-janela-corpo"), Object.assign({}, opcoes, { janela:{ aoFechar: fechar } }));
    bib.focar();
    return { fechar };
  }

  return { lerEstado, ligar, desligar, montar, abrirBiblioteca, duracoes, idDoLeitor, provedoresLigados, tituloDaAula,
           get estado(){ return estado; }, esc };
})();
