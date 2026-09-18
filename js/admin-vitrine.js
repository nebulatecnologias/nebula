/* ============================================================
   Administração › Vitrine
   Que ofertas o aluno vê à venda dentro da Academia.

   O catálogo é do Payflow: o que uma oferta é, quanto custa e o que entrega
   decide-se lá. O que se decide aqui é outra coisa — se ela APARECE ao aluno.
   São duas perguntas diferentes, e quem as responde nem sempre é a mesma
   pessoa no mesmo dia.

   Por oferta, e não por curso, porque um plano é uma oferta com vários cursos
   lá dentro: mostrar ou esconder o pacote é uma decisão só.

   NADA APARECE SEM SER MANDADO. Uma oferta nova fica escondida até alguém a
   ligar aqui. A Vitrine tem botão de pagar e cobra a sério — uma oferta que
   aparecesse por esquecimento seria uma cobrança que ninguém decidiu.
   ============================================================ */

let ofertasDaVitrine = null;   /* lido do servidor, com os motivos já calculados */

async function renderAdminVitrine(){
  const alvo = document.getElementById("content-admin");
  if(!ofertasDaVitrine && modoDemonstracao()){
    /* Sem servidor, mostra-se a forma do ecrã com o que a demonstração tem. */
    ofertasDaVitrine = (DB.vitrine || []).map(v => ({
      ofertaId: v.ofertaId, nome: v.nome, preco: v.preco, moeda: v.moeda,
      cobranca: v.mensal ? "Recorrente mensal" : "Cobrança única",
      entrega: v.entrega, estado: "Ativa", atalho: "demo", mostrar: true,
      temLinha: true, destaque: v.destaque, chamada: v.chamada, ordem: v.ordem,
      plano: v.entrega === "Plano" ? v.nome : null,
      cursos: v.cursos.map(c => ({ id:c.id, titulo:c.titulo, naVitrine:true, aulas:c.aulas }))
    }));
  }

  if(!ofertasDaVitrine){
    alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Vitrine" })}
      <div class="card"><div class="empty-note">A ler as ofertas…</div></div>`;
    try { ofertasDaVitrine = await API.vitrineDaEquipa(); }
    catch(e){
      alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Vitrine" })}
        <div class="card"><div class="empty-note">Não consegui ler as ofertas: ${e.message}</div></div>`;
      return;
    }
  }

  const lista = ofertasDaVitrine;
  const visiveis = lista.filter(o => o.mostrar && !motivoDeNaoAparecer(o)).length;
  const marcadas = lista.filter(o => o.mostrar).length;

  alvo.innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Vitrine",
      descricao: "O que o aluno vê à venda dentro da Academia. O preço e o que cada oferta "
               + "entrega são do Payflow — aqui escolhe-se só o que aparece."
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.tag}</div>
        <div class="stat-label">A aparecer ao aluno</div><div class="stat-value">${visiveis}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div>
        <div class="stat-label">Marcadas para mostrar</div><div class="stat-value">${marcadas}<span>/ ${lista.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.gear}</div>
        <div class="stat-label">Retidas por algo em falta</div><div class="stat-value">${marcadas - visiveis}</div></div>
    </div>

    <div class="card table-card">
      <div class="table-card-head">
        <h3>Ofertas que entregam conteúdo</h3>
        <span class="count">${lista.length} ${lista.length === 1 ? "oferta" : "ofertas"} · as que entregam um link ou nada não entram aqui</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Oferta</th><th>Entrega</th><th>Preço</th><th>Estado</th><th>Na Vitrine</th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(linhaDaVitrine).join("")
              : `<tr><td colspan="5"><div class="empty-note">Ainda não há ofertas que entreguem conteúdo da Academia. Cria-as no Payflow e liga-as a um curso ou a um plano.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll("#content-admin [data-vitrine]").forEach(el =>
    el.addEventListener("click", () => alternarNaVitrine(el.getAttribute("data-vitrine"))));
}

/* Porque é que esta oferta não chega ao aluno, mesmo estando marcada.
   A ordem é a ordem por que se resolve: primeiro o que se vende, depois o que
   se entrega, e só no fim o caminho para pagar. */
function motivoDeNaoAparecer(o){
  if(o.estado !== "Ativa") return `a oferta está ${o.estado.toLowerCase()} no Payflow`;

  const cursos = o.cursos || [];
  if(!cursos.length){
    return o.entrega === "Plano"
      ? (o.plano ? `o plano "${o.plano}" não tem cursos publicados` : "não tem plano ligado")
      : "não tem curso ligado";
  }

  const naVitrine = cursos.filter(c => c.naVitrine !== false);
  if(!naVitrine.length) return "o conteúdo está escondido da vitrine em Conteúdos";

  const aulas = naVitrine.reduce((s,c) => s + (c.aulas || 0), 0);
  if(!aulas) return "o que entrega ainda não tem nenhuma aula";

  return null;
}

function linhaDaVitrine(o){
  const motivo = motivoDeNaoAparecer(o);
  const cursos = o.cursos || [];
  const aulas = cursos.reduce((s,c) => s + (c.aulas || 0), 0);
  const vazios = cursos.filter(c => !c.aulas).length;

  const entrega = o.entrega === "Plano"
    ? `<div>${o.plano ? `Plano: <b>${o.plano}</b>` : `<span class="sub-celula">sem plano ligado</span>`}</div>
       <div class="sub-celula">${cursos.length} curso${cursos.length===1?"":"s"} · ${aulas} aula${aulas===1?"":"s"}</div>`
    : `<div>${cursos.length ? cursos[0].titulo : `<span class="sub-celula">sem curso ligado</span>`}</div>
       <div class="sub-celula">${aulas} aula${aulas===1?"":"s"}</div>`;

  /* O aviso só faz sentido em quem está marcado: dizer a alguém que uma oferta
     desligada "não aparece" é ruído -- claro que não aparece, foi desligada. */
  const aviso = o.mostrar && motivo
    ? `<div class="erro" style="margin-top:6px">Não aparece: ${motivo}.</div>`
    : (o.mostrar && vazios && cursos.length > 1
        ? `<div class="sub-celula" style="margin-top:6px">Aparece, mas ${vazios} ${vazios===1?"curso está vazio":"cursos estão vazios"} lá dentro.</div>`
        : "");

  const semCaminho = o.mostrar && !motivo && !o.atalho
    ? `<div class="sub-celula" style="margin-top:6px">Sem atalho no Payflow — o botão leva à página de vendas em vez do checkout.</div>`
    : "";

  return `<tr class="${o.mostrar && motivo ? "tint-risco" : ""}">
    <td>
      <div class="nome" style="font-weight:600;">${o.nome}</div>
      ${aviso}${semCaminho}
    </td>
    <td>${entrega}</td>
    <td class="num">${formatarPreco(Number(o.preco)||0)}${o.cobranca === "Recorrente mensal" ? "<div class=\"sub-celula\">por mês</div>" : ""}</td>
    <td><span class="pill ${o.estado === "Ativa" ? "pill-ativo" : "pill-inativo"}">${o.estado}</span></td>
    <td>
      <div class="toggle ${o.mostrar ? "on" : ""}" data-vitrine="${o.ofertaId}" title="${o.mostrar ? "Esconder do aluno" : "Mostrar ao aluno"}"><div class="knob"></div></div>
    </td>
  </tr>`;
}

async function alternarNaVitrine(ofertaId){
  const o = ofertasDaVitrine.find(x => String(x.ofertaId) === String(ofertaId));
  if(!o) return;
  const passaA = !o.mostrar;

  /* O ecrã muda já; se o servidor recusar, volta atrás e diz porquê. Um
     interruptor que fica meio segundo à espera dá vontade de carregar outra
     vez, e duas escritas em sentidos opostos são um estado que ninguém pediu. */
  o.mostrar = passaA;
  renderAdminVitrine();

  try {
    if(!modoDemonstracao()) await API.mostrarNaVitrine(ofertaId, passaA);
    const motivo = motivoDeNaoAparecer(o);
    mostrarToast(!passaA ? `"${o.nome}" deixa de aparecer`
      : motivo ? `Marcada, mas ainda não aparece: ${motivo}`
      : `"${o.nome}" passa a aparecer na Vitrine`);
  } catch(e){
    o.mostrar = !passaA;
    renderAdminVitrine();
    avisarQueNaoGuardou(e);
  }
}

registarViews({ "admin-vitrine": renderAdminVitrine });
