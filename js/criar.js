/* ============================================================
   Criar uma área de membros (/criar/) — W4, no molde do Memberkit.

   O plano vem no endereço (?plano=profissional&ciclo=anual&moeda=MZN) e
   mostra-se em cima, já escolhido: quem carregou num plano no site vem criar
   esse plano, não escolher outra vez (pedido do Shelton a 04/10, como na
   Memberkit). Para trocar, «Trocar de plano» volta aos preços do site. Depois:
     1. a conta: nome da área, o nome da pessoa, email, senha (duas vezes);
        se o email já tem conta, pede-se a senha dessa conta e cria-se com ela;
     2. a validação do pagamento (W4·7, decisões do Shelton a 04/10): o número
        M-Pesa paga MZ 10,00 (o cartão, R 18,00 na página segura do Payflow),
        descontados na primeira fatura; a área fica fechada até confirmar e
        depois abre no onboarding (?org=<nome curto>).
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
    /* Só neste browser: a sessão de outra conta (a da equipa de uma escola,
       por exemplo, que partilha este endereço) não pode ir no pedido. */
    async sair(){ await c.auth.signOut({ scope:"local" }); },
    async entrar(email, senha){
      const { error } = await c.auth.signInWithPassword({ email, password:senha });
      if(error) throw new Error(/invalid/i.test(error.message) ? "A senha não confere com este email." : error.message);
    },
    criarEscola: corpo => invocar("criar-escola", corpo),
    /* O pedido de PIN: o mesmo mpesa-checkout do Payflow, pela cobrança da
       validação (o atalho). Espera até ~100 s pela resposta do M-Pesa. */
    async pedirPin(atalho, msisdn){
      try { return await invocar("mpesa-checkout", { cobranca:atalho, msisdn }); }
      catch(e){ if(e.estado === 409) return { ok:false, estado:"a_decorrer", aviso:e.message }; throw e; }
    },
    confirmar: org => invocar("criar-escola", { accao:"confirmar", organizacao:org }),
    abrir: endereco => location.assign(endereco),
  };
}

/* ---------------- A demonstração ---------------- */
/* Preços de mentira, só para a página se ver e os testes correrem. */
function fonteDemo(){
  const q = new URLSearchParams(location.search);
  const registo = window.__criarDemo = { chamadas:[] };
  let sessao = q.get("sessao") ? { email:q.get("sessao") } : null;
  const espera = () => new Promise(r => setTimeout(r, 60));
  const planos = [
    { id:"essencial", nome:"Essencial", alunosMax:500, aVenda:true,
      precos:{ MZN:{ mensal:3500, anual:35000, simbolo:"MZ" }, ZAR:{ mensal:199, anual:1990, simbolo:"R" } } },
    { id:"profissional", nome:"Profissional", alunosMax:1500, aVenda:true,
      precos:{ MZN:{ mensal:7000, anual:70000, simbolo:"MZ" }, ZAR:{ mensal:399, anual:3990, simbolo:"R" } } },
    { id:"escala", nome:"Premium", alunosMax:5000, aVenda:true,
      precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:799, anual:null, simbolo:"R" } } },
  ];
  /* ?payflow=1: os planos como a base os dá com o Payflow ligado (A5) — o
     preço, a validação e os dias grátis vêm do produto de cada célula. */
  if(q.has("payflow")){
    planos[0].regras = { MZN:{ mensal:{ validacao:25, diasGratis:14 }, anual:{ validacao:25, diasGratis:14 } }, ZAR:{ mensal:{ validacao:18, diasGratis:7 } } };
    planos[1].regras = { MZN:{ mensal:{ validacao:0, diasGratis:0 }, anual:{ validacao:0, diasGratis:0 } } };
  }
  let contaExiste = q.has("existe");
  let pago = false;
  return {
    iniciar(){},
    async planos(){
      await espera();
      return q.has("fechado") ? planos.map(p => Object.assign({}, p, { aVenda:false,
        precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:null, anual:null, simbolo:"R" } } })) : planos;
    },
    async sessao(){ return sessao; },
    async sair(){ registo.chamadas.push(["sair", sessao && sessao.email]); sessao = null; },
    async entrar(email, senha){
      await espera(); registo.chamadas.push(["entrar", email]);
      if(senha === "errada-123") throw new Error("A senha não confere com este email.");
      sessao = { email };
    },
    async criarEscola(corpo){
      await espera(); registo.chamadas.push(["criar-escola", Object.assign({}, corpo, { senha: corpo.senha ? "•" : "" })]);
      if(sessao && sessao.email !== corpo.email) throw new Error("Entrou com outra conta. Use o email dessa conta ou saia primeiro.");
      if(contaExiste && !sessao){ const e = new Error("Este email já tem conta."); e.estado = 409; e.corpo = { conta:"existe" }; throw e; }
      /* A escola que ficou à espera da validação, já paga: retoma-se e abre. */
      if(q.has("retomar") && sessao) return { ok:true, organizacao:"00000000-0000-4000-8000-000000000001", contaNova:false, retomada:true, aberta:true,
        slug:corpo.nomeEscola.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
      const slug = corpo.nomeEscola.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      /* ?abre=1: um produto sem validação, com dias grátis — a área abre já. */
      if(q.has("abre")) return { ok:true, organizacao:"00000000-0000-4000-8000-000000000001", slug, contaNova:!sessao, aberta:true };
      const r = (((planos.find(p => p.id === corpo.plano) || {}).regras || {})[corpo.moeda] || {})[corpo.ciclo];
      return { ok:true, organizacao:"00000000-0000-4000-8000-000000000001", slug, contaNova:!sessao,
               validacao:{ metodo:corpo.moeda === "ZAR" ? "cartao" : "mpesa", numero:"KMZ-2026-0001", atalho:"demo123",
                           valor:r ? (r.validacao || 0) : corpo.moeda === "ZAR" ? 18 : 10, moeda:corpo.moeda,
                           tipo:r && !r.validacao ? "period" : "setup", teste:q.has("teste"),
                           link:"https://payflow.kingdomcompny.com/c/demo123" } };
    },
    /* Números de mentira: …0001 sem saldo, …0002 sem resposta, …0003 a ligação
       cortada depois de o PIN ser confirmado, …0004 recusado do nosso lado;
       o resto paga. */
    async pedirPin(atalho, msisdn){
      await espera(); registo.chamadas.push(["pin", msisdn]);
      if(msisdn.endsWith("0003")){ pago = true; throw new Error("Não foi possível falar com o servidor. Tente outra vez."); }
      if(msisdn.endsWith("0004")) return { ok:false, estado:"recusada", nosso:true, porque:"Temos um problema do nosso lado no pagamento automático. Não foi nada consigo e nada lhe foi cobrado — pague por transferência ou fale connosco." };
      if(msisdn.endsWith("0001")) return { ok:false, estado:"recusada", porque:"Não havia saldo suficiente na sua carteira M-Pesa." };
      if(msisdn.endsWith("0002")) return { ok:false, estado:"desconhecida", aviso:"Não recebemos resposta a tempo." };
      pago = true; return { ok:true, estado:"confirmada" };
    },
    async confirmar(){ await espera(); registo.chamadas.push(["confirmar"]); return { ok:true, estado: pago || q.has("pago") ? "ativa" : "pendente" }; },
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
/* Com o Payflow ligado (A5), a base diz por produto a validação e os dias
   grátis; sem ele, valem os de origem (MZ 10,00 / R 18,00 e 7 dias). */
const regrasDe = (p, ciclo, moeda) => {
  const r = (((p && p.regras) || {})[moeda || E.moeda] || {})[ciclo || E.ciclo];
  return r ? { validacao:Number(r.validacao || 0), diasGratis:Number(r.diasGratis || 0) }
           : { validacao:(moeda || E.moeda) === "ZAR" ? 18 : 10, diasGratis:7 };
};
const moedasAVenda = () => Object.keys(MOEDAS).filter(m => E.planos.some(p => vendeEm(p, m)));

/* O site de vendas pode dizer o plano pelo nome: «premium» é o «escala». */
const NOMES_DOS_PLANOS = { premium:"escala" };

function escolherPlano(id, ciclo, moeda){
  id = NOMES_DOS_PLANOS[String(id || "").toLowerCase()] || id;
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

/* O que o plano inclui: as mesmas linhas do site de vendas. */
const INCLUI = p => [`Até ${contagem(p.alunosMax)} alunos activos`, "A sua marca e o seu domínio", "Cursos, módulos e certificados",
  "Encontros ao vivo e comunidades", "Vendas pelo Payflow: M-Pesa e cartão"];
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/></svg>';

function desenharPlano(){
  const p = E.plano, preco = precoDe(p, E.ciclo);
  $("plano-nome").textContent = `Plano ${p.nome}`;
  $("plano-alunos").textContent = `Até ${contagem(p.alunosMax)} alunos activos`;
  $("plano-valor").textContent = dinheiro(preco, simboloDe(p));
  let por = E.ciclo === "anual" ? "por ano" : "por mês";
  const mensal = precoDe(p, "mensal");
  if(E.ciclo === "anual" && mensal){
    const poupa = Math.round((1 - preco / (mensal * 12)) * 100);
    if(poupa > 0) por += ` · poupa ${poupa}%`;
  }
  $("plano-por").textContent = por;
  const regras = regrasDe(p);
  E.diasTeste = regras.diasGratis;
  const porCiclo = E.ciclo === "anual" ? "por ano" : "por mês";
  $("plano-gratis").textContent = regras.diasGratis > 0
    ? `${regras.diasGratis} ${regras.diasGratis === 1 ? "dia grátis" : "dias grátis"}. Depois, ${dinheiro(preco, simboloDe(p))} ${porCiclo}. Pode cancelar antes.`
    : `${dinheiro(preco, simboloDe(p))} ${porCiclo}, a começar hoje. Pode cancelar quando quiser.`;
  /* O que se pede ao número M-Pesa ao criar. */
  $("mpesa-dica").textContent = regras.validacao > 0
    ? `Pedimos ${dinheiro(regras.validacao, simboloDe(p))} a este número para validar o pagamento. O valor é descontado na primeira fatura.`
    : regras.diasGratis > 0 ? "A área abre já. As faturas pedem o pagamento a este número."
    : `Pedimos ${dinheiro(preco, simboloDe(p))} a este número: é o primeiro ${E.ciclo === "anual" ? "ano" : "mês"}.`;
  $("lado-titulo").textContent = `O que inclui o plano ${p.nome}`;
  $("lado-inclui").innerHTML = INCLUI(p).map(x => `<li>${CHECK}<span>${esc(x)}</span></li>`).join("");
  $("plano-trocar").href = `/site/?moeda=${encodeURIComponent(E.moeda)}#precos`;
  $("campo-mpesa").hidden = E.moeda !== "MZN";
  $("campo-cartao").hidden = E.moeda !== "ZAR";
  /* A validação por cartão ainda não existe na página de cobrança do Payflow
     (só tem M-Pesa): fora de Moçambique, a inscrição espera por ela. */
  $("btn-conta").disabled = E.moeda === "ZAR" && !CARTAO_PRONTO;
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
  if(E.moeda === "MZN" && !msisdn(v("f-mpesa"))) return ["Escreva o número M-Pesa que vai pagar: 84 ou 85, com 9 algarismos.", $("f-mpesa")];
  if(E.existente){
    if(!$("f-senha-existente").value) return ["Escreva a senha da sua conta.", $("f-senha-existente")];
  } else {
    if($("f-senha").value.length < 8) return ["A senha tem de ter pelo menos 8 caracteres.", $("f-senha")];
    if($("f-senha").value !== $("f-senha2").value) return ["As duas senhas não são iguais.", $("f-senha2")];
  }
  return null;
}

/* 84/85 com 9 algarismos, com ou sem 258 — o mesmo que o mpesa-checkout aceita. */
function msisdn(bruto){
  const d = String(bruto || "").replace(/\D/g, "");
  const n = d.length === 12 && d.startsWith("258") ? d : d.length === 9 && d.startsWith("8") ? "258" + d : d.length === 10 && d.startsWith("08") ? "258" + d.slice(1) : "";
  return /^258(84|85)\d{7}$/.test(n) ? n : null;
}
const numeroVisivel = n => `${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;

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
    msisdn:E.moeda === "MZN" ? msisdn($("f-mpesa").value) : null,
  };
  aOcupar(btn, E.existente ? "A entrar…" : "A criar…");
  try {
    /* Este endereço é o mesmo da área de membros: quem já entrou noutra conta
       (de uma escola, por exemplo) e cria a área com outro email começa sem
       essa sessão, senão o servidor recusa («Entrou com outra conta»). */
    const atual = await fonte.sessao();
    if(atual && String(atual.email || "").toLowerCase() !== email) await fonte.sair();
    if(E.existente) await fonte.entrar(email, $("f-senha-existente").value);
    let r;
    try { r = await fonte.criarEscola(corpo); }
    catch(e){
      if(e.estado === 409 && e.corpo && e.corpo.conta === "existe"){ aOcupar(btn); modoExistente(); return; }
      throw e;
    }
    if(r.contaNova) await fonte.entrar(email, corpo.senha);
    E.escola = { organizacao:r.organizacao, slug:r.slug, nome:corpo.nomeEscola };
    /* A escola que ficou à espera da validação e já foi paga: abre-se. */
    if(r.aberta) return aAbrir();
    E.validacao = r.validacao || null;
    validarPagamento(corpo.msisdn);
  } catch(e){
    aOcupar(btn);
    if(E.existente) btn.textContent = "Entrar e continuar";
    erroConta(e.message || "Não foi possível criar a área de membros.");
  }
}

/* ---- a validação do pagamento (W4·7) ----
   M-Pesa: pede-se o PIN pela cobrança da validação e espera-se pela resposta;
   confirmado, pergunta-se se a escola já abriu e abre-se. Cartão: a página
   segura do Payflow abre noutro separador e esta vai perguntando. */
const SIMBOLO = { MZN:"MZ", ZAR:"R" };
const CARTAO_PRONTO = new URLSearchParams(location.search).has("demo");
const ICONES = {
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  falhou:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 7v6M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  cartao:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 15h3"/></svg>'
};
function mostraValidar({ sinal, titulo, texto, relogio, erro, accoes, cartao }){
  $("painel-conta").hidden = true;
  $("painel-validar").hidden = false;
  const s = $("validar-sinal");
  s.className = "validar-sinal" + (sinal === "ok" ? " ok" : sinal === "falhou" ? " falhou" : "");
  s.innerHTML = ICONES[sinal] || '<span class="roda grande"></span>';
  $("validar-titulo").textContent = titulo;
  $("validar-texto").textContent = texto || "";
  $("validar-relogio").hidden = !relogio;
  const e = $("validar-erro"); e.textContent = erro || ""; e.hidden = !erro;
  $("validar-accoes").hidden = !accoes;
  $("btn-cartao").hidden = !cartao;
  if(cartao) $("btn-cartao").href = cartao;
}

let relogio = 0;
function contar(segundos){
  clearInterval(relogio);
  let n = segundos;
  const pinta = () => { $("validar-relogio").textContent = n > 0 ? `O pedido expira em ${n} s` : "A aguardar a resposta do M-Pesa…"; };
  pinta(); relogio = setInterval(() => { n--; pinta(); if(n <= 0) clearInterval(relogio); }, 1000);
}

/* O valor vem do Payflow (a cobrança da validação); antes dela, o do produto. */
function valorDaValidacao(){
  const v = E.validacao;
  return dinheiro(v ? v.valor : regrasDe(E.plano).validacao, SIMBOLO[(v && v.moeda) || E.moeda] || "MZ");
}
/* A validação desconta-se na primeira fatura; um produto sem validação cobra já o 1.º período. */
const doDesconto = () => E.validacao && E.validacao.tipo === "period"
  ? `É o primeiro ${E.ciclo === "anual" ? "ano" : "mês"} do plano.` : "O valor é descontado na primeira fatura.";

function validarPagamento(numero){
  if(E.validacao && E.validacao.metodo === "cartao") return validarCartao();
  return pedirPin(numero);
}

async function pedirPin(numero){
  E.numero = numero;
  /* Uma inscrição feita com a chave de teste do Payflow (sk_test_): a fatura
     não se paga pelo M-Pesa, por isso não se pede o PIN. */
  if(E.validacao && E.validacao.teste) return mostraValidar({ sinal:"falhou", titulo:"Inscrição de teste",
    texto:"O Payflow está ligado com a chave de teste: a fatura não se paga pelo M-Pesa e nada foi cobrado. A área fica fechada até a ligação ser a de produção." });
  mostraValidar({ titulo:"Confirme no seu telemóvel",
    texto:`Enviámos um pedido de ${valorDaValidacao()} para o número ${numeroVisivel(numero)}. Abra a mensagem do M-Pesa e escreva o seu PIN. ${doDesconto()}`,
    relogio:true });
  contar(90);
  let r;
  try { r = await fonte.pedirPin(E.validacao.atalho, numero); }
  catch(e){
    clearInterval(relogio);
    /* Com um erro escrito, o servidor recusou antes de falar com o M-Pesa:
       nada foi cobrado. Sem resposta nenhuma (a ligação cortada a meio da
       espera), o PIN pode ter sido confirmado — foi o que aconteceu ao Shelton
       a 04/10: a página disse «falhou» e os 10 MT tinham entrado. Verifica-se. */
    if(e.corpo && e.corpo.error) return falhou(e.message);
    return aEsperarAbrir(VERIFICAR, 180);
  }
  clearInterval(relogio);
  if(r && (r.estado === "confirmada" || r.jaPago)) return aEsperarAbrir();
  /* «Nosso» é o M-Pesa a recusar o pedido por uma razão do lado dele ou
     nosso: o texto do Payflow manda pagar por transferência, que aqui não há. */
  if(r && r.estado === "recusada" && r.nosso) return falhou("O M-Pesa não aceitou o pedido agora. Tente outra vez daqui a um minuto, ou use outro número.");
  if(r && r.estado === "recusada") return falhou(r.porque || "O M-Pesa não concluiu o pagamento.");
  /* Sem resposta a tempo, ou já um pedido a decorrer: se a pessoa confirmou
     o PIN, o pagamento entrou — pergunta-se durante uns minutos. */
  return aEsperarAbrir(r && r.aviso ? r.aviso : VERIFICAR, 180);
}
const VERIFICAR = "Não recebemos resposta a tempo. Se confirmou o PIN, o pagamento entrou: estamos a verificar. Não pague outra vez.";

function falhou(motivo){
  mostraValidar({ sinal:"falhou", titulo:"O pagamento não foi confirmado", erro:motivo,
    texto:"Nada foi cobrado. Tente outra vez com o mesmo número, ou use outro.", accoes:true });
}

const pausa = ms => new Promise(res => setTimeout(res, ms));

async function aEsperarAbrir(aviso, segundos){
  mostraValidar({ sinal: aviso ? null : "ok", titulo: aviso ? "A verificar o pagamento" : "Pagamento confirmado",
    texto: aviso || "A abrir a sua área de membros…" });
  const ate = Date.now() + (segundos || 60) * 1000;
  while(Date.now() < ate){
    try { const r = await fonte.confirmar(E.escola.organizacao); if(r && r.estado && r.estado !== "pendente") return aAbrir(); }
    catch(e){ /* tenta outra vez */ }
    await pausa(3000);
  }
  mostraValidar({ sinal:"falhou", titulo:"Ainda não vimos o pagamento",
    texto:"Se o seu telemóvel pediu o PIN e o confirmou, a área abre sozinha em poucos minutos — pode voltar a esta página com o mesmo email e nome, e ela abre. Se não, tente outra vez.",
    accoes:true });
}

async function validarCartao(){
  mostraValidar({ sinal:"cartao", titulo:"Valide o cartão",
    texto:`Abra a página segura do pagamento e pague ${valorDaValidacao()}. ${doDesconto()} Esta página abre a sua área assim que o pagamento entrar.`,
    cartao:E.validacao.link });
  for(;;){
    await pausa(4000);
    try { const r = await fonte.confirmar(E.escola.organizacao); if(r && r.estado && r.estado !== "pendente") return aAbrir(); }
    catch(e){ /* tenta outra vez */ }
  }
}

/* ---- a área aberta: segue para o onboarding ---- */
function aAbrir(){
  $("painel-conta").hidden = true;
  $("painel-validar").hidden = true;
  $("plano-trocar").hidden = true;
  $("painel-pronta").hidden = false;
  $("pronta-titulo").textContent = `A «${E.escola.nome}» está aberta`;
  $("pronta-texto").textContent = "A abrir a sua área de membros para pôr a marca e os primeiros cursos…";
  const endereco = `/?org=${encodeURIComponent(E.escola.slug)}`;
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

  $("form-conta").addEventListener("submit", enviarConta);
  $("btn-repetir").addEventListener("click", () => pedirPin(E.numero));
  $("form-outro").addEventListener("submit", ev => {
    ev.preventDefault();
    const n = msisdn($("f-outro").value);
    if(!n){ $("validar-erro").textContent = "Esse número não parece um M-Pesa: 84 ou 85, com 9 algarismos."; $("validar-erro").hidden = false; return; }
    pedirPin(n);
  });

}
arrancar();
