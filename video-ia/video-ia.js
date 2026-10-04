/* ============================================================
   Página de vendas do curso de vídeo com IA: os efeitos, o catálogo
   de módulos, as ofertas e a oferta única.
   ============================================================ */
(() => {
  /* ---------------- O que se ajusta ---------------- */

  /* Os links de pagamento de cada oferta. Vazios, o botão avisa que ainda
     não está ligado em vez de levar a uma página que não existe. */
  const CHECKOUT = {
    basico:  "",   // Básico, R 99,00
    premium: "",   // Premium, R 199,00
    oto:     ""    // Premium pela oferta única, R 147,00
  };
  /* Os preços: o «antes» é o riscado. Só apresentação: o que se cobra
     é o que estiver na página de pagamento. */
  const SIMBOLO = "R";
  const PRECOS = {
    basico:  { nome:"Básico", antes:199, agora:99 },
    premium: { nome:"Premium", antes:399, agora:199 },
    oto:     { nome:"Premium com a oferta única", antes:199, agora:147 }
  };
  /* PROVISÓRIO: os módulos, as aulas e as durações a confirmar com o formador. */
  const MODULOS = [
    { titulo:"Primeiros passos: como a IA cria vídeo", curto:"fundamentos", tipo:"Fundamentos", nivel:"Iniciante", aulas:6, min:35, plano:"basico", tom:28,
      desc:"O que cada tipo de ferramenta faz, quanto custa usar e como montar o seu estúdio no telemóvel ou no computador, sem equipamento caro.",
      cria:"O seu primeiro vídeo de oito segundos." },
    { titulo:"Prompts de realizador", curto:"prompts", tipo:"Fundamentos", nivel:"Iniciante", aulas:8, min:48, plano:"basico", tom:45,
      desc:"Escrever como quem dirige: planos, lentes, luz, movimento de câmara e estilo. A diferença entre um vídeo genérico e uma cena de cinema.",
      cria:"Uma cena com o plano e a luz que escolheu." },
    { titulo:"Personagens consistentes, cena após cena", curto:"personagens", tipo:"Cinema", nivel:"Intermédio", aulas:7, min:52, plano:"basico", tom:280,
      desc:"Criar uma personagem em imagem e mantê-la igual em todos os planos: o rosto, a roupa e o cenário.",
      cria:"Uma personagem sua, igual em cinco planos." },
    { titulo:"Reels, TikTok e Shorts com IA", curto:"redes sociais", tipo:"Redes sociais", nivel:"Iniciante", aulas:6, min:40, plano:"basico", tom:330,
      desc:"Formatos verticais, ganchos nos primeiros segundos e legendas, para publicar todos os dias sem filmar.",
      cria:"Uma semana de vídeos verticais prontos a publicar." },
    { titulo:"Montagem e acabamento", curto:"montagem", tipo:"Fundamentos", nivel:"Intermédio", aulas:5, min:28, plano:"basico", tom:200,
      desc:"Juntar os planos, cortar ao ritmo da música, corrigir a cor e exportar na qualidade certa para cada rede.",
      cria:"Um vídeo montado, com música e legendas." },
    { titulo:"Anúncios de produto que vendem", curto:"anúncios", tipo:"Anúncios e clientes", nivel:"Intermédio", aulas:7, min:55, plano:"premium", tom:15,
      desc:"Do produto fotografado com o telemóvel ao anúncio em vídeo: estruturas que prendem a atenção, mostram o produto e chamam à acção.",
      cria:"Um anúncio de 15 segundos para um produto real." },
    { titulo:"Voz, música e lip-sync", curto:"voz e lip-sync", tipo:"Cinema", nivel:"Intermédio", aulas:5, min:33, plano:"premium", tom:150,
      desc:"Dar voz às personagens, sincronizar os lábios com a fala, escolher a música e o som que fazem a cena parecer real.",
      cria:"Uma personagem a falar, com a voz certa." },
    { titulo:"Curta-metragem: do guião ao corte final", curto:"curta-metragem", tipo:"Cinema", nivel:"Avançado", aulas:10, min:84, plano:"premium", tom:260,
      desc:"Um projecto completo, acompanhado plano a plano: guião, storyboard, geração das cenas, montagem e som.",
      cria:"A sua curta-metragem, do princípio ao fim." },
    { titulo:"Vender vídeos com IA a clientes", curto:"clientes", tipo:"Anúncios e clientes", nivel:"Avançado", aulas:6, min:45, plano:"premium", tom:170,
      desc:"Encontrar os primeiros clientes, montar o portfólio, fazer a proposta e cobrar pelo seu trabalho.",
      cria:"O seu portfólio e a primeira proposta." }
  ];
  const BONUS = ["Biblioteca de prompts de cinema", "Pack de personagens consistentes", "Modelos de guião e storyboard", "Kit de anúncios em vídeo", "Guia: vender vídeos com IA"];
  /* As cenas do estúdio da abertura. src: um vídeo real da cena, quando houver. */
  const CENAS = [
    { prompt:"Plano geral ao pôr do sol: um pescador puxa o barco para a areia da praia. Câmara lenta, luz dourada, lente de 35 mm.",
      formato:"16:9", estilo:"Cinematográfico", legenda:"Cena 1 · O pescador ao pôr do sol", tom:28, src:"" },
    { prompt:"Close-up de uma chávena de café a fumegar numa mesa de madeira, chuva na janela, luz suave, a câmara aproxima-se devagar.",
      formato:"16:9", estilo:"Publicidade", legenda:"Cena 2 · Café num dia de chuva", tom:205, src:"" },
    { prompt:"Vertical 9:16: uns ténis a rodar sobre fundo laranja, cortes rápidos ao ritmo da música, a palavra «Novo» no fim.",
      formato:"9:16", estilo:"Redes sociais", legenda:"Cena 3 · Anúncio de ténis", tom:18, src:"" }
  ];
  const PROMPTS = [
    "Plano picado em grande angular, 24 mm: uma rua movimentada ao amanhecer, vendedores a montar as bancas, névoa leve, cores quentes.",
    "Contraluz ao pôr do sol: a silhueta de uma mulher a caminhar na praia, reflexos dourados na água, grão de película, tons de âmbar.",
    "Travelling lento para a frente, câmara à altura dos olhos, a atravessar um mercado cheio de gente, profundidade de campo curta.",
    "Estética de anúncio de luxo: fundo preto, um frasco de perfume a rodar devagar, partículas de luz no ar, reflexos suaves no vidro."
  ];

  /* ---------------- Ferramentas ---------------- */
  const $ = id => document.getElementById(id);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NBSP = " ";
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ""}>${d}</svg>`;
  const espera = ms => new Promise(r => setTimeout(r, ms));

  /* Dinheiro como em todo o lado: «R 1 500,00». */
  const valor = n => Number(n || 0).toLocaleString("pt-PT", { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:"always" });
  const dinheiro = n => `${SIMBOLO}${NBSP}${valor(n)}`;
  const duracao = min => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
  const sem = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const I = {
    check:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    traco:'<path d="M8 12h8"/>',
    presente:'<rect x="3.5" y="8" width="17" height="12.5" rx="2"/><path d="M3.5 12h17M12 8v12.5M12 8S10.5 3.5 7.8 4.6C5.6 5.5 7 8 12 8zm0 0s1.5-4.5 4.2-3.4C18.4 5.5 17 8 12 8z"/>',
    tipo:'<rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="m15 11 5-3v8l-5-3"/>',
    aulas:'<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>',
    relogio:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    seta:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    cadeado:'<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    alvo:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'
  };
  const nivelSvg = nivel => {
    const n = { "Iniciante":1, "Intermédio":2, "Avançado":3 }[nivel] || 1;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="nivel-ico">${[0,1,2].map(i => `<rect x="${5 + i * 5.5}" y="${15 - i * 4}" width="3" height="${5 + i * 4}" rx="1" ${i < n ? 'class="cheio"' : ""}/>`).join("")}</svg>`;
  };

  if(!calmo) document.documentElement.classList.add("anima");

  /* ---------------- Preços em todo o lado ---------------- */
  $$("[data-preco]").forEach(el => { el.textContent = dinheiro(PRECOS[el.dataset.preco].agora); });
  $$("[data-preco-antes]").forEach(el => { el.textContent = dinheiro(PRECOS[el.dataset.precoAntes].antes); });
  $$("[data-poupa]").forEach(el => { const p = PRECOS[el.dataset.poupa]; el.textContent = `Poupa ${dinheiro(p.antes - p.agora)}`; });
  $$("[data-diferenca]").forEach(el => { el.textContent = dinheiro(PRECOS.oto.agora - PRECOS.basico.agora); });

  /* Os totais saem dos módulos, para nunca dizerem números diferentes. */
  const soma = (lista, k) => lista.reduce((t, m) => t + m[k], 0);
  const doBasico = MODULOS.filter(m => m.plano === "basico"), doPremium = MODULOS.filter(m => m.plano === "premium");
  const T = {
    modulos:`${MODULOS.length} módulos`,
    aulas:`${soma(MODULOS, "aulas")} aulas`,
    duracao:`${duracao(soma(MODULOS, "min"))} de aulas`
  };
  $$("[data-total]").forEach(el => { el.textContent = T[el.dataset.total]; });
  const curtos = lista => { const n = lista.map(m => m.curto); return n.length > 1 ? `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}` : n[0]; };
  const intervalo = lista => { const a = MODULOS.indexOf(lista[0]) + 1, b = MODULOS.indexOf(lista[lista.length - 1]) + 1; return `Módulos ${a} a ${b}`; };
  $$("[data-oto=modulos]").forEach(el => { el.textContent = `Os ${doPremium.length} módulos avançados: ${curtos(doPremium)}`; });
  $$("[data-oto=aulas]").forEach(el => { el.textContent = `${soma(doPremium, "aulas")} aulas a mais`; });

  /* ---------------- Navegação ---------------- */
  const nav = $("nav"), barra = $("barra-fixa");
  let ofertasVisiveis = false;
  const naRolagem = () => {
    nav.classList.toggle("solida", scrollY > 24);
    const mostra = scrollY > innerHeight * 0.9 && !ofertasVisiveis && (innerHeight + scrollY) < document.documentElement.scrollHeight - 420;
    barra.classList.toggle("ver", mostra);
  };
  addEventListener("scroll", naRolagem, { passive:true });

  /* ---------------- Entradas ao deslizar ---------------- */
  const revela = $$(".revela");
  revela.forEach(el => {
    const irmaos = [...el.parentElement.children].filter(x => x.classList.contains("revela"));
    el.style.setProperty("--atraso", `${Math.min(irmaos.indexOf(el), 5) * 0.08}s`);
  });
  const temIO = "IntersectionObserver" in window;
  if(calmo || !temIO) revela.forEach(el => el.classList.add("visto"));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add("visto"); io.unobserve(e.target); }
    }), { rootMargin:"0px 0px -8% 0px", threshold:0.08 });
    revela.forEach(el => io.observe(el));
  }
  if(temIO) new IntersectionObserver(([e]) => { ofertasVisiveis = e.isIntersecting; naRolagem(); }, { rootMargin:"0px 0px -30% 0px" }).observe($("ofertas"));
  naRolagem();

  /* ---------------- Imagens e vídeos nos espaços reservados ---------------- */
  function poeMedia(ph){
    const src = (ph.dataset.src || "").trim();
    const velha = ph.querySelector(".ph-media");
    if(velha) velha.remove();
    ph.classList.remove("tem-media");
    if(!src) return;
    const video = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);
    const el = document.createElement(video ? "video" : "img");
    el.className = "ph-media";
    if(video){
      const som = ph.hasAttribute("data-som");
      el.muted = !som; el.loop = !som; el.playsInline = true; el.autoplay = !som; el.controls = som; el.preload = "metadata";
      el.addEventListener("loadeddata", () => ph.classList.add("tem-media"));
    } else {
      el.loading = "lazy"; el.decoding = "async"; el.alt = ph.dataset.alt || "";
      el.addEventListener("load", () => ph.classList.add("tem-media"));
    }
    el.addEventListener("error", () => { el.remove(); ph.classList.remove("tem-media"); });
    el.src = src;
    ph.appendChild(el);
  }
  $$(".ph").forEach(poeMedia);

  /* ---------------- A janela da abertura endireita-se ao deslizar ---------------- */
  const janela = $("janela-hero");
  if(!calmo){
    let pedido = 0;
    const inclina = () => {
      pedido = 0;
      const p = Math.min(Math.max(scrollY / 520, 0), 1), e = 1 - Math.pow(1 - p, 3);
      janela.style.setProperty("--rx", `${(16 * (1 - e)).toFixed(2)}deg`);
      janela.style.setProperty("--sc", (0.93 + 0.07 * e).toFixed(4));
    };
    addEventListener("scroll", () => { if(!pedido) pedido = requestAnimationFrame(inclina); }, { passive:true });
    inclina();
  }

  /* ---------------- O estúdio: o prompt escreve-se e a cena gera-se ---------------- */
  (() => {
    const texto = $("ger-texto"), tela = $("ger-tela"), render = $("ger-render"), pct = $("ger-pct"),
          barraR = $("ger-barra"), botao = $("ger-botao"), legenda = $("ger-legenda"), hist = $("ger-hist"),
          cabeca = $("ger-cabeca"), ph = tela.querySelector(".ph");
    let visivel = true;
    if(temIO) new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(janela);
    const acordado = async () => { while(!visivel || document.hidden) await espera(400); };

    const mostraCena = (c, i) => {
      tela.parentElement.style.setProperty("--tom", c.tom);   // o ecrã e a linha do tempo
      tela.dataset.formato = c.formato;
      $("ger-formato").textContent = c.formato;
      $("ger-estilo").textContent = c.estilo;
      legenda.textContent = c.legenda;
      if((ph.dataset.src || "") !== c.src){ ph.dataset.src = c.src; poeMedia(ph); }
      ph.dataset.rotulo = `Vídeo ${c.formato} · cena-${i + 1}.mp4`;
    };
    const juntaHistorico = (c, i) => {
      if(hist.children.length >= 3) hist.firstElementChild.remove();
      const s = document.createElement("span");
      s.className = "hist-item";
      s.style.setProperty("--tom", c.tom);
      s.innerHTML = `<i></i><b>${esc(c.legenda.split(" · ")[1] || c.legenda)}</b><small>${esc(c.formato)} · 8 s</small>`;
      hist.appendChild(s);
    };

    if(calmo){
      texto.textContent = CENAS[0].prompt;
      mostraCena(CENAS[0], 0); juntaHistorico(CENAS[0], 0);
      tela.classList.add("pronta");
      return;
    }

    (async () => {
      let i = 0;
      mostraCena(CENAS[0], 0);
      for(;;){
        const c = CENAS[i % CENAS.length];
        await acordado();
        /* Escreve. */
        texto.textContent = "";
        for(let k = 0; k <= c.prompt.length; k++){
          texto.textContent = c.prompt.slice(0, k);
          await espera(c.prompt[k - 1] === " " ? 34 : 18 + Math.random() * 22);
        }
        await espera(420);
        botao.classList.add("carregado");
        await espera(220);
        botao.classList.remove("carregado");
        /* Gera: a cena anterior desfoca-se e a nova nasce por cima. */
        tela.classList.remove("pronta");
        render.classList.add("ativo");
        const t0 = performance.now(), dur = 2300;
        await new Promise(fim => {
          const passo = agora => {
            const k = Math.min((agora - t0) / dur, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            pct.textContent = Math.round(e * 100);
            barraR.style.transform = `scaleX(${e})`;
            cabeca.style.setProperty("--k", e);
            if(k < 1) requestAnimationFrame(passo); else fim();
          };
          requestAnimationFrame(passo);
        });
        mostraCena(c, i % CENAS.length);
        render.classList.remove("ativo");
        tela.classList.add("pronta");
        juntaHistorico(c, i % CENAS.length);
        await espera(3600);
        /* Selecciona e apaga, como quem vai escrever outra. */
        texto.classList.add("seleccionado");
        await espera(420);
        texto.classList.remove("seleccionado");
        i++;
      }
    })();
  })();

  /* ---------------- A luz que segue o rato nos cartões ---------------- */
  $$(".luz-rato").forEach(c => c.addEventListener("pointermove", e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`);
    c.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  /* ---------------- Módulos: o catálogo com filtros ---------------- */
  const lista = $("lista-modulos"), procura = $("procura"), ordenar = $("ordenar");
  const caixas = $$("#filtros input[type=checkbox]");
  const faixaDur = min => min < 40 ? "curto" : min <= 60 ? "medio" : "longo";

  function cartaoModulo(m){
    const n = MODULOS.indexOf(m) + 1, premium = m.plano === "premium";
    return `<li class="modulo" data-n="${n}" style="view-transition-name:modulo-${n}">
      <div class="modulo-capa">
        <div class="ph ph-imagem" data-src="" data-rotulo="Imagem 16:9 · modulo-${n}.jpg" style="--tom:${m.tom}"></div>
        <span class="modulo-num" aria-hidden="true">${String(n).padStart(2, "0")}</span>
        ${premium ? `<span class="modulo-selo">${svg(I.cadeado)}Premium</span>` : ""}
      </div>
      <div class="modulo-texto">
        <h3><span class="sr">Módulo ${n}: </span>${esc(m.titulo)}</h3>
        <p>${esc(m.desc)}</p>
        <p class="modulo-cria">${svg(I.alvo)}<span>Vai criar: ${esc(m.cria)}</span></p>
        <ul class="etiquetas">
          <li>${svg(I.tipo)}${esc(m.tipo)}</li>
          <li>${nivelSvg(m.nivel)}${esc(m.nivel)}</li>
          <li>${svg(I.aulas)}${m.aulas} aulas</li>
          <li>${svg(I.relogio)}${duracao(m.min)}</li>
        </ul>
        <div class="modulo-accoes">
          ${premium
            ? `<a class="btn btn-escuro" href="#ofertas" data-ir="premium">${svg(I.cadeado)}Incluído no Premium</a>`
            : `<a class="btn btn-laranja" href="#ofertas" data-ir="basico">Começar por ${esc(dinheiro(PRECOS.basico.agora))}</a>`}
          <span class="modulo-onde">${premium ? "Só no Premium" : "No Básico e no Premium"}</span>
        </div>
      </div>
    </li>`;
  }

  function filtrados(){
    const marcados = {};
    caixas.forEach(c => { if(c.checked) (marcados[c.name] = marcados[c.name] || []).push(c.value); });
    const q = sem(procura.value.trim());
    let r = MODULOS.filter(m =>
      (!marcados.tipo || marcados.tipo.includes(m.tipo)) &&
      (!marcados.nivel || marcados.nivel.includes(m.nivel)) &&
      (!marcados.duracao || marcados.duracao.includes(faixaDur(m.min))) &&
      (!marcados.plano || marcados.plano.includes(m.plano)) &&
      (!q || sem(`${m.titulo} ${m.desc} ${m.tipo} ${m.cria} ${m.nivel}`).includes(q)));
    if(ordenar.value === "curtos") r = [...r].sort((a, b) => a.min - b.min);
    if(ordenar.value === "longos") r = [...r].sort((a, b) => b.min - a.min);
    return { r, filtros: caixas.filter(c => c.checked).length, q };
  }

  function desenhaModulos(){
    const { r, filtros, q } = filtrados();
    const aplica = () => {
      lista.innerHTML = r.map(cartaoModulo).join("");
      $$(".ph", lista).forEach(poeMedia);
      $("modulos-vazio").hidden = r.length > 0;
      const aulas = soma(r, "aulas"), min = soma(r, "min");
      $("modulos-n").textContent = r.length
        ? `${r.length === MODULOS.length ? "Todos os" : r.length} ${r.length === 1 ? "módulo" : "módulos"} · ${aulas} aulas · ${duracao(min)}`
        : "";
      const conta = $("filtros-conta");
      conta.hidden = !filtros; conta.textContent = filtros;
      $("filtros-limpar").hidden = !(filtros || q);
    };
    if(!calmo && document.startViewTransition && lista.children.length) document.startViewTransition(aplica);
    else aplica();
  }
  caixas.forEach(c => c.addEventListener("change", desenhaModulos));
  let atraso = 0;
  procura.addEventListener("input", () => { clearTimeout(atraso); atraso = setTimeout(desenhaModulos, 120); });
  ordenar.addEventListener("change", desenhaModulos);
  const limpa = () => { caixas.forEach(c => { c.checked = false; }); procura.value = ""; desenhaModulos(); };
  $("filtros-limpar").addEventListener("click", limpa);
  $$("[data-limpar]").forEach(b => b.addEventListener("click", limpa));
  $("filtros-abrir").addEventListener("click", e => {
    const aberto = e.currentTarget.getAttribute("aria-expanded") !== "true";
    e.currentTarget.setAttribute("aria-expanded", String(aberto));
    $("filtros").classList.toggle("aberto", aberto);
  });
  desenhaModulos();

  /* Os botões dos módulos levam à oferta e acendem-na. */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-ir]");
    if(!a) return;
    const alvo = document.querySelector(`.oferta[data-oferta="${a.dataset.ir}"]`);
    if(!alvo) return;
    alvo.classList.remove("acende");
    setTimeout(() => alvo.classList.add("acende"), calmo ? 0 : 650);
    setTimeout(() => alvo.classList.remove("acende"), 2600);
  });

  /* ---------------- Método: os passos acendem-se e o antes/depois ---------------- */
  (() => {
    const passos = $$("#passos .passo");
    let i = 0, relogio = 0;
    const marca = k => { i = k; passos.forEach((p, j) => p.classList.toggle("ativo", j === k)); };
    const anda = () => { clearInterval(relogio); if(!calmo) relogio = setInterval(() => marca((i + 1) % passos.length), 3200); };
    passos.forEach((p, k) => {
      p.tabIndex = 0;
      p.addEventListener("click", () => { marca(k); clearInterval(relogio); });
      p.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); marca(k); clearInterval(relogio); } });
    });
    if(temIO && !calmo) new IntersectionObserver(([e]) => { if(e.isIntersecting) anda(); else clearInterval(relogio); }, { threshold:.4 }).observe($("passos"));

    const comp = $("comparar"), r = $("comparar-range");
    const poe = v => { comp.style.setProperty("--corte", `${v}%`); r.value = v; };
    r.addEventListener("input", () => { comp.classList.add("mexido"); poe(r.value); });
    /* Uma passagem sozinha, a mostrar que a linha se arrasta. */
    if(temIO && !calmo){
      const io = new IntersectionObserver(([e]) => {
        if(!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now(), dur = 2200;
        const f = agora => {
          if(comp.classList.contains("mexido")) return;
          const k = Math.min((agora - t0) / dur, 1);
          poe(50 + Math.sin(k * Math.PI * 2) * 28 * (1 - k * .3) * (k < 1 ? 1 : 0));
          if(k < 1) requestAnimationFrame(f); else poe(50);
        };
        setTimeout(() => requestAnimationFrame(f), 500);
      }, { threshold:.6 });
      io.observe(comp);
    }
  })();

  /* ---------------- Interruptor ---------------- */
  function interruptor(btnId, caixaId, aplicar){
    const b = $(btnId), caixa = $(caixaId);
    const marca = ligado => {
      b.setAttribute("aria-checked", String(ligado));
      caixa.querySelectorAll("[data-lado]").forEach(s => s.classList.toggle("ativo", (s.dataset.lado === "1") === ligado));
    };
    const troca = ligado => { marca(ligado); aplicar(ligado); };
    b.addEventListener("click", () => troca(b.getAttribute("aria-checked") !== "true"));
    caixa.querySelectorAll("[data-lado]").forEach(s => { s.style.cursor = "pointer"; s.addEventListener("click", () => troca(s.dataset.lado === "1")); });
    return marca;
  }

  /* ---------------- Bónus: o que fica aberto em cada oferta ---------------- */
  interruptor("btn-plano", "int-plano", premium => {
    $("bonus-grelha").dataset.plano = premium ? "premium" : "basico";
    $("btn-plano").setAttribute("aria-label", premium ? "Ver com o Básico" : "Ver com o Premium");
  });

  /* A biblioteca de prompts: separadores e copiar. */
  (() => {
    const abas = $$(".prompts-abas [role=tab]"), out = $("prompt-texto"), copiar = $("prompt-copiar");
    let atual = 0;
    const mostra = k => {
      atual = k;
      abas.forEach((a, j) => { a.setAttribute("aria-selected", String(j === k)); a.tabIndex = j === k ? 0 : -1; });
      out.classList.remove("muda"); void out.offsetWidth; out.classList.add("muda");
      out.textContent = PROMPTS[k];
    };
    abas.forEach((a, k) => {
      a.addEventListener("click", () => mostra(k));
      a.addEventListener("keydown", e => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if(!d) return;
        e.preventDefault();
        const n = (k + d + abas.length) % abas.length;
        mostra(n); abas[n].focus();
      });
    });
    copiar.addEventListener("click", async () => {
      const t = PROMPTS[atual];
      let ok = false;
      try { await navigator.clipboard.writeText(t); ok = true; }
      catch(e){
        const a = document.createElement("textarea");
        a.value = t; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
        document.body.appendChild(a); a.select();
        try { ok = document.execCommand("copy"); } catch(_){}
        a.remove();
      }
      const rot = copiar.querySelector("span");
      rot.textContent = ok ? "Copiado" : "Seleccione e copie à mão";
      copiar.classList.toggle("feito", ok);
      setTimeout(() => { rot.textContent = "Copiar o prompt"; copiar.classList.remove("feito"); }, 1800);
    });
    mostra(0);
  })();

  /* ---------------- Ofertas ---------------- */
  const item = (t, ico, cls) => `<li${cls ? ` class="${cls}"` : ""}>${svg(I[ico || "check"])}<span>${t}</span></li>`;
  $$("[data-itens=basico]").forEach(ul => {
    ul.innerHTML = [
      item(`${intervalo(doBasico)}: ${esc(curtos(doBasico))}`),
      item(`${soma(doBasico, "aulas")} aulas em vídeo, ${duracao(soma(doBasico, "min"))} no total`),
      item("Acesso logo a seguir ao pagamento"),
      item("No telemóvel e no computador"),
      item("Os módulos avançados e os bónus", "traco", "fora")
    ].join("");
  });
  $$("[data-itens=premium]").forEach(ul => {
    ul.innerHTML = [
      item("<b>Tudo o que está no Básico</b>"),
      item(`${intervalo(doPremium)}: ${esc(curtos(doPremium))}`),
      item(`${soma(MODULOS, "aulas")} aulas em vídeo, ${duracao(soma(MODULOS, "min"))} no total`),
      `<li class="oferta-bonus">${svg(I.presente)}<span><b>${BONUS.length} bónus</b><span class="oferta-bonus-lista">${BONUS.map(esc).join(" · ")}</span></span></li>`
    ].join("");
  });
  /* A comparação, módulo a módulo. */
  const sim = `<span class="tem">${svg(I.check)}<span class="sr">Incluído</span></span>`;
  const nao = `<span class="nao-tem">${svg(I.traco)}<span class="sr">Não incluído</span></span>`;
  $("tabela-corpo").innerHTML =
    MODULOS.map((m, k) => `<tr><th scope="row"><span class="tab-n">${k + 1}</span>${esc(m.titulo)}</th><td>${m.plano === "basico" ? sim : nao}</td><td>${sim}</td></tr>`).join("") +
    BONUS.map(b => `<tr class="tab-bonus"><th scope="row">${svg(I.presente)}${esc(b)}</th><td>${nao}</td><td>${sim}</td></tr>`).join("") +
    `<tr class="tab-preco"><th scope="row">Preço de lançamento</th><td>${esc(dinheiro(PRECOS.basico.agora))}</td><td>${esc(dinheiro(PRECOS.premium.agora))}</td></tr>`;

  /* ---------------- Pagamento e a oferta única ---------------- */
  const aviso = $("aviso");
  let avisoRelogio = 0;
  const avisa = t => {
    aviso.textContent = t; aviso.classList.add("ver");
    clearTimeout(avisoRelogio); avisoRelogio = setTimeout(() => aviso.classList.remove("ver"), 5200);
  };
  function pagar(chave){
    const p = PRECOS[chave];
    document.documentElement.dataset.checkout = chave;
    const url = CHECKOUT[chave];
    if(url){
      /* As campanhas (utm_…) seguem até à página de pagamento. */
      const u = new URL(url, location.href);
      new URLSearchParams(location.search).forEach((v, k) => { if(/^utm_|^fbclid$|^gclid$/.test(k) && !u.searchParams.has(k)) u.searchParams.set(k, v); });
      location.href = u.toString();
      return;
    }
    avisa(`${p.nome} por ${dinheiro(p.agora)}: o link de pagamento ainda não está ligado.`);
  }

  const oto = $("oto"), cinema = $("cinema");
  const abre = d => { if(typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); document.documentElement.classList.add("com-dialogo"); };
  const fecha = d => {
    if(!d.open) return;
    if(calmo || !d.animate){ d.close(); return; }
    d.classList.add("a-fechar");
    setTimeout(() => { d.classList.remove("a-fechar"); d.close(); }, 220);
  };
  [oto, cinema].forEach(d => {
    d.addEventListener("close", () => {
      document.documentElement.classList.remove("com-dialogo");
      const v = d.querySelector("video"); if(v) v.pause();
    });
    d.addEventListener("click", e => { if(e.target === d) fecha(d); });   // clique fora da caixa
    d.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", () => fecha(d)));
  });

  /* Ao abrir, o preço desce do Premium até ao da oferta única. */
  function desceOto(){
    const el = $("oto-valor"), de = PRECOS.premium.agora, para = PRECOS.oto.agora;
    if(calmo){ el.textContent = dinheiro(para); return; }
    el.textContent = dinheiro(de);
    const t0 = performance.now() + 380, dur = 900;
    const f = agora => {
      const k = Math.max(0, Math.min((agora - t0) / dur, 1)), e = 1 - Math.pow(1 - k, 4);
      el.textContent = dinheiro(Math.round(de + (para - de) * e));
      if(k < 1) requestAnimationFrame(f); else el.parentElement.classList.add("pousou");
    };
    el.parentElement.classList.remove("pousou");
    requestAnimationFrame(f);
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-comprar]");
    if(!b) return;
    if(b.dataset.comprar === "basico"){ abre(oto); desceOto(); $("oto-sim").focus(); }
    else pagar(b.dataset.comprar);
  });
  $("oto-sim").addEventListener("click", () => { oto.close(); pagar("oto"); });
  $("oto-nao").addEventListener("click", () => { oto.close(); pagar("basico"); });

  $$("[data-abrir-video]").forEach(b => b.addEventListener("click", () => {
    abre(cinema);
    const v = cinema.querySelector("video"); if(v) v.play().catch(() => {});
  }));

  /* ---------------- Detalhes que abrem e fecham com movimento ---------------- */
  $$(".faq-item, .comparar-tabela").forEach(d => {
    const s = d.querySelector("summary"), corpo = d.querySelector(".faq-resposta, .tabela-caixa");
    s.addEventListener("click", e => {
      if(calmo || !corpo.animate) return;
      e.preventDefault();
      if(d.open){
        const a = corpo.animate([{ height:`${corpo.offsetHeight}px`, opacity:1 }, { height:"0px", opacity:0 }], { duration:320, easing:"cubic-bezier(.16,1,.3,1)" });
        a.onfinish = () => { d.open = false; };
      } else {
        d.open = true;
        const h = corpo.offsetHeight;
        corpo.animate([{ height:"0px", opacity:0 }, { height:`${h}px`, opacity:1 }], { duration:420, easing:"cubic-bezier(.16,1,.3,1)" });
      }
    });
  });

  /* ---------------- Estrelas no fecho ---------------- */
  const tela = $("estrelas");
  if(tela && tela.getContext){
    const ctx = tela.getContext("2d");
    let estrelas = [], largura = 0, altura = 0, visivel = false, pedido = 0;
    const prepara = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      largura = tela.clientWidth; altura = tela.clientHeight;
      tela.width = Math.round(largura * dpr); tela.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      estrelas = Array.from({ length:Math.round(largura * altura / 5200) }, () => ({
        x:Math.random() * largura, y:Math.random() * altura, r:Math.random() * 1.1 + .25,
        f:Math.random() * Math.PI * 2, v:Math.random() * 1.4 + .4, quente:Math.random() < .18, dy:-(Math.random() * .06 + .01)
      }));
    };
    const desenha = t => {
      ctx.clearRect(0, 0, largura, altura);
      for(const s of estrelas){
        const a = calmo ? .55 : .25 + .75 * Math.abs(Math.sin(s.f + t * .001 * s.v));
        if(!calmo){ s.y += s.dy; if(s.y < -2) s.y = altura + 2; }
        ctx.globalAlpha = a * (.35 + .65 * (1 - s.y / altura * .5));
        ctx.fillStyle = s.quente ? "#ffb384" : "#ffffff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const ciclo = t => { desenha(t); pedido = visivel && !calmo ? requestAnimationFrame(ciclo) : 0; };
    prepara(); desenha(0);
    addEventListener("resize", () => { prepara(); desenha(performance.now()); });
    if(temIO) new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      if(visivel && !pedido && !calmo) pedido = requestAnimationFrame(ciclo);
    }).observe(tela);
  }
})();
