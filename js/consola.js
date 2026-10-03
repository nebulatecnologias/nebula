/* ============================================================
   Consola da plataforma (/consola/)
   Para quem administra a PLATAFORMA (nucleo.administradores_plataforma),
   não uma escola. Um painel de gestão das organizações (pedido do Shelton
   a 02/10/2026): números da carteira, o que precisa de atenção, a lista
   das organizações e a ficha de cada uma — dados, faturas, alunos, equipa,
   pagamento — com «ver como organização» e «ver como aluno».

   Da escola, a consola mostra números, não nomes de alunos: para ver os
   alunos entra-se como suporte («ver como organização»).

   Três leituras com a mesma forma: escolas() e cobranca() (as funções
   academia.consola_* que já existem) e painel() (faturas, evolução dos
   alunos, eventos do Payflow). Duas fontes: a base e a demonstração
   (?demo=1), em memória, para os testes e para o protótipo.
   ============================================================ */

const PAPEIS = { dono:"Dono", admin:"Administrador", colaborador:"Colaborador", aluno:"Aluno" };
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MESES_CURTOS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const NBSP = " ";
const POR_PAGINA = 8;

function esc(t){
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
/* Dinheiro como nos relatórios da empresa: «MZ 1 500,00». Numa coluna com o
   símbolo no cabeçalho, só o número (valor). */
function valor(n){ return Number(n || 0).toLocaleString("pt-PT", { minimumFractionDigits:2, maximumFractionDigits:2, useGrouping:"always" }); }
function dinheiro(n, simbolo){ return `${simbolo}${NBSP}${valor(n)}`; }
/* Uma contagem (não é dinheiro): «1 500». */
function contagem(n){ return Number(n || 0).toLocaleString("pt-PT", { useGrouping:"always", maximumFractionDigits:0 }); }
function percentagem(x, casas){ return (x * 100).toLocaleString("pt-PT", { maximumFractionDigits: casas == null ? 1 : casas }) + "%"; }
function dataCurta(iso){
  const d = new Date(iso); if(isNaN(d)) return "";
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}
function dataTabela(iso){
  const d = new Date(iso); if(isNaN(d)) return "";
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]} ${d.getFullYear()}`;
}
function diasEntre(a, b){ return Math.round((new Date(b) - new Date(a)) / 864e5); }
function relativo(iso){
  const d = diasEntre(new Date().toISOString().slice(0, 10), String(iso).slice(0, 10));
  if(d === 0) return "hoje";
  if(d === 1) return "amanhã";
  if(d === -1) return "ontem";
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`;
}
function iniciais(nome){
  const p = String(nome || "?").replace(/^(Escola|Academia|Instituto|Centro)( de| do| da)? /i, "").split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w));
  return ((p[0] || "?")[0] + ((p[1] || "")[0] || "")).toUpperCase();
}
/* «Escola de Liderança» → «escola-de-lideranca» */
function nomeCurto(nome){
  return String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 41).replace(/-+$/, "");
}
function chaveMes(d){ d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function ultimosMeses(n){
  const a = new Date(); const r = [];
  for(let i = n - 1; i >= 0; i--){ r.push(chaveMes(new Date(a.getFullYear(), a.getMonth() - i, 1))); }
  return r;
}
function nomeDoMes(chave, curto){ const m = Number(chave.slice(5, 7)) - 1; return curto ? MESES_CURTOS[m] : `${MESES[m]} de ${chave.slice(0, 4)}`; }

/* «Ver como»: a escola aberta neste endereço (onde a sessão da consola já
   vale), como a equipa dela a vê ou como um aluno a vê. A base conta quem
   administra a plataforma como administração da escola (suporte), e a app
   diz em todos os ecrãs que se está como suporte. */
function verComo(e, como){
  const u = new URL(location.origin + "/");
  u.searchParams.set("org", e.slug);
  if(como === "aluno") u.searchParams.set("ver", "aluno");
  if(modoDemonstracao()) u.searchParams.set("demo", "1");
  return u.toString();
}

/* ---------------- Ícones (traço 1.8, como os da app) ---------------- */
const I = (d, cls) => `<svg class="icon ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONE = {
  visao: I('<rect x="3.5" y="3.5" width="7" height="9" rx="2"/><rect x="13.5" y="3.5" width="7" height="5" rx="2"/><rect x="13.5" y="11.5" width="7" height="9" rx="2"/><rect x="3.5" y="15.5" width="7" height="5" rx="2"/>'),
  orgs: I('<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/><path d="M4 20h16"/>'),
  pagamentos: I('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M7 15h4"/>'),
  planos: I('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  integracoes: I('<path d="M9 2v6M15 2v6M6 8h12l-1 5a5 5 0 0 1-5 4 5 5 0 0 1-5-4L6 8Z"/><path d="M12 17v5"/>'),
  receita: I('<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>'),
  alunos: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2A6.5 6.5 0 0 1 21.5 20"/>'),
  fatura: I('<path d="M6 3h9l4 4v14l-3-2-2.5 2-2.5-2-2.5 2L6 19z"/><path d="M9 9h6M9 13h6"/>'),
  alerta: I('<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>'),
  relogio: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  sobe: I('<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>'),
  desce: I('<path d="M4 7l6 6 4-4 6 7"/><path d="M15 16h5v-5"/>'),
  livro: I('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>'),
  globo: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>'),
  pausa: I('<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>'),
  olho: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  aluno: I('<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2V11"/>'),
  seta: I('<path d="M9 6l6 6-6 6"/>'),
  esquerda: I('<path d="M15 6l-6 6 6 6"/>'),
  voltar: I('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  procurar: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  convidar: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>'),
  externo: I('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>')
};
const SETA_SOBE = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/></svg>`;
const SETA_DESCE = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5"/></svg>`;

/* ---------------- A base ---------------- */
function fonteReal(){
  let c = null;
  const erro = e => new Error((e && (e.message || e.error_description)) || "Não foi possível falar com o servidor.");
  const rpc = async (nome, args) => {
    const { data, error } = await c.rpc(nome, args || {});
    if(error) throw erro(error);
    return data;
  };
  return {
    iniciar(){
      c = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
        db: { schema: ESQUEMA }, auth: { persistSession: true, autoRefreshToken: true }
      });
    },
    async sessao(){ const { data } = await c.auth.getSession(); return data.session ? data.session.user : null; },
    async entrar(email, password){
      const { error } = await c.auth.signInWithPassword({ email, password });
      if(error) throw new Error(/invalid/i.test(error.message) ? "Email ou password errados." : error.message);
    },
    async sair(){ await c.auth.signOut(); },
    souAdmin: () => rpc("consola_sou_admin"),
    escolas: () => rpc("consola_organizacoes"),
    /* Faturas, evolução, alunos por curso e eventos (academia.consola_painel).
       Se a função falhar, a consola diz que não os tem, em vez de inventar zeros. */
    async painel(){
      try { const p = await rpc("consola_painel"); return Object.assign({ ligado:true, faturas:[], eventos:[], historico:{}, detalhe:{} }, p || {}); }
      catch(e){ return { ligado:false, faturas:[], eventos:[], historico:{}, detalhe:{} }; }
    },
    criar: (nome, slug, dominio) => rpc("consola_criar_organizacao", { p_nome: nome, p_slug: slug, p_dominio: dominio || null }),
    mudarEstado: (id, estado) => rpc("consola_mudar_estado", { p_organizacao: id, p_estado: estado }),
    juntarDominio: (id, dominio) => rpc("consola_juntar_dominio", { p_organizacao: id, p_dominio: dominio }),
    mudarMembro: (org, pessoa, papel, ativo) => rpc("consola_mudar_membro", { p_organizacao: org, p_utilizador: pessoa, p_papel: papel, p_ativo: ativo }),
    revogarConvite: id => rpc("consola_revogar_convite", { p_convite: id }),
    cobranca: () => rpc("consola_cobranca"),
    integracoes: () => rpc("consola_integracoes"),
    guardarPayflow: segredo => rpc("consola_integracao_payflow", { p_segredo: segredo || "" }),
    guardarPlano: (plano, p) => rpc("consola_guardar_plano", { p_plano: plano,
      p_mensal_mzn: p.MZN.mensal, p_anual_mzn: p.MZN.anual, p_mensal_zar: p.ZAR.mensal, p_anual_zar: p.ZAR.anual }),
    isentar: (org, isenta) => rpc("consola_isentar", { p_organizacao: org, p_isenta: isenta }),
    async convidar(pedido){
      const { data, error } = await c.functions.invoke("convidar-aluno", { body: Object.assign({ dias: 14 }, pedido) });
      if(error){
        let detalhe = "";
        try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* sem corpo */ }
        throw new Error(detalhe || "O convite não foi enviado.");
      }
      if(data && data.error) throw new Error(data.error);
      return data;
    }
  };
}

/* ---------------- A demonstração ----------------
   Organizações inventadas, com emails @exemplo.invalid. Os números são
   gerados de forma determinista a partir de hoje, para os testes darem
   sempre o mesmo. */
function aleatorio(semente){
  let a = semente >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function fonteDemo(){
  const pedido = new URLSearchParams(location.search);
  const id = () => "demo-" + Math.random().toString(36).slice(2, 10);
  const agora = new Date();
  const emDias = d => new Date(agora.getTime() + d * 864e5).toISOString();
  let comSessao = !pedido.has("sem-sessao");

  const planos = [
    { id:"essencial", nome:"Essencial", alunosMax:500, precos:{ MZN:{ mensal:699, anual:null, simbolo:"MZ" }, ZAR:{ mensal:155.33, anual:null, simbolo:"R" } } },
    { id:"profissional", nome:"Profissional", alunosMax:1500, precos:{ MZN:{ mensal:1350, anual:null, simbolo:"MZ" }, ZAR:{ mensal:300, anual:null, simbolo:"R" } } },
    { id:"escala", nome:"Premium", alunosMax:5000, precos:{ MZN:{ mensal:3450, anual:null, simbolo:"MZ" }, ZAR:{ mensal:766.67, anual:null, simbolo:"R" } } }
  ];
  const definicoes = { diasTeste:7, diasTolerancia:7, cambioZarMzn:4.5 };
  const NOMES = ["Carla","Daniel","Elisa","Fábio","Graça","Hélio","Inês","Joel","Lúcia","Mário","Nélia","Óscar","Paula","Rui"];
  let n = 0;
  const pessoa = papel => { const nome = NOMES[n++ % NOMES.length]; return { id:"u" + n, nome:`${nome} Exemplo`, email:`${nomeCurto(nome)}${n}@exemplo.invalid`, papel, estado:"ativo" }; };

  /* criado: há quantos dias; conta: a assinatura (dias relativos a hoje). */
  const especie = [
    { slug:"kingdom", nome:"Kingdom Company", nomeEscola:"Kingdom Academy", kingdom:true, criado:340, alunos:412, cursos:5,
      dominios:["membros.kingdomcompny.com"], conta:{ estado:"isenta", plano:"escala", moeda:"MZN" },
      equipa:[{ id:"u1", nome:"Ana Exemplo", email:"ana@exemplo.invalid", papel:"admin", estado:"ativo" }] },
    { slug:"teste", nome:"Escola de Teste", criado:1, alunos:0, cursos:0, conta:{ estado:"isenta", plano:"escala", moeda:"MZN" },
      equipa:[{ id:"u2", nome:"Bruno Exemplo", email:"bruno@exemplo.invalid", papel:"dono", estado:"ativo" }] },
    { slug:"horizonte", nome:"Instituto Horizonte de Liderança", criado:330, alunos:1184, cursos:9, dominios:["aulas.horizonte.exemplo"],
      conta:{ estado:"ativa", plano:"profissional", moeda:"MZN", metodo:"cartao" }, equipa:2 },
    { slug:"mare-de-fe", nome:"Escola Maré de Fé", criado:300, alunos:463, cursos:4,
      conta:{ estado:"ativa", plano:"essencial", moeda:"MZN", metodo:"fatura" } },
    { slug:"ponte-viva", nome:"Academia Ponte Viva", criado:275, alunos:820, cursos:7,
      conta:{ estado:"ativa", plano:"profissional", moeda:"ZAR", metodo:"cartao" }, equipa:2 },
    { slug:"raizes", nome:"Escola Raízes", criado:250, alunos:233, cursos:3,
      conta:{ estado:"em_atraso", plano:"essencial", moeda:"MZN", metodo:"cartao", pagoAte:-4, tentativas:2, ultimoErro:"O cartão não tinha saldo suficiente." } },
    { slug:"aurora", nome:"Centro Bíblico Aurora", criado:320, alunos:2940, cursos:14, dominios:["escola.aurora.exemplo"],
      conta:{ estado:"ativa", plano:"escala", moeda:"ZAR", metodo:"cartao" }, equipa:3 },
    { slug:"acorde", nome:"Escola de Música Acorde", criado:6, alunos:38, cursos:2,
      conta:{ estado:"teste", plano:"essencial", moeda:"MZN", metodo:"fatura", testeAte:1 } },
    { slug:"cume", nome:"Formação Cume", criado:190, alunos:145, cursos:2, queda:true,
      conta:{ estado:"em_atraso", plano:"essencial", moeda:"ZAR", metodo:"cartao", pagoAte:-6, tentativas:3, ultimoErro:"O banco recusou o pagamento." } },
    { slug:"nova-alianca", nome:"Escola Nova Aliança", criado:220, alunos:980, cursos:6,
      conta:{ estado:"ativa", plano:"profissional", moeda:"MZN", metodo:"cartao" } },
    { slug:"farol", nome:"Mentoria Farol", criado:6, alunos:0, cursos:0, conta:{ estado:"pendente", plano:"essencial", moeda:"MZN" } },
    { slug:"kairos", nome:"Instituto Kairós", criado:160, alunos:1410, cursos:8, sobe:true,
      conta:{ estado:"ativa", plano:"profissional", moeda:"ZAR", metodo:"cartao" }, porLigar:"aprender.kairos.exemplo" },
    { slug:"palavra-viva", nome:"Escola Palavra Viva", estado:"suspensa", criado:210, alunos:0, cursos:3,
      conta:{ estado:"cancelada", plano:"essencial", moeda:"MZN", metodo:"cartao", pagoAte:-58 } },
    { slug:"ancora", nome:"Academia Âncora", criado:3, alunos:12, cursos:1,
      conta:{ estado:"teste", plano:"essencial", moeda:"MZN", metodo:"cartao", testeAte:5 } }
  ];

  const escolas = especie.map(s => ({
    id:"org-" + s.slug, slug:s.slug, nome:s.nome, nomeEscola:s.nomeEscola || null, estado:s.estado || "ativa", kingdom:!!s.kingdom,
    criadoEm:emDias(-s.criado), dominios:s.dominios || [], dominiosPorLigar: s.porLigar ? [{ dominio:s.porLigar, estado:"pendente" }] : [],
    alunos:s.alunos, cursos:s.cursos,
    equipa: Array.isArray(s.equipa) ? s.equipa : Array.from({ length: s.equipa || 1 }, (_, i) => pessoa(i ? "admin" : "dono")),
    convites:[]
  }));
  const contas = {};
  especie.forEach(s => {
    const c = s.conta;
    contas["org-" + s.slug] = { estado:c.estado, plano:c.plano, ciclo:"mensal", moeda:c.moeda, metodo:c.metodo || null,
      testeAte: c.testeAte != null ? emDias(c.testeAte) : null,
      pagoAte: c.pagoAte != null ? emDias(c.pagoAte) : (c.estado === "ativa" ? emDias(18 + (s.criado % 11)) : null),
      ultimoErro:c.ultimoErro || null, tentativas:c.tentativas || 0, cancelaNoFim:false,
      links: c.estado === "isenta" ? {} : { gerir:"https://payflow.kingdomcompny.com/assinaturas/demo-" + s.slug } };
  });

  /* Evolução dos alunos: doze meses, a subir até ao número de hoje. */
  const meses = ultimosMeses(12);
  const historico = {};
  const detalhe = {};
  const TITULOS = ["Fundamentos","Liderança servidora","Primeiros passos","Oficina prática","Mentoria em grupo","Comunicação","Estudo guiado","Módulo avançado","Vida em comunidade","Finanças pessoais","Escola de pais","Louvor e música","Formação de líderes","Retiro online"];
  especie.forEach((s, k) => {
    const r = aleatorio(k + 7);
    const criado = new Date(agora.getTime() - s.criado * 864e5);
    const serie = meses.map((m, i) => {
      const fim = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0, 23, 59);
      if(fim < criado) return null;
      const idade = (fim - criado) / 864e5, total = s.criado || 1;
      return Math.round(s.alunos * Math.min(1, .3 + .7 * Math.pow(idade / total, .85)) * (.96 + r() * .06));
    });
    serie[11] = s.alunos;
    if(s.queda) serie[10] = Math.round(s.alunos / .84);
    if(s.sobe) serie[10] = Math.round(s.alunos / 1.27);
    if(s.estado === "suspensa"){ serie[10] = 0; serie[9] = 96; serie[8] = 104; }
    historico["org-" + s.slug] = meses.map((m, i) => ({ mes:m, alunos:serie[i] }));
    const antes = serie[10] || 0;
    let restam = Math.round(s.alunos * 1.35);
    detalhe["org-" + s.slug] = {
      convidados: Math.round(s.alunos * .05) + (s.alunos ? 1 : 0),
      inativos: Math.round(s.alunos * (.08 + r() * .1)),
      novos30: Math.max(0, s.alunos - antes) + Math.round(s.alunos * .03),
      ultimaEntrada: s.alunos ? emDias(-Math.floor(r() * 2)) : null,
      porCurso: Array.from({ length: s.cursos }, (_, i) => {
        const alunos = i === s.cursos - 1 ? Math.max(0, restam) : Math.round(restam * (.3 + r() * .25));
        restam -= alunos;
        return { curso: TITULOS[(k + i * 3) % TITULOS.length], alunos, concluiram: alunos ? Math.round(alunos * (.12 + r() * .4)) : 0 };
      })
    };
  });

  /* Faturas: uma por mês depois dos 7 dias de teste, pelo preço do plano. */
  const faturas = [];
  especie.forEach(s => {
    const c = contas["org-" + s.slug];
    if(!["ativa","em_atraso","cancelada"].includes(c.estado)) return;
    const plano = planos.find(p => p.id === c.plano);
    const inicio = new Date(agora.getTime() - (s.criado - 7) * 864e5);
    const fim = c.estado === "cancelada" ? new Date(new Date(c.pagoAte).getTime() - 30 * 864e5) : agora;
    for(let d = new Date(inicio); d <= fim; d.setMonth(d.getMonth() + 1)){
      faturas.push({ id:id(), organizacao:"org-" + s.slug, emitidaEm:d.toISOString(), valor:plano.precos[c.moeda].mensal, moeda:c.moeda,
                     estado:"paga", metodo:c.metodo, plano:plano.nome, link:null });
    }
    const daOrg = faturas.filter(f => f.organizacao === "org-" + s.slug);
    if(c.estado === "em_atraso"){
      const ultima = daOrg[daOrg.length - 1];
      ultima.estado = c.metodo === "fatura" ? "por_pagar" : "falhada";
      ultima.erro = c.ultimoErro;
      ultima.link = "https://payflow.kingdomcompny.com/pagar/demo-" + s.slug;
    }
    if(c.estado === "cancelada") daOrg[daOrg.length - 1].estado = "falhada";
  });
  /* Uma fatura por M-Pesa à espera, sem atraso: emitida há dois dias. */
  const mare = faturas.filter(f => f.organizacao === "org-mare-de-fe");
  if(mare.length){ const u = mare[mare.length - 1]; u.estado = "por_pagar"; u.emitidaEm = emDias(-2); u.link = "https://payflow.kingdomcompny.com/pagar/demo-mare"; }
  faturas.sort((a, b) => a.emitidaEm < b.emitidaEm ? -1 : 1);
  const porAno = {};
  faturas.forEach(f => { const a = f.emitidaEm.slice(0, 4); porAno[a] = (porAno[a] || 0) + 1; f.numero = `F-${a}-${String(porAno[a]).padStart(4, "0")}`; });
  faturas.reverse();

  /* Eventos do Payflow, como a base os registou. */
  const TIPO = { paga:"assinatura.paga", falhada:"assinatura.pagamento_falhou", por_pagar:"assinatura.fatura_emitida" };
  const eventos = faturas.slice(0, 12).map(f => ({ id:"evt_" + f.numero.toLowerCase().replace(/-/g, ""), tipo:TIPO[f.estado], organizacao:f.organizacao,
    resultado:"aplicado", recebidoEm:new Date(new Date(f.emitidaEm).getTime() + 90e3).toISOString() }));
  if(eventos.length > 2){
    eventos.splice(1, 0, Object.assign({}, eventos[2], { resultado:"repetido", recebidoEm:new Date(new Date(eventos[2].recebidoEm).getTime() + 3e5).toISOString() }));
    eventos.splice(4, 0, { id:"evt_cliente", tipo:"cliente.atualizado", organizacao:"org-horizonte", resultado:"ignorado", recebidoEm:emDias(-3) });
  }

  const integracoes = { payflow: { ligada:false, segredoFim:null, ligadaEm:null, ultimoEvento: eventos[0] ? { tipo:eventos[0].tipo, resultado:eventos[0].resultado, recebidoEm:eventos[0].recebidoEm } : null, eventos: eventos.length } };
  const achar = org => { const e = escolas.find(x => x.id === org); if(!e) throw new Error("Escola não encontrada."); return e; };
  const pausa = () => new Promise(r => setTimeout(r, 30));
  const copia = o => JSON.parse(JSON.stringify(o));
  return {
    iniciar(){},
    async sessao(){ return comSessao ? { id:"demo", email:"admin@exemplo.invalid" } : null; },
    async entrar(email, password){
      await pausa();
      if(!email || !password) throw new Error("Email ou password errados.");
      comSessao = true;
    },
    async sair(){ comSessao = false; },
    async souAdmin(){ return !pedido.has("visitante"); },
    async escolas(){ await pausa(); return copia(escolas); },
    async painel(){ await pausa(); return copia({ ligado:true, faturas, eventos, historico, detalhe }); },
    async integracoes(){ await pausa(); return copia(integracoes); },
    async guardarPayflow(segredo){
      await pausa();
      if(segredo && !/^whsec_[A-Za-z0-9+/=_-]{16,200}$/.test(segredo)) throw new Error("O segredo do Payflow começa por whsec_. Copie-o outra vez da integração no Payflow.");
      integracoes.payflow = segredo ? Object.assign(integracoes.payflow, { ligada:true, segredoFim:segredo.slice(-4), ligadaEm:integracoes.payflow.ligadaEm || new Date().toISOString() })
                                    : Object.assign(integracoes.payflow, { ligada:false, segredoFim:null });
      return { ligada: !!segredo };
    },
    async criar(nome, slug, dominio){
      await pausa();
      if(!String(nome || "").trim()) throw new Error("Falta o nome da escola.");
      if(!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) throw new Error("O nome curto só pode ter letras minúsculas, números e hífenes (2 a 41).");
      if(escolas.some(e => e.slug === slug)) throw new Error(`Já existe uma escola com o nome curto «${slug}».`);
      const nova = { id:id(), slug, nome:nome.trim(), nomeEscola:null, estado:"ativa", kingdom:false, criadoEm:new Date().toISOString(),
                     dominios: dominio ? [dominio.toLowerCase()] : [], dominiosPorLigar:[], alunos:0, cursos:0, equipa:[], convites:[] };
      escolas.push(nova);
      contas[nova.id] = { estado:"pendente", plano:"essencial", ciclo:"mensal", moeda:"MZN", links:{} };
      return { id:nova.id, slug };
    },
    async mudarEstado(org, estado){
      const e = achar(org);
      if(e.kingdom) throw new Error("A Kingdom não se suspende pela consola.");
      e.estado = estado;
    },
    async juntarDominio(org, dominio){
      if(!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(String(dominio).toLowerCase())) throw new Error("Domínio inválido.");
      const e = achar(org);
      e.dominiosPorLigar = (e.dominiosPorLigar || []).concat({ dominio: dominio.toLowerCase(), estado: "pendente" });
    },
    async mudarMembro(org, pessoaId, papel, ativo){
      const e = achar(org);
      if(e.kingdom) throw new Error("Na Kingdom, a equipa gere-se no painel de gestão.");
      const m = e.equipa.find(x => x.id === pessoaId);
      m.papel = papel; m.estado = ativo ? "ativo" : "suspenso";
    },
    async cobranca(){
      await pausa();
      return copia({ planos, definicoes,
        escolas: escolas.map(e => Object.assign({ id:e.id, slug:e.slug, nome:e.nome, kingdom:e.kingdom, temCartao:false,
          alunosAtivos:e.alunos }, contas[e.id] || { estado:null },
          { contaEmDia: ["ativa","teste","isenta"].includes((contas[e.id] || {}).estado) ||
              ((contas[e.id] || {}).estado === "em_atraso" && diasEntre(contas[e.id].pagoAte, agora) <= definicoes.diasTolerancia) })) });
    },
    async guardarPlano(plano, precos){
      const p = planos.find(x => x.id === plano);
      if(!p) throw new Error("Plano não encontrado.");
      for(const m of ["MZN", "ZAR"]) for(const c of ["mensal", "anual"]){
        const v = precos[m][c];
        if(v != null && !(v > 0)) throw new Error("Preço inválido.");
        p.precos[m][c] = v;
      }
    },
    async isentar(org, isenta){
      const e = achar(org);
      if(!isenta && e.kingdom) throw new Error("A Kingdom não paga mensalidade.");
      contas[org] = Object.assign({ plano:"essencial", ciclo:"mensal", moeda:"MZN", links:{} }, contas[org] || {},
        { estado: isenta ? "isenta" : "pendente", ultimoErro:null });
    },
    async revogarConvite(conviteId){
      escolas.forEach(e => { e.convites = e.convites.filter(c => c.id !== conviteId); });
    },
    async convidar(p){
      await pausa();
      if(!/^\S+@\S+\.\S+$/.test(p.email || "")) throw new Error("Email inválido.");
      const e = escolas.find(x => x.slug === p.organizacao);
      if(!e) throw new Error("Escola não encontrada.");
      const token = Math.random().toString(16).slice(2).padEnd(48, "0").slice(0, 48);
      e.convites.unshift({ id:id(), email:p.email, nome:p.nome || null, papel:p.papel, expiraEm:emDias(14) });
      return { enviado:true, link: e.dominios.length ? `https://${e.dominios[0]}/?convite=${token}` : `${location.origin}/?org=${e.slug}&convite=${token}` };
    }
  };
}

/* ---------------- O estado da conta, em palavras ---------------- */
const CONTA = {
  ativa:     { rotulo:"Em dia",        pill:"pill-ativo",   cor:"var(--green)" },
  teste:     { rotulo:"Em teste",      pill:"pill-teste",   cor:"var(--violet-1)" },
  em_atraso: { rotulo:"Em atraso",     pill:"pill-atraso",  cor:"#d99a00" },
  pendente:  { rotulo:"Sem pagamento", pill:"pill-frio",    cor:"var(--line-strong)" },
  isenta:    { rotulo:"Isenta",        pill:"pill-isenta",  cor:"var(--blue-ink)" },
  cancelada: { rotulo:"Cancelada",     pill:"pill-inativo", cor:"var(--faint)" }
};
const FATURA = {
  paga:      { rotulo:"Paga",      pill:"pill-ativo" },
  por_pagar: { rotulo:"Por pagar", pill:"pill-teste" },
  falhada:   { rotulo:"Falhou",    pill:"pill-quente" },
  anulada:   { rotulo:"Anulada",   pill:"pill-inativo" },
  reembolsada: { rotulo:"Reembolsada", pill:"pill-inativo" }
};
const METODO = { cartao:"Cartão", fatura:"Fatura", mpesa:"M-Pesa", emola:"e-Mola" };

/* ---------------- A página ---------------- */
const Consola = {
  fonte: null,
  escolas: [],
  cobranca: null,
  painel: { ligado:false, faturas:[], eventos:[], historico:{}, detalhe:{} },
  ui: { filtro:"todas", texto:"", ordem:"recentes", pagina:1, sel:null, serie:"receita", barra:null,
        faturas:"todas", faturasPagina:1, insightsTodos:false, intAba:"instaladas" },
  integracoes: null,

  mostrar(qual){
    ["a-carregar","ecra-entrar","ecra-sem-acesso","ecra-consola"].forEach(id => {
      document.getElementById(id).hidden = id !== qual;
    });
  },

  aviso(texto, tom, link){
    const el = document.getElementById("aviso-geral");
    el.className = "aviso " + (tom || "ok");
    el.innerHTML = esc(texto) + (link ? `<div class="copiar"><input readonly value="${esc(link)}" aria-label="Link do convite"><button class="btn btn-secondary btn-sm" type="button" data-copiar>Copiar link</button></div>` : "");
    el.hidden = false;
    const botao = el.querySelector("[data-copiar]");
    if(botao) botao.addEventListener("click", () => {
      const campo = el.querySelector("input");
      campo.select();
      try { navigator.clipboard.writeText(campo.value); botao.textContent = "Copiado"; } catch(e){ document.execCommand("copy"); }
    });
    el.scrollIntoView({ block:"nearest" });
  },

  async arrancar(){
    this.fonte = modoDemonstracao() ? fonteDemo() : fonteReal();
    try { this.fonte.iniciar(); }
    catch(e){ document.getElementById("a-carregar").textContent = "Não foi possível carregar a biblioteca do Supabase."; return; }
    document.getElementById("c-demo").hidden = !modoDemonstracao();
    this.ligar();
    await this.entrarSeHouverSessao();
  },

  async entrarSeHouverSessao(){
    let sessao = null;
    try { sessao = await this.fonte.sessao(); } catch(e){ /* sem sessão */ }
    if(!sessao){ this.mostrar("ecra-entrar"); return; }
    let admin = false;
    try { admin = await this.fonte.souAdmin(); } catch(e){ admin = false; }
    if(!admin){ this.mostrar("ecra-sem-acesso"); return; }
    const email = sessao.email || "";
    document.getElementById("c-quem").textContent = email;
    document.getElementById("c-quem-iniciais").textContent = (email[0] || "A").toUpperCase();
    this.mostrar("ecra-consola");
    await this.recarregar();
  },

  async recarregar(){
    try { this.escolas = await this.fonte.escolas(); }
    catch(e){ this.aviso(e.message, "erro"); this.escolas = []; }
    try { this.cobranca = await this.fonte.cobranca(); }
    catch(e){ this.cobranca = null; }
    try { this.integracoes = await this.fonte.integracoes(); }
    catch(e){ this.integracoes = null; }
    try { this.painel = await this.fonte.painel(); }
    catch(e){ this.painel = { ligado:false, faturas:[], eventos:[], historico:{}, detalhe:{} }; }
    this.desenhar();
  },

  /* ---------------- Os dados, juntos ---------------- */
  cambio(){ const v = Number(((this.cobranca || {}).definicoes || {}).cambioZarMzn); return v > 0 ? v : null; },
  planos(){ return (this.cobranca && this.cobranca.planos) || []; },
  plano(id){ return this.planos().find(p => p.id === id) || null; },
  simbolo(moeda){ const p = this.planos()[0]; return ((p && p.precos && p.precos[moeda]) || {}).simbolo || (moeda === "ZAR" ? "R" : "MZ"); },
  contaDe(id){ return ((this.cobranca && this.cobranca.escolas) || []).find(x => x.id === id) || null; },
  escolaPorId(id){ return this.escolas.find(e => e.id === id); },
  escolaPorSlug(slug){ return this.escolas.find(e => e.slug === slug); },
  nomeDe(e){ return e.nomeEscola || e.nome; },

  /* A mensalidade de uma escola num mês, na moeda dela (o anual a dividir por 12). */
  mensalidade(e){
    const a = this.contaDe(e.id);
    if(!a || !a.plano) return null;
    const p = this.plano(a.plano);
    const precos = p && p.precos && p.precos[a.moeda || "MZN"];
    if(!precos) return null;
    const v = a.ciclo === "anual" ? (precos.anual != null ? precos.anual / 12 : null) : precos.mensal;
    return v == null ? null : { valor:v, moeda:a.moeda || "MZN" };
  },
  emMetical(v, moeda){ return moeda === "ZAR" ? v * (this.cambio() || 0) : v; },
  /* Quem conta para a receita: quem paga, em dia ou em atraso. */
  pagante(e){ const a = this.contaDe(e.id); return !!a && ["ativa","em_atraso"].includes(a.estado) && e.estado === "ativa"; },
  receitaMensal(){ return this.escolas.filter(e => this.pagante(e)).reduce((s, e) => { const m = this.mensalidade(e); return s + (m ? this.emMetical(m.valor, m.moeda) : 0); }, 0); },
  estadoConta(e){ return (this.contaDe(e.id) || {}).estado || null; },
  faturasDe(e){ return (this.painel.faturas || []).filter(f => f.organizacao === e.id); },
  historicoDe(e){ return (this.painel.historico || {})[e.id] || []; },
  detalheDe(e){ return (this.painel.detalhe || {})[e.id] || null; },
  alunosMax(e){ const a = this.contaDe(e.id); const p = a && this.plano(a.plano); return p ? Number(p.alunosMax) || null : null; },
  alunosMesPassado(e){ const h = this.historicoDe(e); return h.length > 1 ? h[h.length - 2].alunos : null; },

  /* ---------------- O que precisa de atenção ----------------
     Regras simples, lidas dos dados que a consola já tem. Cada uma diz o
     que se passa, a quem, e para onde ir. */
  insightsDe(e){
    const r = [];
    const a = this.contaDe(e.id) || {};
    const nome = this.nomeDe(e);
    const tol = Number(((this.cobranca || {}).definicoes || {}).diasTolerancia) || 7;
    const vai = sep => `#/organizacoes/${e.slug}${sep ? "/" + sep : ""}`;
    const idade = diasEntre(e.criadoEm, new Date());
    if(e.estado !== "ativa"){
      r.push({ tom:"info", peso:10, icone:ICONE.pausa, titulo:nome, texto:"Organização suspensa: ninguém da escola entra.", rota:vai("dados"), rotulo:"Ver" });
      return r;
    }
    if(a.estado === "em_atraso"){
      const corte = a.pagoAte ? new Date(new Date(a.pagoAte).getTime() + tol * 864e5) : null;
      const quando = corte ? (corte > new Date() ? `Os alunos deixam de ver os cursos ${relativo(corte.toISOString())} (${dataCurta(corte)}).` : "Os alunos já não vêem os cursos.") : "";
      r.push({ tom:"risco", peso:100, icone:ICONE.alerta, titulo:nome,
        texto:`Pagamento em atraso${a.ultimoErro ? ": " + a.ultimoErro.replace(/\.$/, "").toLowerCase() : ""}. ${quando}`, rota:vai("pagamento"), rotulo:"Rever" });
    }
    if(a.estado === "pendente" && !e.kingdom){
      r.push({ tom:"aviso", peso: idade >= 2 ? 80 : 30, icone:ICONE.pagamentos, titulo:nome,
        texto:`${idade <= 0 ? "Criou a área hoje" : `Criou a área há ${idade} ${idade === 1 ? "dia" : "dias"}`} e ainda não pôs o pagamento: os alunos não vêem os cursos.`, rota:vai("pagamento"), rotulo:"Ver" });
    }
    if(a.estado === "teste" && a.testeAte){
      const d = diasEntre(new Date(), a.testeAte);
      if(d <= 3) r.push({ tom:"tempo", peso:50, icone:ICONE.relogio, titulo:nome,
        texto:`O teste acaba ${relativo(a.testeAte)}: a primeira cobrança é a ${dataCurta(a.testeAte)}${a.metodo ? `, por ${(METODO[a.metodo] || a.metodo).toLowerCase()}` : ""}.`, rota:vai("pagamento"), rotulo:"Ver" });
    }
    const max = this.alunosMax(e);
    if(max && !e.kingdom && a.estado !== "isenta"){
      const uso = Number(e.alunos || 0) / max;
      const p = this.plano(a.plano);
      const acima = this.planos()[this.planos().indexOf(p) + 1];
      if(uso >= 1) r.push({ tom:"aviso", peso:70, icone:ICONE.alunos, titulo:nome,
        texto:`Chegou ao limite do ${p.nome} (${contagem(e.alunos)} de ${contagem(max)} alunos): os convites novos são recusados.`, rota:vai("alunos"), rotulo:"Ver" });
      else if(uso >= .85) r.push({ tom:"oportunidade", peso:40, icone:ICONE.sobe, titulo:nome,
        texto:`Usa ${percentagem(uso, 0)} do ${p.nome} (${contagem(e.alunos)} de ${contagem(max)} alunos).${acima ? ` Candidata ao ${acima.nome}.` : ""}`, rota:vai("alunos"), rotulo:"Ver" });
    }
    const antes = this.alunosMesPassado(e);
    if(antes && antes >= 20){
      const v = (Number(e.alunos || 0) - antes) / antes;
      if(v <= -.1) r.push({ tom:"aviso", peso:45, icone:ICONE.desce, titulo:nome,
        texto:`Perdeu ${percentagem(-v, 0)} dos alunos activos num mês (${contagem(antes)} → ${contagem(e.alunos)}).`, rota:vai("alunos"), rotulo:"Ver" });
      else if(v >= .2) r.push({ tom:"oportunidade", peso:20, icone:ICONE.sobe, titulo:nome,
        texto:`Cresceu ${percentagem(v, 0)} em alunos activos num mês (${contagem(antes)} → ${contagem(e.alunos)}).`, rota:vai("alunos"), rotulo:"Ver" });
    }
    if(!Number(e.cursos) && idade >= 3 && !e.kingdom){
      r.push({ tom:"aviso", peso:35, icone:ICONE.livro, titulo:nome, texto:`Ainda sem cursos, ${idade} dias depois de criar a área.`, rota:vai(), rotulo:"Ver" });
    }
    (e.dominiosPorLigar || []).forEach(d => r.push({ tom:"info", peso:12, icone:ICONE.globo, titulo:nome,
      texto:`${d.dominio} ${d.estado === "verificado" ? "está verificado, a ligar." : "está à espera do DNS."}`, rota:vai("dados"), rotulo:"Ver" }));
    return r;
  },
  insights(){ return this.escolas.flatMap(e => this.insightsDe(e)).sort((a, b) => b.peso - a.peso); },

  insightHTML(i, compacto){
    return `<div class="c-insight" data-tom="${i.tom}">
      <span class="c-insight-icone">${i.icone}</span>
      <div class="c-insight-texto">${compacto ? "" : `<strong>${esc(i.titulo)}</strong>`}<span>${esc(i.texto)}</span></div>
      ${compacto ? "" : `<a class="btn btn-secondary btn-sm" href="${esc(i.rota)}">${esc(i.rotulo)}</a>`}
    </div>`;
  },

  /* ---------------- Navegação ---------------- */
  rota(){
    const p = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const vista = ["visao","organizacoes","pagamentos","planos","integracoes"].includes(p[0]) ? p[0] : "visao";
    return { vista, slug: vista === "organizacoes" ? (p[1] || null) : null, sep: p[2] || "resumo", app: vista === "integracoes" ? (p[1] || null) : null };
  },
  ir(h){ if(location.hash === h) this.desenhar(); else location.hash = h; },

  navHTML(movel){
    const r = this.rota();
    const atencao = this.escolas.filter(e => ["em_atraso"].includes(this.estadoConta(e))).length;
    const itens = [
      ["visao", "Visão geral", ICONE.visao, ""],
      ["organizacoes", "Organizações", ICONE.orgs, `<span class="c-n">${this.escolas.length}</span>`],
      ["pagamentos", "Pagamentos", ICONE.pagamentos, atencao ? `<span class="c-n alerta" title="Contas em atraso">${atencao}</span>` : ""],
      ["planos", "Planos e preços", ICONE.planos, ""],
      ["integracoes", "Integrações", ICONE.integracoes, this.integracoes && this.integracoes.payflow && !this.integracoes.payflow.ligada ? `<span class="c-n alerta" title="Payflow por ligar">1</span>` : ""]
    ];
    if(movel) return itens.map(([v, rot, ic]) => `<button type="button" data-ir="#/${v}" class="${r.vista === v ? "active" : ""}"${r.vista === v ? ' aria-current="page"' : ""}>${ic}<span>${rot.split(" ")[0]}</span></button>`).join("");
    return itens.map(([v, rot, ic, extra]) => `<a class="nav-item${r.vista === v ? " active" : ""}" href="#/${v}"${r.vista === v ? ' aria-current="page"' : ""}>${ic}<span>${rot}</span>${extra}</a>`).join("");
  },

  desenhar(){
    if(document.getElementById("ecra-consola").hidden) return;
    const r = this.rota();
    document.getElementById("c-nav").innerHTML = this.navHTML();
    document.getElementById("c-tabbar").innerHTML = this.navHTML(true);
    const v = document.getElementById("c-vista");
    if(r.vista === "organizacoes" && r.slug){
      const e = this.escolaPorSlug(r.slug);
      v.innerHTML = e ? this.fichaHTML(e, r.sep) : `<a class="c-voltar" href="#/organizacoes">${ICONE.voltar}Organizações</a><div class="card c-painel"><p class="c-vazio">Esta organização não existe.</p></div>`;
      if(e) this.ui.sel = e.slug;
    }
    else if(r.vista === "organizacoes") v.innerHTML = this.organizacoesHTML();
    else if(r.vista === "pagamentos") v.innerHTML = this.pagamentosHTML();
    else if(r.vista === "planos") v.innerHTML = this.planosHTML();
    else if(r.vista === "integracoes"){ v.innerHTML = this.integracoesHTML(r.app); IntegracoesUI.ligarCopiar(v); }
    else v.innerHTML = this.visaoHTML();
    const t = { visao:"Visão geral", organizacoes:"Organizações", pagamentos:"Pagamentos", planos:"Planos e preços", integracoes:"Integrações" }[r.vista];
    document.title = `${r.slug && this.escolaPorSlug(r.slug) ? this.nomeDe(this.escolaPorSlug(r.slug)) : t} · Consola`;
    this.posicionarDica();
  },

  /* ================= Visão geral ================= */
  visaoHTML(){
    const hoje = new Date();
    const dia = hoje.toLocaleDateString("pt-PT", { weekday:"long" });
    const sim = this.simbolo("MZN");
    const mrr = this.receitaMensal();
    const serieR = this.serie("receita");
    const ultimoFechado = serieR.length > 1 ? serieR[serieR.length - 2].v : 0;
    const antesDisso = serieR.length > 2 ? serieR[serieR.length - 3].v : 0;
    const ativas = this.escolas.filter(e => e.estado === "ativa");
    const novas30 = this.escolas.filter(e => diasEntre(e.criadoEm, hoje) <= 30).length;
    const alunos = this.escolas.reduce((s, e) => s + Number(e.alunos || 0), 0);
    const alunosAntes = this.escolas.reduce((s, e) => s + Number(this.alunosMesPassado(e) ?? e.alunos ?? 0), 0);
    const porCobrar = (this.painel.faturas || []).filter(f => ["por_pagar","falhada"].includes(f.estado) && this.escolaPorId(f.organizacao) && this.escolaPorId(f.organizacao).estado === "ativa");
    const somaPorCobrar = porCobrar.reduce((s, f) => s + this.emMetical(f.valor, f.moeda), 0);
    const atraso = this.escolas.filter(e => this.estadoConta(e) === "em_atraso").length;
    const delta = (a, b) => {
      if(!b) return `<span class="c-delta neutro">—</span>`;
      const v = (a - b) / b;
      return `<span class="c-delta${v < 0 ? " desce" : ""}">${v < 0 ? SETA_DESCE : SETA_SOBE}${percentagem(Math.abs(v))}</span>`;
    };
    const ins = this.insights();
    const mostrar = this.ui.insightsTodos ? ins : ins.slice(0, 5);

    return `
      <header class="c-cabeca">
        <div>
          <h1>Visão geral</h1>
          <p><b>${esc(dia.charAt(0).toUpperCase() + dia.slice(1))}, ${esc(dataCurta(hoje))}</b> · ${contagem(this.escolas.length)} organizações, ${contagem(alunos)} alunos activos</p>
        </div>
      </header>

      <section class="c-kpis" aria-label="Números da carteira">
        <article class="card c-kpi destaque" data-kpi="receita">
          <div class="c-kpi-topo"><p class="c-kpi-rot">Receita mensal recorrente</p><span class="c-kpi-icone">${ICONE.receita}</span></div>
          <div class="c-kpi-valor"><span class="sim">${esc(sim)}&nbsp;</span>${valor(mrr)}</div>
          <div class="c-kpi-pe">${this.painel.ligado ? `${delta(ultimoFechado, antesDisso)} ${esc(nomeDoMes(serieR[serieR.length - 2]?.mes || chaveMes(hoje), true))} face a ${esc(nomeDoMes(serieR[serieR.length - 3]?.mes || chaveMes(hoje), true))}` : "Pelos preços dos planos"}${this.cambio() ? ` · rand a ${esc(String(this.cambio()).replace(".", ","))}` : ""}</div>
        </article>
        <article class="card c-kpi" data-kpi="organizacoes">
          <div class="c-kpi-topo"><p class="c-kpi-rot">Organizações activas</p><span class="c-kpi-icone">${ICONE.orgs}</span></div>
          <div class="c-kpi-valor">${contagem(ativas.length)}<small>de ${contagem(this.escolas.length)}</small></div>
          <div class="c-kpi-pe"><span class="c-delta${novas30 ? "" : " neutro"}">${novas30 ? SETA_SOBE : ""}${contagem(novas30)}</span> novas em 30 dias</div>
        </article>
        <article class="card c-kpi" data-kpi="alunos">
          <div class="c-kpi-topo"><p class="c-kpi-rot">Alunos activos</p><span class="c-kpi-icone">${ICONE.alunos}</span></div>
          <div class="c-kpi-valor">${contagem(alunos)}</div>
          <div class="c-kpi-pe">${this.painel.ligado ? `${delta(alunos, alunosAntes)} num mês` : "Em todas as organizações"}</div>
        </article>
        <article class="card c-kpi" data-kpi="por-cobrar">
          <div class="c-kpi-topo"><p class="c-kpi-rot">Por cobrar</p><span class="c-kpi-icone">${ICONE.fatura}</span></div>
          <div class="c-kpi-valor"><span class="sim">${esc(sim)}&nbsp;</span>${valor(somaPorCobrar)}</div>
          <div class="c-kpi-pe">${this.painel.ligado ? `${contagem(porCobrar.length)} ${porCobrar.length === 1 ? "fatura" : "faturas"}` : "Faturas por ligar"}${atraso ? ` · <span class="c-delta desce">${contagem(atraso)} em atraso</span>` : ""}</div>
        </article>
      </section>

      <div class="c-grelha">
        <section class="card c-painel esticado" aria-labelledby="t-desempenho">
          <div class="c-seccao">
            <div><h2 id="t-desempenho">Desempenho</h2><span class="sub">${{ receita:`Receita cobrada por mês (${esc(sim)}), rand convertido`, alunos:"Alunos activos no fim de cada mês", organizacoes:"Organizações com área criada" }[this.ui.serie]}</span></div>
            <div class="segmented" role="group" aria-label="O que mostrar">
              ${[["receita","Receita"],["alunos","Alunos"],["organizacoes","Organizações"]].map(([k, r]) => `<button type="button" data-serie="${k}" class="${this.ui.serie === k ? "active" : ""}" aria-pressed="${this.ui.serie === k}">${r}</button>`).join("")}
            </div>
          </div>
          ${this.graficoHTML()}
          ${this.ui.serie === "alunos" && this.notaEstimada() ? `<p class="c-nota">${esc(this.notaEstimada())}</p>` : ""}
        </section>
        <section class="card c-painel" aria-labelledby="t-saude">
          <div class="c-seccao"><div><h2 id="t-saude">Saúde da carteira</h2><span class="sub">Das organizações que pagam ou vão pagar</span></div></div>
          ${this.medidorHTML()}
        </section>
      </div>

      <div class="c-grelha topo">
        <section class="card c-painel" aria-labelledby="t-atencao">
          <div class="c-seccao">
            <div><h2 id="t-atencao">Precisa de atenção</h2><span class="sub">${ins.length ? `${contagem(ins.length)} ${ins.length === 1 ? "assunto" : "assuntos"}, o mais urgente primeiro` : "Nada por agora"}</span></div>
            ${ins.length > 5 ? `<button class="c-ligacao" type="button" data-insights-todos>${this.ui.insightsTodos ? "Mostrar menos" : `Ver todos (${ins.length})`}</button>` : ""}
          </div>
          ${ins.length ? `<div class="c-insights">${mostrar.map(i => this.insightHTML(i)).join("")}</div>` : `<p class="c-vazio">Nenhuma organização precisa de atenção.</p>`}
        </section>
        <section class="card c-painel" aria-labelledby="t-planos">
          <div class="c-seccao"><div><h2 id="t-planos">Planos</h2><span class="sub">Organizações e receita por plano</span></div><a class="c-ligacao" href="#/planos">Preços</a></div>
          ${this.distribuicaoHTML()}
        </section>
      </div>`;
  },

  /* As séries do gráfico: doze meses. */
  serie(qual){
    const meses = ultimosMeses(12);
    if(qual === "receita"){
      const f = (this.painel.faturas || []).filter(x => x.estado === "paga");
      return meses.map(m => ({ mes:m, v: f.filter(x => chaveMes(x.emitidaEm) === m).reduce((s, x) => s + this.emMetical(x.valor, x.moeda), 0) }));
    }
    if(qual === "alunos"){
      return meses.map((m, i) => ({ mes:m, v: this.escolas.reduce((s, e) => { const h = this.historicoDe(e); return s + Number((h[i] || {}).alunos || 0); }, 0) }));
    }
    return meses.map(m => {
      const fim = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0, 23, 59);
      return { mes:m, v: this.escolas.filter(e => new Date(e.criadoEm) <= fim).length };
    });
  },

  graficoHTML(){
    const qual = this.ui.serie;
    const s = this.serie(qual);
    const semDados = qual !== "organizacoes" && !this.painel.ligado;
    if(semDados || !s.some(x => x.v)) return `<p class="c-vazio">${semDados
      ? (qual === "receita" ? "A receita por mês aparece quando as faturas do Payflow chegarem à consola." : "A evolução dos alunos aparece quando a consola guardar o histórico.")
      : "Ainda sem números para mostrar."}</p>`;
    const max = Math.max(...s.map(x => x.v));
    const passo = this.passoDoEixo(max);
    const topo = passo * 4;
    const ativa = this.barraAtiva(s);
    const rotEixo = v => qual === "receita" && v >= 1000 ? `${contagem(v / 1000)} mil` : contagem(v);
    return `
      <div class="c-grafico" id="c-grafico">
        <div class="c-eixo" aria-hidden="true">${[4,3,2,1,0].map(k => `<span>${rotEixo(passo * k)}</span>`).join("")}</div>
        <div class="c-barras" style="--n:${s.length}">
          <div class="c-linhas" aria-hidden="true">${[0,1,2,3,4].map(() => "<i></i>").join("")}</div>
          ${s.map((x, i) => `<button type="button" class="c-barra${i === ativa ? " ativa" : ""}${i === s.length - 1 && qual !== "organizacoes" ? " em-curso" : ""}" data-barra="${i}" style="--h:${topo ? (x.v / topo * 100).toFixed(2) : 0}%" aria-label="${esc(nomeDoMes(x.mes))}: ${esc(this.textoDaSerie(qual, x.v))}"><span class="c-barra-fill"></span><span class="c-barra-mes" aria-hidden="true">${esc(nomeDoMes(x.mes, true))}</span></button>`).join("")}
          <div class="c-dica" id="c-dica" aria-hidden="true"></div>
        </div>
      </div>`;
  },
  /* A barra em destaque: a escolhida, ou o último mês fechado (o mês em
     curso ainda vai a meio, e compará-lo enganava). */
  /* Os meses antes da primeira fotografia contam-se pela data de entrada dos
     alunos activos hoje (quem saiu entretanto não entra na conta). */
  notaEstimada(e){
    const lista = e ? [this.historicoDe(e)] : Object.values(this.painel.historico || {});
    const est = lista.flat().filter(x => x && x.estimado && x.alunos != null).map(x => x.mes).sort();
    if(!est.length) return "";
    const ate = est[est.length - 1];
    return `Até ${nomeDoMes(ate)}, contado pela data de entrada dos alunos activos hoje; depois, pelo número no fim de cada mês.`;
  },
  barraAtiva(s){
    if(this.ui.barra != null && this.ui.barra < s.length) return this.ui.barra;
    return this.ui.serie === "organizacoes" ? s.length - 1 : Math.max(0, s.length - 2);
  },
  passoDoEixo(max){
    if(!max) return 1;
    const bruto = max / 4;
    const p10 = Math.pow(10, Math.floor(Math.log10(bruto)));
    return [1, 2, 2.5, 5, 10].map(m => m * p10).find(v => v >= bruto);
  },
  textoDaSerie(qual, v){
    if(qual === "receita") return dinheiro(v, this.simbolo("MZN"));
    if(qual === "alunos") return `${contagem(v)} alunos`;
    return `${contagem(v)} ${v === 1 ? "organização" : "organizações"}`;
  },
  posicionarDica(){
    const g = document.getElementById("c-grafico");
    const dica = document.getElementById("c-dica");
    if(!g || !dica) return;
    const s = this.serie(this.ui.serie);
    const barras = g.querySelectorAll(".c-barra");
    const i = this.barraAtiva(s);
    const b = barras[i]; if(!b) return;
    const emCurso = i === s.length - 1 && this.ui.serie !== "organizacoes";
    barras.forEach((x, k) => x.classList.toggle("ativa", k === i));
    const ant = s[i - 1];
    let comp = "";
    if(emCurso) comp = `<span>Mês em curso, até hoje</span>`;
    else if(ant && ant.v){
      const v = (s[i].v - ant.v) / ant.v;
      comp = `<span>${v >= 0 ? "+" : "−"}${percentagem(Math.abs(v))} face a ${esc(MESES[Number(ant.mes.slice(5, 7)) - 1])}</span>`;
    }
    dica.innerHTML = `<span>${esc(nomeDoMes(s[i].mes))}</span><b>${esc(this.textoDaSerie(this.ui.serie, s[i].v))}</b>${comp}`;
    const fill = b.querySelector(".c-barra-fill");
    const caixa = b.parentElement.getBoundingClientRect();
    const fr = fill.getBoundingClientRect();
    let x = fr.left - caixa.left + fr.width / 2;
    const meia = dica.offsetWidth / 2;
    x = Math.max(meia - 6, Math.min(caixa.width - meia + 6, x));
    dica.style.left = x + "px";
    dica.style.top = (fr.top - caixa.top) + "px";
  },

  /* O medidor: em meia-lua, a parte de cada estado. */
  medidorHTML(){
    const ordem = ["ativa","teste","em_atraso","pendente"];
    const contas = ordem.map(k => ({ k, n: this.escolas.filter(e => e.estado === "ativa" && this.estadoConta(e) === k).length }));
    const total = contas.reduce((s, x) => s + x.n, 0);
    const isentas = this.escolas.filter(e => this.estadoConta(e) === "isenta").length;
    const fora = this.escolas.filter(e => e.estado !== "ativa" || ["cancelada", null].includes(this.estadoConta(e))).length;
    const emDia = total ? contas[0].n / total : 0;
    const cx = 100, cy = 100, r = 80;
    const ponto = f => { const t = Math.PI * (1 - f); return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy - r * Math.sin(t)).toFixed(2)}`; };
    const arco = (f0, f1) => `M ${ponto(f0)} A ${r} ${r} 0 0 1 ${ponto(f1)}`;
    let f = 0;
    const folga = total > 1 ? .012 : 0;
    const segmentos = contas.filter(x => x.n).map(x => {
      const f0 = f, f1 = f + x.n / total; f = f1;
      return `<path d="${arco(f0 + (f0 ? folga / 2 : 0), f1 - (f1 < .999 ? folga / 2 : 0))}" stroke="${CONTA[x.k].cor}" stroke-width="18" fill="none"/>`;
    }).join("");
    return `
      <div class="c-medidor" role="img" aria-label="${total ? `${percentagem(emDia)} das organizações estão em dia com o pagamento` : "Ainda nenhuma organização a pagar"}">
        <svg viewBox="0 0 200 110" aria-hidden="true">
          <path d="${arco(0, 1)}" stroke="var(--sunken)" stroke-width="18" fill="none"/>
          ${segmentos}
        </svg>
        <div class="c-medidor-centro"><b>${total ? percentagem(emDia) : "—"}</b><span>em dia</span></div>
      </div>
      <div class="c-legenda">
        ${contas.map(x => `<button type="button" data-ir="#/organizacoes" data-filtro="${x.k}"><i style="--c:${CONTA[x.k].cor}"></i>${CONTA[x.k].rotulo}<b>${contagem(x.n)}</b></button>`).join("")}
        <button type="button" data-ir="#/organizacoes" data-filtro="isenta"><i style="--c:${CONTA.isenta.cor}"></i>Isentas, fora da conta<b>${contagem(isentas)}</b></button>
        ${fora ? `<button type="button" data-ir="#/organizacoes" data-filtro="suspensas"><i style="--c:var(--faint)"></i>Suspensas ou canceladas<b>${contagem(fora)}</b></button>` : ""}
      </div>`;
  },

  distribuicaoHTML(){
    const planos = this.planos();
    if(!planos.length) return `<p class="c-vazio">Não foi possível ler os planos.</p>`;
    const sim = this.simbolo("MZN");
    const linhas = planos.map(p => {
      const orgs = this.escolas.filter(e => (this.contaDe(e.id) || {}).plano === p.id && e.estado === "ativa" && !["isenta","cancelada"].includes(this.estadoConta(e)));
      const receita = orgs.filter(e => this.pagante(e)).reduce((s, e) => { const m = this.mensalidade(e); return s + (m ? this.emMetical(m.valor, m.moeda) : 0); }, 0);
      return { p, n: orgs.length, receita };
    });
    const maxN = Math.max(1, ...linhas.map(l => l.n));
    const mzn = this.escolas.filter(e => this.pagante(e) && (this.contaDe(e.id) || {}).moeda !== "ZAR").length;
    const zar = this.escolas.filter(e => this.pagante(e) && (this.contaDe(e.id) || {}).moeda === "ZAR").length;
    return `
      <div class="c-planos-dist">
        ${linhas.map(l => `<div class="c-plano-linha">
          <div class="topo"><b>${esc(l.p.nome)}</b><span>${contagem(l.n)} ${l.n === 1 ? "organização" : "organizações"} · ${esc(dinheiro(l.receita, sim))}</span></div>
          <div class="progress-track thin"><div class="progress-fill" style="width:${(l.n / maxN * 100).toFixed(1)}%"></div></div>
        </div>`).join("")}
      </div>
      <div class="c-moedas">
        <div><b>${contagem(mzn)}</b><span>pagam em meticais</span></div>
        <div><b>${contagem(zar)}</b><span>pagam em rand</span></div>
      </div>`;
  },

  /* ================= Organizações ================= */
  filtros(){
    const conta = e => this.estadoConta(e);
    return [
      ["todas", "Todas", () => true],
      ["ativa", "Em dia", e => e.estado === "ativa" && conta(e) === "ativa"],
      ["teste", "Em teste", e => e.estado === "ativa" && conta(e) === "teste"],
      ["em_atraso", "Em atraso", e => e.estado === "ativa" && conta(e) === "em_atraso"],
      ["pendente", "Sem pagamento", e => e.estado === "ativa" && conta(e) === "pendente"],
      ["isenta", "Isentas", e => conta(e) === "isenta"],
      ["suspensas", "Suspensas", e => e.estado !== "ativa" || conta(e) === "cancelada"]
    ];
  },
  listaFiltrada(){
    const f = this.filtros().find(x => x[0] === this.ui.filtro) || this.filtros()[0];
    const t = this.ui.texto.trim().toLowerCase();
    let l = this.escolas.filter(f[2]).filter(e => !t || [e.nome, e.nomeEscola, e.slug, ...(e.dominios || [])].some(x => String(x || "").toLowerCase().includes(t)));
    const ord = {
      recentes: (a, b) => a.criadoEm < b.criadoEm ? 1 : -1,
      alunos: (a, b) => Number(b.alunos || 0) - Number(a.alunos || 0),
      receita: (a, b) => { const v = e => { const m = this.mensalidade(e); return this.pagante(e) && m ? this.emMetical(m.valor, m.moeda) : 0; }; return v(b) - v(a); },
      nome: (a, b) => this.nomeDe(a).localeCompare(this.nomeDe(b), "pt")
    }[this.ui.ordem];
    return l.sort(ord);
  },

  pillConta(e){
    if(e.estado !== "ativa") return `<span class="pill pill-suspensa">Suspensa</span>`;
    const k = this.estadoConta(e);
    if(!k) return `<span class="pill pill-frio">Sem assinatura</span>`;
    return `<span class="pill ${CONTA[k].pill}">${CONTA[k].rotulo}</span>`;
  },

  organizacoesHTML(){
    const lista = this.listaFiltrada();
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    if(this.ui.pagina > paginas) this.ui.pagina = paginas;
    const ini = (this.ui.pagina - 1) * POR_PAGINA;
    const pagina = lista.slice(ini, ini + POR_PAGINA);
    if(!this.ui.sel || !this.escolaPorSlug(this.ui.sel)) this.ui.sel = (pagina[0] || {}).slug || null;
    const sel = this.escolaPorSlug(this.ui.sel);
    const dois = n => String(n).padStart(2, "0");
    return `
      <header class="c-cabeca">
        <div><h1>Organizações</h1><p>Cada organização é uma escola com a sua área de membros, a sua marca e a sua equipa.</p></div>
      </header>
      <div class="c-ferramentas">
        <div class="chip-row" role="group" aria-label="Filtrar por estado">
          ${this.filtros().map(([k, r, fn]) => `<button type="button" class="chip${this.ui.filtro === k ? " active" : ""}" data-filtro="${k}" aria-pressed="${this.ui.filtro === k}">${r}<span class="chip-n">${this.escolas.filter(fn).length}</span></button>`).join("")}
        </div>
        <label class="c-procura">${ICONE.procurar}<span class="sr-only">Procurar</span><input type="search" id="c-filtro-texto" placeholder="Procurar" value="${esc(this.ui.texto)}" autocomplete="off"></label>
        <label class="sr-only" for="c-ordem">Ordenar</label>
        <select class="c-select" id="c-ordem">
          ${[["recentes","Mais recentes"],["alunos","Mais alunos"],["receita","Maior mensalidade"],["nome","Nome"]].map(([k, r]) => `<option value="${k}"${this.ui.ordem === k ? " selected" : ""}>${r}</option>`).join("")}
        </select>
      </div>
      <div class="c-lista${sel ? " com-previa" : ""}">
        <div>
          ${lista.length ? `
          <div class="c-tabela-wrap">
            <table class="c-tabela" id="lista-escolas">
              <thead><tr>
                <th>Organização</th><th class="col-media">Plano</th><th class="col-conta">Conta</th><th class="num col-estreita">Alunos</th>
                <th class="num col-larga">Mensalidade</th><th class="col-larga col-desde">Desde</th><th><span class="sr-only">Abrir</span></th>
              </tr></thead>
              <tbody>${pagina.map(e => this.linhaHTML(e, sel && sel.slug === e.slug)).join("")}</tbody>
            </table>
          </div>
          <div class="c-paginacao">
            <span>A mostrar <b>${dois(ini + 1)}–${dois(ini + pagina.length)}</b> de <b>${dois(lista.length)}</b></span>
            ${paginas > 1 ? `<div class="c-paginas">
              <button type="button" data-pagina="${this.ui.pagina - 1}" aria-label="Página anterior"${this.ui.pagina === 1 ? " disabled" : ""}>${ICONE.esquerda}</button>
              ${Array.from({ length: paginas }, (_, i) => `<button type="button" data-pagina="${i + 1}" class="${this.ui.pagina === i + 1 ? "active" : ""}"${this.ui.pagina === i + 1 ? ' aria-current="page"' : ""}>${i + 1}</button>`).join("")}
              <button type="button" data-pagina="${this.ui.pagina + 1}" aria-label="Página seguinte"${this.ui.pagina === paginas ? " disabled" : ""}>${ICONE.seta}</button>
            </div>` : ""}
          </div>` : `<div class="card c-painel"><p class="c-vazio">${this.escolas.length ? "Nenhuma organização com estes filtros." : "Ainda não há organizações. Crie a primeira em «Nova organização»."}</p></div>`}
        </div>
        ${sel ? this.previaHTML(sel) : ""}
      </div>`;
  },

  linhaHTML(e, selecionada){
    const a = this.contaDe(e.id) || {};
    const p = this.plano(a.plano);
    const max = this.alunosMax(e);
    const uso = max ? Math.min(1, Number(e.alunos || 0) / max) : 0;
    const m = this.mensalidade(e);
    const mostraValor = m && !["isenta","cancelada"].includes(a.estado) && e.estado === "ativa";
    return `<tr data-escola="${esc(e.slug)}" tabindex="0" class="${selecionada ? "sel" : ""}" aria-selected="${selecionada ? "true" : "false"}">
      <td><div class="c-org"><span class="avatar" aria-hidden="true">${esc(iniciais(this.nomeDe(e)))}</span><div style="min-width:0"><span class="nome">${esc(this.nomeDe(e))}</span><span class="sub">${esc((e.dominios || [])[0] || e.slug)}</span><span class="c-conta-movel">${this.pillConta(e)}</span></div></div></td>
      <td class="col-media"><span class="pill pill-plano">${p ? esc(p.nome) : "—"}</span></td>
      <td class="col-conta">${this.pillConta(e)}</td>
      <td class="num col-estreita"><div class="c-mini-n">${contagem(e.alunos)}${max ? `<div class="progress-track thin" title="${percentagem(uso, 0)} do plano"><div class="progress-fill${uso >= .85 ? " cheio" : ""}" style="width:${(uso * 100).toFixed(1)}%"></div></div>` : ""}</div></td>
      <td class="num col-larga">${mostraValor ? esc(dinheiro(m.valor, this.simbolo(m.moeda))) : "—"}</td>
      <td class="col-larga col-desde">${esc(dataTabela(e.criadoEm))}</td>
      <td><span class="c-seta">${ICONE.seta}</span></td>
    </tr>`;
  },

  previaHTML(e){
    const a = this.contaDe(e.id) || {};
    const p = this.plano(a.plano);
    const m = this.mensalidade(e);
    const ins = this.insightsDe(e).sort((x, y) => y.peso - x.peso).slice(0, 2);
    return `<aside class="card c-previa" aria-label="Organização seleccionada" data-previa="${esc(e.slug)}">
      <div class="c-previa-topo"><span class="avatar" aria-hidden="true">${esc(iniciais(this.nomeDe(e)))}</span>
        <div style="min-width:0"><h2>${esc(this.nomeDe(e))}</h2><p>${esc((e.dominios || [])[0] || "?org=" + e.slug)}</p></div></div>
      <div class="c-pilulas">${this.pillConta(e)}${p ? `<span class="pill pill-papel">${esc(p.nome)}</span>` : ""}</div>
      <div class="c-numeros">
        <div><b>${contagem(e.alunos)}</b><span>alunos activos</span></div>
        <div><b>${contagem(e.cursos)}</b><span>${Number(e.cursos) === 1 ? "curso" : "cursos"}</span></div>
        <div><b>${m && !["isenta"].includes(a.estado) ? esc(dinheiro(m.valor, this.simbolo(m.moeda))) : "—"}</b><span>por mês</span></div>
        <div><b>${contagem(e.equipa.length)}</b><span>na equipa</span></div>
      </div>
      ${ins.length ? `<div>${ins.map(i => this.insightHTML(i, true)).join("")}</div>` : ""}
      <div class="c-previa-accoes">
        <a class="btn btn-primary" href="#/organizacoes/${esc(e.slug)}">Abrir ficha</a>
        <div class="duas">
          <a class="btn btn-secondary btn-sm" href="${esc(verComo(e, "organizacao"))}" target="_blank" rel="noopener" data-ver-como="organizacao">${ICONE.olho}Organização</a>
          <a class="btn btn-secondary btn-sm" href="${esc(verComo(e, "aluno"))}" target="_blank" rel="noopener" data-ver-como="aluno">${ICONE.aluno}Aluno</a>
        </div>
      </div>
    </aside>`;
  },

  /* ================= Ficha da organização ================= */
  fichaHTML(e, sep){
    const a = this.contaDe(e.id) || {};
    const p = this.plano(a.plano);
    const max = this.alunosMax(e);
    const m = this.mensalidade(e);
    const faturas = this.faturasDe(e);
    const pago = faturas.filter(f => f.estado === "paga").reduce((s, f) => s + f.valor, 0);
    const antes = this.alunosMesPassado(e);
    const SEPS = [["resumo","Resumo"],["faturas","Faturas", faturas.length],["alunos","Alunos"],["equipa","Equipa", e.equipa.length + e.convites.length],["pagamento","Pagamento"],["dados","Dados"]];
    if(!SEPS.some(s => s[0] === sep)) sep = "resumo";
    const corpo = { resumo:() => this.fichaResumo(e), faturas:() => this.fichaFaturas(e), alunos:() => this.fichaAlunos(e),
                    equipa:() => this.fichaEquipa(e), pagamento:() => this.fichaPagamento(e), dados:() => this.fichaDados(e) }[sep]();
    const delta = antes ? (Number(e.alunos || 0) - antes) / antes : null;
    return `
      <a class="c-voltar" href="#/organizacoes">${ICONE.voltar}Organizações</a>
      <article data-ficha="${esc(e.slug)}" data-escola="${esc(e.slug)}">
        <header class="card c-ficha-topo">
          <div class="c-ficha-quem">
            <span class="avatar" aria-hidden="true">${esc(iniciais(this.nomeDe(e)))}</span>
            <div style="min-width:0">
              <h1>${esc(this.nomeDe(e))}</h1>
              <div class="c-ficha-meta meta">
                <code>${esc(e.slug)}</code>
                ${this.nomeDe(e) !== e.nome ? `<span>${esc(e.nome)}</span>` : ""}
                <span class="pill ${e.estado === "ativa" ? "pill-ativo" : "pill-suspensa"}">${e.estado === "ativa" ? "Activa" : "Suspensa"}</span>
                ${e.estado === "ativa" && a.estado ? `<span class="pill ${CONTA[a.estado].pill}">${CONTA[a.estado].rotulo}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="c-ficha-accoes">
            <a class="btn btn-secondary" href="${esc(verComo(e, "organizacao"))}" target="_blank" rel="noopener" data-ver-como="organizacao">${ICONE.olho}Ver como organização</a>
            <a class="btn btn-secondary" href="${esc(verComo(e, "aluno"))}" target="_blank" rel="noopener" data-ver-como="aluno">${ICONE.aluno}Ver como aluno</a>
          </div>
        </header>

        <section class="c-kpis c-ficha-kpis" aria-label="Números da organização">
          <article class="card c-kpi">
            <div class="c-kpi-topo"><p class="c-kpi-rot">Alunos activos</p><span class="c-kpi-icone">${ICONE.alunos}</span></div>
            <div class="c-kpi-valor">${contagem(e.alunos)}${max ? `<small>de ${contagem(max)}</small>` : ""}</div>
            <div class="c-kpi-pe">${delta != null ? `<span class="c-delta${delta < 0 ? " desce" : delta === 0 ? " neutro" : ""}">${delta < 0 ? SETA_DESCE : delta > 0 ? SETA_SOBE : ""}${percentagem(Math.abs(delta))}</span> num mês` : max ? `${percentagem(Number(e.alunos || 0) / max, 0)} do plano` : "Sem plano"}</div>
          </article>
          <article class="card c-kpi">
            <div class="c-kpi-topo"><p class="c-kpi-rot">Cursos</p><span class="c-kpi-icone">${ICONE.livro}</span></div>
            <div class="c-kpi-valor">${contagem(e.cursos)}</div>
            <div class="c-kpi-pe">${contagem(e.equipa.length)} na equipa</div>
          </article>
          <article class="card c-kpi">
            <div class="c-kpi-topo"><p class="c-kpi-rot">Mensalidade</p><span class="c-kpi-icone">${ICONE.receita}</span></div>
            <div class="c-kpi-valor">${m && a.estado !== "isenta" ? `<span class="sim">${esc(this.simbolo(m.moeda))}&nbsp;</span>${valor(m.valor)}` : "—"}</div>
            <div class="c-kpi-pe">${a.estado === "isenta" ? "Isenta" : p ? `${esc(p.nome)}, ${a.ciclo === "anual" ? "anual" : "mensal"}` : "Sem plano"}</div>
          </article>
          <article class="card c-kpi">
            <div class="c-kpi-topo"><p class="c-kpi-rot">Pago até hoje</p><span class="c-kpi-icone">${ICONE.fatura}</span></div>
            <div class="c-kpi-valor">${this.painel.ligado ? `<span class="sim">${esc(this.simbolo(a.moeda || "MZN"))}&nbsp;</span>${valor(pago)}` : "—"}</div>
            <div class="c-kpi-pe">Cliente desde ${esc(dataCurta(e.criadoEm))} de ${new Date(e.criadoEm).getFullYear()}</div>
          </article>
        </section>

        <nav class="c-separadores" aria-label="Secções da organização">
          <div class="segmented">${SEPS.map(([k, r, n]) => `<button type="button" data-sep="${k}" class="${sep === k ? "active" : ""}"${sep === k ? ' aria-current="page"' : ""}>${r}${n ? `<span class="c-n">${n}</span>` : ""}</button>`).join("")}</div>
        </nav>
        <div id="c-ficha-corpo">${corpo}</div>
      </article>`;
  },

  /* Uma conta, em campos. */
  contaCampos(e){
    const a = this.contaDe(e.id) || {};
    const p = this.plano(a.plano);
    if(!a.estado) return `<p class="c-vazio">Esta organização não tem assinatura.</p>`;
    const campo = (rot, v, sub) => `<div><dt>${rot}</dt><dd>${v}${sub ? `<span class="sub">${sub}</span>` : ""}</dd></div>`;
    return `<dl class="c-campos conta-escola">
      ${campo("Estado", `<span class="pill ${CONTA[a.estado].pill}">${CONTA[a.estado].rotulo}</span>`)}
      ${campo("Plano", p ? esc(p.nome) : "—", p ? `até ${contagem(p.alunosMax)} alunos` : "")}
      ${campo("Moeda", a.moeda === "ZAR" ? "Rand" : "Meticais", a.ciclo === "anual" ? "Anual" : "Mensal")}
      ${campo("Forma de pagamento", a.metodo ? esc(METODO[a.metodo] || a.metodo) : "Por escolher", a.metodo === "cartao" ? "Cobrança automática" : a.metodo ? "Fatura todos os meses" : "")}
      ${a.estado === "teste" ? campo("Teste até", esc(dataCurta(a.testeAte)), esc(relativo(a.testeAte))) : campo("Paga até", a.pagoAte ? esc(dataCurta(a.pagoAte)) : "—", a.pagoAte ? esc(relativo(a.pagoAte)) : "")}
      ${campo("Acesso dos alunos", a.contaEmDia === false ? "Fechado" : "Aberto", a.contaEmDia === false ? "Não vêem os cursos" : "Vêem os cursos")}
    </dl>`;
  },

  fichaResumo(e){
    const h = this.historicoDe(e).filter(x => x.alunos != null);
    const ins = this.insightsDe(e).sort((x, y) => y.peso - x.peso);
    const max = Math.max(1, ...h.map(x => x.alunos));
    return `<div class="c-duas">
      <div class="c-pilha">
        <section class="card c-painel">
          <div class="c-seccao"><div><h2>Alunos activos</h2><span class="sub">No fim de cada mês</span></div></div>
          ${h.length > 1 ? `<div class="c-grafico" style="height:200px"><div class="c-eixo" aria-hidden="true">${[1,.5,0].map(k => `<span>${contagem(max * k)}</span>`).join("")}</div>
            <div class="c-barras" style="--n:${h.length}"><div class="c-linhas" aria-hidden="true"><i></i><i></i><i></i></div>
            ${h.map((x, i) => `<div class="c-barra${i === h.length - 1 ? " ativa" : ""}" role="img" aria-label="${esc(nomeDoMes(x.mes))}: ${contagem(x.alunos)} alunos" style="--h:${(x.alunos / max * 100).toFixed(1)}%"><span class="c-barra-fill"></span><span class="c-barra-mes" aria-hidden="true">${esc(nomeDoMes(x.mes, true))}</span></div>`).join("")}</div></div>`
          : `<p class="c-vazio">${this.painel.ligado ? "Ainda não há meses suficientes para mostrar a evolução." : "A evolução aparece quando a consola guardar o histórico dos alunos."}</p>`}
          ${h.length > 1 && this.notaEstimada(e) ? `<p class="c-nota">${esc(this.notaEstimada(e))}</p>` : ""}
        </section>
        <section class="card c-painel">
          <div class="c-seccao"><h2>Precisa de atenção</h2></div>
          ${ins.length ? `<div class="c-insights">${ins.map(i => this.insightHTML(i, true)).join("")}</div>` : `<p class="c-vazio">Está tudo em ordem nesta organização.</p>`}
        </section>
      </div>
      <section class="card c-painel">
        <div class="c-seccao"><h2>Assinatura</h2><a class="c-ligacao" href="#/organizacoes/${esc(e.slug)}/pagamento">Pagamento</a></div>
        ${this.contaCampos(e)}
      </section>
    </div>`;
  },

  faturasTabela(lista, comOrg){
    if(!lista.length) return "";
    const moedas = [...new Set(lista.map(f => f.moeda))];
    const umaMoeda = moedas.length === 1;
    return `<div class="table-wrap"><table class="c-simples" id="${comOrg ? "faturas-todas" : "faturas-escola"}">
      <thead><tr><th>Fatura</th>${comOrg ? "<th>Organização</th>" : ""}<th class="col-media">Emitida</th><th class="num">Valor${umaMoeda ? ` (${esc(this.simbolo(moedas[0]))})` : ""}</th><th>Estado</th><th class="col-estreita">Método</th><th><span class="sr-only">Abrir</span></th></tr></thead>
      <tbody>${lista.map(f => { const e = this.escolaPorId(f.organizacao); return `<tr data-fatura="${esc(f.numero)}">
        <td><b>${esc(f.numero)}</b><span class="sub">${esc(f.plano || "")}</span></td>
        ${comOrg ? `<td>${e ? `<a class="c-ligacao" href="#/organizacoes/${esc(e.slug)}/faturas">${esc(this.nomeDe(e))}</a>` : "—"}</td>` : ""}
        <td class="col-media">${esc(dataTabela(f.emitidaEm))}</td>
        <td class="num">${esc(umaMoeda ? valor(f.valor) : dinheiro(f.valor, this.simbolo(f.moeda)))}</td>
        <td><span class="pill ${(FATURA[f.estado] || {}).pill || ""}">${esc((FATURA[f.estado] || {}).rotulo || f.estado)}</span>${f.erro ? `<span class="sub">${esc(f.erro)}</span>` : ""}</td>
        <td class="col-estreita">${esc(METODO[f.metodo] || "—")}</td>
        <td class="num">${f.link ? `<a class="c-ligacao" href="${esc(f.link)}" target="_blank" rel="noopener">Payflow</a>` : ""}</td>
      </tr>`; }).join("")}</tbody></table></div>`;
  },

  fichaFaturas(e){
    const f = this.faturasDe(e);
    const a = this.contaDe(e.id) || {};
    const pagas = f.filter(x => x.estado === "paga");
    return `<section class="card c-painel">
      <div class="c-seccao"><div><h2>Faturas</h2><span class="sub">${f.length ? `${contagem(f.length)} ${f.length === 1 ? "fatura" : "faturas"} · ${esc(dinheiro(pagas.reduce((s, x) => s + x.valor, 0), this.simbolo(a.moeda || "MZN")))} pagos` : ""}</span></div>
        ${a.links && a.links.gerir ? `<a class="btn btn-secondary btn-sm" href="${esc(a.links.gerir)}" target="_blank" rel="noopener">${ICONE.externo}Abrir no Payflow</a>` : ""}</div>
      ${f.length ? this.faturasTabela(f, false) : `<p class="c-vazio">${this.painel.ligado ? (a.estado === "isenta" ? "Organização isenta: não recebe faturas." : "Ainda sem faturas.") : "As faturas chegam do Payflow; aparecem aqui quando a consola estiver ligada a elas."}</p>`}
    </section>`;
  },

  fichaAlunos(e){
    const d = this.detalheDe(e);
    const max = this.alunosMax(e);
    const uso = max ? Number(e.alunos || 0) / max : null;
    const caixa = (v, rot) => `<div><b>${v}</b><span>${rot}</span></div>`;
    return `<div class="c-duas">
      <section class="card c-painel">
        <div class="c-seccao"><div><h2>Por curso</h2><span class="sub">Alunos inscritos e quantos concluíram</span></div></div>
        ${d && d.porCurso && d.porCurso.length ? `<div class="table-wrap"><table class="c-simples"><thead><tr><th>Curso</th><th class="num">Inscritos</th><th class="num">Concluíram</th></tr></thead>
          <tbody>${d.porCurso.map(c => `<tr><td>${esc(c.curso)}</td><td class="num">${contagem(c.alunos)}</td><td class="num">${contagem(c.concluiram)}<span class="sub">${c.alunos ? percentagem(c.concluiram / c.alunos, 0) : "—"}</span></td></tr>`).join("")}</tbody></table></div>`
        : `<p class="c-vazio">${!Number(e.cursos) ? "Ainda sem cursos." : this.painel.ligado ? "Ainda sem inscrições." : "Os números por curso aparecem quando a consola estiver ligada a eles."}</p>`}
        <p class="c-nota">A consola mostra números, não nomes. Para ver os alunos, entre com «Ver como organização».</p>
      </section>
      <div class="c-pilha">
        <section class="card c-painel">
          <div class="c-seccao"><h2>Em números</h2></div>
          <div class="c-numeros">
            ${caixa(contagem(e.alunos), "activos")}
            ${caixa(d ? contagem(d.novos30) : "—", "novos em 30 dias")}
            ${caixa(d ? contagem(d.convidados) : "—", "convites por aceitar")}
            ${caixa(d ? contagem(d.inativos) : "—", "sem entrar há 30 dias")}
          </div>
        </section>
        ${max ? `<section class="card c-painel">
          <div class="c-seccao"><h2>Limite do plano</h2><span class="sub">${contagem(e.alunos)} de ${contagem(max)}</span></div>
          <div class="progress-track"><div class="progress-fill${uso >= .85 ? " cheio" : ""}" style="width:${Math.min(100, uso * 100).toFixed(1)}%"></div></div>
          <p class="c-nota">${uso >= 1 ? "No limite: os convites novos são recusados até mudar de plano." : `${percentagem(uso, 0)} usado. Acima do limite, os convites novos são recusados.`}</p>
        </section>` : ""}
      </div>
    </div>`;
  },

  fichaEquipa(e){
    const equipa = e.equipa.length ? e.equipa.map(m => `
      <div class="linha" data-membro="${esc(m.id)}">
        <div class="quem"><span class="avatar" aria-hidden="true">${esc(iniciais(m.nome || m.email))}</span><div style="min-width:0"><strong>${esc(m.nome || m.email)}</strong><span>${esc(m.email)}</span></div></div>
        <div class="mexer">
          ${e.kingdom
            ? `<span class="pill pill-papel">${esc(PAPEIS[m.papel] || m.papel)}</span>`
            : `<label class="sr-only" for="papel-${esc(e.id)}-${esc(m.id)}">Papel de ${esc(m.nome || m.email)}</label>
               <select id="papel-${esc(e.id)}-${esc(m.id)}" data-papel data-org="${esc(e.id)}" data-pessoa="${esc(m.id)}">
                 ${["dono","admin","colaborador"].map(p => `<option value="${p}"${p === m.papel ? " selected" : ""}>${PAPEIS[p]}</option>`).join("")}
               </select>
               <button class="btn btn-sm ${m.estado === "ativo" ? "btn-perigo-suave" : "btn-secondary"}" type="button" data-membro-estado data-org="${esc(e.id)}" data-pessoa="${esc(m.id)}" data-papel-actual="${esc(m.papel)}" data-ativo="${m.estado === "ativo" ? "1" : ""}">${m.estado === "ativo" ? "Suspender" : "Reactivar"}</button>`}
          ${m.estado !== "ativo" ? `<span class="pill pill-suspensa">Suspenso</span>` : ""}
        </div>
      </div>`).join("") : `<p class="c-vazio">Ainda sem equipa. Convide o dono da escola.</p>`;
    const convites = e.convites.length ? `
      <div class="bloco">
        <h3>Convites por aceitar</h3>
        ${e.convites.map(c => `
          <div class="linha">
            <div class="quem"><div style="min-width:0"><strong>${esc(c.nome || c.email)}</strong><span>${esc(c.email)} · ${esc(PAPEIS[c.papel] || c.papel)} · vale até ${esc(dataCurta(c.expiraEm))}</span></div></div>
            <div class="mexer"><button class="btn btn-sm btn-texto" type="button" data-revogar="${esc(c.id)}">Revogar</button></div>
          </div>`).join("")}
      </div>` : "";
    return `<section class="card c-painel">
      <div class="c-seccao"><div><h2>Equipa</h2><span class="sub">Quem gere a área de membros desta organização</span></div>
        <button class="btn btn-secondary btn-sm" type="button" data-convidar="${esc(e.id)}">${ICONE.convidar}Convidar para a equipa</button></div>
      ${equipa}
      ${e.kingdom ? `<p class="c-nota">Na Kingdom, a equipa gere-se no painel de gestão.</p>` : ""}
      ${convites}
    </section>`;
  },

  fichaPagamento(e){
    const a = this.contaDe(e.id) || {};
    const tol = Number(((this.cobranca || {}).definicoes || {}).diasTolerancia) || 7;
    const eventos = (this.painel.eventos || []).filter(x => x.organizacao === e.id);
    let problema = "";
    if(a.estado === "em_atraso"){
      const corte = a.pagoAte ? new Date(new Date(a.pagoAte).getTime() + tol * 864e5) : null;
      problema = `<div class="c-problema risco">${ICONE.alerta}<div><b>Pagamento em atraso${a.tentativas ? ` · ${a.tentativas} ${a.tentativas === 1 ? "tentativa" : "tentativas"}` : ""}</b>${esc(a.ultimoErro || "O último pagamento não passou.")} ${corte ? (corte > new Date() ? `Sem pagamento, os alunos deixam de ver os cursos a ${esc(dataCurta(corte))}.` : "Os alunos já não vêem os cursos.") : ""}</div></div>`;
    } else if(a.estado === "pendente"){
      problema = `<div class="c-problema">${ICONE.pagamentos}<div><b>Pagamento por configurar</b>A escola ainda não escolheu como paga; os alunos não vêem os cursos até lá. O teste de ${contagem(((this.cobranca || {}).definicoes || {}).diasTeste || 7)} dias começa quando o puser.</div></div>`;
    }
    return `<div class="c-duas">
      <section class="card c-painel">
        <div class="c-seccao"><div><h2>Assinatura</h2><span class="sub">O Payflow cobra; a Academia aplica o que ele diz</span></div></div>
        ${problema}
        ${this.contaCampos(e)}
        <div class="c-accoes-linha">
          ${a.links && a.links.gerir ? `<a class="btn btn-secondary btn-sm" href="${esc(a.links.gerir)}" target="_blank" rel="noopener">${ICONE.externo}Abrir no Payflow</a>` : ""}
          ${e.kingdom ? "" : a.estado === "isenta"
            ? `<button class="btn btn-sm btn-secondary" type="button" data-isentar="${esc(e.id)}" data-isenta="">Voltar a cobrar</button>`
            : `<button class="btn btn-sm btn-secondary" type="button" data-isentar="${esc(e.id)}" data-isenta="1">Isentar da mensalidade</button>`}
        </div>
        ${e.kingdom ? "" : `<p class="c-nota">${a.estado === "isenta" ? "Isenta: os alunos vêem os cursos sem a escola pagar." : "Isentar dá acesso sem pagar: para parceiros, testes internos ou cortesia."}</p>`}
      </section>
      <section class="card c-painel">
        <div class="c-seccao"><div><h2>Eventos do Payflow</h2><span class="sub">O que chegou, e o que a base fez</span></div></div>
        ${eventos.length ? eventos.map(x => `<div class="linha"><div class="quem"><div style="min-width:0"><strong class="c-evento-tipo">${esc(x.tipo)}</strong><span>${esc(dataTabela(x.recebidoEm))} · ${esc(relativo(x.recebidoEm))}</span></div></div><span class="pill ${x.resultado === "aplicado" ? "pill-ativo" : "pill-frio"}">${esc(x.resultado)}</span></div>`).join("")
        : `<p class="c-vazio">${this.painel.ligado ? "Ainda nenhum evento desta organização." : "Os eventos aparecem quando a consola estiver ligada a eles."}</p>`}
      </section>
    </div>`;
  },

  fichaDados(e){
    const campo = (rot, v, sub) => `<div><dt>${rot}</dt><dd>${v}${sub ? `<span class="sub">${sub}</span>` : ""}</dd></div>`;
    return `<div class="c-duas">
      <div class="c-pilha">
        <section class="card c-painel">
          <div class="c-seccao"><h2>Identificação</h2></div>
          <dl class="c-campos">
            ${campo("Nome da organização", esc(e.nome))}
            ${campo("Nome da escola", esc(e.nomeEscola || "Igual ao da organização"), "Na Aparência dela")}
            ${campo("Nome curto", `<span class="c-codigo">${esc(e.slug)}</span>`)}
            ${campo("Criada a", esc(dataTabela(e.criadoEm)), esc(relativo(e.criadoEm)))}
          </dl>
        </section>
        <section class="card c-painel">
          <div class="c-seccao"><div><h2>Endereço</h2><span class="sub">Onde a área de membros abre</span></div>
            <button class="btn btn-secondary btn-sm" type="button" data-dominio="${esc(e.id)}">${ICONE.globo}Juntar domínio</button></div>
          <div class="numeros">
            ${(e.dominios || []).map(d => `<div class="linha"><div class="quem"><div><strong>${esc(d)}</strong><span>Ligado</span></div></div><span class="pill pill-ativo">Activo</span></div>`).join("")}
            ${(e.dominiosPorLigar || []).map(d => `<div class="linha"><div class="quem"><div><strong>${esc(d.dominio)}</strong><span>${esc(d.dominio)} · ${d.estado === "verificado" ? "a ligar" : "à espera do DNS"}</span></div></div><span class="pill pill-teste">${d.estado === "verificado" ? "A ligar" : "Pendente"}</span></div>`).join("")}
            ${!(e.dominios || []).length ? `<div class="linha"><div class="quem"><div><strong>${esc(location.host)}/?org=${esc(e.slug)}</strong><span>Sem domínio próprio</span></div></div></div>` : ""}
          </div>
        </section>
      </div>
      <section class="card c-painel">
        <div class="c-seccao"><h2>Estado</h2></div>
        <p>${e.estado === "ativa" ? "A organização está activa: a equipa e os alunos entram." : "Suspensa: ninguém da escola entra até a reactivar."}</p>
        ${e.kingdom ? `<p class="c-nota">A Kingdom não se suspende pela consola.</p>` : `<button class="btn btn-sm ${e.estado === "ativa" ? "btn-perigo-suave" : "btn-secondary"}" type="button" data-estado="${esc(e.id)}" data-para="${e.estado === "ativa" ? "suspensa" : "ativa"}">${e.estado === "ativa" ? "Suspender organização" : "Reactivar organização"}</button>`}
      </section>
    </div>`;
  },

  /* ================= Pagamentos ================= */
  pagamentosHTML(){
    const sim = this.simbolo("MZN");
    const f = this.painel.faturas || [];
    const esteMes = chaveMes(new Date());
    const cobrado = f.filter(x => x.estado === "paga" && chaveMes(x.emitidaEm) === esteMes).reduce((s, x) => s + this.emMetical(x.valor, x.moeda), 0);
    const ativas = x => { const e = this.escolaPorId(x.organizacao); return e && e.estado === "ativa"; };
    const abertas = f.filter(x => ["por_pagar","falhada"].includes(x.estado) && ativas(x));
    const recentes = f.filter(x => diasEntre(x.emitidaEm, new Date()) <= 90 && ["paga","falhada"].includes(x.estado));
    const sucesso = recentes.length ? recentes.filter(x => x.estado === "paga").length / recentes.length : null;
    const rever = this.escolas.filter(e => e.estado === "ativa" && ["em_atraso","pendente"].includes(this.estadoConta(e)) && !e.kingdom)
      .sort((a, b) => (this.estadoConta(a) === "em_atraso" ? 0 : 1) - (this.estadoConta(b) === "em_atraso" ? 0 : 1));
    const FILTROS = [["todas","Todas", () => true],["abertas","Por pagar", x => x.estado === "por_pagar"],["falhadas","Falharam", x => x.estado === "falhada"],["pagas","Pagas", x => x.estado === "paga"]];
    const fil = FILTROS.find(x => x[0] === this.ui.faturas) || FILTROS[0];
    const lista = f.filter(fil[2]);
    const porPag = 10;
    const paginas = Math.max(1, Math.ceil(lista.length / porPag));
    if(this.ui.faturasPagina > paginas) this.ui.faturasPagina = paginas;
    const ini = (this.ui.faturasPagina - 1) * porPag;
    const eventos = (this.painel.eventos || []).slice(0, 8);
    const kpi = (rot, v, pe, icone, cls) => `<article class="card c-kpi ${cls || ""}"><div class="c-kpi-topo"><p class="c-kpi-rot">${rot}</p><span class="c-kpi-icone">${icone}</span></div><div class="c-kpi-valor">${v}</div><div class="c-kpi-pe">${pe}</div></article>`;
    return `
      <header class="c-cabeca"><div><h1>Pagamentos</h1><p>As mensalidades das organizações. O Payflow cobra e avisa; aqui revê-se o que falhou.</p></div></header>
      <section class="c-kpis">
        ${kpi(`Cobrado em ${esc(MESES[new Date().getMonth()])}`, this.painel.ligado ? `<span class="sim">${esc(sim)}&nbsp;</span>${valor(cobrado)}` : "—", "Rand convertido", ICONE.receita, "destaque")}
        ${kpi("Por cobrar", this.painel.ligado ? `<span class="sim">${esc(sim)}&nbsp;</span>${valor(abertas.reduce((s, x) => s + this.emMetical(x.valor, x.moeda), 0))}` : "—", `${contagem(abertas.length)} ${abertas.length === 1 ? "fatura aberta" : "faturas abertas"}`, ICONE.fatura)}
        ${kpi("Contas a rever", contagem(rever.length), `${contagem(rever.filter(e => this.estadoConta(e) === "em_atraso").length)} em atraso`, ICONE.alerta)}
        ${kpi("Pagamentos que passam", sucesso == null ? "—" : percentagem(sucesso), "Nos últimos 90 dias", ICONE.sobe)}
      </section>
      <div class="c-grelha topo">
        <section class="card c-painel" aria-labelledby="t-rever">
          <div class="c-seccao"><div><h2 id="t-rever">Contas a rever</h2><span class="sub">Em atraso ou sem pagamento</span></div></div>
          ${rever.length ? rever.map(e => {
            const a = this.contaDe(e.id) || {};
            return `<div class="linha" data-rever="${esc(e.slug)}">
              <div class="quem"><span class="avatar" aria-hidden="true">${esc(iniciais(this.nomeDe(e)))}</span><div style="min-width:0"><strong>${esc(this.nomeDe(e))}</strong>
                <span>${a.estado === "em_atraso" ? esc(a.ultimoErro || "O último pagamento não passou.") + (a.pagoAte ? ` Paga até ${esc(dataCurta(a.pagoAte))}.` : "") : `Criada ${esc(relativo(e.criadoEm))}, sem forma de pagamento.`}</span></div></div>
              <div class="mexer">${this.pillConta(e)}<a class="btn btn-secondary btn-sm" href="#/organizacoes/${esc(e.slug)}/pagamento">Rever</a></div>
            </div>`; }).join("") : `<p class="c-vazio">Nenhuma conta com problemas.</p>`}
        </section>
        <section class="card c-painel" aria-labelledby="t-eventos">
          <div class="c-seccao"><div><h2 id="t-eventos">Eventos do Payflow</h2><span class="sub">Os últimos que chegaram</span></div></div>
          ${eventos.length ? eventos.map(x => { const e = this.escolaPorId(x.organizacao); return `<div class="linha"><div class="quem"><div style="min-width:0"><strong class="c-evento-tipo">${esc(x.tipo)}</strong><span>${e ? esc(this.nomeDe(e)) + " · " : ""}${esc(relativo(x.recebidoEm))}</span></div></div><span class="pill ${x.resultado === "aplicado" ? "pill-ativo" : "pill-frio"}">${esc(x.resultado)}</span></div>`; }).join("")
          : `<p class="c-vazio">${this.painel.ligado ? "Ainda não chegou nenhum evento." : "Os eventos aparecem quando a consola estiver ligada a eles."}</p>`}
        </section>
      </div>
      <section class="card c-painel" aria-labelledby="t-faturas">
        <div class="c-seccao"><div><h2 id="t-faturas">Faturas</h2><span class="sub">De todas as organizações</span></div></div>
        <div class="chip-row" role="group" aria-label="Filtrar faturas" style="margin-bottom:14px">
          ${FILTROS.map(([k, r, fn]) => `<button type="button" class="chip${this.ui.faturas === k ? " active" : ""}" data-faturas="${k}" aria-pressed="${this.ui.faturas === k}">${r}<span class="chip-n">${f.filter(fn).length}</span></button>`).join("")}
        </div>
        ${lista.length ? this.faturasTabela(lista.slice(ini, ini + porPag), true) + `
          <div class="c-paginacao"><span>A mostrar <b>${String(ini + 1).padStart(2, "0")}–${String(Math.min(ini + porPag, lista.length)).padStart(2, "0")}</b> de <b>${String(lista.length).padStart(2, "0")}</b></span>
          ${paginas > 1 ? `<div class="c-paginas">
            <button type="button" data-faturas-pagina="${this.ui.faturasPagina - 1}" aria-label="Página anterior"${this.ui.faturasPagina === 1 ? " disabled" : ""}>${ICONE.esquerda}</button>
            <span style="align-self:center;padding:0 6px"><b>${this.ui.faturasPagina}</b> de ${paginas}</span>
            <button type="button" data-faturas-pagina="${this.ui.faturasPagina + 1}" aria-label="Página seguinte"${this.ui.faturasPagina === paginas ? " disabled" : ""}>${ICONE.seta}</button></div>` : ""}</div>`
        : `<p class="c-vazio">${this.painel.ligado ? "Nenhuma fatura com este filtro." : "As faturas chegam do Payflow; aparecem aqui quando a consola estiver ligada a elas."}</p>`}
      </section>`;
  },

  /* ================= Integrações =================
     No modelo da Memberkit (pedido do Shelton a 02/10/2026). A da consola
     é o Payflow que cobra a mensalidade das escolas: a plataforma subscreve
     o academia-receber nos eventos assinatura.* e cola aqui o segredo (fica
     cifrado no Vault). Cada escola liga o Payflow dela nas Integrações da
     área de membros, para as vendas abrirem os cursos. */
  catalogoDaConsola(){
    const pf = (this.integracoes || {}).payflow || {};
    return [
      { id:"payflow", nome:"Payflow", categoria:"Mensalidade das escolas", indicada:true, instalada:!!pf.ligada,
        titulo:`Payflow${pf.segredoFim ? " · ····" + pf.segredoFim : ""}`, descricao:"Recebe as assinaturas, os pagamentos e as faturas das escolas." },
      { id:"resend", nome:"Resend", categoria:"Email transaccional", instalada:false },
      { id:"vercel", nome:"Vercel", categoria:"Domínios das escolas", instalada:false },
      { id:"webhook", nome:"Webhooks", categoria:"Notificações", estado:"em_breve", instalada:false }
    ];
  },

  integracoesHTML(appId){
    const lista = this.catalogoDaConsola();
    const app = appId ? lista.find(a => a.id === appId) : null;
    const eventos = this.painel.eventos || [];
    if(app) return IntegracoesUI.ficha(app, this.accoesDaIntegracao(app), this.corpoDaIntegracao(app));
    const instaladas = lista.filter(a => a.instalada);
    const aba = this.ui.intAba;
    return `
      <header class="c-cabeca"><div><h1>Integrações</h1><p>As aplicações ligadas à plataforma. Abra um cartão para ver como se liga.</p></div></header>
      ${IntegracoesUI.abas(aba, { instaladas: instaladas.length, disponiveis: lista.length, historico: eventos.length })}
      ${aba === "historico" ? this.historicoIntegracoesHTML(eventos)
        : aba === "disponiveis" ? `<div class="int-grelha">${lista.map(IntegracoesUI.cartao).join("")}</div>`
        : instaladas.length ? `<div class="int-lista">${instaladas.map(IntegracoesUI.linha).join("")}</div>`
          : `<div class="card c-painel"><p class="c-vazio">Ainda nenhuma integração ligada. O Payflow é a primeira: abra-o em <button class="c-ligacao" type="button" data-int-aba="disponiveis">Disponíveis</button>.</p></div>`}`;
  },

  historicoIntegracoesHTML(eventos){
    if(!eventos.length) return `<div class="card int-historico"><div class="int-hist-topo"><span>Sem resultados</span></div><p class="c-vazio">${this.painel.ligado ? "Nenhuma notificação recebida do Payflow." : "Os eventos aparecem quando a consola estiver ligada a eles."}</p></div>`;
    return `<div class="card int-historico">
      <div class="int-hist-topo"><span>${contagem(eventos.length)} ${eventos.length === 1 ? "notificação recebida" : "notificações recebidas"} do Payflow</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th class="col-larga">Integração</th><th>Evento</th><th>Organização</th><th>Estado</th></tr></thead>
        <tbody>${eventos.map(x => { const e = this.escolaPorId(x.organizacao); return `<tr>
          <td>${esc(IntegracoesUI.quando(x.recebidoEm))}</td><td class="col-larga">Payflow</td>
          <td><span class="tipo">${esc(x.tipo)}</span></td>
          <td>${e ? `<a class="c-ligacao" href="#/organizacoes/${esc(e.slug)}/pagamento">${esc(this.nomeDe(e))}</a>` : "—"}</td>
          <td><span class="pill ${x.resultado === "aplicado" ? "pill-ativo" : "pill-inativo"}">${esc(x.resultado)}</span></td></tr>`; }).join("")}</tbody>
      </table></div></div>`;
  },

  accoesDaIntegracao(app){
    if(app.id === "payflow") return `<a class="btn btn-secondary" href="https://payflow.kingdomcompny.com/" target="_blank" rel="noopener">Abrir o Payflow</a>`;
    if(app.id === "resend") return `<a class="btn btn-secondary" href="https://resend.com/domains" target="_blank" rel="noopener">Abrir o Resend</a>`;
    if(app.id === "vercel") return `<a class="btn btn-secondary" href="https://vercel.com/dashboard" target="_blank" rel="noopener">Abrir o Vercel</a>`;
    return "";
  },

  corpoDaIntegracao(app){
    if(app.id === "payflow"){
      const pf = (this.integracoes || {}).payflow || {};
      const ult = pf.ultimoEvento;
      const url = `${typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : ""}/functions/v1/academia-receber`;
      return `<p class="int-lead">A mensalidade das escolas, cobrada pelo Payflow.</p>
        <p>O Payflow cobra cada escola (cartão automático, ou fatura por cartão, M-Pesa ou e-Mola) e avisa a plataforma de cada mudança: teste, pagamento, atraso, suspensão, cancelamento. A Academia aplica o que ele diz: abre ou fecha a área de membros da escola e guarda as faturas.</p>
        <div class="int-estado">${pf.ligada ? `<span class="pill pill-ativo">Ligado</span><span>Segredo <b>····${esc(pf.segredoFim || "")}</b></span>` : `<span class="pill pill-inativo">Por ligar</span>`}
          ${ult ? `<span>Último evento: <b>${esc(ult.tipo)}</b>, ${esc(IntegracoesUI.quando(ult.recebidoEm))}</span>` : `<span>Ainda sem eventos.</span>`}</div>
        <h2>1. Crie a integração no Payflow</h2>
        <ol class="passos">
          <li>No Payflow da plataforma, abra <strong>Integrações › Webhooks › Nova integração</strong>, com o nome «Área de membros».</li>
          <li>Em <strong>URL que recebe</strong>, cole este endereço:${IntegracoesUI.copiar(url, "Endereço da plataforma")}</li>
          <li>Em <strong>Eventos</strong>, marque todos os de assinatura (<code>assinatura.*</code>). Grave e copie o segredo, que aparece uma só vez.</li>
        </ol>
        <h2>2. Cole o segredo</h2>
        <form class="int-form" id="c-int-payflow" novalidate>
          <div class="field"><label for="c-int-segredo">Segredo do Payflow</label><input id="c-int-segredo" type="password" autocomplete="off" spellcheck="false" placeholder="${pf.ligada ? "Cole um novo para o trocar" : "whsec_…"}">
            <p class="hint">Fica guardado cifrado. Durante uma troca, o segredo antigo continua a valer se estiver também nos segredos do servidor.</p></div>
          <div class="acoes"><button class="btn btn-primary btn-sm" type="submit">${pf.ligada ? "Trocar o segredo" : "Ligar o Payflow"}</button>
            ${pf.ligada ? `<button class="btn btn-perigo-suave btn-sm" type="button" id="c-int-desligar">Desligar</button>` : ""}</div>
        </form>
        <h2>3. Experimente</h2>
        <p>Na integração do Payflow, carregue em <strong>Enviar evento de teste</strong>: aparece no <strong>Histórico</strong> como «ignorado» (não é de assinatura), e prova que a ligação funciona.</p>
        <h2>E as vendas das escolas?</h2>
        <p>Cada escola liga o Payflow dela em <strong>Integrações › Payflow</strong>, na própria área de membros: as vendas dela abrem os cursos dela. A consola não precisa de fazer nada.</p>`;
    }
    if(app.id === "resend") return `<p class="int-lead">Os emails da Academia saem pelo Resend.</p>
      <p>Convites, recuperação da password e cartas de quem comprou saem do endereço da plataforma, com o nome de cada escola, e as respostas vão para a escola.</p>
      <ol class="passos"><li>A chave da API do Resend está nos segredos das Edge Functions do Supabase, com o nome <code>RESEND_API_KEY</code>.</li>
      <li>O domínio de envio verifica-se no Resend, em <strong>Domains</strong>.</li></ol>
      <p>Por segurança, a consola não lê nem mostra a chave.</p>`;
    if(app.id === "vercel") return `<p class="int-lead">Os domínios próprios das escolas ligam-se no Vercel.</p>
      <p>Quando uma escola junta um domínio e o DNS fica certo, a Academia junta-o ao projecto no Vercel, que dá o certificado sozinho.</p>
      <ol class="passos"><li>O token do Vercel está nos segredos das Edge Functions do Supabase.</li>
      <li>Cada domínio vê-se em <strong>Organizações › a escola › Dados › Endereço</strong>.</li></ol>`;
    return `<p class="int-lead">Avise outros sistemas do que acontece na plataforma.</p><p>Escolas criadas, suspensas ou com o pagamento em atraso, entregues assinadas ao endereço que indicar. Está em preparação.</p>`;
  },

  async guardarPayflow(segredo){
    try {
      await this.fonte.guardarPayflow(segredo);
      await this.recarregar();
      this.aviso(segredo ? "Payflow ligado. Envie um evento de teste para confirmar." : "Payflow desligado.", "ok");
    } catch(err){ this.aviso(err.message, "erro"); }
  },

  /* ================= Planos e preços ================= */
  planosHTML(){
    const c = this.cobranca;
    if(!c) return `<header class="c-cabeca"><div><h1>Planos e preços</h1></div></header><div class="card c-painel"><p class="c-vazio">Não foi possível ler a mensalidade.</p></div>`;
    const sim = m => this.simbolo(m);
    const n = v => v == null ? "" : String(v).replace(".", ",");
    const COLUNAS = [["MZN","mensal","Mensal"], ["MZN","anual","Anual"], ["ZAR","mensal","Mensal"], ["ZAR","anual","Anual"]];
    return `
      <header class="c-cabeca"><div><h1>Planos e preços</h1><p>O que cada organização paga por mês, pelo número de alunos.</p></div></header>
      <div class="c-planos-precos">
        ${c.planos.map(p => {
          const orgs = this.escolas.filter(e => (this.contaDe(e.id) || {}).plano === p.id && e.estado === "ativa" && !["isenta","cancelada"].includes(this.estadoConta(e))).length;
          const pm = ((p.precos || {}).MZN || {}).mensal;
          return `<article class="card c-plano-cartao" data-plano-cartao="${esc(p.id)}">
            <h3>${esc(p.nome)}</h3>
            <div class="preco">${pm != null ? `${esc(dinheiro(pm, sim("MZN")))}<small> /mês</small>` : `<small>Sem preço</small>`}</div>
            <p>Até ${contagem(p.alunosMax)} alunos · ${contagem(orgs)} ${orgs === 1 ? "organização" : "organizações"}</p>
          </article>`; }).join("")}
      </div>
      <section class="card c-painel mensalidade" id="mensalidade" aria-label="Mensalidade das escolas">
        <div class="c-seccao"><div><h2>Mensalidade das escolas</h2>
          <span class="sub">As escolas de Moçambique pagam em meticais, as da África do Sul em rand. Sem preço, o plano não se vende nessa moeda e nesse ciclo.${this.cambio() ? ` Rand pelo câmbio 1 R = ${esc(String(this.cambio()).replace(".", ","))} MT: o rand que ficar vazio calcula-se ao guardar.` : ""}</span></div></div>
        <div class="table-wrap">
          <table class="tabela-planos">
            <thead>
              <tr><th rowspan="2">Plano</th><th rowspan="2">Alunos</th><th colspan="2" class="grupo">Meticais (${esc(sim("MZN"))})</th><th colspan="2" class="grupo">Rand (${esc(sim("ZAR"))})</th><th rowspan="2"></th></tr>
              <tr><th>Mensal</th><th>Anual</th><th>Mensal</th><th>Anual</th></tr>
            </thead>
            <tbody>${c.planos.map(p => `
              <tr data-plano="${esc(p.id)}">
                <td data-rotulo="Plano"><strong>${esc(p.nome)}</strong></td>
                <td data-rotulo="Alunos">até ${contagem(p.alunosMax)}</td>
                ${COLUNAS.map(([m, ciclo, rot]) => `<td data-rotulo="${rot} (${esc(sim(m))})"><input inputmode="decimal" aria-label="Preço ${rot.toLowerCase()} do ${esc(p.nome)} em ${m === "MZN" ? "meticais" : "rand"}" data-moeda="${m}" data-preco="${ciclo}" value="${esc(n(((p.precos || {})[m] || {})[ciclo]))}" placeholder="sem preço"></td>`).join("")}
                <td><button class="btn btn-secondary btn-sm" type="button" data-guardar-plano="${esc(p.id)}">Guardar</button></td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
        <p class="c-nota">Um preço novo vale para as organizações novas e para as próximas cobranças. O Payflow cobra pelo preço que tiver na assinatura de cada escola.</p>
      </section>`;
  },

  async guardarPlano(id){
    const linha = document.querySelector(`#mensalidade tr[data-plano="${CSS.escape(id)}"]`);
    const ler = (m, q) => { const t = linha.querySelector(`[data-moeda="${m}"][data-preco="${q}"]`).value.trim().replace(/\s/g, "").replace(",", ".");
      if(!t) return null; const v = Number(t); if(!(v > 0)) throw new Error("Escreva o preço só com números, por exemplo 399,00."); return Math.round(v * 100) / 100; };
    try {
      const precos = { MZN:{ mensal:ler("MZN", "mensal"), anual:ler("MZN", "anual") }, ZAR:{ mensal:ler("ZAR", "mensal"), anual:ler("ZAR", "anual") } };
      /* «Para rand faz-se o câmbio» (Shelton, 02/10): o rand vazio sai do metical. */
      const cambio = this.cambio();
      if(cambio) for(const c of ["mensal", "anual"])
        if(precos.ZAR[c] == null && precos.MZN[c] != null) precos.ZAR[c] = Math.round(precos.MZN[c] / cambio * 100) / 100;
      await this.fonte.guardarPlano(id, precos);
      this.aviso("Preço guardado. Vale para as escolas novas e para as próximas cobranças.", "ok");
    } catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  async isentar(org, isenta){
    const e = this.escolaPorId(org);
    if(!isenta && !confirm(`Voltar a cobrar ${this.nomeDe(e)}? Sem pagamento, os alunos deixam de ver os cursos até a escola o pôr.`)) return;
    try { await this.fonte.isentar(org, isenta); this.aviso(isenta ? "Organização isenta da mensalidade." : "A organização volta a pagar mensalidade.", "ok"); }
    catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  /* ---------------- Os botões ---------------- */
  ligar(){
    document.getElementById("form-entrar").addEventListener("submit", async ev => {
      ev.preventDefault();
      const erro = document.getElementById("entrar-erro");
      erro.hidden = true;
      try {
        await this.fonte.entrar(document.getElementById("entrar-email").value.trim(), document.getElementById("entrar-password").value);
        await this.entrarSeHouverSessao();
      } catch(e){ erro.textContent = e.message; erro.hidden = false; }
    });
    const sair = async () => { await this.fonte.sair(); this.mostrar("ecra-entrar"); };
    ["btn-sair","btn-sair-movel","btn-sair-sem-acesso"].forEach(id => document.getElementById(id).addEventListener("click", sair));

    document.querySelectorAll("dialog [data-fechar]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

    /* Nova organização: o nome curto acompanha o nome até alguém o mexer à mão. */
    const nome = document.getElementById("escola-nome"), slug = document.getElementById("escola-slug");
    const previa = () => { document.getElementById("escola-slug-previa").textContent = `${location.host}/?org=${slug.value || "…"}`; };
    nome.addEventListener("input", () => { if(!slug.dataset.mexido){ slug.value = nomeCurto(nome.value); previa(); } });
    slug.addEventListener("input", () => { slug.dataset.mexido = "1"; previa(); });
    document.getElementById("btn-nova-escola").addEventListener("click", () => {
      document.getElementById("form-escola").reset();
      delete slug.dataset.mexido;
      document.getElementById("escola-erro").hidden = true;
      previa();
      document.getElementById("dlg-escola").showModal();
      nome.focus();
    });
    document.getElementById("form-escola").addEventListener("submit", ev => { ev.preventDefault(); this.criarEscola(); });
    document.getElementById("form-convite").addEventListener("submit", ev => { ev.preventDefault(); this.enviarConvite(); });
    document.getElementById("form-dominio").addEventListener("submit", ev => { ev.preventDefault(); this.juntarDominio(); });

    /* Procurar, na barra de cima: leva à lista, já filtrada. */
    document.getElementById("c-procurar-form").addEventListener("submit", ev => {
      ev.preventDefault();
      this.ui.texto = document.getElementById("c-procurar").value;
      this.ui.filtro = "todas"; this.ui.pagina = 1; this.ui.sel = null;
      this.ir("#/organizacoes");
    });

    window.addEventListener("hashchange", () => { document.getElementById("aviso-geral").hidden = true; this.desenhar(); window.scrollTo(0, 0); });
    window.addEventListener("resize", () => this.posicionarDica());
    document.getElementById("c-tabbar").addEventListener("click", ev => { const b = ev.target.closest("[data-ir]"); if(b) this.ir(b.dataset.ir); });

    /* Tudo o que está na vista redesenha-se, por isso delega-se. */
    const v = document.getElementById("c-vista");
    v.addEventListener("click", ev => {
      const t = ev.target;
      const b = t.closest("button");
      if(b){
        if(b.dataset.intAba){ this.ui.intAba = b.dataset.intAba; this.ir("#/integracoes"); this.desenhar(); return; }
        if(b.dataset.intAbrir){ this.ir(`#/integracoes/${b.dataset.intAbrir}`); return; }
        if(b.hasAttribute("data-int-voltar")){ this.ir("#/integracoes"); return; }
        if(b.id === "c-int-desligar"){ if(confirm("Desligar o Payflow da plataforma? Os eventos das assinaturas deixam de ser aceites até voltar a ligar.")) this.guardarPayflow(""); return; }
        if(b.dataset.serie){ this.ui.serie = b.dataset.serie; this.ui.barra = null; this.desenhar(); return; }
        if(b.dataset.barra != null){ this.ui.barra = Number(b.dataset.barra); this.posicionarDica(); return; }
        if(b.hasAttribute("data-insights-todos")){ this.ui.insightsTodos = !this.ui.insightsTodos; this.desenhar(); return; }
        if(b.dataset.filtro && b.dataset.ir){ this.ui.filtro = b.dataset.filtro; this.ui.pagina = 1; this.ui.sel = null; this.ir(b.dataset.ir); return; }
        if(b.dataset.filtro){ this.ui.filtro = b.dataset.filtro; this.ui.pagina = 1; this.ui.sel = null; this.desenhar(); return; }
        if(b.dataset.pagina){ this.ui.pagina = Number(b.dataset.pagina); this.ui.sel = null; this.desenhar(); return; }
        if(b.dataset.faturas){ this.ui.faturas = b.dataset.faturas; this.ui.faturasPagina = 1; this.desenhar(); return; }
        if(b.dataset.faturasPagina){ this.ui.faturasPagina = Number(b.dataset.faturasPagina); this.desenhar(); return; }
        if(b.dataset.sep){ const r = this.rota(); this.ir(`#/organizacoes/${r.slug}${b.dataset.sep === "resumo" ? "" : "/" + b.dataset.sep}`); return; }
        if(b.dataset.ir){ this.ir(b.dataset.ir); return; }
        if(b.dataset.guardarPlano){ this.guardarPlano(b.dataset.guardarPlano); return; }
        if(b.dataset.convidar){ this.abrirConvite(b.dataset.convidar); return; }
        if(b.dataset.dominio){ this.abrirDominio(b.dataset.dominio); return; }
        if(b.dataset.estado){ this.mudarEstado(b.dataset.estado, b.dataset.para); return; }
        if(b.dataset.revogar){ this.revogar(b.dataset.revogar); return; }
        if(b.dataset.isentar){ this.isentar(b.dataset.isentar, !!b.dataset.isenta); return; }
        if(b.hasAttribute("data-membro-estado")){ this.mudarMembro(b.dataset.org, b.dataset.pessoa, b.dataset.papelActual, !b.dataset.ativo); return; }
      }
      /* Uma linha da lista: seleccionar; com a pré-visualização escondida
         (ecrãs estreitos), abrir logo a ficha. */
      const tr = t.closest("#lista-escolas tbody tr[data-escola]");
      if(tr && !t.closest("a")){
        const previaVisivel = window.matchMedia("(min-width:1321px)").matches;
        if(!previaVisivel || this.ui.sel === tr.dataset.escola) this.ir(`#/organizacoes/${tr.dataset.escola}`);
        else { this.ui.sel = tr.dataset.escola; this.desenhar(); const n = document.querySelector(`#lista-escolas tr[data-escola="${CSS.escape(this.ui.sel)}"]`); if(n) n.focus({ preventScroll:true }); }
      }
    });
    v.addEventListener("submit", ev => {
      if(ev.target.id === "c-int-payflow"){ ev.preventDefault(); this.guardarPayflow(document.getElementById("c-int-segredo").value.trim()); }
    });
    v.addEventListener("keydown", ev => {
      const tr = ev.target.closest && ev.target.closest("#lista-escolas tbody tr[data-escola]");
      if(!tr) return;
      if(ev.key === "Enter"){ ev.preventDefault(); this.ir(`#/organizacoes/${tr.dataset.escola}`); }
      if(ev.key === "ArrowDown" || ev.key === "ArrowUp"){
        ev.preventDefault();
        const outro = ev.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling;
        if(outro){ this.ui.sel = outro.dataset.escola; this.desenhar(); const n = document.querySelector(`#lista-escolas tr[data-escola="${CSS.escape(this.ui.sel)}"]`); if(n) n.focus(); }
      }
    });
    v.addEventListener("mouseover", ev => {
      const b = ev.target.closest && ev.target.closest("#c-grafico .c-barra");
      if(b && Number(b.dataset.barra) !== this.ui.barra){ this.ui.barra = Number(b.dataset.barra); this.posicionarDica(); }
    });
    v.addEventListener("focusin", ev => {
      const b = ev.target.closest && ev.target.closest("#c-grafico .c-barra");
      if(b){ this.ui.barra = Number(b.dataset.barra); this.posicionarDica(); }
    });
    v.addEventListener("input", ev => {
      if(ev.target.id === "c-filtro-texto"){
        this.ui.texto = ev.target.value; this.ui.pagina = 1; this.ui.sel = null;
        const pos = ev.target.selectionStart;
        this.desenhar();
        const c = document.getElementById("c-filtro-texto"); c.focus(); c.setSelectionRange(pos, pos);
      }
    });
    v.addEventListener("change", ev => {
      if(ev.target.id === "c-ordem"){ this.ui.ordem = ev.target.value; this.ui.pagina = 1; this.desenhar(); return; }
      const s = ev.target.closest("select[data-papel]");
      if(!s) return;
      const ativo = !!s.parentElement.querySelector("[data-membro-estado]").dataset.ativo;
      this.mudarMembro(s.dataset.org, s.dataset.pessoa, s.value, ativo);
    });
  },

  async criarEscola(){
    const erro = document.getElementById("escola-erro");
    const botao = document.getElementById("btn-criar-escola");
    const v = id => document.getElementById(id).value.trim();
    const email = v("escola-dono-email").toLowerCase();
    erro.hidden = true;
    if(email && !/^\S+@\S+\.\S+$/.test(email)){ erro.textContent = "O email do dono não parece válido."; erro.hidden = false; return; }
    botao.disabled = true;
    try {
      const criada = await this.fonte.criar(v("escola-nome"), v("escola-slug").toLowerCase(), v("escola-dominio"));
      document.getElementById("dlg-escola").close();
      let aviso = ["Organização criada. Convide o dono a partir da equipa, quando quiser.", "ok", null];
      if(email){
        try {
          const r = await this.fonte.convidar({ organizacao: criada.slug, papel: "dono", email, nome: v("escola-dono-nome") });
          aviso = r.enviado ? [`Organização criada. O convite seguiu para ${email}.`, "ok", null]
                            : [`Organização criada. ${r.aviso || "O email não saiu."} Envie este link ao dono:`, "nota", r.link];
        } catch(e){
          aviso = [`Organização criada, mas o convite não foi enviado: ${e.message} Pode convidar o dono a partir da equipa.`, "nota", null];
        }
      }
      await this.recarregar();
      this.ir(`#/organizacoes/${criada.slug}`);
      this.aviso(...aviso);
    } catch(e){
      erro.textContent = e.message; erro.hidden = false;
    } finally { botao.disabled = false; }
  },

  abrirConvite(org){
    const e = this.escolaPorId(org);
    this.conviteOrg = e;
    document.getElementById("form-convite").reset();
    document.getElementById("convite-erro").hidden = true;
    document.getElementById("convite-escola").textContent = `Para ${this.nomeDe(e)}. A pessoa recebe um email para escolher a password e entrar.`;
    document.getElementById("convite-papel").value = e.equipa.some(m => m.papel === "dono") ? "admin" : "dono";
    document.getElementById("dlg-convite").showModal();
  },

  async enviarConvite(){
    const erro = document.getElementById("convite-erro");
    const botao = document.getElementById("btn-enviar-convite");
    const e = this.conviteOrg;
    const email = document.getElementById("convite-email").value.trim().toLowerCase();
    erro.hidden = true;
    if(!/^\S+@\S+\.\S+$/.test(email)){ erro.textContent = "Escreva um email válido."; erro.hidden = false; return; }
    botao.disabled = true;
    try {
      const r = await this.fonte.convidar({ organizacao: e.slug, papel: document.getElementById("convite-papel").value,
                                            email, nome: document.getElementById("convite-nome").value.trim() });
      document.getElementById("dlg-convite").close();
      await this.recarregar();
      if(r.enviado) this.aviso(`Convite enviado a ${email}.`, "ok");
      else this.aviso(`${r.aviso || "O email não saiu."} Envie este link:`, "nota", r.link);
    } catch(err){ erro.textContent = err.message; erro.hidden = false; }
    finally { botao.disabled = false; }
  },

  abrirDominio(org){
    const e = this.escolaPorId(org);
    this.dominioOrg = e;
    document.getElementById("form-dominio").reset();
    document.getElementById("dominio-erro").hidden = true;
    document.getElementById("dominio-escola").textContent = `Para ${this.nomeDe(e)}.`;
    document.getElementById("dlg-dominio").showModal();
  },

  async juntarDominio(){
    const erro = document.getElementById("dominio-erro");
    erro.hidden = true;
    try {
      await this.fonte.juntarDominio(this.dominioOrg.id, document.getElementById("dominio-valor").value.trim().toLowerCase());
      document.getElementById("dlg-dominio").close();
      await this.recarregar();
      this.aviso("Domínio pedido. A escola vê os registos a criar no DNS em Configurações › Endereço da área de membros, e verifica lá.", "ok");
    } catch(e){ erro.textContent = e.message; erro.hidden = false; }
  },

  async mudarEstado(org, para){
    const e = this.escolaPorId(org);
    if(para === "suspensa" && !confirm(`Suspender ${this.nomeDe(e)}? Ninguém lá entra até a reactivar.`)) return;
    let aviso;
    try { await this.fonte.mudarEstado(org, para); aviso = [para === "suspensa" ? "Organização suspensa." : "Organização reactivada.", "ok"]; }
    catch(err){ aviso = [err.message, "erro"]; }
    await this.recarregar();
    this.aviso(...aviso);
  },

  async mudarMembro(org, pessoa, papel, ativo){
    let aviso;
    try { await this.fonte.mudarMembro(org, pessoa, papel, ativo); aviso = ["Equipa actualizada.", "ok"]; }
    catch(err){ aviso = [err.message, "erro"]; }
    await this.recarregar();
    this.aviso(...aviso);
  },

  async revogar(convite){
    let aviso;
    try { await this.fonte.revogarConvite(convite); aviso = ["Convite revogado: o link deixou de servir.", "ok"]; }
    catch(err){ aviso = [err.message, "erro"]; }
    await this.recarregar();
    this.aviso(...aviso);
  }
};

document.addEventListener("DOMContentLoaded", () => Consola.arrancar());
