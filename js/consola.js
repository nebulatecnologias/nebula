/* ============================================================
   Consola da plataforma (/consola/)
   Para quem administra a PLATAFORMA (nucleo.administradores_plataforma),
   não uma escola: criar escolas, convidar o dono e a equipa, juntar
   domínios, suspender. Não mostra dados de alunos — só os números.

   Duas fontes com a mesma forma: a base (funções academia.consola_* e a
   Edge Function convidar-aluno) e a demonstração (?demo=1), em memória,
   para os testes.
   ============================================================ */

const PAPEIS = { dono:"Dono", admin:"Administrador", colaborador:"Colaborador", aluno:"Aluno" };

function esc(t){
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function dataCurta(iso){
  try { return new Date(iso).toLocaleDateString("pt-PT", { day:"numeric", month:"long" }); }
  catch(e){ return ""; }
}
/* «Escola de Liderança» → «escola-de-lideranca» */
function nomeCurto(nome){
  return String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 41).replace(/-+$/, "");
}
/* Onde a escola abre: o domínio dela, ou este endereço com ?org=. */
function enderecoDaEscola(e){
  return e.dominios && e.dominios.length ? "https://" + e.dominios[0] : `${location.origin}/?org=${encodeURIComponent(e.slug)}`;
}

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
    criar: (nome, slug, dominio) => rpc("consola_criar_organizacao", { p_nome: nome, p_slug: slug, p_dominio: dominio || null }),
    mudarEstado: (id, estado) => rpc("consola_mudar_estado", { p_organizacao: id, p_estado: estado }),
    juntarDominio: (id, dominio) => rpc("consola_juntar_dominio", { p_organizacao: id, p_dominio: dominio }),
    mudarMembro: (org, pessoa, papel, ativo) => rpc("consola_mudar_membro", { p_organizacao: org, p_utilizador: pessoa, p_papel: papel, p_ativo: ativo }),
    revogarConvite: id => rpc("consola_revogar_convite", { p_convite: id }),
    cobranca: () => rpc("consola_cobranca"),
    guardarPlano: (plano, p) => rpc("consola_guardar_plano", { p_plano: plano,
      p_mensal_mzn: p.MZN.mensal, p_anual_mzn: p.MZN.anual, p_mensal_zar: p.ZAR.mensal, p_anual_zar: p.ZAR.anual }),
    isentar: (org, isenta) => rpc("consola_isentar", { p_organizacao: org, p_isenta: isenta }),
    ambiente: a => rpc("consola_ambiente", { p_ambiente: a }),
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

/* ---------------- A demonstração ---------------- */
function fonteDemo(){
  const pedido = new URLSearchParams(location.search);
  const id = () => "demo-" + Math.random().toString(36).slice(2, 10);
  const agora = new Date();
  const emDias = d => new Date(agora.getTime() + d * 864e5).toISOString();
  let comSessao = !pedido.has("sem-sessao");
  const escolas = [
    { id:"org-kingdom", slug:"kingdom", nome:"Kingdom Company", nomeEscola:"Kingdom Academy", estado:"ativa", kingdom:true,
      criadoEm:"2026-10-01T16:21:00Z", dominios:["membros.kingdomcompny.com"], alunos:11, cursos:5,
      equipa:[{ id:"u1", nome:"Ana Exemplo", email:"ana@exemplo.invalid", papel:"admin", estado:"ativo" }], convites:[] },
    { id:"org-teste", slug:"teste", nome:"Escola de Teste", nomeEscola:null, estado:"ativa", kingdom:false,
      criadoEm:"2026-10-01T18:40:00Z", dominios:[], alunos:0, cursos:0,
      equipa:[{ id:"u2", nome:"Bruno Exemplo", email:"bruno@exemplo.invalid", papel:"dono", estado:"ativo" }], convites:[] }
  ];
  const achar = org => { const e = escolas.find(x => x.id === org); if(!e) throw new Error("Escola não encontrada."); return e; };
  /* A mensalidade, em memória: preços por preencher, como na base hoje. */
  const cobranca = {
    planos: [
      { id:"essencial", nome:"Essencial", alunosMax:500, precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:null, anual:null, simbolo:"R" } } },
      { id:"profissional", nome:"Profissional", alunosMax:1500, precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:null, anual:null, simbolo:"R" } } },
      { id:"escala", nome:"Escala", alunosMax:5000, precos:{ MZN:{ mensal:null, anual:null, simbolo:"MZ" }, ZAR:{ mensal:null, anual:null, simbolo:"R" } } }
    ],
    definicoes: { ambiente:"teste", diasTeste:7, diasTolerancia:3 },
    contas: { "org-kingdom": { estado:"isenta", plano:"escala", ciclo:"mensal" }, "org-teste": { estado:"isenta", plano:"escala", ciclo:"mensal" } }
  };
  const pausa = () => new Promise(r => setTimeout(r, 30));
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
    async escolas(){ await pausa(); return JSON.parse(JSON.stringify(escolas)); },
    async criar(nome, slug, dominio){
      await pausa();
      if(!String(nome || "").trim()) throw new Error("Falta o nome da escola.");
      if(!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) throw new Error("O nome curto só pode ter letras minúsculas, números e hífenes (2 a 41).");
      if(escolas.some(e => e.slug === slug)) throw new Error(`Já existe uma escola com o nome curto «${slug}».`);
      const nova = { id:id(), slug, nome:nome.trim(), nomeEscola:null, estado:"ativa", kingdom:false, criadoEm:new Date().toISOString(),
                     dominios: dominio ? [dominio.toLowerCase()] : [], alunos:0, cursos:0, equipa:[], convites:[] };
      escolas.push(nova);
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
    async mudarMembro(org, pessoa, papel, ativo){
      const e = achar(org);
      if(e.kingdom) throw new Error("Na Kingdom, a equipa gere-se no painel de gestão.");
      const m = e.equipa.find(x => x.id === pessoa);
      m.papel = papel; m.estado = ativo ? "ativo" : "suspenso";
    },
    async cobranca(){
      await pausa();
      return JSON.parse(JSON.stringify({ planos: cobranca.planos, definicoes: cobranca.definicoes,
        escolas: escolas.map(e => Object.assign({ id:e.id, slug:e.slug, nome:e.nome, kingdom:e.kingdom, temCartao:false, contaEmDia:true },
          cobranca.contas[e.id] || { estado:null })) }));
    },
    async guardarPlano(plano, precos){
      const p = cobranca.planos.find(x => x.id === plano);
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
      cobranca.contas[org] = Object.assign({ plano:"essencial", ciclo:"mensal" }, cobranca.contas[org] || {}, { estado: isenta ? "isenta" : "pendente" });
    },
    async ambiente(a){ cobranca.definicoes.ambiente = a; },
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

/* ---------------- A página ---------------- */
const Consola = {
  fonte: null,
  escolas: [],

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
    this.mostrar("ecra-consola");
    await this.recarregar();
  },

  async recarregar(){
    try { this.escolas = await this.fonte.escolas(); }
    catch(e){ this.aviso(e.message, "erro"); this.escolas = []; }
    try { this.cobranca = await this.fonte.cobranca(); }
    catch(e){ this.cobranca = null; }
    this.desenhar();
  },

  /* ---------------- A mensalidade ----------------
     Os preços de cada plano (ZAR), o ambiente da Paystack e, em cada escola,
     o estado da conta. O dinheiro aqui é o que a base cobra: o que se escreve
     guarda-se como está, com duas casas. */
  contaDe(id){ return ((this.cobranca && this.cobranca.escolas) || []).find(x => x.id === id) || null; },

  mensalidadeHTML(){
    const c = this.cobranca;
    if(!c) return `<p class="vazio">Não foi possível ler a mensalidade.</p>`;
    const sim = m => ((c.planos[0] || {}).precos || {})[m]?.simbolo || m;
    const n = v => v == null ? "" : String(v).replace(".", ",");
    const producao = c.definicoes && c.definicoes.ambiente === "producao";
    const COLUNAS = [["MZN","mensal","Mensal"], ["MZN","anual","Anual"], ["ZAR","mensal","Mensal"], ["ZAR","anual","Anual"]];
    return `
      <div class="escola-cabeca">
        <div>
          <h2>Mensalidade das escolas</h2>
          <div class="meta"><span>As escolas de Moçambique pagam em meticais, as da África do Sul em rand. Sem preço, o plano não se vende nessa moeda e nesse ciclo.</span></div>
        </div>
        <div class="escola-accoes">
          <label class="sr-only" for="ambiente-paystack">Ambiente da Paystack</label>
          <select id="ambiente-paystack" class="seletor-ambiente">
            <option value="teste"${producao ? "" : " selected"}>Paystack: teste</option>
            <option value="producao"${producao ? " selected" : ""}>Paystack: produção</option>
          </select>
          <span class="pill ${producao ? "pill-ativo" : "pill-suspensa"}" id="pill-ambiente">${producao ? "A cobrar a sério" : "Modo de teste"}</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tabela-planos">
          <thead>
            <tr><th rowspan="2">Plano</th><th rowspan="2">Alunos</th><th colspan="2" class="grupo">Meticais (${esc(sim("MZN"))})</th><th colspan="2" class="grupo">Rand (${esc(sim("ZAR"))})</th><th rowspan="2"></th></tr>
            <tr><th>Mensal</th><th>Anual</th><th>Mensal</th><th>Anual</th></tr>
          </thead>
          <tbody>${c.planos.map(p => `
            <tr data-plano="${esc(p.id)}">
              <td data-rotulo="Plano"><strong>${esc(p.nome)}</strong></td>
              <td data-rotulo="Alunos">até ${Number(p.alunosMax || 0).toLocaleString("pt-PT", { useGrouping:"always" })}</td>
              ${COLUNAS.map(([m, ciclo, rot]) => `<td data-rotulo="${rot} (${esc(sim(m))})"><input inputmode="decimal" aria-label="Preço ${rot.toLowerCase()} do ${esc(p.nome)} em ${m === "MZN" ? "meticais" : "rand"}" data-moeda="${m}" data-preco="${ciclo}" value="${esc(n(((p.precos || {})[m] || {})[ciclo]))}" placeholder="sem preço"></td>`).join("")}
              <td><button class="btn btn-secondary btn-sm" type="button" data-guardar-plano="${esc(p.id)}">Guardar</button></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>`;
  },

  contaHTML(e){
    const a = this.contaDe(e.id);
    if(!a || !a.estado) return `<span>Sem assinatura</span>`;
    const rotulos = { pendente:"Falta o cartão", teste:"Em teste", ativa:"Ativa", em_atraso:"Em atraso", cancelada:"Cancelada", isenta:"Isenta" };
    const plano = ((this.cobranca && this.cobranca.planos) || []).find(p => p.id === a.plano);
    const ate = a.estado === "teste" ? a.testeAte : a.pagoAte;
    return `<span>Mensalidade: <b>${esc(rotulos[a.estado] || a.estado)}</b>${a.estado !== "isenta" && plano ? ` · ${esc(plano.nome)} ${a.ciclo === "anual" ? "anual" : "mensal"}${a.moeda ? " em " + (a.moeda === "MZN" ? "meticais" : "rand") : ""}` : ""}${ate && a.estado !== "isenta" ? ` · até ${esc(dataCurta(ate))}` : ""}${a.cancelaNoFim ? " · cancela no fim" : ""}${a.ultimoErro ? ` · ${esc(a.ultimoErro)}` : ""}</span>`;
  },

  async guardarPlano(id){
    const linha = document.querySelector(`#mensalidade tr[data-plano="${CSS.escape(id)}"]`);
    const ler = (m, q) => { const t = linha.querySelector(`[data-moeda="${m}"][data-preco="${q}"]`).value.trim().replace(/\s/g, "").replace(",", ".");
      if(!t) return null; const v = Number(t); if(!(v > 0)) throw new Error("Escreva o preço só com números, por exemplo 399,00."); return Math.round(v * 100) / 100; };
    try {
      const precos = { MZN:{ mensal:ler("MZN", "mensal"), anual:ler("MZN", "anual") }, ZAR:{ mensal:ler("ZAR", "mensal"), anual:ler("ZAR", "anual") } };
      await this.fonte.guardarPlano(id, precos);
      this.aviso("Preço guardado. Vale para as escolas novas e para as próximas cobranças.", "ok");
    } catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  async mudarAmbiente(a){
    if(a === "producao" && !confirm("Passar a Paystack para produção? Os cartões postos a partir de agora são cobrados a sério.")){ this.desenhar(); return; }
    try { await this.fonte.ambiente(a); this.aviso(a === "producao" ? "A Paystack está em produção." : "A Paystack está em modo de teste.", "ok"); }
    catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  async isentar(org, isenta){
    const e = this.escolaPorId(org);
    if(!isenta && !confirm(`Voltar a cobrar ${e.nomeEscola || e.nome}? Sem cartão, os alunos deixam de ver os cursos até a escola o pôr.`)) return;
    try { await this.fonte.isentar(org, isenta); this.aviso(isenta ? "Escola isenta da mensalidade." : "A escola volta a pagar mensalidade.", "ok"); }
    catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  desenhar(){
    const ativas = this.escolas.filter(e => e.estado === "ativa").length;
    const soma = campo => this.escolas.reduce((n, e) => n + Number(e[campo] || 0), 0);
    document.getElementById("resumo").innerHTML = [
      [this.escolas.length, this.escolas.length === 1 ? "escola" : "escolas"],
      [ativas, ativas === 1 ? "activa" : "activas"],
      [soma("alunos"), "alunos activos"],
      [soma("cursos"), "cursos"]
    ].map(([n, r]) => `<div class="card"><div class="num">${n}</div><div class="rot">${r}</div></div>`).join("");

    document.getElementById("mensalidade").innerHTML = this.mensalidadeHTML();

    document.getElementById("lista-escolas").innerHTML = this.escolas.length
      ? this.escolas.map(e => this.escolaHTML(e)).join("")
      : `<div class="card escola"><p class="vazio">Ainda não há escolas.</p></div>`;
  },

  escolaHTML(e){
    const nome = e.nomeEscola || e.nome;
    const suspensa = e.estado !== "ativa";
    const equipa = e.equipa.length ? e.equipa.map(m => `
      <div class="linha" data-membro="${esc(m.id)}">
        <div class="quem"><strong>${esc(m.nome || m.email)}</strong><span>${esc(m.email)}</span></div>
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
      </div>`).join("") : `<p class="vazio">Ainda sem equipa. Convide o dono da escola.</p>`;

    const convites = e.convites.length ? `
      <div class="bloco">
        <h3>Convites por aceitar</h3>
        ${e.convites.map(c => `
          <div class="linha">
            <div class="quem"><strong>${esc(c.nome || c.email)}</strong><span>${esc(c.email)} · ${esc(PAPEIS[c.papel] || c.papel)} · vale até ${esc(dataCurta(c.expiraEm))}</span></div>
            <div class="mexer"><button class="btn btn-sm btn-texto" type="button" data-revogar="${esc(c.id)}">Revogar</button></div>
          </div>`).join("")}
      </div>` : "";

    return `
      <article class="card escola" data-escola="${esc(e.slug)}">
        <div class="escola-cabeca">
          <div>
            <h2>${esc(nome)}</h2>
            <div class="meta">
              <code>${esc(e.slug)}</code>
              ${nome !== e.nome ? `<span>${esc(e.nome)}</span>` : ""}
              <span class="pill ${suspensa ? "pill-suspensa" : "pill-ativo"}">${suspensa ? "Suspensa" : "Activa"}</span>
            </div>
          </div>
          <div class="escola-accoes">
            <a class="btn btn-secondary btn-sm" href="${esc(enderecoDaEscola(e))}" target="_blank" rel="noopener">Abrir</a>
            <button class="btn btn-secondary btn-sm" type="button" data-convidar="${esc(e.id)}">Convidar para a equipa</button>
            <button class="btn btn-secondary btn-sm" type="button" data-dominio="${esc(e.id)}">Juntar domínio</button>
            ${e.kingdom ? "" : `<button class="btn btn-sm ${suspensa ? "btn-secondary" : "btn-perigo-suave"}" type="button" data-estado="${esc(e.id)}" data-para="${suspensa ? "ativa" : "suspensa"}">${suspensa ? "Reactivar" : "Suspender"}</button>`}
          </div>
        </div>
        <div class="numeros">
          <span><b>${Number(e.alunos || 0)}</b> ${Number(e.alunos) === 1 ? "aluno activo" : "alunos activos"}</span>
          <span><b>${Number(e.cursos || 0)}</b> ${Number(e.cursos) === 1 ? "curso" : "cursos"}</span>
          <span>${e.dominios.length ? esc(e.dominios.join(" · ")) : "Sem domínio próprio"}</span>
          ${(e.dominiosPorLigar || []).map(d => `<span>${esc(d.dominio)} · ${d.estado === "verificado" ? "a ligar" : "à espera do DNS"}</span>`).join("")}
        </div>
        <div class="numeros conta-escola">
          ${this.contaHTML(e)}
          ${e.kingdom ? "" : (this.contaDe(e.id) || {}).estado === "isenta"
            ? `<button class="btn btn-sm btn-texto" type="button" data-isentar="${esc(e.id)}" data-isenta="">Voltar a cobrar</button>`
            : `<button class="btn btn-sm btn-texto" type="button" data-isentar="${esc(e.id)}" data-isenta="1">Isentar</button>`}
        </div>
        <div class="bloco">
          <h3>Equipa</h3>
          ${equipa}
          ${e.kingdom ? `<p class="hint">Na Kingdom, a equipa gere-se no painel de gestão.</p>` : ""}
        </div>
        ${convites}
      </article>`;
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
    document.getElementById("btn-sair").addEventListener("click", sair);
    document.getElementById("btn-sair-sem-acesso").addEventListener("click", sair);

    document.querySelectorAll("dialog [data-fechar]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

    /* Nova escola: o nome curto acompanha o nome até alguém o mexer à mão. */
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

    /* As acções de cada escola (a lista redesenha-se, por isso delega-se). */
    const mensalidade = document.getElementById("mensalidade");
    mensalidade.addEventListener("click", ev => { const b = ev.target.closest("[data-guardar-plano]"); if(b) this.guardarPlano(b.dataset.guardarPlano); });
    mensalidade.addEventListener("change", ev => { if(ev.target.id === "ambiente-paystack") this.mudarAmbiente(ev.target.value); });

    const lista = document.getElementById("lista-escolas");
    lista.addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if(!b) return;
      if(b.dataset.convidar) this.abrirConvite(b.dataset.convidar);
      else if(b.dataset.dominio) this.abrirDominio(b.dataset.dominio);
      else if(b.dataset.estado) this.mudarEstado(b.dataset.estado, b.dataset.para);
      else if(b.dataset.revogar) this.revogar(b.dataset.revogar);
      else if(b.dataset.isentar) this.isentar(b.dataset.isentar, !!b.dataset.isenta);
      else if(b.hasAttribute("data-membro-estado")) this.mudarMembro(b.dataset.org, b.dataset.pessoa, b.dataset.papelActual, !b.dataset.ativo);
    });
    lista.addEventListener("change", ev => {
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
      if(email){
        try {
          const r = await this.fonte.convidar({ organizacao: criada.slug, papel: "dono", email, nome: v("escola-dono-nome") });
          if(r.enviado) this.aviso(`Escola criada. O convite seguiu para ${email}.`, "ok");
          else this.aviso(`Escola criada. ${r.aviso || "O email não saiu."} Envie este link ao dono:`, "nota", r.link);
        } catch(e){
          this.aviso(`Escola criada, mas o convite não foi enviado: ${e.message} Pode convidar o dono a partir da escola.`, "nota");
        }
      } else {
        this.aviso("Escola criada. Convide o dono a partir da escola, quando quiser.", "ok");
      }
      await this.recarregar();
    } catch(e){
      erro.textContent = e.message; erro.hidden = false;
    } finally { botao.disabled = false; }
  },

  escolaPorId(id){ return this.escolas.find(e => e.id === id); },

  abrirConvite(org){
    const e = this.escolaPorId(org);
    this.conviteOrg = e;
    document.getElementById("form-convite").reset();
    document.getElementById("convite-erro").hidden = true;
    document.getElementById("convite-escola").textContent = `Para ${e.nomeEscola || e.nome}. A pessoa recebe um email para escolher a password e entrar.`;
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
      if(r.enviado) this.aviso(`Convite enviado a ${email}.`, "ok");
      else this.aviso(`${r.aviso || "O email não saiu."} Envie este link:`, "nota", r.link);
      await this.recarregar();
    } catch(err){ erro.textContent = err.message; erro.hidden = false; }
    finally { botao.disabled = false; }
  },

  abrirDominio(org){
    const e = this.escolaPorId(org);
    this.dominioOrg = e;
    document.getElementById("form-dominio").reset();
    document.getElementById("dominio-erro").hidden = true;
    document.getElementById("dominio-escola").textContent = `Para ${e.nomeEscola || e.nome}.`;
    document.getElementById("dlg-dominio").showModal();
  },

  async juntarDominio(){
    const erro = document.getElementById("dominio-erro");
    erro.hidden = true;
    try {
      await this.fonte.juntarDominio(this.dominioOrg.id, document.getElementById("dominio-valor").value.trim().toLowerCase());
      document.getElementById("dlg-dominio").close();
      this.aviso("Domínio pedido. A escola vê os registos a criar no DNS em Configurações › Endereço da área de membros, e verifica lá.", "ok");
      await this.recarregar();
    } catch(e){ erro.textContent = e.message; erro.hidden = false; }
  },

  async mudarEstado(org, para){
    const e = this.escolaPorId(org);
    if(para === "suspensa" && !confirm(`Suspender ${e.nomeEscola || e.nome}? Ninguém lá entra até a reactivar.`)) return;
    try {
      await this.fonte.mudarEstado(org, para);
      this.aviso(para === "suspensa" ? "Escola suspensa." : "Escola reactivada.", "ok");
    } catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  async mudarMembro(org, pessoa, papel, ativo){
    try {
      await this.fonte.mudarMembro(org, pessoa, papel, ativo);
      this.aviso("Equipa actualizada.", "ok");
    } catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  },

  async revogar(convite){
    try {
      await this.fonte.revogarConvite(convite);
      this.aviso("Convite revogado: o link deixou de servir.", "ok");
    } catch(err){ this.aviso(err.message, "erro"); }
    await this.recarregar();
  }
};

document.addEventListener("DOMContentLoaded", () => Consola.arrancar());
