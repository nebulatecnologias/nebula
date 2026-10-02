/* ============================================================
   Criar uma área de membros (/criar/) — W4, no molde do Memberkit.

   O plano vem no endereço (?plano=profissional&ciclo=anual) e mostra-se em
   cima, com a troca de ciclo e de plano. Depois:
     1. a conta: nome da área, o nome da pessoa, email, senha (duas vezes);
        se o email já tem conta, pede-se a senha dessa conta e cria-se com ela;
     2. a área abre-se logo, na página Cobrança (?org=<nome curto>#/cobranca):
        é lá que se paga, como na referência (decisão do Shelton a 02/10).
   Esta página vai ser o fim do site de vendas, que mostra os planos e manda
   para aqui com ?plano= e ?ciclo=.

   O dinheiro é só apresentação: o preço que se cobra sai da base, nunca
   daqui. A página é da plataforma, que ainda não tem marca: não leva a de
   nenhuma escola.

   Duas fontes com a mesma forma: a base e a demonstração (?demo=1), em
   memória, para os testes — que nunca criam contas.
   ============================================================ */

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
    abrir: endereco => location.assign(endereco),
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
    { id:"essencial", nome:"Essencial", alunosMax:500, aVenda:true,
      precos:{ MZN:{ mensal:3500, anual:35000, simbolo:"MZ" }, ZAR:{ mensal:199, anual:1990, simbolo:"R" } } },
    { id:"profissional", nome:"Profissional", alunosMax:1500, aVenda:true,
      precos:{ MZN:{ mensal:7000, anual:70000, simbolo:"MZ" }, ZAR:{ mensal:399, anual:3990, simbolo:"R" } } },
    { id:"escala", nome:"Escala", alunosMax:5000, aVenda:true,
      precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:799, anual:null, simbolo:"R" } } },
  ];
  let contaExiste = q.has("existe");
  return {
    iniciar(){},
    async planos(){
      await espera();
      return q.has("fechado") ? planos.map(p => Object.assign({}, p, { aVenda:false,
        precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:null, anual:null, simbolo:"R" } } })) : planos;
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
    abrir(endereco){ registo.abriu = endereco; },
  };
}

/* ---------------- A página ---------------- */
const fonte = new URLSearchParams(location.search).has("demo") ? fonteDemo() : fonteReal();
const E = { planos:[], plano:null, ciclo:"mensal", moeda:"MZN", escola:null, diasTeste:7, existente:false };

/* O país decide a moeda: Moçambique paga em meticais, a África do Sul em rand
   (decisão do Shelton a 02/10). Um plano está à venda numa moeda se tiver
   preço nela, num dos ciclos. */
const MOEDAS = { MZN:"Moçambique", ZAR:"África do Sul" };
const precosDe = (p, moeda) => ((p.precos || {})[moeda || E.moeda]) || {};
const precoDe = (p, ciclo, moeda) => { const v = precosDe(p, moeda)[ciclo]; return v == null ? null : Number(v); };
const simboloDe = p => precosDe(p).simbolo || E.moeda;
const vendeEm = (p, moeda) => precoDe(p, "mensal", moeda) != null || precoDe(p, "anual", moeda) != null;
const moedasAVenda = () => Object.keys(MOEDAS).filter(m => E.planos.some(p => vendeEm(p, m)));

function escolherPlano(id, ciclo, moeda){
  const moedas = moedasAVenda();
  E.moeda = moedas.includes(moeda) ? moeda : moedas.includes(E.moeda) ? E.moeda : moedas[0];
  const aVenda = E.planos.filter(p => vendeEm(p, E.moeda));
  E.plano = aVenda.find(p => p.id === id) || aVenda.find(p => p.id === "profissional") || aVenda[0];
  E.ciclo = ciclo === "anual" && precoDe(E.plano, "anual") != null ? "anual"
          : precoDe(E.plano, "mensal") != null ? "mensal" : "anual";
  try {
    const u = new URL(location.href);
    u.searchParams.set("plano", E.plano.id); u.searchParams.set("ciclo", E.ciclo); u.searchParams.set("moeda", E.moeda);
    history.replaceState(null, "", u);
  } catch(e){ /* sem history */ }
  desenharPlano();
}

function desenharPlano(){
  const p = E.plano, preco = precoDe(p, E.ciclo);
  $("plano-nome").textContent = `Plano ${p.nome}`;
  $("plano-alunos").textContent = `Até ${contagem(p.alunosMax)} alunos`;
  $("plano-valor").textContent = dinheiro(preco, simboloDe(p));
  let por = E.ciclo === "anual" ? "por ano" : "por mês";
  const mensal = precoDe(p, "mensal");
  if(E.ciclo === "anual" && mensal){
    const poupa = Math.round((1 - preco / (mensal * 12)) * 100);
    if(poupa > 0) por += ` · poupa ${poupa}%`;
  }
  $("plano-por").textContent = por;
  document.querySelectorAll("#ciclo button").forEach(b => {
    const c = b.dataset.ciclo;
    b.setAttribute("aria-pressed", String(c === E.ciclo));
    b.hidden = precoDe(p, c) == null;
  });
  $("ciclo").hidden = [...document.querySelectorAll("#ciclo button")].filter(b => !b.hidden).length < 2;
  document.querySelectorAll("#pais button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.moeda === E.moeda)));
  $("pais").hidden = moedasAVenda().length < 2;
  $("plano-gratis").textContent = `${E.diasTeste} dias grátis. Depois, ${dinheiro(preco, simboloDe(p))} ${E.ciclo === "anual" ? "por ano" : "por mês"}. Pode cancelar antes.`;
  preencherEscolha();
}

function preencherEscolha(){
  const s = $("plano-escolher");
  s.innerHTML = E.planos.filter(p => vendeEm(p, E.moeda))
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
    senha:E.existente ? "" : $("f-senha").value, plano:E.plano.id, ciclo:E.ciclo, moeda:E.moeda, aceitouTermos:true,
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
    E.escola = { organizacao:r.organizacao, slug:r.slug, nome:corpo.nomeEscola };
    aAbrir();
  } catch(e){
    aOcupar(btn);
    if(E.existente) btn.textContent = "Entrar e continuar";
    erroConta(e.message || "Não foi possível criar a área de membros.");
  }
}

/* ---- a área criada: abre-se na Cobrança ---- */
function aAbrir(){
  $("painel-conta").hidden = true;
  $("plano-escolhas").hidden = true;
  $("pais").hidden = true;
  $("painel-pronta").hidden = false;
  $("pronta-titulo").textContent = `A «${E.escola.nome}» está criada`;
  $("pronta-texto").textContent = "A abrir a sua área de membros, na página Cobrança…";
  const endereco = `/?org=${encodeURIComponent(E.escola.slug)}#/cobranca`;
  $("btn-entrar").href = endereco;
  fonte.abrir(endereco);
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
  escolherPlano(q.get("plano"), q.get("ciclo"), (q.get("moeda") || "").toUpperCase() || (q.get("pais") === "za" ? "ZAR" : q.get("pais") === "mz" ? "MZN" : null));

  $("plano-escolher").addEventListener("change", e => escolherPlano(e.target.value, E.ciclo, E.moeda));
  document.querySelectorAll("#pais button").forEach(b => b.addEventListener("click", () => escolherPlano(E.plano.id, E.ciclo, b.dataset.moeda)));
  document.querySelectorAll("#ciclo button").forEach(b => b.addEventListener("click", () => escolherPlano(E.plano.id, b.dataset.ciclo, E.moeda)));
  $("form-conta").addEventListener("submit", enviarConta);

}
arrancar();
