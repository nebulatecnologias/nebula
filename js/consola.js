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
      achar(org).dominios.push(dominio.toLowerCase());
    },
    async mudarMembro(org, pessoa, papel, ativo){
      const e = achar(org);
      if(e.kingdom) throw new Error("Na Kingdom, a equipa gere-se no painel de gestão.");
      const m = e.equipa.find(x => x.id === pessoa);
      m.papel = papel; m.estado = ativo ? "ativo" : "suspenso";
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
    this.desenhar();
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
    const lista = document.getElementById("lista-escolas");
    lista.addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if(!b) return;
      if(b.dataset.convidar) this.abrirConvite(b.dataset.convidar);
      else if(b.dataset.dominio) this.abrirDominio(b.dataset.dominio);
      else if(b.dataset.estado) this.mudarEstado(b.dataset.estado, b.dataset.para);
      else if(b.dataset.revogar) this.revogar(b.dataset.revogar);
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
      this.aviso("Domínio juntado. Falta apontá-lo para a plataforma (DNS e Vercel).", "ok");
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
