/* ============================================================
   Administração › Integrações
   No modelo da Memberkit (pedido do Shelton a 02/10/2026):
   Instaladas · Disponíveis · Histórico, um cartão por aplicação e,
   ao abri-lo, as instruções de como a ligar.

   - Payflow: as vendas da escola abrem os cursos sozinhas. A escola
     cria a integração no Payflow dela, cola aqui o segredo e liga cada
     produto aos cursos (academia.integracoes_da_escola e companhia; o
     recetor é a Edge Function academia-vendas).
   - Vídeo (Panda, YouTube, Vimeo, Bunny): pelo código de incorporação
     de cada aula; aqui escolhe-se onde estão os vídeos.
   - Aulas ao vivo (Zoom, Google Meet): pelo link de cada evento.
   - WhatsApp (canal de apoio) e respostas aos emails.
   - Webhooks de saída: em breve.
   ============================================================ */

const estadoInt = { aba: "instaladas", aberta: null, dados: null, carregado: false, procura: "", aviso: null };
const URL_VENDAS = () => `${(typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "")}/functions/v1/academia-vendas`;

function aulasComVideo(){
  return DB.cursos.flatMap(c => c.modulos.flatMap(m => m.aulas)).filter(temVideo);
}
function totalDeAulas(){
  return DB.cursos.reduce((s,c) => s + c.modulos.reduce((n,m)=>n+m.aulas.length, 0), 0);
}

/* ---------------- Os dados (base ou demonstração) ---------------- */
function integracoesDaDemonstracao(){
  if(!DB.integracoesDemo){
    const agora = Date.now();
    const h = d => new Date(agora - d * 36e5).toISOString();
    DB.integracoesDemo = {
      organizacao: { id: "00000000-0000-4000-8000-0000000000de", slug: "demo", vendasPelaPonte: false },
      payflow: { ligada: true, segredoFim: "x9Qk", ligadaEm: h(240), ultimoEvento: { tipo: "order.paid", resultado: "aplicado", recebidoEm: h(3) } },
      produtos: DB.cursos.length ? [{ produto: "prod_01JDEMO7K2QF", nome: "Oferta de lançamento", cursos: [DB.cursos[0].id] }] : [],
      historico: [
        { id: "evt_demo_3", tipo: "order.paid", resultado: "aplicado", pedido: "KG-20261002-7K2QF", email: "ana@exemplo.invalid", cursos: DB.cursos.slice(0, 1).map(c => c.id), modo: "convite", teste: false, recebidoEm: h(3) },
        { id: "evt_demo_2", tipo: "order.paid", resultado: "aplicado", pedido: "KG-20261001-3M8ZD", email: "bruno@exemplo.invalid", cursos: DB.cursos.slice(0, 1).map(c => c.id), modo: "acesso", teste: false, recebidoEm: h(27) },
        { id: "evt_demo_1", tipo: "integration.test", resultado: "teste", pedido: null, email: null, cursos: [], modo: null, teste: true, recebidoEm: h(240) }
      ]
    };
  }
  return JSON.parse(JSON.stringify(DB.integracoesDemo));
}

async function carregarIntegracoes(){
  if(modoDemonstracao()){ estadoInt.dados = integracoesDaDemonstracao(); estadoInt.carregado = true; return; }
  try { estadoInt.dados = await API.integracoesDaEscola(); }
  catch(e){ estadoInt.dados = null; estadoInt.aviso = { tom: "erro", texto: "Não foi possível ler as integrações: " + e.message }; }
  estadoInt.carregado = true;
}

/* ---------------- O catálogo ---------------- */
function catalogoDaEscola(){
  const i = DB.config.integracoes || {};
  const d = estadoInt.dados || {};
  const pf = d.payflow || {};
  const respostas = (DB.config.email || {}).respostaPara || "";
  const comVideo = aulasComVideo().length;
  const video = (id, nome, valor) => ({
    id, nome, categoria: "Plataforma de vídeo", instalada: i.player === valor, valor,
    titulo: `${nome}`, descricao: `Os vídeos das aulas, pelo código de incorporação · ${comVideo} ${comVideo === 1 ? "aula ligada" : "aulas ligadas"}`
  });
  return [
    { id: "payflow", nome: "Payflow", categoria: "Meio de pagamento", indicada: true, instalada: !!pf.ligada,
      titulo: `Payflow${pf.segredoFim ? " · ····" + pf.segredoFim : ""}`,
      descricao: (d.produtos || []).length ? `As vendas abrem os cursos sozinhas · ${(d.produtos || []).length} ${(d.produtos || []).length === 1 ? "produto ligado" : "produtos ligados"}` : "Ligado, mas ainda sem produtos ligados a cursos.",
      tom: (d.produtos || []).length ? "" : "aviso", estadoTexto: (d.produtos || []).length ? "Ativo" : "Falta ligar produtos" },
    video("panda", "Panda Video", "Panda Video"),
    video("youtube", "YouTube", "YouTube"),
    video("vimeo", "Vimeo", "Vimeo"),
    Object.assign(video("bunny", "Bunny Stream", "Bunny Stream"), {}),
    { id: "zoom", nome: "Zoom", categoria: "Aulas ao vivo", instalada: false },
    { id: "meet", nome: "Google Meet", categoria: "Aulas ao vivo", instalada: false },
    { id: "whatsapp", nome: "WhatsApp", categoria: "Apoio ao aluno", instalada: !!i.suporteUrl,
      titulo: i.suporteRotulo ? `WhatsApp · ${i.suporteRotulo}` : "Canal de apoio", descricao: i.suporteUrl || "" },
    { id: "email", nome: "Respostas aos emails", marca: "email", categoria: "Email", instalada: !!respostas,
      titulo: `Respostas aos emails · ${respostas}`, descricao: "Quem responde a um email da academia escreve para aqui." },
    { id: "webhook", nome: "Webhooks", categoria: "Notificações", estado: "em_breve", instalada: false }
  ];
}

/* ---------------- O ecrã ---------------- */
async function renderAdminIntegracoes(){
  const alvo = document.getElementById("content-admin");
  if(!estadoInt.carregado){
    alvo.innerHTML = `${cabecalhoAdmin({ titulo: "Integrações" })}<div class="card painel"><p class="empty-note">A carregar…</p></div>`;
    await carregarIntegracoes();
    if(estadoAtualEIntegracoes()) renderAdminIntegracoes();
    return;
  }
  const lista = catalogoDaEscola();
  const app = estadoInt.aberta ? lista.find(a => a.id === estadoInt.aberta) : null;
  const aviso = estadoInt.aviso ? `<div class="int-aviso ${estadoInt.aviso.tom || ""}" role="status">${IntegracoesUI.esc(estadoInt.aviso.texto)}</div>` : "";
  if(app){
    alvo.innerHTML = aviso + IntegracoesUI.ficha(app, accoesDaFicha(app), corpoDaFicha(app));
  } else {
    const instaladas = lista.filter(a => a.instalada);
    const hist = (estadoInt.dados || {}).historico || [];
    alvo.innerHTML = `
      ${cabecalhoAdmin({ titulo: "Integrações", descricao: "As aplicações ligadas à sua área de membros. Abra um cartão para ver como se liga." })}
      ${aviso}
      ${IntegracoesUI.abas(estadoInt.aba, { instaladas: instaladas.length, disponiveis: lista.length, historico: hist.length })}
      <div id="int-painel">${estadoInt.aba === "historico" ? historicoHTML(hist) : estadoInt.aba === "disponiveis"
        ? `<div class="int-grelha">${lista.map(IntegracoesUI.cartao).join("")}</div>`
        : instaladas.length ? `<div class="int-lista">${instaladas.map(IntegracoesUI.linha).join("")}</div>`
          : `<div class="card painel"><p class="empty-note">Ainda nenhuma integração ligada. Veja as <button class="link-muted" type="button" data-int-aba="disponiveis">disponíveis</button>.</p></div>`}</div>`;
  }
  ligarIntegracoes(alvo);
}
function estadoAtualEIntegracoes(){ return typeof estado === "undefined" || estado.viewAtual === "admin-integracoes"; }

function historicoHTML(hist){
  const t = estadoInt.procura.trim().toLowerCase();
  const lista = t ? hist.filter(h => String(h.email || "").toLowerCase().includes(t)) : hist;
  const titulos = Object.fromEntries(DB.cursos.map(c => [c.id, c.titulo]));
  const RESULTADO = { aplicado: ["Acesso dado", "pill-ativo"], retirado: ["Acesso retirado", "pill-risco"], teste: ["Teste recebido", "pill-teste"],
                      sem_cursos: ["Sem cursos ligados", "pill-risco"], recusado: ["Recusado", "pill-quente"], ignorado: ["Ignorado", "pill-inativo"] };
  return `<div class="card int-historico">
    <div class="int-hist-topo"><span>${lista.length ? `${lista.length} ${lista.length === 1 ? "notificação recebida" : "notificações recebidas"} do Payflow` : "Sem resultados"}</span>
      <label class="int-procura"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="hidden">Procurar por email</span><input type="search" id="int-procura" placeholder="Procurar por email" value="${IntegracoesUI.esc(estadoInt.procura)}"></label></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Data</th><th class="col-larga">Integração</th><th>Detalhes do pedido</th><th>Cliente</th><th>Estado</th></tr></thead>
      <tbody>${lista.length ? lista.map(h => { const r = RESULTADO[h.resultado] || [h.resultado, "pill-inativo"]; return `<tr>
        <td>${IntegracoesUI.esc(IntegracoesUI.quando(h.recebidoEm))}</td>
        <td class="col-larga">Payflow${h.teste ? `<span class="sub">modo de teste</span>` : ""}</td>
        <td><span class="tipo">${IntegracoesUI.esc(h.tipo)}</span>${h.pedido ? `<span class="sub">${IntegracoesUI.esc(h.pedido)}</span>` : ""}${(h.cursos || []).length ? `<span class="sub">${IntegracoesUI.esc((h.cursos || []).map(c => titulos[c] || c).join(", "))}</span>` : ""}</td>
        <td>${h.email ? IntegracoesUI.esc(h.email) : "—"}${h.modo ? `<span class="sub">${h.modo === "convite" ? "convite enviado" : "já tinha conta"}</span>` : ""}</td>
        <td><span class="pill ${r[1]}">${IntegracoesUI.esc(r[0])}</span></td>
      </tr>`; }).join("") : `<tr><td colspan="5"><div class="empty-note">${t ? "Nenhuma notificação com esse email." : "Nenhuma notificação recebida do Payflow."}</div></td></tr>`}</tbody>
    </table></div>
  </div>`;
}

/* ---------------- As fichas ---------------- */
function accoesDaFicha(app){
  if(app.categoria === "Plataforma de vídeo"){
    return app.instalada
      ? `<button class="btn btn-secondary" type="button" disabled>É o seu provedor</button>`
      : `<button class="btn btn-primary" type="button" data-int-provedor="${IntegracoesUI.esc(app.valor)}">Usar o ${IntegracoesUI.esc(app.nome)}</button>`;
  }
  if(app.id === "zoom" || app.id === "meet") return `<button class="btn btn-secondary" type="button" data-int-ir="admin-eventos">Abrir Eventos</button>`;
  if(app.id === "payflow") return `<a class="btn btn-secondary" href="https://payflow.kingdomcompny.com/" target="_blank" rel="noopener">Abrir o Payflow</a>`;
  return "";
}

function corpoDaFicha(app){
  const esc = IntegracoesUI.esc;
  const i = DB.config.integracoes || {};
  if(app.id === "payflow"){
    const d = estadoInt.dados || {};
    const pf = d.payflow || {};
    const org = d.organizacao || {};
    const ult = pf.ultimoEvento;
    if(org.vendasPelaPonte) return `<p class="int-lead">As vendas abrem os cursos sozinhas.</p>
      <div class="int-aviso">Nesta escola, as vendas do Payflow já chegam pela ligação de origem, até à migração dos alunos. Esta ligação é para as escolas novas.</div>`;
    const cursos = DB.cursos;
    return `<p class="int-lead">As vendas abrem os cursos sozinhas.</p>
      <p>Quando alguém compra um produto seu no Payflow, a pessoa recebe os cursos ligados a esse produto: quem já tem conta entra logo; quem não tem recebe um convite com a marca da sua escola. Um reembolso total fecha o acesso.</p>
      <div class="int-estado">${pf.ligada ? `<span class="pill pill-ativo">Ligado</span><span>Segredo <b>····${esc(pf.segredoFim || "")}</b></span>` : `<span class="pill pill-inativo">Por ligar</span>`}
        ${ult ? `<span>Último evento: <b>${esc(ult.tipo)}</b>, ${esc(IntegracoesUI.quando(ult.recebidoEm))}</span>` : pf.ligada ? `<span>Ainda sem eventos: envie um de teste do Payflow.</span>` : ""}</div>
      <h2>1. Crie a integração no Payflow</h2>
      <ol class="passos">
        <li>No Payflow, abra <strong>Integrações › Webhooks › Nova integração</strong>.</li>
        <li>Em <strong>URL que recebe</strong>, cole este endereço:${IntegracoesUI.copiar(`${URL_VENDAS()}?escola=${org.id || ""}`, "Endereço da sua escola")}</li>
        <li>Em <strong>Eventos</strong>, marque <code>order.paid</code> e <code>order.refunded</code>. Em <strong>Produtos</strong>, marque os que abrem cursos (ou nenhum, para receber todos).</li>
        <li>Grave. O Payflow mostra o segredo uma única vez: copie-o.</li>
      </ol>
      <h2>2. Cole o segredo</h2>
      <form class="int-form" id="int-form-segredo" novalidate>
        <div class="field"><label for="int-segredo">Segredo do Payflow</label><input id="int-segredo" type="password" autocomplete="off" spellcheck="false" placeholder="${pf.ligada ? "Cole um novo para o trocar" : "whsec_…"}">
          <p class="hint">Fica guardado cifrado. Depois de guardado, vê-se só o fim.</p></div>
        <div class="acoes"><button class="btn btn-primary btn-sm" type="submit" id="int-guardar-segredo">${pf.ligada ? "Trocar o segredo" : "Ligar o Payflow"}</button>
          ${pf.ligada ? `<button class="btn btn-perigo-suave btn-sm" type="button" id="int-desligar">Desligar</button>` : ""}</div>
      </form>
      <h2>3. Ligue cada produto aos cursos</h2>
      <p>No Payflow, em <strong>Integrações › IDs dos produtos</strong>, copie o <code>prod_…</code> de cada oferta. Esse ID nunca muda, mesmo que o nome ou o preço mudem.</p>
      <div class="int-produtos">${(d.produtos || []).map(p => `<div class="int-produto" data-produto="${esc(p.produto)}">
          <div><strong>${esc(p.nome || p.produto)}</strong><span><code>${esc(p.produto)}</code> · ${esc((p.cursos || []).map(c => (cursos.find(k => k.id === c) || {}).titulo || c).join(", "))}</span></div>
          <button class="btn btn-texto btn-sm" type="button" data-int-tirar="${esc(p.produto)}">Tirar</button></div>`).join("") || `<p class="hint">Ainda nenhum produto ligado.</p>`}</div>
      <form class="int-form" id="int-form-produto" novalidate>
        <div class="field"><label for="int-produto">ID do produto</label><input id="int-produto" autocomplete="off" spellcheck="false" placeholder="prod_01J…"></div>
        <div class="field"><label for="int-produto-nome">Nome (para se reconhecer aqui)</label><input id="int-produto-nome" maxlength="120" placeholder="ex: Oferta de lançamento"></div>
        <div class="field"><span class="field-rotulo">Cursos que abre</span>
          <div class="int-cursos">${cursos.length ? cursos.map(c => `<label><input type="checkbox" value="${esc(c.id)}"> ${esc(c.titulo)}</label>`).join("") : `<p class="hint">Crie primeiro um curso em Conteúdos.</p>`}</div></div>
        <div class="acoes"><button class="btn btn-secondary btn-sm" type="submit" id="int-ligar-produto">Ligar produto</button></div>
      </form>
      <h2>4. Experimente</h2>
      <p>Na integração do Payflow, carregue em <strong>Enviar evento de teste</strong>. Aparece no <strong>Histórico</strong> destas Integrações como «Teste recebido».</p>`;
  }
  if(app.categoria === "Plataforma de vídeo"){
    const ONDE = {
      panda: "abra o vídeo na biblioteca, carregue em <strong>Compartilhar › Embed</strong> e copie o bloco inteiro.",
      youtube: "no vídeo (de preferência não listado), carregue em <strong>Partilhar › Incorporar</strong> e copie o código.",
      vimeo: "no vídeo, carregue em <strong>Share › Embed</strong> e copie o código.",
      bunny: "na biblioteca do Stream, abra o vídeo, carregue em <strong>Embed</strong> e copie o código."
    };
    const porLigar = DB.cursos.flatMap(c => c.modulos.flatMap(m => m.aulas.filter(a => !temVideo(a)).map(a => ({ a, c }))));
    return `<p class="int-lead">Os vídeos das aulas, sem copiar nada complicado.</p>
      <p>Cada aula recebe o código de incorporação do vídeo. Da caixa colada aproveitamos só o endereço: o leitor é montado por nós, com a moldura e as cores da sua academia, e nenhum HTML de fora entra na página.</p>
      <h2>Como ligar um vídeo</h2>
      <ol class="passos">
        <li><strong>No ${esc(app.nome)}</strong>, ${ONDE[app.id]}</li>
        <li><strong>Aqui</strong>, abra Conteúdos › o curso › a aula › separador <strong>Vídeo</strong>.</li>
        <li><strong>Cole</strong> o código e confirme a pré-visualização. Guarde.</li>
      </ol>
      <div class="int-estado"><span><b>${aulasComVideo().length}</b> de ${totalDeAulas()} aulas com vídeo</span>${porLigar.length ? `<button class="btn btn-secondary btn-sm" type="button" data-int-ligar="${esc(porLigar[0].c.id)}">Ligar a primeira em falta</button>` : ""}</div>`;
  }
  if(app.id === "zoom" || app.id === "meet"){
    const onde = app.id === "zoom" ? "No Zoom, agende a reunião e copie o <strong>link de convite</strong> (https://zoom.us/j/…)." : "No Google Calendar ou no Meet, crie a reunião e copie o <strong>link</strong> (https://meet.google.com/…).";
    return `<p class="int-lead">Encontros ao vivo com os seus alunos.</p>
      <ol class="passos"><li>${onde}</li><li>Aqui, abra <strong>Eventos</strong>, crie ou edite o evento e cole-o em <strong>Link da sala</strong>.</li>
      <li>Os alunos vêem o botão para entrar na hora do evento. Num evento pago, só quem comprou o lugar o vê.</li></ol>`;
  }
  if(app.id === "whatsapp"){
    return `<p class="int-lead">Um botão para o aluno pedir ajuda.</p>
      <p>Aparece nas Definições do aluno. Pode ser um link de WhatsApp (<code>https://wa.me/258…</code>) ou um email (<code>mailto:apoio@…</code>).</p>
      <form class="int-form" id="int-form-apoio" novalidate>
        <div class="field"><label for="int-apoio-rotulo">Texto do botão</label><input id="int-apoio-rotulo" maxlength="60" value="${esc(i.suporteRotulo || "")}" placeholder="Falar com a mentoria"></div>
        <div class="field"><label for="int-apoio-url">Link</label><input id="int-apoio-url" value="${esc(i.suporteUrl || "")}" placeholder="https://wa.me/258… ou mailto:apoio@…"><p class="hint">Deixe vazio para esconder o botão.</p></div>
        <div class="acoes"><button class="btn btn-primary btn-sm" type="submit">Guardar</button></div>
      </form>`;
  }
  if(app.id === "email"){
    const r = (DB.config.email || {}).respostaPara || "";
    return `<p class="int-lead">Para onde vão as respostas aos emails da academia.</p>
      <p>Os emails da academia (convites, password) saem com o nome da sua escola. Quem lhes responder escreve para este endereço; sem ele, a resposta vai para o dono da escola.</p>
      <form class="int-form" id="int-form-email" novalidate>
        <div class="field"><label for="int-email">Email para respostas</label><input id="int-email" type="email" value="${esc(r)}" placeholder="apoio@a-sua-escola.com"></div>
        <div class="acoes"><button class="btn btn-primary btn-sm" type="submit">Guardar</button></div>
      </form>`;
  }
  return `<p class="int-lead">Avise o seu sistema quando algo acontece na academia.</p>
    <p>Um aluno entrou, concluiu um curso, recebeu um certificado: a academia envia o evento, assinado, para o endereço que indicar. Está em preparação.</p>`;
}

/* ---------------- Os botões ---------------- */
function ligarIntegracoes(raiz){
  IntegracoesUI.ligarCopiar(raiz);
  raiz.querySelectorAll("[data-int-aba]").forEach(b => b.addEventListener("click", () => { estadoInt.aba = b.dataset.intAba; estadoInt.aviso = null; renderAdminIntegracoes(); }));
  raiz.querySelectorAll("[data-int-abrir]").forEach(b => b.addEventListener("click", () => { estadoInt.aberta = b.dataset.intAbrir; estadoInt.aviso = null; renderAdminIntegracoes(); window.scrollTo(0, 0); }));
  raiz.querySelectorAll("[data-int-voltar]").forEach(b => b.addEventListener("click", () => { estadoInt.aberta = null; estadoInt.aviso = null; renderAdminIntegracoes(); }));
  raiz.querySelectorAll("[data-int-ir]").forEach(b => b.addEventListener("click", () => irPara(b.dataset.intIr)));
  raiz.querySelectorAll("[data-int-ligar]").forEach(b => b.addEventListener("click", () => irPara("admin-curso-editor", b.dataset.intLigar)));
  const procura = raiz.querySelector("#int-procura");
  if(procura) procura.addEventListener("input", () => {
    estadoInt.procura = procura.value;
    const pos = procura.selectionStart;
    document.getElementById("int-painel").innerHTML = historicoHTML((estadoInt.dados || {}).historico || []);
    ligarIntegracoes(document.getElementById("int-painel"));
    const novo = document.getElementById("int-procura"); novo.focus(); novo.setSelectionRange(pos, pos);
  });
  raiz.querySelectorAll("[data-int-provedor]").forEach(b => b.addEventListener("click", async () => {
    DB.config.integracoes.player = b.dataset.intProvedor;
    await salvarIntegracoes();
    estadoInt.aviso = { tom: "ok", texto: `Provedor de vídeo: ${b.dataset.intProvedor}.` };
    renderAdminIntegracoes();
  }));

  const fSeg = raiz.querySelector("#int-form-segredo");
  if(fSeg){
    fSeg.addEventListener("submit", ev => { ev.preventDefault(); guardarSegredoPayflow(document.getElementById("int-segredo").value.trim()); });
    const desl = raiz.querySelector("#int-desligar");
    if(desl) desl.addEventListener("click", () => confirmarAcao({
      titulo: "Desligar o Payflow?", mensagem: "As vendas deixam de abrir os cursos até voltar a ligar. Os acessos já dados ficam.",
      textoConfirmar: "Desligar", aoConfirmar: () => guardarSegredoPayflow("")
    }));
  }
  const fProd = raiz.querySelector("#int-form-produto");
  if(fProd) fProd.addEventListener("submit", ev => {
    ev.preventDefault();
    const cursos = [...fProd.querySelectorAll(".int-cursos input:checked")].map(x => x.value);
    ligarProduto(document.getElementById("int-produto").value.trim(), document.getElementById("int-produto-nome").value.trim(), cursos);
  });
  raiz.querySelectorAll("[data-int-tirar]").forEach(b => b.addEventListener("click", () => tirarProduto(b.dataset.intTirar)));

  const fApoio = raiz.querySelector("#int-form-apoio");
  if(fApoio) fApoio.addEventListener("submit", async ev => {
    ev.preventDefault();
    DB.config.integracoes.suporteRotulo = document.getElementById("int-apoio-rotulo").value.trim();
    DB.config.integracoes.suporteUrl = document.getElementById("int-apoio-url").value.trim();
    await salvarIntegracoes();
    estadoInt.aviso = { tom: "ok", texto: DB.config.integracoes.suporteUrl ? "Canal de apoio ativo." : "Canal de apoio removido." };
    renderAdminIntegracoes();
  });
  const fEmail = raiz.querySelector("#int-form-email");
  if(fEmail) fEmail.addEventListener("submit", async ev => {
    ev.preventDefault();
    const email = document.getElementById("int-email").value.trim().toLowerCase();
    if(email && !/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(email)){ estadoInt.aviso = { tom: "erro", texto: "Esse email não parece válido." }; renderAdminIntegracoes(); return; }
    DB.config.email = DB.config.email || {};
    DB.config.email.respostaPara = email;
    await salvarEmail();
    estadoInt.aviso = { tom: "ok", texto: email ? `As respostas vão para ${email}.` : "As respostas vão para o dono da escola." };
    renderAdminIntegracoes();
  });
}

async function guardarSegredoPayflow(segredo){
  try {
    if(segredo && !/^whsec_[A-Za-z0-9+/=_-]{16,200}$/.test(segredo)) throw new Error("O segredo do Payflow começa por whsec_. Copie-o outra vez da integração no Payflow.");
    if(modoDemonstracao()){
      DB.integracoesDemo.payflow = segredo ? Object.assign(DB.integracoesDemo.payflow, { ligada: true, segredoFim: segredo.slice(-4) }) : { ligada: false };
      guardarDB();
    } else await API.guardarPayflowEscola(segredo);
    estadoInt.aviso = { tom: "ok", texto: segredo ? "Payflow ligado. Envie um evento de teste para confirmar." : "Payflow desligado." };
    await carregarIntegracoes();
  } catch(e){ estadoInt.aviso = { tom: "erro", texto: e.message }; }
  renderAdminIntegracoes();
}

async function ligarProduto(produto, nome, cursos){
  try {
    if(!/^prod_[A-Za-z0-9_]{4,64}$/.test(produto)) throw new Error("O ID do produto começa por prod_. Copie-o do Payflow, em Integrações › IDs dos produtos.");
    if(!cursos.length) throw new Error("Escolha pelo menos um curso para este produto abrir.");
    if(modoDemonstracao()){
      const l = DB.integracoesDemo.produtos.filter(p => p.produto !== produto);
      l.push({ produto, nome: nome || null, cursos });
      DB.integracoesDemo.produtos = l; guardarDB();
    } else await API.guardarProdutoExterno(produto, nome, cursos);
    estadoInt.aviso = { tom: "ok", texto: "Produto ligado. As próximas vendas dele abrem estes cursos." };
    await carregarIntegracoes();
  } catch(e){ estadoInt.aviso = { tom: "erro", texto: e.message }; }
  renderAdminIntegracoes();
}

async function tirarProduto(produto){
  try {
    if(modoDemonstracao()){ DB.integracoesDemo.produtos = DB.integracoesDemo.produtos.filter(p => p.produto !== produto); guardarDB(); }
    else await API.tirarProdutoExterno(produto);
    estadoInt.aviso = { tom: "ok", texto: "Produto tirado. Os acessos já dados ficam." };
    await carregarIntegracoes();
  } catch(e){ estadoInt.aviso = { tom: "erro", texto: e.message }; }
  renderAdminIntegracoes();
}

registarViews({ "admin-integracoes": () => { estadoInt.carregado = false; estadoInt.aberta = null; estadoInt.aviso = null; renderAdminIntegracoes(); } });
