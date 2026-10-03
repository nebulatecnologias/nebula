/* ============================================================
   Site de vendas: os efeitos e os preços.
   Os preços vêm da base (public.planos_da_plataforma), os mesmos que
   a consola edita; sem ligação, os valores decididos a 02/10/2026.
   ============================================================ */
(() => {
  const $ = id => document.getElementById(id);
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NBSP = " ";
  const CRIAR = "https://membros.kingdomcompny.com/criar/";
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ""}>${d}</svg>`;

  /* Dinheiro como em todo o lado: «MZ 1 350,00». */
  const valor = n => Number(n || 0).toLocaleString("pt-PT", { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:"always" });
  const contagem = n => Number(n || 0).toLocaleString("pt-PT", { useGrouping:"always" });

  if(!calmo) document.documentElement.classList.add("anima");

  /* ---------------- Navegação ---------------- */
  const nav = $("nav");
  const naRolagem = () => nav.classList.toggle("solida", scrollY > 24);
  addEventListener("scroll", naRolagem, { passive:true }); naRolagem();

  /* ---------------- Entradas ao deslizar ---------------- */
  const revela = [...document.querySelectorAll(".revela")];
  revela.forEach(el => {
    const irmaos = [...el.parentElement.children].filter(x => x.classList.contains("revela"));
    el.style.setProperty("--atraso", `${Math.min(irmaos.indexOf(el), 5) * 0.08}s`);
  });
  if(calmo || !("IntersectionObserver" in window)) revela.forEach(el => el.classList.add("visto"));
  else {
    const io = new IntersectionObserver(entradas => entradas.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add("visto"); io.unobserve(e.target); }
    }), { rootMargin:"0px 0px -8% 0px", threshold:0.08 });
    revela.forEach(el => io.observe(el));
  }

  /* ---------------- A janela da abertura endireita-se ao deslizar ---------------- */
  const janela = $("janela-hero");
  if(!calmo){
    let pedido = 0;
    const inclina = () => {
      pedido = 0;
      const p = Math.min(Math.max(scrollY / 520, 0), 1);
      const e = 1 - Math.pow(1 - p, 3);
      janela.style.setProperty("--rx", `${(16 * (1 - e)).toFixed(2)}deg`);
      janela.style.setProperty("--sc", (0.93 + 0.07 * e).toFixed(4));
    };
    addEventListener("scroll", () => { if(!pedido) pedido = requestAnimationFrame(inclina); }, { passive:true });
    inclina();
  }

  /* ---------------- Experimente: o nome e a cor da sua escola ---------------- */
  const iniciais = nome => {
    const p = nome.trim().split(/\s+/).filter(x => x.length > 2 || /^[A-ZÀ-Ý]/.test(x));
    const letras = (p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] || "E").slice(0, 2));
    return letras.toUpperCase();
  };
  const dominio = nome => {
    const s = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    return `membros.${s || "escolahorizonte"}.com`;
  };
  $("exp-nome").addEventListener("input", e => {
    const nome = e.target.value.trim() || "Escola Horizonte";
    $("m-nome").textContent = nome;
    $("m-iniciais").textContent = iniciais(nome);
    $("m-url").textContent = dominio(nome);
  });
  const cores = [...document.querySelectorAll(".cores button")];
  const escolheCor = b => {
    cores.forEach(x => { x.setAttribute("aria-checked", String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    janela.style.setProperty("--m", b.dataset.cor);
  };
  cores.forEach((b, i) => {
    b.tabIndex = i === 0 ? 0 : -1;
    b.addEventListener("click", () => escolheCor(b));
    b.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if(!d) return;
      e.preventDefault();
      const n = cores[(i + d + cores.length) % cores.length];
      escolheCor(n); n.focus();
    });
  });

  /* ---------------- A luz que segue o rato nos cartões ---------------- */
  document.querySelectorAll(".luz-rato").forEach(c => c.addEventListener("pointermove", e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`);
    c.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  /* ---------------- Faixas de detalhes ---------------- */
  const I = {
    certificado:'<circle cx="12" cy="9" r="5.5"/><path d="m9 13.6-1.5 7 4.5-2.4 4.5 2.4-1.5-7"/>',
    aoVivo:'<rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="m15 11 5-3v8l-5-3"/>',
    convite:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    globo:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    carta:'<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/><path d="M15 18v3l3-3"/>',
    montra:'<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/>',
    grupo:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 20a6.5 6.5 0 0 0-2.6-5.2"/>',
    trofeu:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.6 3.9M16 6h3.5a3 3 0 0 1-3.6 3.9M12 13v4M8.5 20h7"/>',
    grafico:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    idioma:'<path d="M4 5h9M8.5 3v2M6 5c.6 3.2 2.6 5.8 5.5 7.2M11 5c-.8 3.6-3.2 6.6-6.5 8.2"/><path d="m13 21 4-9 4 9M14.4 18h5.2"/>',
    equipa:'<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17a4.8 4.8 0 0 1 9 0"/>',
    ecras:'<rect x="2.5" y="4" width="14" height="10" rx="2"/><path d="M6 18h6"/><rect x="17" y="8" width="4.5" height="12" rx="1.3"/>'
  };
  const DETALHES = [
    [["certificado", "Certificados", "com o nome da sua escola"], ["aoVivo", "Encontros ao vivo", "no Zoom e no Google Meet"], ["convite", "Convites com prazo", "de 1 a 30 dias"],
     ["globo", "Domínio próprio", "membros.suaescola.com"], ["carta", "Emails com a sua marca", "convites e recuperação"], ["montra", "Vitrine", "os cursos que o aluno ainda não tem"]],
    [["grupo", "Comunidades", "um grupo por programa"], ["trofeu", "Ranking e conquistas", "para o aluno voltar"], ["grafico", "Relatórios", "o progresso de cada aluno"],
     ["idioma", "Português e inglês", "à escolha de cada aluno"], ["equipa", "Equipa", "com papéis e acessos"], ["ecras", "Telemóvel e computador", "a mesma área, nos dois"]]
  ];
  const cartaoDetalhe = ([ico, t, s]) => `<li class="detalhe"><span class="detalhe-ico">${svg(I[ico])}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></li>`;
  [["trilho-1", DETALHES[0]], ["trilho-2", DETALHES[1]]].forEach(([id, lista]) => {
    const um = lista.map(cartaoDetalhe).join("");
    /* Duas voltas iguais para o deslize não ter costura; a segunda é só desenho. */
    $(id).innerHTML = um + um.replace(/<li class="detalhe">/g, '<li class="detalhe" aria-hidden="true">');
  });

  /* ---------------- Para quem é: o carrossel ---------------- */
  const SLIDES = [
    { tipo:"Escola de música", ico:'<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>', cor:"#7357e8",
      escola:"Escola de Música Acorde", dominio:"membros.escolaacorde.com", capa:"Violino · Nível 2", progresso:40,
      frase:"Aulas de instrumento por níveis, com o progresso de cada aluno à vista e um certificado no fim de cada etapa." },
    { tipo:"Mentoria", ico:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>', cor:"#0f8f86",
      escola:"Mentoria Farol", dominio:"membros.mentoriafarol.com", capa:"Semana 5 de 12", progresso:42,
      frase:"Um programa de doze semanas, com um encontro ao vivo por semana e o grupo do programa no WhatsApp só para quem se inscreveu." },
    { tipo:"Formação profissional", ico:'<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>', cor:"#2f6fe4",
      escola:"Instituto Kairós", dominio:"membros.institutokairos.com", capa:"Contabilidade básica", progresso:70,
      frase:"Cursos vendidos pelo Payflow, por M-Pesa ou cartão: quando o pagamento entra, o aluno recebe o acesso sem ninguém da equipa mexer em nada." },
    { tipo:"Igreja e ministério", ico:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5M12 7v6M9.5 9.5h5"/>', cor:"#b3264f",
      escola:"Ministério Palavra Viva", dominio:"membros.palavraviva.com", capa:"Liderança · Módulo 1", progresso:25,
      frase:"Formação de líderes em português e em inglês, com convites que caducam e as aulas em vídeo no YouTube ou no Vimeo." }
  ];
  let atual = 0, relogio = 0;
  const tel = $("tel"), frase = $("slide-frase"), palco = $("slider-palco");
  $("slide-total").textContent = SLIDES.length;
  const mostra = (i, primeiro) => {
    atual = (i + SLIDES.length) % SLIDES.length;
    const s = SLIDES[atual];
    const aplica = () => {
      $("slide-tipo").textContent = s.tipo;
      $("slide-ico").innerHTML = svg(s.ico);
      frase.textContent = `«${s.frase}»`;
      $("slide-escola").textContent = s.escola;
      $("slide-dominio").textContent = s.dominio;
      $("slide-n").textContent = atual + 1;
      $("tel-nome").textContent = s.escola;
      $("tel-sinal").textContent = iniciais(s.escola);
      $("tel-capa-txt").textContent = s.capa;
      $("tel-barra").style.setProperty("--p", s.progresso / 100);
      tel.style.setProperty("--m", s.cor);
      palco.style.setProperty("--m", s.cor);
      tel.classList.remove("muda"); frase.classList.remove("muda");
    };
    if(primeiro || calmo) return aplica();
    tel.classList.add("muda"); frase.classList.add("muda");
    setTimeout(aplica, 320);
  };
  const seguinte = () => mostra(atual + 1);
  const anda = () => { clearInterval(relogio); if(!calmo) relogio = setInterval(seguinte, 7000); };
  $("slide-seg").addEventListener("click", () => { seguinte(); anda(); });
  $("slide-ant").addEventListener("click", () => { mostra(atual - 1); anda(); });
  const slider = $("slider");
  slider.addEventListener("pointerenter", () => clearInterval(relogio));
  slider.addEventListener("pointerleave", anda);
  slider.addEventListener("focusin", () => clearInterval(relogio));
  slider.addEventListener("focusout", anda);
  slider.addEventListener("keydown", e => {
    if(e.key === "ArrowRight"){ seguinte(); anda(); }
    if(e.key === "ArrowLeft"){ mostra(atual - 1); anda(); }
  });
  let toqueX = null;
  palco.addEventListener("touchstart", e => { toqueX = e.touches[0].clientX; }, { passive:true });
  palco.addEventListener("touchend", e => {
    if(toqueX == null) return;
    const d = e.changedTouches[0].clientX - toqueX; toqueX = null;
    if(Math.abs(d) > 40){ mostra(atual + (d < 0 ? 1 : -1)); anda(); }
  });
  mostra(0, true); anda();

  /* ---------------- Pilares: separadores que seguem a leitura ---------------- */
  const abas = [...document.querySelectorAll("#pilares-abas a")];
  const indicador = $("pilares-indicador");
  const marcaAba = a => {
    abas.forEach(x => { x.classList.toggle("ativo", x === a); if(x === a) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
    indicador.style.setProperty("--x", `${a.offsetLeft}px`);
    indicador.style.setProperty("--w", `${a.offsetWidth}px`);
    const caixa = a.parentElement;
    if(caixa.scrollWidth > caixa.clientWidth) caixa.scrollTo({ left:a.offsetLeft - 20, behavior:calmo ? "auto" : "smooth" });
  };
  if(abas.length){
    requestAnimationFrame(() => marcaAba(abas[0]));
    addEventListener("resize", () => marcaAba(abas.find(a => a.classList.contains("ativo")) || abas[0]));
    if("IntersectionObserver" in window){
      const visiveis = new Map();
      const espiao = new IntersectionObserver(es => {
        es.forEach(e => visiveis.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        let melhor = null, r = 0;
        visiveis.forEach((v, id) => { if(v > r){ r = v; melhor = id; } });
        if(melhor){ const a = abas.find(x => x.getAttribute("href") === `#${melhor}`); if(a && !a.classList.contains("ativo")) marcaAba(a); }
      }, { rootMargin:"-150px 0px -35% 0px", threshold:[0, .2, .4, .6, .8, 1] });
      document.querySelectorAll(".pilar").forEach(p => espiao.observe(p));
    }
  }

  /* Os desenhos de cada pilar acordam quando entram no ecrã. */
  const desenhos = [...document.querySelectorAll(".pilar-visual")];
  const acorda = el => {
    el.classList.add("visto");
    if(el.querySelector("#fluxo")) correFluxo();
    if(el.querySelector("#ranking")) sobeRanking();
  };
  if(calmo || !("IntersectionObserver" in window)) desenhos.forEach(acorda);
  else {
    const io2 = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ acorda(e.target); io2.unobserve(e.target); } }), { threshold:0.35 });
    desenhos.forEach(el => io2.observe(el));
  }

  /* Entrega: os passos acendem-se um a um e recomeçam. */
  function correFluxo(){
    const passos = [...document.querySelectorAll("#fluxo .fluxo-passo")];
    if(calmo){ passos.forEach(p => p.classList.add("aceso")); return; }
    let i = 0;
    const passo = () => {
      if(i === passos.length){ setTimeout(() => { passos.forEach(p => p.classList.remove("aceso")); i = 0; setTimeout(passo, 700); }, 2600); return; }
      passos[i++].classList.add("aceso");
      setTimeout(passo, 750);
    };
    setTimeout(passo, 400);
  }

  /* Gamificação: o ranking, com o XP a subir até ao valor. */
  const RANKING = [
    ["JA", "Júlia A.", 25432, "#0f8f86"], ["VC", "Vasco C.", 23120, "#2f6fe4"], ["AB", "Artur B.", 19814, "#b3264f"],
    ["AL", "Ana Langa", 19536, "#7357e8", true], ["DR", "Dina R.", 18012, "#139a5b"], ["JL", "João L.", 16318, "#c2410c"]
  ];
  $("ranking").innerHTML = RANKING.map(([ini, nome, xp, cor, eu], i) =>
    `<li${eu ? ' class="eu"' : ""}><span class="pos">${i + 1}</span><span class="av" style="background:${cor}">${ini}</span><span>${esc(nome)}</span><span class="xp" data-xp="${xp}">${contagem(xp)}</span><span class="tag">XP</span></li>`).join("");
  function sobeRanking(){
    if(calmo) return;
    document.querySelectorAll("#ranking .xp").forEach(el => {
      const alvo = Number(el.dataset.xp), t0 = performance.now(), dur = 1400;
      const f = agora => { const k = Math.min((agora - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = contagem(Math.round(alvo * e)); if(k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
  }

  /* ---------------- Preços ---------------- */
  const DECIDIDOS = [
    { id:"essencial", nome:"Essencial", aVenda:true, alunosMax:500, precos:{ MZN:{ mensal:699, anual:null, simbolo:"MZ" }, ZAR:{ mensal:155.33, anual:null, simbolo:"R" } } },
    { id:"profissional", nome:"Profissional", aVenda:true, alunosMax:1500, precos:{ MZN:{ mensal:1350, anual:null, simbolo:"MZ" }, ZAR:{ mensal:300, anual:null, simbolo:"R" } } },
    { id:"escala", nome:"Premium", aVenda:true, alunosMax:5000, precos:{ MZN:{ mensal:3450, anual:null, simbolo:"MZ" }, ZAR:{ mensal:766.67, anual:null, simbolo:"R" } } }
  ];
  const TEXTO = {
    essencial:   { desc:"Para quem está a lançar os primeiros cursos.", ico:'<path d="M12 20v-8"/><path d="M12 12c0-4 2.5-7 7-7 0 4.5-3 7-7 7z"/><path d="M12 14c0-3-2-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5z"/>' },
    profissional:{ desc:"Para escolas com turmas a crescer todos os meses.", ico:'<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14.5 4.5c3-1 5-1 5-1s0 2-1 5l-6.5 6.5-4-4z"/><path d="M8 11 5 10.5 7.5 8H11M13 16l.5 3 2.5-2.5V13"/>' },
    escala:      { desc:"Para escolas grandes, com muitos cursos e muitos alunos.", ico:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".55"/>' }
  };
  const CHECK = '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>';
  const E = { planos:[], moeda:"MZN", ciclo:"mensal" };
  const precoDe = (p, ciclo, moeda) => { const v = p.precos && p.precos[moeda] && p.precos[moeda][ciclo]; return v == null ? null : Number(v); };
  const simboloDe = (p, moeda) => (p.precos && p.precos[moeda] && p.precos[moeda].simbolo) || (moeda === "ZAR" ? "R" : "MZ");
  const temAnual = () => E.planos.some(p => precoDe(p, "anual", E.moeda) != null);
  const vendeEm = moeda => E.planos.some(p => precoDe(p, "mensal", moeda) != null || precoDe(p, "anual", moeda) != null);

  const valorHTML = (n, sim) => `<span class="sim">${esc(sim)}${NBSP}</span><span class="num">${valor(n)}</span>`;
  const linkCriar = p => {
    const u = new URL(CRIAR);
    u.searchParams.set("plano", p.id === "escala" ? "premium" : p.id);
    u.searchParams.set("ciclo", E.ciclo); u.searchParams.set("moeda", E.moeda);
    return u.toString();
  };

  function cartaoPlano(p){
    const t = TEXTO[p.id] || { desc:"", ico:TEXTO.essencial.ico };
    const ciclo = precoDe(p, E.ciclo, E.moeda) != null ? E.ciclo : "mensal";
    const v = precoDe(p, ciclo, E.moeda);
    const destaque = p.id === "profissional";
    const mensal = precoDe(p, "mensal", E.moeda);
    const poupa = ciclo === "anual" && mensal ? Math.round((1 - v / (mensal * 12)) * 100) : 0;
    const itens = [`Até ${contagem(p.alunosMax)} alunos activos`, "A sua marca e o seu domínio", "Cursos, módulos e certificados", "Encontros ao vivo e comunidades", "Vendas pelo Payflow: M-Pesa e cartão"];
    return `<article class="plano${destaque ? " destaque" : ""}" data-plano="${esc(p.id)}">
      ${destaque ? `<span class="plano-selo">Recomendado</span>` : ""}
      ${svg(t.ico, 'class="plano-ico"')}
      <h3>${esc(p.nome)}</h3>
      <p class="plano-desc">${esc(t.desc)}</p>
      <div class="plano-preco">
        ${v == null ? `<span class="plano-valor">Sob consulta</span>` : `<span class="plano-valor" data-valor="${v}">${valorHTML(v, simboloDe(p, E.moeda))}</span><span class="plano-por">/ ${ciclo === "anual" ? "ano" : "mês"}</span>`}
        ${poupa > 0 ? `<span class="plano-poupa">Poupa ${poupa}% face ao mensal</span>` : ""}
      </div>
      <h4>O que inclui:</h4>
      <ul>${itens.map(x => `<li>${svg(CHECK)}<span>${esc(x)}</span></li>`).join("")}</ul>
      <a class="btn ${destaque ? "btn-branco" : "btn-escuro"}" href="${esc(linkCriar(p))}">${svg('<path d="M5 12h14M13 6l6 6-6 6"/>')}Começar 7 dias grátis</a>
    </article>`;
  }

  /* Os números correm até ao valor novo quando se troca a moeda ou o ciclo. */
  function correNumeros(antes){
    if(calmo) return;
    document.querySelectorAll("#planos .plano-valor[data-valor]").forEach(el => {
      const id = el.closest(".plano").dataset.plano, de = antes[id], para = Number(el.dataset.valor);
      if(de == null || de === para) return;
      const num = el.querySelector(".num"), t0 = performance.now(), dur = 700;
      const passo = agora => {
        const k = Math.min((agora - t0) / dur, 1), e = 1 - Math.pow(1 - k, 4);
        num.textContent = valor(de + (para - de) * e);
        if(k < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

  function desenhaPlanos(){
    const antes = {};
    document.querySelectorAll("#planos .plano-valor[data-valor]").forEach(el => { antes[el.closest(".plano").dataset.plano] = Number(el.dataset.valor); });
    const lista = E.planos.filter(p => p.aVenda !== false && (precoDe(p, "mensal", E.moeda) != null || precoDe(p, "anual", E.moeda) != null));
    $("planos").innerHTML = lista.length ? lista.map(cartaoPlano).join("") : `<p class="precos-erro">Os planos ainda não estão à venda nesta moeda.</p>`;
    $("planos").setAttribute("aria-busy", "false");
    $("int-ciclo").hidden = !temAnual();
    $("int-moeda").hidden = !(vendeEm("MZN") && vendeEm("ZAR"));
    correNumeros(antes);
    /* Os botões gerais levam ao plano recomendado na moeda escolhida. */
    const rec = lista.find(p => p.id === "profissional") || lista[0];
    if(rec) document.querySelectorAll("[data-criar]").forEach(a => { a.href = linkCriar(rec); });
  }

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
  interruptor("btn-moeda", "int-moeda", ligado => { E.moeda = ligado ? "ZAR" : "MZN"; desenhaPlanos(); });
  interruptor("btn-ciclo", "int-ciclo", ligado => { E.ciclo = ligado ? "anual" : "mensal"; desenhaPlanos(); });

  (async () => {
    $("planos").innerHTML = '<div class="plano plano-esq"></div><div class="plano plano-esq"></div><div class="plano plano-esq"></div>';
    try {
      if(new URLSearchParams(location.search).has("demo")) throw new Error("demonstração");
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/planos_da_plataforma`, {
        method:"POST",
        headers:{ apikey:SUPABASE_CHAVE, Authorization:`Bearer ${SUPABASE_CHAVE}`, "Content-Type":"application/json", "Content-Profile":"public", "Accept-Profile":"public" },
        body:"{}"
      });
      if(!r.ok) throw new Error(String(r.status));
      const dados = await r.json();
      E.planos = Array.isArray(dados) && dados.length ? dados : DECIDIDOS;
    } catch(e){ E.planos = DECIDIDOS; }
    desenhaPlanos();
  })();

  /* ---------------- Perguntas: abrir e fechar com movimento ---------------- */
  document.querySelectorAll(".faq-item").forEach(d => {
    const s = d.querySelector("summary"), corpo = d.querySelector(".faq-resposta");
    s.addEventListener("click", e => {
      if(calmo || !corpo.animate) return;
      e.preventDefault();
      if(d.open){
        const a = corpo.animate([{ height:`${corpo.offsetHeight}px`, opacity:1 }, { height:"0px", opacity:0 }], { duration:320, easing:"cubic-bezier(.16,1,.3,1)" });
        d.classList.add("a-fechar");
        a.onfinish = () => { d.open = false; d.classList.remove("a-fechar"); };
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
    let estrelas = [], largura = 0, altura = 0, dpr = 1, visivel = false, pedido = 0;
    const prepara = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      largura = tela.clientWidth; altura = tela.clientHeight;
      tela.width = Math.round(largura * dpr); tela.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(largura * altura / 5200);
      estrelas = Array.from({ length:n }, () => ({
        x:Math.random() * largura, y:Math.random() * altura, r:Math.random() * 1.1 + .25,
        f:Math.random() * Math.PI * 2, v:Math.random() * 1.4 + .4, quente:Math.random() < .18,
        dy:-(Math.random() * 0.06 + 0.01)
      }));
    };
    const desenha = t => {
      ctx.clearRect(0, 0, largura, altura);
      for(const s of estrelas){
        const a = calmo ? .55 : .25 + .75 * Math.abs(Math.sin(s.f + t * 0.001 * s.v));
        if(!calmo){ s.y += s.dy; if(s.y < -2) s.y = altura + 2; }
        ctx.globalAlpha = a * (0.35 + 0.65 * (1 - s.y / altura * .5));
        ctx.fillStyle = s.quente ? "#ffb384" : "#ffffff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const ciclo = t => { desenha(t); pedido = visivel && !calmo ? requestAnimationFrame(ciclo) : 0; };
    prepara(); desenha(0);
    addEventListener("resize", () => { prepara(); desenha(performance.now()); });
    if("IntersectionObserver" in window){
      new IntersectionObserver(([e]) => {
        visivel = e.isIntersecting;
        if(visivel && !pedido && !calmo) pedido = requestAnimationFrame(ciclo);
      }).observe(tela);
    }
  }
})();
