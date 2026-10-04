/* ============================================================
   Página de vendas do curso de vídeo com IA, na estrutura do modelo
   Little Believers: o conteúdo, os efeitos, as ofertas e a oferta única.
   ============================================================ */
(() => {
  /* ================= O que se ajusta ================= */

  /* Os links de pagamento (Payflow). Vazios, o botão avisa que ainda não
     está ligado em vez de levar a uma página que não existe. */
  const CHECKOUT = {
    basico:  "",   // Básico, R 99,00
    premium: "",   // Premium, R 199,00
    oto:     ""    // Premium pela oferta única, R 147,00 (link próprio)
  };
  /* Os preços: o «antes» é o riscado. Só apresentação: o que se cobra é o
     que estiver na página de pagamento. */
  const SIMBOLO = "R";
  const PRECOS = {
    basico:  { nome:"Realizador IA Básico", antes:199, agora:99 },
    premium: { nome:"Realizador IA Premium", antes:399, agora:199 },
    oto:     { nome:"Realizador IA Premium (oferta única)", antes:199, agora:147 }
  };
  /* A contagem decrescente só aparece com uma data real de fim da promoção
     (ex.: "2026-10-31T23:59:59+02:00"). Sem data, a barra mostra só os preços:
     um relógio que recomeça todos os dias seria uma urgência falsa. */
  const PROMOCAO_ATE = "";
  /* Dias de garantia. 0 tira a garantia de todo o lado. CONFIRMAR. */
  const GARANTIA_DIAS = 7;

  /* PROVISÓRIO: os módulos, as aulas e as durações a confirmar com o formador. */
  const MODULOS = [
    { titulo:"Primeiros passos: como a IA cria vídeo", nivel:"Iniciante", aulas:6, min:35, plano:"basico" },
    { titulo:"Prompts de realizador", nivel:"Iniciante", aulas:8, min:48, plano:"basico" },
    { titulo:"Reels, TikTok e Shorts com IA", nivel:"Iniciante", aulas:6, min:40, plano:"basico" },
    { titulo:"Personagens consistentes, cena após cena", nivel:"Intermédio", aulas:7, min:52, plano:"basico" },
    { titulo:"Montagem e acabamento", nivel:"Intermédio", aulas:5, min:28, plano:"basico" },
    { titulo:"Anúncios de produto que vendem", nivel:"Intermédio", aulas:7, min:55, plano:"premium" },
    { titulo:"Voz, música e lip-sync", nivel:"Intermédio", aulas:5, min:33, plano:"premium" },
    { titulo:"Curta-metragem: do guião ao corte final", nivel:"Avançado", aulas:10, min:84, plano:"premium" },
    { titulo:"Vender vídeos com IA a clientes", nivel:"Avançado", aulas:6, min:45, plano:"premium" }
  ];
  /* Os bónus do Premium. valor: o preço de cada um à venda em separado, se
     existir; sem valor real, fica null e a página não mostra preços de bónus. */
  const BONUS = [
    { titulo:"Biblioteca de prompts de cinema", valor:null, tom:30,
      desc:"Prompts testados, organizados por plano, luz, movimento de câmara e estilo. Copie, troque o assunto e gere." },
    { titulo:"Pack de personagens consistentes", valor:null, tom:280,
      desc:"Folhas de referência prontas, com o rosto, o perfil e o corpo inteiro, para a personagem ficar igual em todas as cenas." },
    { titulo:"Kit de anúncios em vídeo", valor:null, tom:15,
      desc:"Estruturas de anúncio prontas a adaptar: o gancho, a prova, a oferta e a chamada à acção, cena a cena." },
    { titulo:"Guia: vender vídeos com IA", valor:null, tom:170,
      desc:"Um modelo de proposta, uma tabela de preços de referência e o guião da primeira conversa com um cliente." }
  ];
  const DORES = [
    "Vê vídeos incríveis feitos com IA e não faz ideia de como foram feitos.",
    "Já experimentou ferramentas, gastou créditos e os vídeos saem estranhos ou genéricos.",
    "As personagens mudam de cara de uma cena para a outra.",
    "Precisa de vídeos para o seu negócio e uma produtora está fora do orçamento.",
    "Passa horas a ver tutoriais soltos, em inglês, sem um caminho do princípio ao fim."
  ];
  const QUEM_SIM = [
    "Cria conteúdo e quer publicar mais, sem filmar todos os dias",
    "Tem um negócio e quer anúncios em vídeo sem pagar uma produtora",
    "Quer oferecer vídeos com IA como serviço a clientes",
    "Nunca editou vídeo e quer começar do zero, com método",
    "Já experimentou ferramentas de IA e quer resultados com qualidade de cinema",
    "Prefere aprender em português, ao seu ritmo"
  ];
  const QUEM_NAO = [
    "Procura um botão mágico que faz tudo sem praticar",
    "Não tem tempo para ver as aulas e repetir os exercícios",
    "Não tem interesse em criar vídeos",
    "Já domina a geração de vídeo e só quer novidades soltas"
  ];
  const DEPOIMENTOS = 3;   // espaços para capturas de WhatsApp reais
  /* As cenas do estúdio. src: um vídeo real da cena, quando houver. */
  const CENAS = [
    { prompt:"Plano geral ao pôr do sol: um pescador puxa o barco para a areia da praia. Câmara lenta, luz dourada, lente de 35 mm.",
      formato:"16:9", estilo:"Cinematográfico", legenda:"Cena 1 · O pescador ao pôr do sol", tom:28, src:"" },
    { prompt:"Close-up de uma chávena de café a fumegar numa mesa de madeira, chuva na janela, a câmara aproxima-se devagar.",
      formato:"16:9", estilo:"Publicidade", legenda:"Cena 2 · Café num dia de chuva", tom:205, src:"" },
    { prompt:"Vertical 9:16: uns ténis a rodar sobre fundo laranja, cortes rápidos ao ritmo da música, a palavra «Novo» no fim.",
      formato:"9:16", estilo:"Redes sociais", legenda:"Cena 3 · Anúncio de ténis", tom:18, src:"" }
  ];

  /* ================= Ferramentas ================= */
  const $ = id => document.getElementById(id);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const temIO = "IntersectionObserver" in window;
  const NBSP = " ";
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ""}>${d}</svg>`;
  const espera = ms => new Promise(r => setTimeout(r, ms));

  /* Dinheiro como em todo o lado: «R 1 500,00». */
  const valor = n => Number(n || 0).toLocaleString("pt-PT", { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:"always" });
  const dinheiro = n => `${SIMBOLO}${NBSP}${valor(n)}`;
  const contagem = n => Number(n || 0).toLocaleString("pt-PT", { useGrouping:"always" });
  const duracao = min => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
  const soma = (lista, k) => lista.reduce((t, m) => t + m[k], 0);

  const I = {
    check:'<path d="M20 6 9 17l-5-5"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    conversa:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    modulos:'<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M9 4v5M15 4v5"/>',
    aulas:'<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>',
    relogio:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    presente:'<rect x="3.5" y="8" width="17" height="12.5" rx="2"/><path d="M3.5 12h17M12 8v12.5M12 8S10.5 3.5 7.8 4.6C5.6 5.5 7 8 12 8zm0 0s1.5-4.5 4.2-3.4C18.4 5.5 17 8 12 8z"/>',
    mais:'<path d="M12 5v14M5 12h14"/>',
    chev:'<path d="m6 9 6 6 6-6"/>'
  };

  if(!calmo) document.documentElement.classList.add("anima");

  const doBasico = MODULOS.filter(m => m.plano === "basico"), doPremium = MODULOS.filter(m => m.plano === "premium");
  const aulasB = soma(doBasico, "aulas"), aulasP = soma(doPremium, "aulas"), aulasT = soma(MODULOS, "aulas");
  const nomesBonus = BONUS.map(b => b.titulo);
  const totalBonus = BONUS.every(b => b.valor) ? soma(BONUS, "valor") : 0;

  /* ================= Preços, garantia e totais em todo o lado ================= */
  $$("[data-preco]").forEach(el => { el.textContent = dinheiro(PRECOS[el.dataset.preco].agora); });
  $$("[data-preco-antes]").forEach(el => { el.textContent = dinheiro(PRECOS[el.dataset.precoAntes].antes); });
  $$("[data-garantia]").forEach(el => { el.textContent = GARANTIA_DIAS; });
  if(!GARANTIA_DIAS) $$("[data-garantia-mostra]").forEach(el => { el.hidden = true; });
  const TOTAIS = { aulas:`${aulasT} aulas`, bonus:`${BONUS.length} bónus`, "bonus-n":String(BONUS.length) };
  $$("[data-total]").forEach(el => { el.textContent = TOTAIS[el.dataset.total]; });

  /* ================= Barra da promoção ================= */
  (() => {
    const fim = PROMOCAO_ATE ? new Date(PROMOCAO_ATE) : null;
    if(!fim || isNaN(fim) || fim <= new Date()) return;
    const rel = $("promo-relogio"), d = $("cd-d"), h = $("cd-h"), m = $("cd-m"), s = $("cd-s");
    $("promo-texto").innerHTML = `O preço de lançamento termina dentro de`;
    rel.hidden = false;
    const dois = n => String(n).padStart(2, "0");
    const tique = () => {
      const falta = fim - new Date();
      if(falta <= 0){ rel.hidden = true; $("promo-texto").textContent = "O preço de lançamento terminou."; clearInterval(relogio); return; }
      const dias = Math.floor(falta / 864e5);
      d.hidden = !dias; d.textContent = `${dias}d`;
      h.textContent = dois(Math.floor(falta % 864e5 / 36e5));
      m.textContent = dois(Math.floor(falta % 36e5 / 6e4));
      s.textContent = dois(Math.floor(falta % 6e4 / 1e3));
    };
    const relogio = setInterval(tique, 1000); tique();
  })();

  /* ================= Rastreio ================= */
  /* As campanhas (utm_…, src) guardam-se na sessão e seguem até ao pagamento. */
  const CHAVES = ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
  const campanha = (() => {
    let guardado = {};
    try { guardado = JSON.parse(sessionStorage.getItem("ria_campanha") || "{}"); } catch(e){}
    const q = new URLSearchParams(location.search);
    CHAVES.forEach(k => { if(q.has(k)) guardado[k] = q.get(k); });
    try { sessionStorage.setItem("ria_campanha", JSON.stringify(guardado)); } catch(e){}
    return guardado;
  })();
  /* Os píxeis (Meta, TikTok) só disparam se estiverem instalados na página. */
  const rastreia = (evento, dados, proprio) => {
    try { if(typeof window.fbq === "function") window.fbq(proprio ? "trackCustom" : "track", evento, { currency:"ZAR", ...dados }); } catch(e){}
    try { if(window.ttq && typeof window.ttq.track === "function" && !proprio) window.ttq.track(evento, { currency:"ZAR", ...dados }); } catch(e){}
  };

  /* ================= Entradas ao deslizar ================= */
  const revela = $$(".revela");
  revela.forEach(el => {
    const irmaos = [...el.parentElement.children].filter(x => x.classList.contains("revela"));
    el.style.setProperty("--atraso", `${Math.min(irmaos.indexOf(el), 5) * 0.07}s`);
  });
  const observaRevela = el => {
    if(calmo || !temIO) return el.classList.add("visto");
    ioRevela.observe(el);
  };
  const ioRevela = temIO ? new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting){ e.target.classList.add("visto"); ioRevela.unobserve(e.target); }
  }), { rootMargin:"0px 0px -6% 0px", threshold:0.06 }) : null;
  revela.forEach(observaRevela);

  /* ================= Imagens e vídeos nos espaços reservados ================= */
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
      el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true; el.preload = "metadata";
      el.addEventListener("loadeddata", () => ph.classList.add("tem-media"));
    } else {
      el.loading = "lazy"; el.decoding = "async"; el.alt = ph.dataset.alt || "";
      el.addEventListener("load", () => ph.classList.add("tem-media"));
    }
    el.addEventListener("error", () => { el.remove(); ph.classList.remove("tem-media"); });
    el.src = src;
    ph.appendChild(el);
  }

  /* ================= O conteúdo ================= */
  const cartaoRevela = (tag, cls, html) => `<${tag} class="${cls} revela">${html}</${tag}>`;

  /* Números: tudo sai dos módulos e dos bónus, nada inventado. */
  const NUMEROS = [
    { n:MODULOS.length, rot:"Módulos, do zero ao avançado", ico:I.modulos },
    { n:aulasT, rot:"Aulas em vídeo", ico:I.aulas },
    { n:Math.round(soma(MODULOS, "min") / 60), suf:" h", rot:"De aulas práticas", ico:I.relogio },
    { n:BONUS.length, rot:"Bónus no Premium", ico:I.presente }
  ];
  $("numeros").innerHTML = NUMEROS.map(x => cartaoRevela("li", "numero cartao",
    `${svg(x.ico)}<b data-conta="${x.n}" data-suf="${x.suf || ""}">${contagem(x.n)}${x.suf || ""}</b><span>${esc(x.rot)}</span>`)).join("");

  $("lista-depoimentos").innerHTML = Array.from({ length:DEPOIMENTOS }, (_, i) =>
    `<figure class="depo revela"><div class="ph ph-imagem" data-src="" data-rotulo="Captura do WhatsApp · depoimento-${i + 1}.jpg" data-alt="" style="--ar:540/1050; --tom:${[140, 200, 30][i % 3]}"></div></figure>`).join("");

  const NIVEIS = [
    { nivel:"Iniciante", cls:"verde", frase:"Nunca gerou um vídeo? Comece aqui, do zero, com os primeiros resultados no primeiro dia." },
    { nivel:"Intermédio", cls:"azul", frase:"Já experimentou ferramentas? Aqui ganha controlo: personagens, montagem, anúncios e voz." },
    { nivel:"Avançado", cls:"amarelo", frase:"Quer ir mais longe? Uma curta-metragem completa e o caminho para vender vídeos a clientes." }
  ];
  $("niveis").innerHTML = NIVEIS.map(v => cartaoRevela("div", "nivel cartao",
    `<span class="selo selo-${v.cls}">${esc(v.nivel.toUpperCase())}</span><p>${esc(v.frase)}</p>
     <ul>${MODULOS.filter(m => m.nivel === v.nivel).map(m => `<li><span>${esc(m.titulo)}</span>${m.plano === "premium" ? '<em>Premium</em>' : ""}</li>`).join("")}</ul>`)).join("");

  $("lista-dores").innerHTML = DORES.map(d => cartaoRevela("div", "dor cartao", `${svg(I.conversa)}<p>${esc(d)}</p>`)).join("");
  $("quem-sim").innerHTML = QUEM_SIM.map(t => `<li>${svg(I.check)}<span>${esc(t)}</span></li>`).join("");
  $("quem-nao").innerHTML = QUEM_NAO.map(t => `<li>${svg(I.x)}<span>${esc(t)}</span></li>`).join("");

  $("lista-bonus").innerHTML = BONUS.map((b, i) => cartaoRevela("article", "bonus cartao",
    `<div class="bonus-capa">
       <div class="ph ph-imagem" data-src="" data-rotulo="Capa 1:1 · bonus-${i + 1}.webp" data-alt="Capa do bónus ${esc(b.titulo)}" style="--ar:1/1; --tom:${b.tom}"></div>
       <span class="selo selo-laranja bonus-n">Bónus ${i + 1}</span>
     </div>
     <div class="bonus-corpo">
       <h3>${esc(b.titulo)}</h3>
       <p>${esc(b.desc)}</p>
       <div class="bonus-pe">
         <span>${b.valor ? `<s>${esc(dinheiro(b.valor))}</s> de valor` : "Incluído no Premium"}</span>
         <span class="selo selo-verde">Grátis hoje</span>
       </div>
     </div>`)).join("");
  if(totalBonus){ $("bonus-total").textContent = dinheiro(totalBonus); $("bonus-total-valor").hidden = false; }

  const item = (t, ico) => `<li>${svg(I[ico || "check"])}<span>${t}</span></li>`;
  $$("[data-itens=basico]").forEach(ul => {
    ul.innerHTML = [
      item(`<b>${doBasico.length} módulos de base</b>, ${aulasB} aulas em vídeo`),
      item("Como a IA cria vídeo e prompts de realizador"),
      item("Reels, TikTok e Shorts com IA"),
      item("Personagens consistentes e montagem"),
      item("No telemóvel e no computador"),
      item("Acesso logo a seguir ao pagamento")
    ].join("");
  });
  $$("[data-itens=premium]").forEach(ul => {
    ul.innerHTML = [
      item(`<b>${doPremium.length} módulos avançados</b>, ${aulasP} aulas a mais`),
      ...doPremium.map(m => item(esc(m.titulo))),
      ...BONUS.map(b => item(`<b>Bónus:</b> ${esc(b.titulo)}`, "presente"))
    ].join("");
  });
  $("oto-itens").innerHTML = [
    item(`Os ${doPremium.length} módulos avançados: anúncios, voz e lip-sync, curta-metragem e clientes (${aulasP} aulas a mais)`, "mais"),
    item(`Os ${BONUS.length} bónus: ${esc(nomesBonus.join(", "))}${totalBonus ? ` (${esc(dinheiro(totalBonus))} de valor)` : ""}`, "mais"),
    item("Tudo o que está no Básico", "check")
  ].join("");

  const PERGUNTAS = [
    ["Como recebo o acesso?", "Assim que o pagamento é confirmado, recebe um email com o acesso à área de membros, onde estão as aulas. Basta escolher a sua senha e começar."],
    ["Preciso de saber editar vídeo ou de ter experiência?", "Não. O primeiro módulo parte do zero: o que é cada ferramenta, como se escreve um prompt e como se gera o primeiro vídeo. A montagem também se ensina no curso."],
    ["Preciso de um computador potente?", "Não. A geração de vídeo corre nos servidores das próprias ferramentas, por isso basta um browser, no computador ou no telemóvel, e uma ligação à internet."],
    ["As ferramentas de inteligência artificial são pagas?", "Muitas têm um plano gratuito, com limites. O curso mostra como começar sem gastar e como saber quando vale a pena pagar uma assinatura."],
    ["Qual é a diferença entre o Básico e o Premium?", `O Básico tem os ${doBasico.length} módulos de base. O Premium junta os ${doPremium.length} módulos avançados (anúncios, voz e lip-sync, curta-metragem e vender a clientes) e os ${BONUS.length} bónus.`],
    ["O pagamento é mensal?", "Não. Paga uma única vez o preço da oferta que escolher, sem assinaturas."],
    GARANTIA_DIAS ? ["Há garantia de devolução do dinheiro?", `Sim. Tem ${GARANTIA_DIAS} dias para experimentar o curso. Se não for para si, peça o reembolso dentro desse prazo, nos termos aplicáveis.`] : null,
    ["Posso partilhar o acesso com outras pessoas?", "Não. O acesso é pessoal: as aulas e os bónus não podem ser partilhados, revendidos nem publicados."]
  ].filter(Boolean);
  $("lista-perguntas").innerHTML = PERGUNTAS.map(([q, a]) =>
    `<details class="faq-item cartao"><summary><span>${esc(q)}</span>${svg(I.chev, 'class="chev"')}</summary><div class="faq-resposta"><p>${esc(a)}</p></div></details>`).join("");

  $$(".revela").forEach(el => {
    if(revela.includes(el)) return;
    const irmaos = [...el.parentElement.children].filter(x => x.classList.contains("revela"));
    el.style.setProperty("--atraso", `${Math.min(irmaos.indexOf(el), 5) * 0.07}s`);
    observaRevela(el);
  });
  $$(".ph").forEach(poeMedia);

  /* Os números contam até ao valor quando aparecem. */
  (() => {
    const els = $$("[data-conta]");
    if(calmo || !temIO) return;
    els.forEach(el => { el.textContent = `0${el.dataset.suf}`; });
    const io = new IntersectionObserver(es => es.forEach(e => {
      if(!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, alvo = Number(el.dataset.conta), t0 = performance.now(), dur = 1100;
      const f = agora => {
        const k = Math.min((agora - t0) / dur, 1), x = 1 - Math.pow(1 - k, 3);
        el.textContent = `${contagem(Math.round(alvo * x))}${el.dataset.suf}`;
        if(k < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }), { threshold:.6 });
    els.forEach(el => io.observe(el));
  })();

  /* ================= O estúdio: o prompt escreve-se e a cena gera-se ================= */
  (() => {
    const janela = $("janela-estudio"), texto = $("ger-texto"), tela = $("ger-tela"), render = $("ger-render"),
          pct = $("ger-pct"), barraR = $("ger-barra"), botao = $("ger-botao"), legenda = $("ger-legenda"),
          ph = tela.querySelector(".ph");
    let visivel = false;
    if(temIO) new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(janela); else visivel = true;
    const acordado = async () => { while(!visivel || document.hidden) await espera(400); };
    const mostraCena = (c, i) => {
      tela.style.setProperty("--tom", c.tom);
      tela.dataset.formato = c.formato;
      $("ger-formato").textContent = c.formato;
      $("ger-estilo").textContent = c.estilo;
      legenda.textContent = c.legenda;
      if((ph.dataset.src || "") !== c.src){ ph.dataset.src = c.src; poeMedia(ph); }
      ph.dataset.rotulo = `Vídeo ${c.formato} · cena-${i + 1}.mp4`;
    };
    if(calmo){ texto.textContent = CENAS[0].prompt; mostraCena(CENAS[0], 0); tela.classList.add("pronta"); return; }
    (async () => {
      let i = 0;
      mostraCena(CENAS[0], 0);
      for(;;){
        const c = CENAS[i % CENAS.length];
        await acordado();
        texto.textContent = "";
        for(let k = 0; k <= c.prompt.length; k++){
          texto.textContent = c.prompt.slice(0, k);
          await espera(c.prompt[k - 1] === " " ? 34 : 18 + Math.random() * 22);
        }
        await espera(420);
        botao.classList.add("carregado"); await espera(220); botao.classList.remove("carregado");
        tela.classList.remove("pronta");
        render.classList.add("ativo");
        const t0 = performance.now(), dur = 2300;
        await new Promise(fim => {
          const passo = agora => {
            const k = Math.min((agora - t0) / dur, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            pct.textContent = Math.round(e * 100);
            barraR.style.transform = `scaleX(${e})`;
            if(k < 1) requestAnimationFrame(passo); else fim();
          };
          requestAnimationFrame(passo);
        });
        mostraCena(c, i % CENAS.length);
        render.classList.remove("ativo");
        tela.classList.add("pronta");
        await espera(3600);
        texto.classList.add("seleccionado"); await espera(420); texto.classList.remove("seleccionado");
        i++;
      }
    })();
  })();

  /* ================= Barra fixa do telemóvel ================= */
  (() => {
    const barra = $("barra-fixa"), hero = $("topo");
    let ofertasVisiveis = false;
    const actualiza = () => barra.classList.toggle("ver", hero.getBoundingClientRect().bottom < 0 && !ofertasVisiveis);
    addEventListener("scroll", actualiza, { passive:true });
    if(temIO){
      let visto = false;
      new IntersectionObserver(([e]) => {
        ofertasVisiveis = e.isIntersecting; actualiza();
        if(e.isIntersecting && !visto){ visto = true; rastreia("ViewContent", { content_name:"Ofertas", content_type:"product", content_ids:["basico", "premium"] }); }
      }, { threshold:.15 }).observe($("ofertas"));
    }
    actualiza();
  })();

  /* ================= Pagamento e a oferta única ================= */
  const aviso = $("aviso");
  let avisoRelogio = 0;
  const avisa = t => {
    aviso.textContent = t; aviso.classList.add("ver");
    clearTimeout(avisoRelogio); avisoRelogio = setTimeout(() => aviso.classList.remove("ver"), 5200);
  };
  function pagar(chave, origem){
    const p = PRECOS[chave];
    document.documentElement.dataset.checkout = chave;
    rastreia("InitiateCheckout", { content_name:p.nome, content_ids:[chave], content_type:"product", value:p.agora, num_items:1 });
    rastreia("BotaoPagamento", { oferta:chave, botao:origem, value:p.agora }, true);
    const url = CHECKOUT[chave];
    if(!url){ avisa(`${p.nome} por ${dinheiro(p.agora)}: o link de pagamento ainda não está ligado.`); return; }
    const u = new URL(url, location.href);
    Object.entries(campanha).forEach(([k, v]) => { if(!u.searchParams.has(k)) u.searchParams.set(k, v); });
    /* Um instante para o píxel sair antes de mudar de página. */
    setTimeout(() => { location.href = u.toString(); }, 300);
  }

  const oto = $("oto");
  let antesDoOto = null;
  const abreOto = () => {
    antesDoOto = document.activeElement;
    if(typeof oto.showModal === "function") oto.showModal(); else oto.setAttribute("open", "");
    document.documentElement.classList.add("com-dialogo");
    oto.scrollTop = 0;
    $("oto-sim").focus();
    rastreia("OfertaUnicaVista", { value:PRECOS.oto.agora }, true);
    /* O preço desce do Premium até ao da oferta única. */
    const el = $("oto-valor"), de = PRECOS.premium.agora, para = PRECOS.oto.agora;
    if(calmo){ el.textContent = dinheiro(para); return; }
    el.textContent = dinheiro(de);
    const t0 = performance.now() + 350, dur = 900;
    const f = agora => {
      const k = Math.max(0, Math.min((agora - t0) / dur, 1)), e = 1 - Math.pow(1 - k, 4);
      el.textContent = dinheiro(Math.round(de + (para - de) * e));
      if(k < 1) requestAnimationFrame(f); else el.classList.add("pousou");
    };
    el.classList.remove("pousou");
    requestAnimationFrame(f);
  };
  const fechaOto = () => { if(oto.open) oto.close(); };
  oto.addEventListener("close", () => {
    document.documentElement.classList.remove("com-dialogo");
    if(antesDoOto && antesDoOto.focus) antesDoOto.focus();
  });
  oto.addEventListener("click", e => { if(e.target === oto) fechaOto(); });   // clique fora da caixa
  $$("[data-fechar]", oto).forEach(b => b.addEventListener("click", fechaOto));
  $("oto-sim").addEventListener("click", () => { fechaOto(); pagar("oto", "oferta_unica"); });
  $("oto-nao").addEventListener("click", () => { fechaOto(); pagar("basico", "oferta_unica_recusada"); });

  /* O Básico abre primeiro a oferta única; o Premium vai direito ao pagamento. */
  $$("[data-comprar]").forEach(b => b.addEventListener("click", () => {
    if(b.dataset.comprar === "basico") abreOto();
    else pagar(b.dataset.comprar, "cartao_oferta");
  }));

  /* ================= Perguntas: abrir e fechar com movimento ================= */
  $$(".faq-item").forEach(d => {
    const s = d.querySelector("summary"), corpo = d.querySelector(".faq-resposta");
    s.addEventListener("click", e => {
      if(calmo || !corpo.animate) return;
      e.preventDefault();
      if(d.open){
        d.classList.add("a-fechar");
        const a = corpo.animate([{ height:`${corpo.offsetHeight}px`, opacity:1 }, { height:"0px", opacity:0 }], { duration:300, easing:"cubic-bezier(.16,1,.3,1)" });
        a.onfinish = () => { d.open = false; d.classList.remove("a-fechar"); };
      } else {
        d.open = true;
        const h = corpo.offsetHeight;
        corpo.animate([{ height:"0px", opacity:0 }, { height:`${h}px`, opacity:1 }], { duration:400, easing:"cubic-bezier(.16,1,.3,1)" });
      }
    });
  });
})();
