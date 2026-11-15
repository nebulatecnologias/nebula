/* ============================================================
   Administração › Ofertas
   O que a escola vende, montado aqui (pedido do Shelton, 15/11/2026).

   Uma oferta diz quatro coisas: que cursos abre, por quanto tempo, quanto
   custa e onde se paga. O pagamento é de fora: o link leva ao checkout (no
   Payflow ou noutro), e o checkout avisa a escola de cada venda pelo webhook
   das Integrações. É pelos IDs de produto que a venda encontra a oferta, e
   é a oferta que abre os cursos.

   A Vitrine do aluno lê daqui (academia.vitrine_do_aluno). Antes o catálogo
   era o do Payflow e só a escola de origem o tinha; agora é de cada escola.

   NADA APARECE SEM SER MANDADO. Uma oferta nova fica fora da Vitrine até
   alguém a ligar. A Vitrine tem botão de pagar e cobra a sério: uma oferta
   que aparecesse por esquecimento seria uma cobrança que ninguém decidiu.
   ============================================================ */

let ofertasLidas = false;   /* com servidor, lê-se uma vez por entrada no ecrã */

const MOEDAS_DA_OFERTA = [
  { valor:"MZN", rotulo:"Metical (MZ)" },
  { valor:"ZAR", rotulo:"Rand (R)" },
  { valor:"USD", rotulo:"Dólar ($)" },
  { valor:"EUR", rotulo:"Euro (€)" }
];
const COBRANCAS_DA_OFERTA = [
  { valor:"",    rotulo:"Pagamento único" },
  { valor:"mes", rotulo:"Todos os meses" },
  { valor:"ano", rotulo:"Todos os anos" }
];
const PRAZOS_DA_OFERTA = [
  { valor:"",    rotulo:"Sem prazo" },
  { valor:"7",   rotulo:"7 dias" },
  { valor:"30",  rotulo:"30 dias" },
  { valor:"90",  rotulo:"90 dias" },
  { valor:"180", rotulo:"6 meses" },
  { valor:"365", rotulo:"1 ano" },
  { valor:"730", rotulo:"2 anos" }
];

function prazoDaOfertaEmTexto(dias){
  if(!dias) return "sem prazo";
  const p = PRAZOS_DA_OFERTA.find(x => x.valor === String(dias));
  return p ? p.rotulo : `${dias} dias`;
}

/* Os cursos de uma oferta que ainda existem, pela ordem em que foram postos. */
function cursosDaOferta(o){
  return (o.cursos || []).map(cursoPorId).filter(Boolean);
}

/* Porque é que esta oferta não chega ao aluno, mesmo estando marcada. As
   mesmas guardas da base, pela ordem por que se resolvem: primeiro o que se
   vende, depois o que se entrega, e só no fim o caminho para pagar. */
function motivoDeNaoAparecer(o){
  if(o.ativa === false) return "a oferta está desligada";
  const cursos = cursosDaOferta(o);
  if(!cursos.length) return "não tem nenhum curso escolhido";
  const publicados = cursos.filter(c => c.publicado !== false);
  if(!publicados.length) return cursos.length === 1 ? "o curso dela ainda é rascunho" : "os cursos dela ainda são rascunho";
  if(!o.link && !o.emBreve) return "falta o link de pagamento";
  /* Sem aulas só entra em pré-venda, e a pré-venda liga-se à mão: nunca
     sozinha (decisão do Shelton, 27/09/2026). */
  const aulas = publicados.reduce((s, c) => s + contarAulas(c), 0);
  if(!aulas && !o.emBreve) return "o que entrega ainda não tem nenhuma aula (ligue a pré-venda para a vender antes)";
  return null;
}

async function renderAdminOfertas(){
  const alvo = document.getElementById("content-admin");
  if(!modoDemonstracao() && !ofertasLidas){
    alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Ofertas" })}
      <div class="card"><div class="empty-note">A ler as ofertas…</div></div>`;
    try { DB.ofertasDaEscola = await API.ofertasDaEscola(); ofertasLidas = true; }
    catch(e){
      alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Ofertas" })}
        <div class="card"><div class="empty-note">Não consegui ler as ofertas: ${textoSeguro(e.message)}</div></div>`;
      return;
    }
    if(estado.viewAtual !== "admin-ofertas") return;   /* entretanto mudou de ecrã */
  }
  if(!Array.isArray(DB.ofertasDaEscola)) DB.ofertasDaEscola = [];
  desenharOfertas();
}

function desenharOfertas(){
  const admin = souAdminDaEscola();
  const lista = DB.ofertasDaEscola.slice().sort((x, y) => (x.ordem || 0) - (y.ordem || 0));
  const marcadas = lista.filter(o => o.naVitrine);
  const visiveis = marcadas.filter(o => !motivoDeNaoAparecer(o)).length;
  const comProduto = lista.filter(o => o.ativa !== false && (o.produtos || []).length).length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Ofertas",
      descricao: "O que a escola vende. Cada oferta diz que cursos abre, por quanto tempo, a que preço e onde se paga. "
               + "As que estão ligadas à Vitrine aparecem à venda aos alunos que ainda não têm esses cursos.",
      acaoRotulo: admin ? "Nova oferta" : "",
      acaoId: "btn-nova-oferta"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.tag}</div>
        <div class="stat-label">Na Vitrine do aluno</div><div class="stat-value">${visiveis}<span>/ ${lista.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.plug}</div>
        <div class="stat-label">Com produto do checkout ligado</div><div class="stat-value">${comProduto}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.gear}</div>
        <div class="stat-label">Retidas por algo em falta</div><div class="stat-value">${marcadas.length - visiveis}</div></div>
    </div>

    ${retidasHTML(lista)}

    <div class="card table-card">
      <div class="table-card-head">
        <h3>Ofertas da escola</h3>
        <span class="count">${lista.length} ${lista.length === 1 ? "oferta" : "ofertas"}${admin ? "" : " · só a administração da escola as muda"}</span>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Oferta</th><th>O que abre</th><th>Preço</th><th>Pagamento</th><th>Na Vitrine</th><th></th></tr></thead>
          <tbody>
            ${lista.length ? lista.map(o => linhaDaOferta(o, admin)).join("")
              : `<tr><td colspan="6"><div class="empty-note">Ainda não há ofertas. Crie a primeira: escolha os cursos, o preço e o link onde se paga.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const nova = document.getElementById("btn-nova-oferta");
  if(nova) nova.addEventListener("click", () => editarOferta(null));
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarOferta(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarOferta(b.getAttribute("data-apagar"))));
  document.querySelectorAll("#content-admin [data-vitrine]").forEach(el => {
    const alternar = () => alternarNaVitrine(el.getAttribute("data-vitrine"));
    el.addEventListener("click", alternar);
    el.addEventListener("keydown", ev => { if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); alternar(); } });
  });
}

/* As retidas à vista, em cima: uma oferta marcada que não chega ao aluno é
   uma venda que a equipa julga que está a fazer e não está. */
function retidasHTML(lista){
  const retidas = lista.filter(o => o.naVitrine).map(o => ({ o, motivo: motivoDeNaoAparecer(o) })).filter(x => x.motivo);
  if(!retidas.length) return "";
  return `<div class="card aviso-retidas" role="status">
    <h3>${retidas.length === 1 ? "Uma oferta ligada à Vitrine não aparece" : `${retidas.length} ofertas ligadas à Vitrine não aparecem`}</h3>
    <ul>${retidas.map(({ o, motivo }) => `<li><strong>${textoSeguro(o.nome)}</strong>: ${motivo}.</li>`).join("")}</ul>
  </div>`;
}

function linhaDaOferta(o, admin){
  const motivo = motivoDeNaoAparecer(o);
  const cursos = cursosDaOferta(o);
  const aulas = cursos.reduce((s, c) => s + contarAulas(c), 0);
  const produtos = o.produtos || [];

  const oQueAbre = cursos.length
    ? `<div>${cursos.slice(0, 2).map(c => textoSeguro(c.titulo)).join(", ")}${cursos.length > 2 ? ` e mais ${cursos.length - 2}` : ""}</div>
       <div class="sub-celula">Acesso ${prazoDaOfertaEmTexto(o.diasDeAcesso)} · ${aulas} aula${aulas === 1 ? "" : "s"}</div>`
    : `<span class="erro">Nenhum curso escolhido</span>`;

  let onde = "";
  try { onde = o.link ? new URL(o.link).host : ""; } catch(e){ onde = ""; }
  const pagamento = `
    <div>${onde ? textoSeguro(onde) : `<span class="sub-celula">Sem link de pagamento</span>`}</div>
    ${produtos.length
      ? `<div class="sub-celula">${produtos.length} ${produtos.length === 1 ? "produto ligado" : "produtos ligados"}</div>`
      : `<div class="sub-celula" title="Sem ID de produto, uma compra não abre os cursos sozinha.">Sem produto ligado</div>`}`;

  /* O aviso só faz sentido em quem está ligado: dizer que uma oferta fora da
     Vitrine «não aparece» é ruído. */
  const aviso = o.naVitrine && motivo ? `<div class="erro" style="margin-top:6px">Não aparece: ${motivo}.</div>` : "";
  const preVenda = o.emBreve
    ? `<div class="sub-celula" style="margin-top:6px">Pré-venda${o.abreEm ? `: as aulas abrem a ${dataCurta(o.abreEm)}` : ", sem data"}</div>` : "";
  const rotulo = `Mostrar ${textoSeguro(o.nome)} na Vitrine`;

  return `<tr class="${o.naVitrine && motivo ? "tint-risco" : ""}" data-oferta-linha="${o.id}">
    <td class="oferta-nome">
      <div class="nome" style="font-weight:500;">${textoSeguro(o.nome)}${o.ativa === false ? ` <span class="pill pill-inativo">Desligada</span>` : ""}</div>
      ${o.chamada ? `<div class="sub-celula">${textoSeguro(o.chamada)}</div>` : ""}
      ${preVenda}${aviso}
    </td>
    <td class="oferta-abre">${oQueAbre}</td>
    <td class="num">${formatarPreco(Number(o.preco) || 0, o.moeda)}${o.recorrencia === "mes" ? `<div class="sub-celula">por mês</div>` : o.recorrencia === "ano" ? `<div class="sub-celula">por ano</div>` : ""}</td>
    <td>${pagamento}</td>
    <td>${admin
      ? `<div class="toggle ${o.naVitrine ? "on" : ""}" data-vitrine="${o.id}" role="switch" aria-checked="${!!o.naVitrine}" aria-label="${rotulo}" tabindex="0"><div class="knob"></div></div>`
      : `<span class="pill ${o.naVitrine ? "pill-ativo" : "pill-inativo"}">${o.naVitrine ? "Sim" : "Não"}</span>`}</td>
    <td>${admin ? acoesLinha(o.id) : ""}</td>
  </tr>`;
}

/* ---------------- Criar e editar ---------------- */
function editarOferta(id){
  const o = id ? DB.ofertasDaEscola.find(x => x.id === id) : null;
  const cursos = DB.cursos.map(c => {
    const aulas = contarAulas(c);
    return { valor:c.id, rotulo:c.titulo, imagem:c.capa || "", iniciais:c.sigla || iniciais(c.titulo || "?"),
             cor:(DB.categorias[c.categoria] || {}).cor || "",
             etiqueta: c.publicado === false ? "Rascunho" : `${aulas} aula${aulas === 1 ? "" : "s"}` };
  });
  const prazos = PRAZOS_DA_OFERTA.slice();
  if(o && o.diasDeAcesso && !prazos.some(p => p.valor === String(o.diasDeAcesso)))
    prazos.push({ valor:String(o.diasDeAcesso), rotulo:`${o.diasDeAcesso} dias` });

  abrirDrawer({
    titulo: o ? "Editar oferta" : "Nova oferta",
    subtitulo: "Quem compra recebe os cursos escolhidos, pelo prazo escolhido.",
    campos: [
      { nome:"nome", rotulo:"Nome da oferta", tipo:"texto", obrigatorio:true, placeholder:"ex: Programa de Liderança · Acesso de 1 ano" },
      { nome:"chamada", rotulo:"Frase de venda", tipo:"textarea", placeholder:"Uma linha a dizer o que a pessoa leva.",
        dica:"Aparece no cartão da Vitrine. Sem ela, usa-se o subtítulo do curso." },
      { nome:"cursos", rotulo:"Cursos que esta oferta abre", tipo:"checklist", cartoes:true, opcoes:cursos,
        dica:"Com mais de um curso, a Vitrine mostra-a como um plano." },
      { nome:"diasDeAcesso", rotulo:"Duração do acesso", tipo:"select", opcoes:prazos,
        dica:"Conta do dia em que a pessoa entra. Uma compra nova nunca encurta um acesso que já ia mais longe." },
      { nome:"preco", rotulo:"Preço", tipo:"numero", meia:true, placeholder:"0" },
      { nome:"moeda", rotulo:"Moeda", tipo:"select", meia:true, opcoes:MOEDAS_DA_OFERTA },
      { nome:"recorrencia", rotulo:"Cobrança", tipo:"select", opcoes:COBRANCAS_DA_OFERTA,
        dica:"É o que o aluno lê ao lado do preço. Quem cobra é o checkout." },
      { nome:"link", rotulo:"Link de pagamento", tipo:"url", placeholder:"https://…",
        dica:"Para onde vai quem carrega em comprar: a página do checkout desta oferta." },
      { nome:"produtos", rotulo:"IDs de produto do checkout", tipo:"textarea", placeholder:"prod_01J…",
        dica:"Um por linha. Quando chega a venda de um destes produtos, a pessoa recebe os cursos desta oferta. No Payflow estão em Integrações › IDs dos produtos." },
      { nome:"naVitrine", rotulo:"Mostrar na Vitrine", tipo:"toggle",
        dica:"Os alunos que ainda não têm estes cursos vêem-na à venda." },
      { nome:"emBreve", rotulo:"Pré-venda", tipo:"toggle",
        dica:"Vende-se antes de haver aulas. Quem compra entra logo e vê quando as aulas abrem." },
      { nome:"abreEm", rotulo:"As aulas abrem a", tipo:"data", dica:"Só conta com a pré-venda ligada." },
      { nome:"ativa", rotulo:"Oferta ativa", tipo:"toggle", padrao:true,
        dica:"Desligada, sai da Vitrine e as compras novas deixam de abrir os cursos." }
    ],
    valores: o ? Object.assign({}, o, { diasDeAcesso: o.diasDeAcesso ? String(o.diasDeAcesso) : "", produtos:(o.produtos || []).join("\n") })
               : { moeda:"MZN", recorrencia:"", diasDeAcesso:"", ativa:true, naVitrine:false, emBreve:false, cursos:[] },
    aoGuardar: v => {
      const produtos = [...new Set(String(v.produtos || "").split(/[\s,;]+/).map(p => p.trim()).filter(Boolean))];
      const mau = produtos.find(p => !/^[A-Za-z0-9_.:-]{3,80}$/.test(p));
      if(mau){ mostrarToast(`O ID de produto «${mau}» não parece válido. Copie-o do checkout.`); return false; }
      const repetida = DB.ofertasDaEscola.find(x => x.id !== (o && o.id) && (x.produtos || []).some(p => produtos.includes(p)));
      if(repetida){
        mostrarToast(`O produto ${repetida.produtos.find(p => produtos.includes(p))} já está na oferta «${repetida.nome}». Um produto entrega uma só oferta.`);
        return false;
      }
      const link = linkExterno(v.link);
      if(link && !/^https:\/\//i.test(link)){ mostrarToast("O link de pagamento tem de começar por https://"); return false; }
      if(v.preco !== null && v.preco < 0){ mostrarToast("O preço não pode ser negativo."); return false; }

      const registo = Object.assign({}, o || { ordem: DB.ofertasDaEscola.reduce((m, x) => Math.max(m, x.ordem || 0), 0) + 1, destaque:false }, {
        nome: v.nome, chamada: v.chamada, cursos: v.cursos,
        diasDeAcesso: v.diasDeAcesso ? Number(v.diasDeAcesso) : null,
        preco: v.preco || 0, moeda: v.moeda || "MZN", recorrencia: v.recorrencia || "",
        link, produtos, naVitrine: v.naVitrine, emBreve: v.emBreve,
        abreEm: v.emBreve && v.abreEm ? v.abreEm : null, ativa: v.ativa
      });
      guardarOferta(registo, !o);
      /* A gaveta fica aberta até a base responder: se ela recusar, a pessoa
         corrige sem perder o que escreveu. */
      return false;
    }
  });
}

async function guardarOferta(registo, nova){
  const botao = document.getElementById("drawer-guardar");
  if(botao) botao.disabled = true;
  try {
    let gravada = registo;
    if(modoDemonstracao()){ if(nova) registo.id = novoId("oferta"); }
    else gravada = await API.guardarOferta(registo);
    const i = DB.ofertasDaEscola.findIndex(x => x.id === gravada.id);
    if(i >= 0) DB.ofertasDaEscola[i] = gravada; else DB.ofertasDaEscola.push(gravada);
    depoisDeMudarOfertas();
    fecharDrawer();
    desenharOfertas();
    const motivo = gravada.naVitrine ? motivoDeNaoAparecer(gravada) : null;
    mostrarToast(motivo ? `Guardada, mas ainda não aparece na Vitrine: ${motivo}`
      : nova ? "Oferta criada" : "Oferta atualizada");
  } catch(e){
    mostrarToast(e.message || "Não foi possível guardar a oferta.");
    if(botao) botao.disabled = false;
  }
}

async function alternarNaVitrine(id){
  const o = DB.ofertasDaEscola.find(x => x.id === id);
  if(!o) return;
  const passaA = !o.naVitrine;

  /* O ecrã muda já; se o servidor recusar, volta atrás e diz porquê. Um
     interruptor que fica meio segundo à espera dá vontade de carregar outra
     vez, e duas escritas em sentidos opostos são um estado que ninguém pediu. */
  o.naVitrine = passaA;
  desenharOfertas();
  try {
    if(!modoDemonstracao()) await API.guardarOferta(o);
    depoisDeMudarOfertas();
    const motivo = motivoDeNaoAparecer(o);
    mostrarToast(!passaA ? `«${o.nome}» deixa de aparecer na Vitrine`
      : motivo ? `Ligada, mas ainda não aparece: ${motivo}`
      : `«${o.nome}» passa a aparecer na Vitrine`);
  } catch(e){
    o.naVitrine = !passaA;
    desenharOfertas();
    avisarQueNaoGuardou(e);
  }
}

function apagarOferta(id){
  const o = DB.ofertasDaEscola.find(x => x.id === id);
  if(!o) return;
  confirmarAcao({
    titulo: "Apagar oferta",
    mensagem: `«${textoSeguro(o.nome)}» sai da Vitrine e as compras novas deixam de abrir os cursos dela. Quem já comprou fica com o acesso que tem.`,
    aoConfirmar: async () => {
      DB.ofertasDaEscola = DB.ofertasDaEscola.filter(x => x.id !== id);
      await remover("ofertaDaEscola", id);
      depoisDeMudarOfertas();
      desenharOfertas();
      mostrarToast("Oferta apagada");
    }
  });
}

/* Depois de uma mudança: com servidor, a Vitrine de quem está a ver relê-se
   (a equipa também a pode abrir); em demonstração, monta-se aqui. */
function depoisDeMudarOfertas(){
  if(!modoDemonstracao()){ API.relerAcesso().catch(() => { /* a próxima entrada relê */ }); return; }
  refletirNaVitrineDemo();
  guardarDB();
}

/* ---------------- Demonstração ----------------
   Sem servidor, a Vitrine do aluno monta-se a partir das ofertas, com as
   mesmas guardas. Os cartões que já lá estavam mantêm o detalhe que tinham
   (duração, avaliação), para o exemplo não mudar por se tocar noutra coisa. */
function segundosDaDuracao(texto){
  const p = String(texto || "").split(":").map(Number);
  if(p.some(isNaN)) return 0;
  return p.reduce((s, n) => s * 60 + n, 0);
}

function refletirNaVitrineDemo(){
  const montra = [];
  (DB.ofertasDaEscola || []).forEach(o => {
    if(!o.naVitrine || motivoDeNaoAparecer(o)) return;
    const publicados = cursosDaOferta(o).filter(c => c.publicado !== false);
    const antigo = (DB.vitrine || []).find(v => v.ofertaId === o.id);
    const mesmos = antigo && antigo.cursos.map(c => c.id).join("|") === publicados.map(c => c.id).join("|");
    const cursos = mesmos ? antigo.cursos : publicados.map(c => {
      const aulas = c.modulos.flatMap(m => m.aulas);
      return { id:c.id, titulo:c.titulo, subtitulo:c.subtitulo || "", sigla:c.sigla || "", capa:c.capa || "",
               categoria:c.categoria, facilitador:c.facilitador || "", facilitadorFoto:c.facilitadorFoto || "",
               nota:0, avaliacoes:0, aulas:aulas.length, modulos:c.modulos.length,
               segundos:aulas.reduce((s, a) => s + segundosDaDuracao(a.duracao), 0) };
    });
    montra.push({
      ofertaId:o.id, nome:o.nome, preco:Number(o.preco) || 0, moeda:o.moeda || "MZN",
      mensal:o.recorrencia === "mes", anual:o.recorrencia === "ano",
      entrega: cursos.length > 1 ? "Plano" : "Academia", destaque:!!o.destaque, chamada:o.chamada || "",
      ordem:o.ordem || 0,
      aulas: mesmos ? antigo.aulas : cursos.reduce((s, c) => s + c.aulas, 0),
      segundos: mesmos ? antigo.segundos : cursos.reduce((s, c) => s + c.segundos, 0),
      emBreve:!!o.emBreve, abreEm:o.abreEm || null, checkout:!!o.link, destino:o.link || "", cursos
    });
  });
  DB.vitrine = montra.sort((x, y) => x.ordem - y.ordem);
}

registarViews({ "admin-ofertas": () => { ofertasLidas = false; renderAdminOfertas(); } });
