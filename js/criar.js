/* ============================================================
   Criar uma área de membros (/criar/) — W4, no molde do Memberkit.

   O plano vem no endereço (?plano=profissional&ciclo=anual) e mostra-se em
   cima, com a troca de ciclo e de plano. Depois:
     1. a conta: nome da área, o nome da pessoa, email, senha (duas vezes);
        se o email já tem conta, pede-se a senha dessa conta e cria-se com ela;
     2. o cartão: a Paystack verifica-o com R 1,00, devolvido logo, e só se
        cobra no fim dos 7 dias grátis (a função plataforma-cartao);
     3. pronta: o botão abre a área nova (?org=<nome curto>).
   Sem cartão a área fica guardada, mas pendente: não abre aos alunos.

   O dinheiro é só apresentação: o preço que se cobra sai da base, nunca
   daqui. A página é da plataforma, que ainda não tem marca: não leva a de
   nenhuma escola.

   Duas fontes com a mesma forma: a base e a demonstração (?demo=1), em
   memória, para os testes — que nunca falam com a Paystack nem criam contas.
   ============================================================ */

const GUARDADO = "criar.escola";
const $ = id => document.getElementById(id);

function esc(t){
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
/* «R 1 500,00» — CLAUDE.md: símbolo à frente, sempre agrupado, vírgula. O
   espaço depois do símbolo é inquebrável, para o «R» não ficar sozinho no
   fim de uma linha. */
function dinheiro(n, simbolo){
  return `${simbolo}\u00a0` + Number(n || 0).toLocaleString("pt-PT",
    { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:"always" });
}
/* Uma contagem (não é dinheiro): «1 500». */
function contagem(n){ return Number(n || 0).toLocaleString("pt-PT", { useGrouping:"always" }); }
function dataLonga(d){
  try { return new Date(d).toLocaleDateString("pt-PT", { day:"numeric", month:"long" }); }
  catch(e){ return ""; }
}
function lerGuardado(){ try { return JSON.parse(sessionStorage.getItem(GUARDADO) || "null"); } catch(e){ return null; } }
function guardar(v){ try { v ? sessionStorage.setItem(GUARDADO, JSON.stringify(v)) : sessionStorage.removeItem(GUARDADO); } catch(e){ /* sem armazenamento */ } }

/* ---------------- A Paystack ---------------- */
/* O formulário da Paystack, como no Payflow: o número do cartão nunca passa
   por esta página. Se o script não vier (rede, bloqueador), diz-se. */
const PAYSTACK_JS = "https://js.paystack.co/v2/inline.js";
let paystackAPedir = null;
function carregarPaystack(){
  if(window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if(paystackAPedir) return paystackAPedir;
  paystackAPedir = new Promise((ok, nao) => {
    const el = document.createElement("script");
    el.src = PAYSTACK_JS; el.async = true;
    const prazo = setTimeout(() => nao(new Error("demorou de mais")), 8000);
    el.onload = () => { clearTimeout(prazo); window.PaystackPop ? ok(window.PaystackPop) : nao(new Error("sem PaystackPop")); };
    el.onerror = () => { clearTimeout(prazo); nao(new Error("não carregou")); };
    document.head.appendChild(el);
  }).catch(e => { paystackAPedir = null; throw e; });
  return paystackAPedir;
}
/* Responde uma vez só: a Paystack pode chamar onCancel a seguir a onSuccess. */
async function formularioPaystack(accessCode, referencia){
  let Pop;
  try { Pop = await carregarPaystack(); } catch(e){ return { ok:false, motivo:"sem-script" }; }
  return new Promise(resolve => {
    let respondeu = false;
    const uma = r => { if(!respondeu){ respondeu = true; resolve(r); } };
    try {
      new Pop().resumeTransaction(accessCode, {
        onSuccess: t => uma({ ok:true, referencia:(t && t.reference) || referencia }),
        onCancel: () => uma({ ok:false, motivo:"desistiu" }),
        onError: () => uma({ ok:false, motivo:"erro" }),
      });
    } catch(e){ uma({ ok:false, motivo:"sem-script" }); }
  });
}

/* ---------------- A base ---------------- */
function fonteReal(){
  let c = null;
  async function invocar(nome, body){
    const { data, error } = await c.functions.invoke(nome, { body });
    if(error){
      let corpo = {};
      try { corpo = await error.context.json(); } catch(e){ /* sem corpo */ }
      const e = new Error(corpo.error || "Não foi possível falar com o servidor. Tente outra vez.");
      e.estado = error.context && error.context.status; e.corpo = corpo;
      throw e;
    }
    if(data && data.error){ const e = new Error(data.error); e.corpo = data; throw e; }
    return data;
  }
  return {
    iniciar(){
      c = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
        db:{ schema:ESQUEMA }, auth:{ persistSession:true, autoRefreshToken:true }
      });
    },
    async planos(){
      const { data, error } = await c.schema("public").rpc("planos_da_plataforma");
      if(error) throw new Error("Não foi possível carregar os planos.");
      return data || [];
    },
    async sessao(){ const { data } = await c.auth.getSession(); return data.session ? data.session.user : null; },
    async entrar(email, senha){
      const { error } = await c.auth.signInWithPassword({ email, password:senha });
      if(error) throw new Error(/invalid/i.test(error.message) ? "A senha não confere com este email." : error.message);
    },
    criarEscola: corpo => invocar("criar-escola", corpo),
    iniciarCartao: org => invocar("plataforma-cartao", { accao:"iniciar", organizacao:org }),
    confirmarCartao: (org, referencia) => invocar("plataforma-cartao", { accao:"confirmar", organizacao:org, referencia }),
    formulario: formularioPaystack,
  };
}

/* ---------------- A demonstração ---------------- */
/* Preços de mentira, só para a página se ver e os testes correrem. */
function fonteDemo(){
  const q = new URLSearchParams(location.search);
  const registo = window.__criarDemo = { chamadas:[] };
  let sessao = null;
  const espera = () => new Promise(r => setTimeout(r, 60));
  const planos = [
    { id:"essencial", nome:"Essencial", alunosMax:500, precoMensal:199, precoAnual:1990, moeda:"ZAR", simbolo:"R", aVenda:true },
    { id:"profissional", nome:"Profissional", alunosMax:1500, precoMensal:399, precoAnual:3990, moeda:"ZAR", simbolo:"R", aVenda:true },
    { id:"escala", nome:"Escala", alunosMax:5000, precoMensal:799, precoAnual:null, moeda:"ZAR", simbolo:"R", aVenda:true },
  ];
  let contaExiste = q.has("existe");
  return {
    iniciar(){},
    async planos(){
      await espera();
      return q.has("fechado") ? planos.map(p => Object.assign({}, p, { precoMensal:null, precoAnual:null, aVenda:false })) : planos;
    },
    async sessao(){ return sessao; },
    async entrar(email, senha){
      await espera(); registo.chamadas.push(["entrar", email]);
      if(senha === "errada-123") throw new Error("A senha não confere com este email.");
      sessao = { email };
    },
    async criarEscola(corpo){
      await espera(); registo.chamadas.push(["criar-escola", Object.assign({}, corpo, { senha: corpo.senha ? "•" : "" })]);
      if(contaExiste && !sessao){ const e = new Error("Este email já tem conta."); e.estado = 409; e.corpo = { conta:"existe" }; throw e; }
      const slug = corpo.nomeEscola.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return { ok:true, organizacao:"00000000-0000-4000-8000-000000000001", slug, contaNova:!sessao };
    },
    async iniciarCartao(org){
      await espera(); registo.chamadas.push(["cartao-iniciar", org]);
      return { access_code:"demo", referencia:"PLTV-0000000000000000", valor:1, moeda:"ZAR", ambiente:"teste" };
    },
    async confirmarCartao(org, referencia){
      await espera(); registo.chamadas.push(["cartao-confirmar", referencia]);
      if(q.has("recusa")) throw new Error("O cartão não tinha saldo suficiente.");
      return { ok:true, estado:"teste", testeAte:new Date(Date.now() + 7 * 864e5).toISOString(),
               cartao:{ marca:"visa", ultimos4:"4081", expira:"12/2030" } };
    },
    async formulario(){
      await espera(); registo.chamadas.push(["formulario"]);
      return q.has("desiste") ? { ok:false, motivo:"desistiu" } : { ok:true, referencia:"PLTV-0000000000000000" };
    },
  };
}

/* ---------------- A página ---------------- */
const fonte = new URLSearchParams(location.search).has("demo") ? fonteDemo() : fonteReal();
const E = { planos:[], plano:null, ciclo:"mensal", escola:null, diasTeste:7, verificacao:1, existente:false };

const precoDe = (p, ciclo) => ciclo === "anual" ? p.precoAnual : p.precoMensal;

function escolherPlano(id, ciclo){
  const aVenda = E.planos.filter(p => p.aVenda);
  E.plano = aVenda.find(p => p.id === id) || aVenda.find(p => p.id === "profissional") || aVenda[0];
  E.ciclo = ciclo === "anual" && E.plano.precoAnual != null ? "anual"
          : E.plano.precoMensal != null ? "mensal" : "anual";
  try {
    const u = new URL(location.href);
    u.searchParams.set("plano", E.plano.id); u.searchParams.set("ciclo", E.ciclo);
    history.replaceState(null, "", u);
  } catch(e){ /* sem history */ }
  desenharPlano();
}

function desenharPlano(){
  const p = E.plano, preco = precoDe(p, E.ciclo);
  $("plano-nome").textContent = `Plano ${p.nome}`;
  $("plano-alunos").textContent = `Até ${contagem(p.alunosMax)} alunos`;
  $("plano-valor").textContent = dinheiro(preco, p.simbolo);
  let por = E.ciclo === "anual" ? "por ano" : "por mês";
  if(E.ciclo === "anual" && p.precoMensal){
    const poupa = Math.round((1 - p.precoAnual / (p.precoMensal * 12)) * 100);
    if(poupa > 0) por += ` · poupa ${poupa}%`;
  }
  $("plano-por").textContent = por;
  document.querySelectorAll("#ciclo button").forEach(b => {
    const c = b.dataset.ciclo;
    b.setAttribute("aria-pressed", String(c === E.ciclo));
    b.hidden = precoDe(p, c) == null;
  });
  $("ciclo").hidden = [...document.querySelectorAll("#ciclo button")].filter(b => !b.hidden).length < 2;
  const fim = new Date(Date.now() + E.diasTeste * 864e5);
  $("plano-gratis").textContent = `${E.diasTeste} dias grátis. A primeira cobrança, de ${dinheiro(preco, p.simbolo)}, é a ${dataLonga(fim)}. Pode cancelar antes.`;
}

function preencherEscolha(){
  const s = $("plano-escolher");
  s.innerHTML = E.planos.filter(p => p.aVenda)
    .map(p => `<option value="${esc(p.id)}">${esc(p.nome)} — até ${esc(contagem(p.alunosMax))} alunos</option>`).join("");
  s.value = E.plano.id;
  s.hidden = s.options.length < 2;
}

/* ---- passo 1: a conta ---- */
function erroConta(msg, campo){
  const box = $("conta-erro");
  box.textContent = msg || ""; box.hidden = !msg;
  document.querySelectorAll("#form-conta [aria-invalid]").forEach(i => i.removeAttribute("aria-invalid"));
  if(campo){ campo.setAttribute("aria-invalid", "true"); campo.focus(); }
  else if(msg) box.scrollIntoView({ block:"nearest" });
}

function validar(){
  const v = id => $(id).value.trim();
  if(v("f-escola").length < 2) return ["Escreva o nome da área de membros.", $("f-escola")];
  if(v("f-nome").length < 2) return ["Escreva o seu nome.", $("f-nome")];
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("f-email"))) return ["O email não parece certo.", $("f-email")];
  if(E.existente){
    if(!$("f-senha-existente").value) return ["Escreva a senha da sua conta.", $("f-senha-existente")];
  } else {
    if($("f-senha").value.length < 8) return ["A senha tem de ter pelo menos 8 caracteres.", $("f-senha")];
    if($("f-senha").value !== $("f-senha2").value) return ["As duas senhas não são iguais.", $("f-senha2")];
  }
  return null;
}

function aOcupar(botao, texto){
  if(texto){ botao.dataset.texto = botao.textContent; botao.disabled = true; botao.innerHTML = `<span class="roda" aria-hidden="true"></span> ${esc(texto)}`; }
  else { botao.disabled = false; botao.textContent = botao.dataset.texto || botao.textContent; }
}

function modoExistente(){
  E.existente = true;
  $("campos-senha").hidden = true;
  $("campos-existente").hidden = false;
  $("btn-conta").textContent = "Entrar e continuar";
  $("f-email").readOnly = true;
  $("f-senha-existente").focus();
}

async function enviarConta(ev){
  ev.preventDefault();
  const problema = validar();
  if(problema) return erroConta(problema[0], problema[1]);
  erroConta("");
  const btn = $("btn-conta");
  const email = $("f-email").value.trim().toLowerCase();
  const corpo = {
    nomeEscola:$("f-escola").value.trim(), nome:$("f-nome").value.trim(), email,
    senha:E.existente ? "" : $("f-senha").value, plano:E.plano.id, ciclo:E.ciclo, aceitouTermos:true,
  };
  aOcupar(btn, E.existente ? "A entrar…" : "A criar…");
  try {
    if(E.existente) await fonte.entrar(email, $("f-senha-existente").value);
    let r;
    try { r = await fonte.criarEscola(corpo); }
    catch(e){
      if(e.estado === 409 && e.corpo && e.corpo.conta === "existe"){ aOcupar(btn); modoExistente(); return; }
      throw e;
    }
    if(r.contaNova) await fonte.entrar(email, corpo.senha);
    E.escola = { organizacao:r.organizacao, slug:r.slug, nome:corpo.nomeEscola, plano:E.plano.id, ciclo:E.ciclo };
    guardar(E.escola);
    passoCartao();
  } catch(e){
    aOcupar(btn);
    if(E.existente) btn.textContent = "Entrar e continuar";
    erroConta(e.message || "Não foi possível criar a área de membros.");
  }
}

/* ---- passo 2: o cartão ---- */
function passoCartao(){
  $("passo-1").removeAttribute("aria-current"); $("passo-1").classList.add("feito");
  $("passo-2").setAttribute("aria-current", "step");
  $("painel-conta").hidden = true;
  $("plano-escolhas").hidden = true;
  $("painel-cartao").hidden = false;
  const p = E.plano, preco = precoDe(p, E.ciclo);
  const fim = new Date(Date.now() + E.diasTeste * 864e5);
  $("cartao-sub").textContent = `A «${E.escola.nome}» está criada. Ponha o cartão para começar os ${E.diasTeste} dias grátis.`;
  $("cartao-resumo").innerHTML = `
    <div><span>Plano</span><b>${esc(p.nome)} · ${E.ciclo === "anual" ? "anual" : "mensal"}</b></div>
    <div><span>Hoje</span><b>${esc(dinheiro(0, p.simbolo))}</b></div>
    <div><span>A partir de ${esc(dataLonga(fim))}</span><b>${esc(dinheiro(preco, p.simbolo))} ${E.ciclo === "anual" ? "por ano" : "por mês"}</b></div>`;
  $("cartao-seguro").textContent = `Para confirmar o cartão cobramos ${dinheiro(E.verificacao, p.simbolo)}, que devolvemos logo. A cobrança é em rand sul-africano (ZAR); o número do cartão fica com a Paystack, nós não o vemos.`;
  $("painel-cartao").scrollIntoView({ block:"start", behavior:"smooth" });
  $("btn-cartao").focus({ preventScroll:true });
}

function erroCartao(msg, tom){
  const box = $("cartao-erro");
  box.className = "aviso " + (tom || "erro");
  box.textContent = msg || ""; box.hidden = !msg;
}

async function porCartao(){
  const btn = $("btn-cartao");
  erroCartao("");
  aOcupar(btn, "A abrir…");
  try {
    const ini = await fonte.iniciarCartao(E.escola.organizacao);
    aOcupar(btn); aOcupar(btn, "À espera do cartão…");
    const f = await fonte.formulario(ini.access_code, ini.referencia);
    if(!f.ok){
      aOcupar(btn);
      if(f.motivo === "desistiu") return erroCartao("O cartão ficou por pôr. A sua área de membros está guardada: ponha o cartão quando quiser.", "nota");
      if(f.motivo === "sem-script") return erroCartao("Não conseguimos abrir o formulário do cartão. Verifique a ligação, ou desligue o bloqueador de anúncios, e tente outra vez.");
      return erroCartao("O formulário do cartão deu um erro. Tente outra vez.");
    }
    aOcupar(btn); aOcupar(btn, "A confirmar…");
    const r = await fonte.confirmarCartao(E.escola.organizacao, f.referencia);
    pronta(r);
  } catch(e){
    aOcupar(btn);
    erroCartao(e.message || "Não foi possível confirmar o cartão.");
  }
}

/* ---- pronta ---- */
function pronta(r){
  guardar(null);
  $("passo-2").removeAttribute("aria-current"); $("passo-2").classList.add("feito");
  $("painel-cartao").hidden = true;
  $("painel-pronta").hidden = false;
  $("pronta-titulo").textContent = `A «${E.escola.nome}» está pronta`;
  const ate = r && r.testeAte ? dataLonga(r.testeAte) : dataLonga(Date.now() + E.diasTeste * 864e5);
  $("pronta-texto").textContent = `Os ${E.diasTeste} dias grátis vão até ${ate}. Pode cancelar antes, sem custos, em Configurações › Cobrança.`;
  $("btn-entrar").href = `/?org=${encodeURIComponent(E.escola.slug)}`;
  $("btn-entrar").focus({ preventScroll:true });
}

/* ---- arranque ---- */
async function arrancar(){
  fonte.iniciar();
  try { E.planos = await fonte.planos(); }
  catch(e){ E.planos = []; }
  $("a-carregar").hidden = true;
  if(!E.planos.some(p => p.aVenda)){ $("ecra-fechado").hidden = false; return; }
  $("ecra-criar").hidden = false;

  const q = new URLSearchParams(location.search);
  const guardado = lerGuardado();
  escolherPlano(guardado ? guardado.plano : q.get("plano"), guardado ? guardado.ciclo : q.get("ciclo"));
  preencherEscolha();

  $("plano-escolher").addEventListener("change", e => escolherPlano(e.target.value, E.ciclo));
  document.querySelectorAll("#ciclo button").forEach(b => b.addEventListener("click", () => escolherPlano(E.plano.id, b.dataset.ciclo)));
  $("form-conta").addEventListener("submit", enviarConta);
  $("btn-cartao").addEventListener("click", porCartao);

  /* Voltou à página a meio (recarregou, ou desistiu do cartão): a área já
     existe e a sessão está aberta — falta só o cartão. */
  if(guardado && guardado.organizacao && await fonte.sessao()){
    E.escola = guardado;
    passoCartao();
  }
}
arrancar();
