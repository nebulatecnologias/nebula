/* ============================================================
   Panda Video nativo (pedido do Shelton a 19/10/2026)
   Cada escola liga a conta Panda dela uma vez, em Integrações, com a
   chave da API. A partir daí, o separador Vídeo da aula abre a
   biblioteca inteira (pastas, procura, miniaturas) e a escolha liga o
   vídeo à aula, com a duração já preenchida.

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
        player:`https://player-vz-demo.tv.pandavideo.com.br/embed/?v=demo${n}`, pasta, criado:new Date(Date.now() - n * 864e5).toISOString()
      });
      DB.pandaDemo = {
        estado: { ligada:false, chaveFim:null, ligadaEm:null, podeLigar:true },
        pastas,
        videos: [
          v(1, "Boas-vindas à academia", null, 184),
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

  function duracao(segundos){
    return typeof formatarDuracao === "function" ? formatarDuracao(segundos) : "";
  }

  /* ---------------- A biblioteca ---------------- */
  /* aoEscolher(video) recebe { id, titulo, duracao, player, miniatura }. */
  function abrirBiblioteca({ aoEscolher, atual } = {}){
    const sel = { pasta:"", raiz:false, titulo:"", pagina:1, videos:[], mais:false, aCarregar:false, erro:"" };
    let pastas = pastasLidas || [];
    let temporizador = null;
    const anterior = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="card panda-janela" role="dialog" aria-modal="true" aria-labelledby="panda-titulo">
        <header class="panda-topo">
          <div>
            <h2 id="panda-titulo">Biblioteca do Panda</h2>
            <p>Escolha o vídeo desta aula. A duração vem com ele.</p>
          </div>
          <button class="btn-icone" type="button" data-panda-fechar aria-label="Fechar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </header>
        <div class="panda-corpo">
          <nav class="panda-pastas" aria-label="Pastas do Panda"></nav>
          <section class="panda-lado">
            <label class="panda-procura"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <span class="hidden">Procurar pelo título</span><input type="search" id="panda-procura" placeholder="Procurar em toda a biblioteca" autocomplete="off"></label>
            <label class="panda-pasta-movel"><span class="hidden">Pasta</span><select id="panda-pasta-movel"></select></label>
            <div class="panda-grelha" aria-live="polite"></div>
            <div class="panda-mais"></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const nav = overlay.querySelector(".panda-pastas");
    const grelha = overlay.querySelector(".panda-grelha");
    const mais = overlay.querySelector(".panda-mais");
    const procura = overlay.querySelector("#panda-procura");
    const movel = overlay.querySelector("#panda-pasta-movel");

    function fechar(){
      document.removeEventListener("keydown", teclas);
      overlay.remove();
      if(anterior && anterior.focus) anterior.focus();
    }
    function teclas(e){ if(e.key === "Escape") fechar(); }
    document.addEventListener("keydown", teclas);
    overlay.addEventListener("click", e => { if(e.target === overlay) fechar(); });
    overlay.querySelector("[data-panda-fechar]").addEventListener("click", fechar);

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

    function cartao(v){
      const pronto = v.estado === "CONVERTED" && v.player;
      const escolhido = atual && v.player && atual === v.player;
      const tempo = duracao(v.duracao);
      return `<button type="button" class="panda-video${escolhido ? " escolhido" : ""}" data-video="${esc(v.id)}"${pronto ? "" : " disabled"}>
        <span class="panda-capa">${v.miniatura ? `<img src="${esc(v.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>`}
          ${tempo ? `<span class="panda-tempo">${esc(tempo)}</span>` : ""}
          ${escolhido ? `<span class="panda-marca">Nesta aula</span>` : ""}</span>
        <span class="panda-nome">${esc(v.titulo)}</span>
        ${pronto ? "" : `<span class="panda-sub">${v.estado === "CONVERTING" || v.estado === "DRAFT" ? "Ainda a converter no Panda" : "Indisponível no Panda"}</span>`}
      </button>`;
    }

    function pintarVideos(){
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
        fechar();
        aoEscolher && aoEscolher({ id:v.id, titulo:v.titulo, duracao:v.duracao, player:v.player, miniatura:v.miniatura });
      }));
      mais.innerHTML = sel.mais ? `<button class="btn btn-secondary btn-sm" type="button" ${sel.aCarregar ? "disabled" : ""}>${sel.aCarregar ? "A carregar…" : "Carregar mais"}</button>` : "";
      const b = mais.querySelector("button");
      if(b) b.addEventListener("click", () => { sel.pagina += 1; carregar(false); });
    }

    let pedido = 0;
    async function carregar(doInicio){
      const este = ++pedido;
      if(doInicio){ sel.pagina = 1; sel.videos = []; }
      sel.aCarregar = true; sel.erro = "";
      pintarVideos();
      try {
        const r = await chamar("videos", { pasta: sel.titulo ? "" : sel.pasta, raiz: !sel.titulo && sel.raiz, titulo: sel.titulo, pagina: sel.pagina });
        if(este !== pedido) return;   // entretanto pediu-se outra coisa
        sel.videos = doInicio ? r.videos : sel.videos.concat(r.videos);
        sel.mais = !!r.mais;
      } catch(e){
        if(este !== pedido) return;
        sel.erro = e.message;
      }
      sel.aCarregar = false;
      pintarVideos();
    }

    async function carregarPastas(){
      if(pastasLidas) return;
      try { pastasLidas = (await chamar("pastas")).pastas || []; pastas = pastasLidas; pintarPastas(); }
      catch(e){ /* sem pastas, a lista de todos os vídeos e a procura continuam a servir */ }
    }

    pintarPastas();
    carregar(true);
    carregarPastas();
    procura.focus();
  }

  return { lerEstado, ligar, desligar, abrirBiblioteca, get estado(){ return estado; }, esc };
})();
