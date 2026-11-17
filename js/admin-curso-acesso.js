/* ============================================================
   Administração › Conteúdos › curso › Quem tem acesso
   (pedido do Shelton, 15/11/2026: «não consigo dentro do painel definir de
   forma clara quem tem acesso a um curso que acabo de criar»).

   A regra de quem abre um curso é da base. Até aqui só se lia pela ficha de
   cada membro, um a um; aqui lê-se do lado do curso, num sítio só:
     - a regra (só quem recebeu acesso, ou todos os membros da escola);
     - as ofertas que o vendem;
     - as pessoas que o têm, com a origem e o prazo de cada acesso;
     - os convites por aceitar que o incluem.

   Ler é academia.curso_acessos; dar, tirar e mudar o prazo são as mesmas
   funções da ficha do membro (GestaoDeMembros), que já conferem quem pede.
   ============================================================ */

const AcessoDoCurso = {
  async ler(cursoId){
    if(modoDemonstracao()) return acessoDoCursoDemo(cursoId);
    return API.membro("curso_acessos", { p_curso:cursoId });
  }
};

/* Na demonstração monta-se a mesma resposta a partir da memória. */
function acessoDoCursoDemo(cursoId){
  const c = cursoPorId(cursoId);
  if(!c) throw new Error("Este curso não é desta escola.");
  const pessoas = [];
  (DB.membros || []).forEach(x => {
    const m = membroDemo(x.id);
    m.acessos.filter(a => a.curso === cursoId).forEach(a => pessoas.push({
      id:m.id, nome:m.nome, email:m.email, papel:funcaoDe(m), suspenso:m.acesso !== "ativo",
      origem:a.origem, nota:null, expira:a.expira, desde:a.desde, ativo:a.ativo,
      turma:a.turma, estado:estadoDoAcesso(a)
    }));
  });
  pessoas.sort((x, y) => (y.ativo - x.ativo) || String(y.desde).localeCompare(String(x.desde)));
  /* Quem abre o curso por uma assinatura ativa, sem matrícula própria ativa. */
  const assinantes = [];
  (DB.membros || []).forEach(x => {
    const m = membroDemo(x.id);
    const v = viasDeAcesso(m.acessos, m.assinaturas).find(k => k.curso === cursoId && k.via === "assinatura");
    if(v) assinantes.push({ id:m.id, nome:m.nome, email:m.email, papel:funcaoDe(m), suspenso:m.acesso !== "ativo",
                            nivel:v.nivel, nivelNome:(nivelPorId(v.nivel) || {}).nome, turma:v.turma, expira:v.expira, desde:v.desde });
  });
  return {
    curso:cursoId, abertoATodos:c.abertoATodos === true, publicado:c.publicado !== false,
    alunosAtivos:(DB.membros || []).filter(m => funcaoDe(m) === "aluno" && m.acesso === "ativo").length,
    equipa:(DB.membros || []).filter(m => funcaoDe(m) !== "aluno" && m.acesso === "ativo").length,
    pessoas, assinantes, payflow:[],
    ilimitados:(DB.membros || []).filter(m => m.ilimitado === true && m.acesso === "ativo" && funcaoDe(m) === "aluno").length,
    turmas: turmasDoCurso(cursoId).map(t => ({ id:t.id, nome:t.nome, padrao:!!t.padrao, prazoDias:t.prazoDias || null,
                                               membros:pessoas.filter(p => p.ativo && p.turma === t.id).length
                                                     + assinantes.filter(p => p.turma === t.id).length })),
    convites:(DB.convites || []).filter(v => (v.estado === "enviado" || v.estado === "aberto") && (v.cursos || []).includes(cursoId))
      .map(v => ({ id:v.id, email:v.email, nome:v.nome, origem:v.origem, expiraEm:v.expiraEm, acessoDias:v.acessoDias || null, criadoEm:v.criadoEm })),
    ofertas:(DB.ofertasDaEscola || []).filter(o => (o.cursos || []).includes(cursoId))
      .map(o => ({ id:o.id, nome:o.nome, ativa:o.ativa !== false, naVitrine:!!o.naVitrine, dias:o.diasDeAcesso || null,
                   preco:o.preco, moeda:o.moeda, produtos:(o.produtos || []).length, temLink:!!o.link }))
  };
}

/* Quem abre mesmo o curso por um acesso próprio: os alunos com o acesso aberto
   (a equipa vê tudo de qualquer maneira, e um suspenso não entra). */
function alunosComAcesso(d){
  const ids = new Set();
  (d.pessoas || []).forEach(p => { if(p.ativo && !p.suspenso && p.papel === "aluno") ids.add(p.id); });
  (d.assinantes || []).forEach(p => { if(!p.suspenso && p.papel === "aluno") ids.add(p.id); });
  (d.payflow || []).forEach(p => ids.add(p.id));
  return ids.size;
}

function plural(n, um, varios){ return `${n} ${n === 1 ? um : varios}`; }

/* ---------------- O resumo, no editor do curso ---------------- */
function resumoDoAcessoHTML(){
  return `<div class="curso-acesso" id="curso-acesso-resumo">
    <h4>Quem tem acesso</h4>
    <p class="curso-acesso-regra">A ler…</p>
    <button class="btn btn-secondary btn-block" type="button" id="btn-gerir-acesso">Gerir acesso</button>
  </div>`;
}

async function carregarResumoDoAcesso(cursoId, segunda){
  const alvo = document.getElementById("curso-acesso-resumo");
  if(!alvo) return;
  const botao = alvo.querySelector("#btn-gerir-acesso");
  if(botao && !botao.dataset.ligado){
    botao.dataset.ligado = "1";
    botao.addEventListener("click", () => abrirAcessoDoCurso(cursoId));
  }
  const regra = alvo.querySelector(".curso-acesso-regra");
  try {
    const d = await AcessoDoCurso.ler(cursoId);
    if(estado.cursoEditando !== cursoId || !document.body.contains(regra)) return;
    regra.outerHTML = textoDoResumo(d);
  } catch(erro){
    /* Um curso acabado de criar ainda pode estar a caminho da base. */
    if(!segunda){ setTimeout(() => carregarResumoDoAcesso(cursoId, true), 1500); return; }
    if(document.body.contains(regra)) regra.textContent = "Não foi possível ler agora. Abra «Gerir acesso» para tentar outra vez.";
  }
}

function textoDoResumo(d){
  const n = alunosComAcesso(d);
  const convites = (d.convites || []).length;
  const ofertas = (d.ofertas || []).filter(o => o.ativa).length;
  const quem = d.abertoATodos
    ? `<strong>Todos os membros da escola</strong> (${plural(d.alunosAtivos, "aluno ativo", "alunos ativos")}).`
    : n ? `<strong>${plural(n, "aluno", "alunos")}</strong>, por convite, compra ou acesso dado.`
        : `<strong>Nenhum aluno ainda.</strong> Só a equipa o abre.`;
  const extra = [
    (d.turmas || []).length > 1 ? plural(d.turmas.length, "turma", "turmas") : "",
    convites ? plural(convites, "convite por aceitar", "convites por aceitar") : "",
    ofertas ? plural(ofertas, "oferta que o vende", "ofertas que o vendem") : "Nenhuma oferta o vende"
  ].filter(Boolean).join(" · ");
  return `<p class="curso-acesso-regra">${quem}</p>
    <p class="curso-acesso-extra">${extra}${d.publicado ? "" : " · Rascunho: os alunos só o vêem depois de publicado"}</p>`;
}

/* ---------------- A gaveta ---------------- */
let acessoAberto = null;   /* { curso, dados, form, prazo } */

function abrirAcessoDoCurso(cursoId){
  fecharAcessoDoCurso(true);
  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  overlay.id = "acesso-overlay";
  overlay.innerHTML = `<div class="drawer drawer-membro" role="dialog" aria-modal="true" aria-labelledby="acesso-titulo">
    <div class="drawer-body"><div class="empty-note">A carregar…</div></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if(e.target === overlay) fecharAcessoDoCurso(); });
  document.addEventListener("keydown", fecharAcessoComEsc);
  requestAnimationFrame(() => overlay.classList.add("aberto"));
  acessoAberto = { curso:cursoId, dados:null, form:false, prazo:null };
  carregarAcessoDoCurso();
}

function fecharAcessoComEsc(e){
  if(e.key === "Escape" && !document.querySelector(".modal-overlay.confirmacao")) fecharAcessoDoCurso();
}

function fecharAcessoDoCurso(imediato){
  const overlay = document.getElementById("acesso-overlay");
  document.removeEventListener("keydown", fecharAcessoComEsc);
  const curso = acessoAberto && acessoAberto.curso;
  acessoAberto = null;
  if(!overlay) return;
  overlay.removeAttribute("id");
  overlay.classList.remove("aberto");
  if(imediato) overlay.remove();
  else setTimeout(() => overlay.remove(), 180);
  /* O resumo do editor acompanha o que se fez aqui. */
  if(curso && estado.viewAtual === "admin-curso-editor" && estado.cursoEditando === curso) renderAdminCursoEditor(curso);
}

async function carregarAcessoDoCurso(){
  if(!acessoAberto) return;
  const curso = acessoAberto.curso;
  try {
    const dados = await AcessoDoCurso.ler(curso);
    if(!acessoAberto || acessoAberto.curso !== curso) return;
    acessoAberto.dados = dados;
    desenharAcessoDoCurso();
  } catch(erro){
    const caixa = document.querySelector("#acesso-overlay .drawer");
    if(!caixa) return;
    caixa.innerHTML = `<div class="drawer-body"><div class="empty-note">${textoSeguro(erro.message || "Não foi possível ler quem tem acesso.")}</div>
      <button class="btn btn-secondary" type="button" data-fechar-acesso>Fechar</button></div>`;
    caixa.querySelector("[data-fechar-acesso]").addEventListener("click", () => fecharAcessoDoCurso());
  }
}

function origemDoAcesso(p){
  return ORIGENS_DO_ACESSO[p.origem] || "Dado à mão";
}

function desenharAcessoDoCurso(){
  const caixa = document.querySelector("#acesso-overlay .drawer");
  if(!caixa || !acessoAberto || !acessoAberto.dados) return;
  const d = acessoAberto.dados;
  const c = cursoPorId(acessoAberto.curso);
  if(!c){ fecharAcessoDoCurso(); return; }
  const abertos = (d.pessoas || []).filter(p => p.ativo);
  const fechados = (d.pessoas || []).filter(p => !p.ativo && !abertos.some(x => x.id === p.id));
  const doPayflow = (d.payflow || []).filter(p => !abertos.some(x => x.id === p.id));
  const assinantes = (d.assinantes || []).filter(p => !abertos.some(x => x.id === p.id));
  const n = alunosComAcesso(d);

  caixa.innerHTML = `
    <div class="drawer-head">
      <div class="membro-topo">
        ${miniaturaDoCurso(c)}
        <div class="membro-quem">
          <h3 id="acesso-titulo">Quem tem acesso</h3>
          <p class="drawer-sub">${textoSeguro(c.titulo)}${d.publicado ? "" : " · Rascunho"}</p>
        </div>
      </div>
      <button class="modal-close" type="button" data-fechar-acesso aria-label="Fechar"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="drawer-body">
      ${d.publicado ? "" : `<p class="membro-aviso" style="margin:0 0 4px">Este curso ainda é rascunho: quem tem acesso só o vê depois de publicado.</p>`}

      <section class="membro-seccao sem-linha">
        <h4>Regra de acesso</h4>
        <div class="papel-opcoes duas" role="radiogroup" aria-label="Regra de acesso">
          <label class="papel-opcao ${d.abertoATodos ? "" : "escolhido"}">
            <input type="radio" name="regra-acesso" value="fechado" ${d.abertoATodos ? "" : "checked"}>
            <span class="papel-nome">Só quem recebeu acesso</span>
            <span class="papel-dica">Por convite, pela compra de uma oferta ou dado aqui.</span>
          </label>
          <label class="papel-opcao ${d.abertoATodos ? "escolhido" : ""}">
            <input type="radio" name="regra-acesso" value="todos" ${d.abertoATodos ? "checked" : ""}>
            <span class="papel-nome">Todos os membros da escola</span>
            <span class="papel-dica">Qualquer aluno ativo o abre, sem mais nada.</span>
          </label>
        </div>
      </section>

      <section class="membro-seccao">
        <div class="seccao-cabeca">
          <h4>Turmas deste curso</h4>
          <button class="btn btn-secondary btn-sm" type="button" data-ir-turmas>Abrir Turmas</button>
        </div>
        <div class="acessos-lista">${(d.turmas || []).map(linhaDaTurmaDoCurso).join("")}</div>
      </section>

      <section class="membro-seccao">
        <div class="seccao-cabeca">
          <h4>Ofertas que vendem este curso</h4>
          <button class="btn btn-secondary btn-sm" type="button" data-ir-ofertas>Abrir Ofertas</button>
        </div>
        ${(d.ofertas || []).length ? `<div class="acessos-lista">${d.ofertas.map(linhaDaOfertaDoCurso).join("")}</div>`
          : `<p class="hint">Nenhuma oferta abre este curso. Para o vender, crie uma oferta e escolha-o nela.</p>`}
      </section>

      <section class="membro-seccao">
        <div class="seccao-cabeca">
          <h4>Pessoas com acesso <span class="conta-suave">${d.abertoATodos ? d.alunosAtivos : n}</span></h4>
          <button class="btn btn-secondary btn-sm" type="button" data-abrir-dar aria-expanded="${!!acessoAberto.form}">Dar acesso</button>
        </div>
        ${d.abertoATodos ? `<p class="hint">Aberto a todos: ${plural(d.alunosAtivos, "aluno ativo abre", "alunos ativos abrem")} este curso. Abaixo está quem tem um acesso próprio, que fica se o curso voltar a fechar.</p>` : ""}
        ${acessoAberto.form ? formularioDarAcessoAoCurso(d) : ""}
        ${abertos.length > 8 ? `<div class="search-pill acesso-busca">
            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="acesso-busca" placeholder="Procurar por nome ou email" aria-label="Procurar nas pessoas com acesso"></div>` : ""}
        <div class="acessos-lista" id="acesso-pessoas">
          ${abertos.map(linhaDaPessoaComAcesso).join("")}
          ${assinantes.map(linhaDaPessoaPelaAssinatura).join("")}
          ${doPayflow.map(linhaDaPessoaPeloPayflow).join("")}
          ${!abertos.length && !doPayflow.length && !assinantes.length ? `<div class="empty-note">${d.abertoATodos ? "Ninguém tem um acesso próprio." : "Ainda ninguém recebeu acesso a este curso."}</div>` : ""}
        </div>
        <p class="hint" style="margin:10px 0 0">A equipa (${plural(d.equipa, "pessoa", "pessoas")}) vê todos os cursos da escola.${
          d.ilimitados && d.publicado ? ` ${plural(d.ilimitados, "membro com acesso ilimitado também o abre", "membros com acesso ilimitado também o abrem")}.` : ""}</p>
        ${fechados.length ? `
          <details class="acessos-fechados">
            <summary>Acessos fechados (${fechados.length})</summary>
            ${fechados.map(linhaDaPessoaFechada).join("")}
          </details>` : ""}
      </section>

      <section class="membro-seccao">
        <div class="seccao-cabeca">
          <h4>Convites por aceitar <span class="conta-suave">${(d.convites || []).length}</span></h4>
          <button class="btn btn-secondary btn-sm" type="button" data-convidar>Convidar</button>
        </div>
        ${(d.convites || []).length ? `<div class="acessos-lista">${d.convites.map(linhaDoConviteDoCurso).join("")}</div>`
          : `<p class="hint">Nenhum convite à espera inclui este curso.</p>`}
      </section>
    </div>`;
  ligarAcessoDoCurso(caixa, d);
}

function avatarDaPessoa(p){
  return `<span class="avatar-iniciais" style="--c:${corDaPessoa(p.email)}" aria-hidden="true">${textoSeguro(iniciais(p.nome || p.email || "?"))}</span>`;
}

function linhaDaTurmaDoCurso(t){
  return `
    <div class="acesso-linha" data-turma-do-curso="${t.id}">
      <div class="acesso-info">
        <div class="nome">${textoSeguro(t.nome)}</div>
        <div class="sub-celula">${plural(t.membros, "membro", "membros")} · Acesso ${prazoDaTurmaEmTexto(t)}</div>
      </div>
      ${t.padrao ? `<span class="pill pill-ativo">Padrão</span>` : ""}
    </div>`;
}

/* Quem abre o curso por uma assinatura: trata-se na ficha da pessoa (ou no
   nível), não aqui. */
function linhaDaPessoaPelaAssinatura(p){
  const variasTurmas = ((acessoAberto.dados || {}).turmas || []).length > 1;
  const turma = variasTurmas ? (((acessoAberto.dados.turmas || []).find(t => t.id === p.turma) || {}).nome || "") : "";
  const quem = textoSeguro(p.nome || p.email || "");
  return `
    <div class="acesso-linha" data-pessoa="${p.id}" data-pela-assinatura="${p.nivel}" data-procura="${textoSeguro(((p.nome || "") + " " + (p.email || "")).toLowerCase())}">
      ${avatarDaPessoa(p)}
      <div class="acesso-info">
        <div class="nome"><button class="link-pessoa" type="button" data-ver-membro="${p.id}">${quem}</button>${
          p.suspenso ? ` <span class="pill pill-quente">Suspenso</span>` : p.papel !== "aluno" ? ` <span class="pill pill-teste">Equipa</span>` : ""}</div>
        <div class="sub-celula">${[textoSeguro(p.email || ""), turma ? textoSeguro(turma) : "", "Assinatura " + textoSeguro(p.nivelNome || ""),
          p.expira ? "Até " + dataLegivel(p.expira) : "Sem prazo"].filter(Boolean).join(" · ")}</div>
      </div>
      <span class="cartao-etiqueta" title="Este acesso vem de uma assinatura e trata-se na ficha da pessoa.">Assinatura</span>
    </div>`;
}

function linhaDaPessoaComAcesso(p){
  const prazo = p.expira ? "Até " + dataLegivel(p.expira) : "Sem prazo";
  const variasTurmas = ((acessoAberto.dados || {}).turmas || []).length > 1;
  const turma = variasTurmas ? (((acessoAberto.dados.turmas || []).find(t => t.id === p.turma) || {}).nome || "") : "";
  const quem = textoSeguro(p.nome || p.email || "");
  const editando = acessoAberto.prazo === p.id;
  return `
    <div class="acesso-linha" data-pessoa="${p.id}" data-procura="${textoSeguro(((p.nome || "") + " " + (p.email || "")).toLowerCase())}">
      ${avatarDaPessoa(p)}
      <div class="acesso-info">
        <div class="nome"><button class="link-pessoa" type="button" data-ver-membro="${p.id}">${quem}</button>${
          p.suspenso ? ` <span class="pill pill-quente">Suspenso</span>` : p.papel !== "aluno" ? ` <span class="pill pill-teste">Equipa</span>` : ""}</div>
        <div class="sub-celula">${[textoSeguro(p.email || ""), turma ? textoSeguro(turma) : "", textoSeguro(origemDoAcesso(p)), prazo].filter(Boolean).join(" · ")}</div>
      </div>
      <div class="acoes-linha">
        <button class="btn-icone" type="button" data-prazo-pessoa="${p.id}" title="Mudar o prazo" aria-label="Mudar o prazo de ${quem}">${ICONE_PRAZO}</button>
        <button class="btn-icone perigo" type="button" data-tirar-pessoa="${p.id}" title="Tirar o acesso" aria-label="Tirar o acesso a ${quem}">${ICONE_TIRAR}</button>
      </div>
      ${editando ? `
        <div class="acesso-prazo">
          <label for="prazo-pessoa-${p.id}">Acesso até</label>
          <input type="date" id="prazo-pessoa-${p.id}" min="${hojeISO()}" value="${p.expira || ""}">
          <button class="btn btn-primary btn-sm" type="button" data-guardar-prazo-pessoa="${p.id}">Guardar</button>
          <button class="btn btn-secondary btn-sm" type="button" data-sem-prazo-pessoa="${p.id}">Sem prazo</button>
        </div>` : ""}
    </div>`;
}

function linhaDaPessoaPeloPayflow(p){
  return `
    <div class="acesso-linha" data-procura="${textoSeguro(((p.nome || "") + " " + (p.email || "")).toLowerCase())}">
      ${avatarDaPessoa(p)}
      <div class="acesso-info">
        <div class="nome"><button class="link-pessoa" type="button" data-ver-membro="${p.id}">${textoSeguro(p.nome || p.email || "")}</button></div>
        <div class="sub-celula">${textoSeguro(p.email || "")} · Inscrição no Payflow</div>
      </div>
      <span class="cartao-etiqueta" title="Este acesso vem de uma inscrição no Payflow e trata-se lá.">Payflow</span>
    </div>`;
}

function linhaDaPessoaFechada(p){
  return `
    <div class="acesso-linha fechado">
      ${avatarDaPessoa(p)}
      <div class="acesso-info">
        <div class="nome">${textoSeguro(p.nome || p.email || "")}</div>
        <div class="sub-celula">${textoSeguro(p.email || "")} · ${p.estado === "pendente" ? "Pendente"
          : p.estado === "expirado" ? "Expirou a " + dataLegivel(p.expira)
          : p.expira ? "Fechado desde " + dataLegivel(p.expira) : "Desativada"}</div>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" data-reabrir-pessoa="${p.id}">Abrir outra vez</button>
    </div>`;
}

function linhaDaOfertaDoCurso(o){
  const falta = !o.ativa ? "Desligada" : !o.produtos ? "Sem produto ligado: uma compra não abre o curso sozinha" : "";
  return `
    <div class="acesso-linha">
      <div class="acesso-info">
        <div class="nome">${textoSeguro(o.nome)}</div>
        <div class="sub-celula">${[formatarPreco(Number(o.preco) || 0, o.moeda), "Acesso " + prazoDaOfertaEmTexto(o.dias), falta].filter(Boolean).join(" · ")}</div>
      </div>
      <span class="pill ${o.ativa && o.naVitrine ? "pill-ativo" : "pill-inativo"}">${o.ativa && o.naVitrine ? "Na Vitrine" : "Fora da Vitrine"}</span>
    </div>`;
}

function linhaDoConviteDoCurso(v){
  const horas = (new Date(v.expiraEm) - Date.now()) / 36e5;
  const expira = horas < 24 ? "Expira hoje" : `Expira em ${plural(Math.ceil(horas / 24), "dia", "dias")}`;
  return `
    <div class="acesso-linha">
      ${avatarDaPessoa(v)}
      <div class="acesso-info">
        <div class="nome">${textoSeguro(v.nome || v.email)}</div>
        <div class="sub-celula">${[v.nome ? textoSeguro(v.email) : "", v.origem === "pagamento" ? "Compra" : "Convite", expira,
          v.acessoDias ? "Acesso " + prazoDaOfertaEmTexto(v.acessoDias) : ""].filter(Boolean).join(" · ")}</div>
      </div>
    </div>`;
}

/* Dar acesso: os alunos da escola que ainda não o têm. Quem ainda não é
   membro entra por convite. */
function formularioDarAcessoAoCurso(d){
  const jaTem = new Set([...(d.pessoas || []).filter(p => p.ativo).map(p => p.id), ...(d.assinantes || []).map(p => p.id), ...(d.payflow || []).map(p => p.id)]);
  const candidatos = (DB.membros || []).filter(m => funcaoDe(m) === "aluno" && !jaTem.has(m.id))
    .sort((x, y) => (x.nome || x.email || "").localeCompare(y.nome || y.email || ""));
  return `
    <div class="membro-form" id="form-dar-acesso">
      ${candidatos.length ? `
        ${candidatos.length > 4 ? `<input type="search" class="acesso-filtro" id="dar-acesso-busca" placeholder="Procurar um membro" aria-label="Procurar um membro">` : ""}
        <div class="checklist checklist-cartoes" id="dar-acesso-lista">
          ${candidatos.map(m => `
            <label class="checklist-item checklist-cartao" data-procura="${textoSeguro(((m.nome || "") + " " + (m.email || "")).toLowerCase())}">
              <input type="checkbox" value="${m.id}">
              ${miniaturaDoCartao({ iniciais:iniciais(m.nome || m.email || "?"), cor:corDaPessoa(m.email) })}
              <span class="cartao-nome">${textoSeguro(m.nome || m.email)}<span class="sub-celula" style="display:block">${textoSeguro(m.email || "")}</span></span>
              ${m.acesso !== "ativo" ? `<span class="cartao-etiqueta">Suspenso</span>` : ""}
            </label>`).join("")}
        </div>` : `<div class="empty-note">Todos os alunos da escola já têm este curso.</div>`}
      <p class="hint" style="margin:10px 0 0">A pessoa ainda não é membro? <button class="btn-texto-link" type="button" data-convidar>Convide-a por email</button>, já com este curso.</p>
      <div class="membro-form-pe">
        ${(d.turmas || []).length > 1 ? `<label class="field-rotulo" for="dar-acesso-turma">Turma</label>
          <div class="select-wrap"><select id="dar-acesso-turma">${d.turmas.map(t => `<option value="${t.id}" ${t.padrao ? "selected" : ""}>${textoSeguro(t.nome)}</option>`).join("")}</select></div>` : ""}
        <label class="field-rotulo" for="dar-acesso-prazo">Prazo</label>
        <div class="select-wrap"><select id="dar-acesso-prazo">${PRAZOS_DE_ACESSO.map(p => `<option value="${p.valor}">${p.rotulo}</option>`).join("")}</select></div>
        <button class="btn btn-secondary btn-sm" type="button" data-abrir-dar>Cancelar</button>
        ${candidatos.length ? `<button class="btn btn-primary btn-sm" type="button" data-dar-acesso>Dar acesso</button>` : ""}
      </div>
    </div>`;
}

/* Uma ação: corre, relê, redesenha e diz o que aconteceu. */
async function acaoNoAcessoDoCurso(fazer, mensagem){
  const curso = acessoAberto && acessoAberto.curso;
  document.querySelectorAll("#acesso-overlay button").forEach(b => b.disabled = true);
  try {
    const resposta = await fazer();
    await GestaoDeMembros.recarregar();
    if(acessoAberto && acessoAberto.curso === curso){
      acessoAberto.form = false; acessoAberto.prazo = null;
      await carregarAcessoDoCurso();
    }
    const texto = typeof mensagem === "function" ? mensagem(resposta) : mensagem;
    if(texto) mostrarToast(texto);
  } catch(erro){
    mostrarToast(erro.message || "Não foi possível fazer isto agora.");
    desenharAcessoDoCurso();
  }
}

function ligarAcessoDoCurso(caixa, d){
  const cursoId = acessoAberto.curso;
  const curso = cursoPorId(cursoId);
  const pessoa = id => (d.pessoas || []).find(p => p.id === id) || {};
  const nomeDe = id => pessoa(id).nome || pessoa(id).email || "esta pessoa";
  const redesenhar = () => desenharAcessoDoCurso();

  caixa.querySelectorAll("[data-fechar-acesso]").forEach(b => b.addEventListener("click", () => fecharAcessoDoCurso()));

  /* A regra: abrir a todos pede confirmação, porque abre a muita gente de uma vez. */
  caixa.querySelectorAll('input[name="regra-acesso"]').forEach(r => r.addEventListener("change", () => {
    const abrir = r.value === "todos";
    if(abrir === !!d.abertoATodos) return;
    const mudar = () => acaoNoAcessoDoCurso(async () => {
      curso.abertoATodos = abrir;
      await salvar("curso", curso);
    }, abrir ? "O curso fica aberto a todos os membros da escola" : "O curso volta a abrir só a quem recebeu acesso");
    if(!abrir){ mudar(); return; }
    redesenhar();
    confirmarAcao({
      titulo: "Abrir a todos os membros",
      mensagem: `${plural(d.alunosAtivos, "aluno ativo da escola passa", "alunos ativos da escola passam")} a abrir «${textoSeguro(curso.titulo)}», sem convite nem compra. Quem entrar na escola depois também.`,
      textoConfirmar: "Abrir a todos",
      aoConfirmar: mudar
    });
  }));

  caixa.querySelectorAll("[data-ir-turmas]").forEach(b => b.addEventListener("click", () => { fecharAcessoDoCurso(true); irPara("admin-turmas"); }));
  caixa.querySelectorAll("[data-ir-ofertas]").forEach(b => b.addEventListener("click", () => { fecharAcessoDoCurso(true); irPara("admin-ofertas"); }));
  caixa.querySelectorAll("[data-convidar]").forEach(b => b.addEventListener("click", () => {
    fecharAcessoDoCurso(true);
    criarConvite({ cursos:[cursoId] });
  }));
  caixa.querySelectorAll("[data-ver-membro]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-ver-membro");
    fecharAcessoDoCurso(true);
    abrirMembro(id);
  }));

  caixa.querySelectorAll("[data-abrir-dar]").forEach(b => b.addEventListener("click", () => {
    acessoAberto.form = !acessoAberto.form; acessoAberto.prazo = null; redesenhar();
  }));
  const filtrar = (campo, seletor) => {
    if(!campo) return;
    campo.addEventListener("input", () => {
      const q = campo.value.trim().toLowerCase();
      caixa.querySelectorAll(seletor).forEach(el => { el.hidden = !!q && !(el.getAttribute("data-procura") || "").includes(q); });
    });
  };
  filtrar(caixa.querySelector("#dar-acesso-busca"), "#dar-acesso-lista [data-procura]");
  filtrar(caixa.querySelector("#acesso-busca"), "#acesso-pessoas [data-procura]");

  const dar = caixa.querySelector("[data-dar-acesso]");
  if(dar) dar.addEventListener("click", () => {
    const ids = [...caixa.querySelectorAll("#dar-acesso-lista input:checked")].map(i => i.value);
    if(!ids.length){ mostrarToast("Escolha pelo menos uma pessoa"); return; }
    const prazo = caixa.querySelector("#dar-acesso-prazo").value;
    const turma = (caixa.querySelector("#dar-acesso-turma") || {}).value || null;
    const expira = dataDaquiA(prazo);
    acaoNoAcessoDoCurso(async () => {
        for(const id of ids){
          /* Numa turma escolhida, ou com o prazo dela, é uma matrícula; senão, o acesso de sempre. */
          if(prazo === "turma" || turma) await GestaoDeMembros.matricula(id, cursoId, { turma, estado:"ativo", prazoDaTurma:prazo === "turma", expira });
          else await GestaoDeMembros.darCursos(id, [cursoId], expira);
        }
      },
      ids.length === 1 ? "Acesso dado" : `Acesso dado a ${ids.length} pessoas`);
  });

  caixa.querySelectorAll("[data-prazo-pessoa]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-prazo-pessoa");
    acessoAberto.prazo = acessoAberto.prazo === id ? null : id; acessoAberto.form = false; redesenhar();
  }));
  caixa.querySelectorAll("[data-guardar-prazo-pessoa]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-guardar-prazo-pessoa");
    const data = caixa.querySelector(`#prazo-pessoa-${CSS.escape(id)}`).value;
    if(!data){ mostrarToast("Escolha uma data, ou «Sem prazo»"); return; }
    acaoNoAcessoDoCurso(() => GestaoDeMembros.prazo(id, cursoId, data), "Prazo guardado");
  }));
  caixa.querySelectorAll("[data-sem-prazo-pessoa]").forEach(b => b.addEventListener("click", () =>
    acaoNoAcessoDoCurso(() => GestaoDeMembros.prazo(b.getAttribute("data-sem-prazo-pessoa"), cursoId, null), "O acesso fica sem prazo")));

  caixa.querySelectorAll("[data-tirar-pessoa]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-tirar-pessoa");
    confirmarAcao({
      titulo: "Tirar o acesso",
      mensagem: `${textoSeguro(nomeDe(id))} deixa de abrir «${textoSeguro(curso.titulo)}»${d.abertoATodos ? " quando o curso voltar a fechar (hoje está aberto a todos)" : ""}. O progresso fica guardado.`,
      textoConfirmar: "Tirar",
      aoConfirmar: () => acaoNoAcessoDoCurso(() => GestaoDeMembros.tirarCursos(id, [cursoId]),
        r => "Acesso tirado." + (typeof avisoDoPayflow === "function" ? avisoDoPayflow(r) : ""))
    });
  }));
  caixa.querySelectorAll("[data-reabrir-pessoa]").forEach(b => b.addEventListener("click", () =>
    acaoNoAcessoDoCurso(() => GestaoDeMembros.darCursos(b.getAttribute("data-reabrir-pessoa"), [cursoId], null), "Acesso aberto outra vez")));
}
