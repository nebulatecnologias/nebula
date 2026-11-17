/* ============================================================
   Administração › Assinaturas

   Um NÍVEL de assinatura leva vários cursos, cada um numa turma. A
   ASSINATURA de um membro liga-o a um nível, com um estado e uma data de
   expiração só: é uma ligação viva. Pôr um curso no nível abre-o a todos os
   assinantes; tirá-lo fecha-o. (Especificação do Shelton, 17/11/2026,
   passo 3. Substitui os Planos, que eram um pacote copiado para cada
   membro.)

   Aqui ficam os níveis: a lista e a edição. A assinatura de cada pessoa
   trata-se na ficha do membro. As regras (quem pode, não excluir com
   membros dentro) são da base, que responde em português.
   ============================================================ */

const NIVEIS_POR_PAGINA = 10;
const ESTADOS_DA_ASSINATURA_DO_MEMBRO = { ativo:"Ativada", pendente:"Pendente", expirado:"Expirada", desativado:"Desativada" };

function nivelPorId(id){ return (DB.niveis || []).find(n => n.id === id); }

/* O estado que se mostra: uma ativa com a data passada é uma expirada. */
function estadoDaAssinatura(s){
  if(!s || !s.estado) return "";
  return s.estado === "ativo" && s.expira && s.expira < hojeISO() ? "expirado" : s.estado;
}
function assinaturaAtiva(s){ return estadoDaAssinatura(s) === "ativo"; }

/* Os cursos que um nível leva, com a turma de cada um: só os que existem.
   Se a turma escolhida já não existir, vale a padrão do curso. */
function cursosDoNivel(n){
  return ((n && n.turmas) || []).filter(x => DB.cursos.some(c => c.id === x.cursoId)).map(x => {
    const t = turmaPorId(x.turmaId);
    return { cursoId:x.cursoId, turmaId: t && t.cursoId === x.cursoId ? t.id : ((turmaPadraoDe(x.cursoId) || {}).id || null) };
  });
}

/* As assinaturas de um membro da lista. Na demonstração estão no próprio
   membro (nascem do nível com que foi criado); com servidor leem-se da base. */
function assinaturasDoMembro(m){
  if(!m) return [];
  if(modoDemonstracao()){
    if(!Array.isArray(m.assinaturas))
      m.assinaturas = nivelPorId(m.nivelId) ? [{ nivel:m.nivelId, estado:"ativo", expira:null, desde:m.membroDesde || hojeISO() }] : [];
    return m.assinaturas;
  }
  return (DB.assinaturas || []).filter(s => s.utilizador === m.id);
}
function membroIlimitado(m){
  if(!m) return false;
  return modoDemonstracao() ? m.ilimitado === true : (DB.ilimitados || []).includes(m.id);
}

/* Por onde uma pessoa abre cada curso (decisão 3 do plano): a matrícula
   própria ativa vale mais; entre assinaturas, a que começou primeiro. Recebe
   as matrículas e as assinaturas, da ficha ou do membro de demonstração. */
function viasDeAcesso(acessos, assinaturas){
  const vias = (acessos || []).filter(a => a.ativo).map(a =>
    ({ curso:a.curso, via:"matricula", turma:a.turma || null, desde:a.desde || null, expira:a.expira || null }));
  (assinaturas || []).filter(assinaturaAtiva).slice()
    .sort((x, y) => String(x.desde || "").localeCompare(String(y.desde || "")))
    .forEach(s => cursosDoNivel(nivelPorId(s.nivel)).forEach(x => {
      if(!vias.some(v => v.curso === x.cursoId))
        vias.push({ curso:x.cursoId, via:"assinatura", turma:x.turmaId, desde:s.desde || null, expira:s.expira || null, nivel:s.nivel });
    }));
  return vias;
}

/* Quantos membros têm cada nível ativo e pendente. */
function numerosDoNivel(n){
  let ativos = 0, pendentes = 0;
  (DB.membros || []).forEach(m => {
    const s = assinaturasDoMembro(m).find(x => x.nivel === n.id);
    const e = estadoDaAssinatura(s);
    if(e === "ativo") ativos++; else if(e === "pendente") pendentes++;
  });
  return { ativos, pendentes };
}

function prazoEmDias(n){ return n ? `${n} ${n === 1 ? "dia" : "dias"}` : "-"; }

/* ============================================================
   A lista
   ============================================================ */
function renderAdminAssinaturas(){
  const todos = (DB.niveis || []).slice().sort((x, y) => String(y.criadoEm || "").localeCompare(String(x.criadoEm || "")));
  const busca = (estado.buscaAssinaturas || "").trim().toLowerCase();
  const lista = todos.filter(n => !busca || (n.nome || "").toLowerCase().includes(busca));
  const paginas = Math.max(1, Math.ceil(lista.length / NIVEIS_POR_PAGINA));
  const pagina = Math.min(Math.max(1, estado.paginaAssinaturas || 1), paginas);
  const visiveis = lista.slice((pagina - 1) * NIVEIS_POR_PAGINA, pagina * NIVEIS_POR_PAGINA);

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Assinaturas",
      descricao: "Uma assinatura abre vários cursos de uma vez, cada um numa turma. Quem a tem abre-os enquanto ela estiver ativa.",
      acaoRotulo: "Nova assinatura",
      acaoId: "btn-nova-assinatura"
    })}
    <div class="card table-card convites-card">
      <div class="convites-barra">
        <span class="count">${todos.length} ${todos.length === 1 ? "assinatura" : "assinaturas"}</span>
        <div class="search-pill convites-busca">
          <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="search" id="assinaturas-busca" placeholder="Pesquisar assinatura" aria-label="Pesquisar assinatura" value="${textoSeguro(estado.buscaAssinaturas || "").replace(/"/g, "&quot;")}">
        </div>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table niveis-tabela">
          <thead><tr><th>Nome</th><th>Trial gratuito</th><th>Membros ativos</th><th>Membros pendentes</th><th>Data de criação</th><th><span class="so-leitor">Ações</span></th></tr></thead>
          <tbody>
            ${visiveis.length ? visiveis.map(linhaDoNivel).join("")
              : `<tr><td colspan="6"><div class="empty-note">${todos.length ? "Nenhuma assinatura com esse nome."
                  : "Ainda não há assinaturas. Uma assinatura junta vários cursos e abre-os a quem a tiver ativa."}</div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginas > 1 ? `<nav class="paginacao" aria-label="Páginas de assinaturas">
          <button class="btn btn-secondary btn-sm" type="button" data-pagina="${pagina - 1}" ${pagina === 1 ? "disabled" : ""}>Anterior</button>
          ${Array.from({ length:paginas }, (_, i) => `<button class="btn btn-sm ${i + 1 === pagina ? "btn-primary" : "btn-secondary"}" type="button" data-pagina="${i + 1}" ${i + 1 === pagina ? 'aria-current="page"' : ""}>${i + 1}</button>`).join("")}
          <button class="btn btn-secondary btn-sm" type="button" data-pagina="${pagina + 1}" ${pagina === paginas ? "disabled" : ""}>Próximo</button>
        </nav>` : ""}
    </div>
  `;

  document.getElementById("btn-nova-assinatura").addEventListener("click", () => irPara("admin-assinatura", "nova"));
  const campo = document.getElementById("assinaturas-busca");
  campo.addEventListener("input", () => {
    estado.buscaAssinaturas = campo.value; estado.paginaAssinaturas = 1;
    const pos = campo.selectionStart;
    renderAdminAssinaturas();
    const outro = document.getElementById("assinaturas-busca");
    outro.focus(); outro.setSelectionRange(pos, pos);
  });
  document.querySelectorAll("#content-admin [data-pagina]").forEach(b => b.addEventListener("click", () => {
    estado.paginaAssinaturas = Number(b.getAttribute("data-pagina")); renderAdminAssinaturas(); window.scrollTo(0, 0);
  }));
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => irPara("admin-assinatura", b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarNivel(nivelPorId(b.getAttribute("data-apagar")))));
  document.querySelectorAll("#content-admin [data-membros-do-nivel]").forEach(b => b.addEventListener("click", () => {
    estado.filtroAssinatura = { nivel:b.getAttribute("data-membros-do-nivel"), estado:b.getAttribute("data-estado") };
    estado.filtroMembros = "todos"; estado.buscaMembros = "";
    irPara("admin-membros");
  }));
}

function linhaDoNivel(n){
  const x = numerosDoNivel(n);
  const cursos = cursosDoNivel(n).map(c => (DB.cursos.find(k => k.id === c.cursoId) || {}).titulo).filter(Boolean);
  const membros = (quantos, est) => quantos
    ? `<button class="link-pessoa" type="button" data-membros-do-nivel="${n.id}" data-estado="${est}">${quantos} ${quantos === 1 ? "membro" : "membros"} →</button>`
    : `<span class="sub-celula">0 membros</span>`;
  return `<tr data-nivel="${n.id}">
    <td><div class="nome" style="font-weight:500;">${textoSeguro(n.nome)}</div>
        <div class="sub-celula">${cursos.length ? cursos.map(textoSeguro).join(" · ") : "sem cursos: ainda não abre nada"}</div></td>
    <td>${prazoEmDias(n.trialDias)}</td>
    <td>${membros(x.ativos, "ativo")}</td>
    <td>${membros(x.pendentes, "pendente")}</td>
    <td class="num">${dataLegivel(String(n.criadoEm || "").slice(0, 10))}</td>
    <td>${acoesLinha(n.id)}</td>
  </tr>`;
}

/* ============================================================
   Criar e editar um nível
   ============================================================ */
function renderAdminAssinatura(id){
  if(id) estado.nivelEditando = id;
  const novo = estado.nivelEditando === "nova";
  const n = novo ? { id:null, nome:"", trialDias:null, extensaoDias:null, turmas:[] } : nivelPorId(estado.nivelEditando);
  if(!n){ irPara("admin-assinaturas"); return; }
  const dentro = new Map(cursosDoNivel(n).map(x => [x.cursoId, x.turmaId]));
  const x = novo ? { ativos:0, pendentes:0 } : numerosDoNivel(n);
  const atributo = v => textoSeguro(v === null || v === undefined ? "" : v).replace(/"/g, "&quot;");

  document.getElementById("content-admin").innerHTML = `
    <div class="back-link" id="btn-voltar-assinaturas"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Voltar a Assinaturas</div>
    <div class="gestao-head">
      <div>
        <h2>${novo ? "Nova assinatura" : "Editar assinatura"}</h2>
        <p>${novo ? "Dê-lhe um nome e escolha os cursos que abre." : `${x.ativos} ${x.ativos === 1 ? "membro ativo" : "membros ativos"}${x.pendentes ? ` · ${x.pendentes} ${x.pendentes === 1 ? "pendente" : "pendentes"}` : ""}`}</p>
      </div>
    </div>

    <div class="card painel turma-form">
      <h3 class="nivel-titulo">Detalhes da assinatura</h3>
      <div class="field">
        <label for="nivel-nome">Nome</label>
        <input id="nivel-nome" maxlength="120" placeholder="ex.: Platinum" value="${atributo(n.nome)}">
      </div>
      <div class="nivel-prazos">
        <div class="field">
          <label for="nivel-trial">Trial gratuito</label>
          <div class="campo-com-sufixo"><input id="nivel-trial" type="number" min="1" max="36500" inputmode="numeric" value="${atributo(n.trialDias)}" placeholder="Sem trial"><span>dias</span></div>
          <p class="hint">Os dias de experiência de quem a recebe sem pagar. Vazio, não há trial.</p>
        </div>
        <div class="field">
          <label for="nivel-extensao">Extensão de acesso</label>
          <div class="campo-com-sufixo"><input id="nivel-extensao" type="number" min="1" max="36500" inputmode="numeric" value="${atributo(n.extensaoDias)}" placeholder="Sem prazo"><span>dias</span></div>
          <p class="hint">Os dias que cada compra ou renovação acrescenta. Vazio, a assinatura não tem prazo.</p>
        </div>
      </div>
    </div>

    <div class="card painel turma-form nivel-conteudos">
      <h3 class="nivel-titulo">Conteúdos</h3>
      <p class="hint">Escolha os cursos que esta assinatura abre e a turma de cada um. A turma é a que define quando as aulas abrem para os assinantes.</p>
      ${DB.cursos.length ? `<div class="nivel-cursos" id="nivel-cursos">
        ${DB.cursos.map(c => {
          const turmas = turmasDoCurso(c.id);
          const marcado = dentro.has(c.id);
          const escolhida = dentro.get(c.id) || (turmaPadraoDe(c.id) || {}).id;
          return `<div class="nivel-curso ${marcado ? "marcado" : ""}" data-nivel-linha="${c.id}">
            <label class="nivel-curso-quem">
              <input type="checkbox" data-nivel-curso="${c.id}" ${marcado ? "checked" : ""}>
              ${miniaturaDoCurso(c)}
              <span class="cartao-nome">${textoSeguro(c.titulo)}${c.publicado === false ? ` <span class="cartao-etiqueta">Rascunho</span>` : ""}</span>
            </label>
            <div class="select-wrap"><select data-nivel-turma="${c.id}" aria-label="Turma de ${atributo(c.titulo)}" ${marcado ? "" : "disabled"}>
              ${turmas.map(t => `<option value="${t.id}" ${t.id === escolhida ? "selected" : ""}>${textoSeguro(t.nome)}</option>`).join("")}
            </select></div>
          </div>`;
        }).join("")}
      </div>` : `<div class="empty-note">Ainda não há cursos. Crie-os em Conteúdos e volte aqui para os pôr na assinatura.</div>`}
    </div>

    <div class="turma-rodape turma-form">
      ${novo ? "" : `<button class="btn btn-perigo-suave" type="button" id="nivel-apagar">Excluir</button>`}
      <span class="turma-rodape-fim">
        <button class="btn btn-secondary" type="button" id="nivel-cancelar">Cancelar</button>
        <button class="btn btn-primary" type="button" id="nivel-guardar">Salvar</button>
      </span>
    </div>
  `;

  const voltar = () => irPara("admin-assinaturas");
  document.getElementById("btn-voltar-assinaturas").addEventListener("click", voltar);
  document.getElementById("nivel-cancelar").addEventListener("click", voltar);
  document.querySelectorAll("#content-admin [data-nivel-curso]").forEach(caixa => caixa.addEventListener("change", () => {
    const id = caixa.getAttribute("data-nivel-curso");
    document.querySelector(`[data-nivel-linha="${id}"]`).classList.toggle("marcado", caixa.checked);
    document.querySelector(`[data-nivel-turma="${id}"]`).disabled = !caixa.checked;
  }));
  document.getElementById("nivel-guardar").addEventListener("click", () => guardarNivel(n));
  const apagar = document.getElementById("nivel-apagar");
  if(apagar) apagar.addEventListener("click", () => apagarNivel(n));
}

async function guardarNivel(n){
  const nome = document.getElementById("nivel-nome").value.trim();
  const dias = (id, oQue) => {
    const bruto = document.getElementById(id).value.trim();
    if(bruto === "") return null;
    const v = Number(bruto);
    if(!Number.isInteger(v) || v < 1 || v > 36500){ mostrarToast(`${oQue} é um número de dias, a partir de 1. Vazio é sem ${oQue === "O trial" ? "trial" : "prazo"}.`); return false; }
    return v;
  };
  if(!nome){ mostrarToast("Dê um nome à assinatura."); document.getElementById("nivel-nome").focus(); return; }
  const trialDias = dias("nivel-trial", "O trial");
  if(trialDias === false) return;
  const extensaoDias = dias("nivel-extensao", "A extensão");
  if(extensaoDias === false) return;
  const turmas = [...document.querySelectorAll("#content-admin [data-nivel-curso]:checked")].map(caixa => {
    const cursoId = caixa.getAttribute("data-nivel-curso");
    return { cursoId, turmaId:document.querySelector(`[data-nivel-turma="${cursoId}"]`).value };
  });
  const botao = document.getElementById("nivel-guardar");
  botao.disabled = true;
  try {
    if(modoDemonstracao()){
      DB.niveis = DB.niveis || [];
      if(n.id) Object.assign(nivelPorId(n.id), { nome, trialDias, extensaoDias, turmas });
      else DB.niveis.push({ id:novoId("nivel"), nome, trialDias, extensaoDias, turmas, criadoEm:new Date().toISOString() });
      guardarDB();
    } else {
      await API.guardarNivel({ id:n.id, nome, trialDias, extensaoDias, turmas });
      await API.recarregarAssinaturas();
    }
    mostrarToast(n.id ? "Assinatura guardada" : "Assinatura criada");
    irPara("admin-assinaturas");
  } catch(e){
    mostrarToast(e.message || "Não foi possível guardar a assinatura.");
    botao.disabled = false;
  }
}

/* Excluir: com membros ativos ou pendentes, pede-se para onde passam
   (decisão 5 do plano). Sem ninguém, é só confirmar. */
function apagarNivel(n){
  if(!n) return;
  const x = numerosDoNivel(n);
  const dentro = x.ativos + x.pendentes;
  const fazer = async moverPara => {
    try {
      if(modoDemonstracao()){
        if(moverPara) (DB.membros || []).forEach(m => {
          const lista = assinaturasDoMembro(m);
          const s = lista.find(k => k.nivel === n.id);
          if(!s || !["ativo", "pendente"].includes(estadoDaAssinatura(s))) return;
          const d = lista.find(k => k.nivel === moverPara);
          if(!d) lista.push({ nivel:moverPara, estado:s.estado, expira:s.expira, desde:s.desde });
          else if(!assinaturaAtiva(d)) Object.assign(d, { estado:s.estado, expira:s.expira, desde:s.desde });
          s.estado = "desativado";
        });
        DB.niveis = DB.niveis.filter(k => k.id !== n.id);
        guardarDB();
      } else {
        await API.apagarNivel(n.id, moverPara || null);
        await API.recarregarAssinaturas();
      }
      mostrarToast(moverPara ? "Assinatura excluída; os membros passaram para a outra" : "Assinatura excluída");
      irPara("admin-assinaturas");
    } catch(e){ mostrarToast(e.message || "Não foi possível excluir a assinatura."); }
  };

  if(!dentro){
    confirmarAcao({
      titulo: "Excluir assinatura",
      mensagem: `«${textoSeguro(n.nome)}» deixa de existir. Ninguém a tem ativa nem pendente.`,
      textoConfirmar: "Excluir",
      aoConfirmar: () => fazer(null)
    });
    return;
  }
  const quantos = `${dentro} ${dentro === 1 ? "membro tem" : "membros têm"}`;
  const outras = (DB.niveis || []).filter(k => k.id !== n.id);
  if(!outras.length){
    mostrarToast(`${quantos} esta assinatura ativa ou pendente. Crie outra assinatura para onde os passar, ou desative-a na ficha de cada um.`);
    return;
  }
  abrirDrawer({
    titulo: "Excluir assinatura",
    subtitulo: `${quantos} «${textoSeguro(n.nome)}» ativa ou pendente. Para a excluir, passam para outra assinatura, com o estado e a data que têm.`,
    campos: [{ nome:"destino", rotulo:"Passar os membros para", tipo:"select", opcoes:outras.map(k => ({ valor:k.id, rotulo:k.nome })) }],
    valores: { destino:outras[0].id },
    textoGuardar: "Passar e excluir",
    aoGuardar: v => { fecharDrawer(true); fazer(v.destino); return false; }
  });
}

registarViews({
  "admin-assinaturas": renderAdminAssinaturas,
  "admin-assinatura": renderAdminAssinatura
});
