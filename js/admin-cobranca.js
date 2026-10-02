/* ============================================================
   Configurações › Cobrança (W4·4, no molde da referência do Memberkit)

   A mensalidade da escola à plataforma, em cinco blocos:
     1. Assinatura — o estado (em teste, ativa, em atraso, cancelada…), a
        próxima cobrança, cancelar ou retomar, e «Pagar agora» em atraso;
     2. Plano contratado — o uso («30% utilizado — 450 de 1 500 alunos») e
        a troca de plano ou de ciclo, que vale na próxima cobrança;
     3. Cartão — marca, últimos 4 e validade; trocar abre o Payflow;
     4. Dados de faturação — nome ou empresa, NUIT, morada, telefone;
     5. Faturas emitidas — período, valor, pagamento e estado.

   Só a administração da escola (a base recusa a outros). O preço que se
   cobra sai da base: aqui é só apresentação.

   Na demonstração (?demo=1) a conta vive neste browser; ?cobranca=teste,
   em_atraso, pendente, cancelada ou isenta escolhe o estado de partida.
   ============================================================ */

let estadoCobranca = { carregado:false, info:null, erro:"", ocupado:false, mudarPlano:false };

const ESTADOS_DA_ASSINATURA = {
  pendente:  { pill:"pill-morno",   rotulo:"Falta o pagamento" },
  teste:     { pill:"pill-ativo",   rotulo:"Em teste" },
  ativa:     { pill:"pill-ativo",   rotulo:"Ativa" },
  em_atraso: { pill:"pill-quente",  rotulo:"Pagamento em atraso" },
  cancelada: { pill:"pill-inativo", rotulo:"Cancelada" },
  isenta:    { pill:"pill-inativo", rotulo:"Isenta" }
};

/* ---------------- A demonstração ---------------- */
function cobrancaDaDemonstracao(){
  const pedido = new URLSearchParams(location.search).get("cobranca");
  if(!DB.cobrancaDemo || (pedido && DB.cobrancaDemo.pedido !== pedido)){
    const dia = n => new Date(Date.now() + n * 864e5).toISOString();
    const estado = ESTADOS_DA_ASSINATURA[pedido] ? pedido : "ativa";
    DB.cobrancaDemo = {
      pedido: pedido || "",
      assinatura: {
        plano:"profissional", ciclo:"mensal", estado, moeda:"ZAR", simbolo:"R",
        testeAte: estado === "teste" ? dia(5) : dia(-40), pagoAte: estado === "ativa" ? dia(21) : estado === "em_atraso" ? dia(-2) : null,
        cancelaNoFim:false, ultimoErro: estado === "em_atraso" ? "O cartão não tinha saldo suficiente." : null,
        cartao: estado === "pendente" ? null : { marca:"visa", ultimos4:"8204", expira:"03/2029", banco:"Banco de Exemplo" },
        faturacao: { nome:"Escola de Exemplo, Lda", nuit:"400000000", morada:"Av. de Exemplo, 100, Maputo", telefone:"+258 84 000 0000" }
      },
      contaEmDia: estado !== "pendente" && estado !== "cancelada",
      alunosAtivos: 450, limite: 1500,
      planos: [
        { id:"essencial", nome:"Essencial", alunosMax:500, aVenda:true, precos:{ MZN:{ mensal:3500, anual:35000, simbolo:"MZ" }, ZAR:{ mensal:199, anual:1990, simbolo:"R" } } },
        { id:"profissional", nome:"Profissional", alunosMax:1500, aVenda:true, precos:{ MZN:{ mensal:7000, anual:70000, simbolo:"MZ" }, ZAR:{ mensal:399, anual:3990, simbolo:"R" } } },
        { id:"escala", nome:"Premium", alunosMax:5000, aVenda:true, precos:{ MZN:{ mensal:14000, anual:140000, simbolo:"MZ" }, ZAR:{ mensal:799, anual:7990, simbolo:"R" } } }
      ],
      faturas: estado === "pendente" ? [] : [
        { id:"f3", inicio:dia(-9), fim:dia(21), valor:399, estado: estado === "em_atraso" ? "falhou" : "paga", plano:"profissional", ciclo:"mensal", pagoEm: estado === "em_atraso" ? null : dia(-9), motivo: estado === "em_atraso" ? "O cartão não tinha saldo suficiente." : null },
        { id:"f2", inicio:dia(-39), fim:dia(-9), valor:399, estado:"paga", plano:"profissional", ciclo:"mensal", pagoEm:dia(-39) },
        { id:"f1", inicio:dia(-69), fim:dia(-39), valor:199, estado:"paga", plano:"essencial", ciclo:"mensal", pagoEm:dia(-69) }
      ]
    };
    if(estado === "isenta") DB.cobrancaDemo.limite = null;
    guardarDB();
  }
  return JSON.parse(JSON.stringify(DB.cobrancaDemo));
}
function demoMudar(fn){ fn(DB.cobrancaDemo); guardarDB(); estadoCobranca.info = cobrancaDaDemonstracao(); }

/* ---------------- Ler ---------------- */
async function carregarCobranca(){
  estadoCobranca = { carregado:false, info:null, erro:"", ocupado:false, mudarPlano:false };
  if(modoDemonstracao()){ estadoCobranca.info = cobrancaDaDemonstracao(); estadoCobranca.carregado = true; return; }
  try { estadoCobranca.info = await API.cobrancaDaEscola(); }
  catch(e){ estadoCobranca.erro = /administração/.test(e.message || "") ? "Só a administração da escola vê a cobrança." : "Não foi possível ler a cobrança agora."; }
  estadoCobranca.carregado = true;
}

/* ---------------- Peças ---------------- */
const planoDaCobranca = id => ((estadoCobranca.info || {}).planos || []).find(p => p.id === id) || null;
/* O preço na moeda da escola (Moçambique: meticais; África do Sul: rand). */
const moedaDaEscola = () => (((estadoCobranca.info || {}).assinatura || {}).moeda) || "ZAR";
const precoDoCiclo = (p, ciclo) => { const v = p && ((p.precos || {})[moedaDaEscola()] || {})[ciclo]; return v == null ? null : Number(v); };
const simboloDaEscola = () => { const i = estadoCobranca.info || {}; return (i.assinatura && i.assinatura.simbolo)
  || ((((i.planos || [])[0] || {}).precos || {})[moedaDaEscola()] || {}).simbolo || moedaDaEscola(); };
function dataCobranca(iso){
  try { return new Date(iso).toLocaleDateString("pt-PT", { day:"numeric", month:"long", year:"numeric" }); }
  catch(e){ return ""; }
}
function dataCurtaCobranca(iso){
  try { return new Date(iso).toLocaleDateString("pt-PT", { day:"numeric", month:"short", year:"numeric" }); }
  catch(e){ return ""; }
}
const contagemDeAlunos = n => Number(n || 0).toLocaleString("pt-PT", { useGrouping:"always" });

function blocoAssinatura(i){
  const a = i.assinatura;
  const e = ESTADOS_DA_ASSINATURA[a.estado] || ESTADOS_DA_ASSINATURA.ativa;
  const p = planoDaCobranca(a.plano);
  const preco = precoDoCiclo(p, a.ciclo);
  const simbolo = simboloDaEscola();
  const ocupado = estadoCobranca.ocupado ? "disabled" : "";
  const fim = a.pagoAte || a.testeAte;
  let texto = "", accoes = "";

  if(a.estado === "isenta"){
    texto = "Esta área de membros não paga mensalidade.";
  } else if(a.estado === "pendente"){
    texto = "A área de membros está criada. Para começar os 7 dias grátis, ponha o pagamento: cartão, ou fatura mensal (em Moçambique, por M-Pesa). Até lá, os alunos não vêem os cursos.";
    accoes = `<button class="btn btn-primary" type="button" data-cobranca="cartao" ${ocupado}>Pôr o pagamento</button>`;
  } else if(a.estado === "cancelada"){
    texto = "A assinatura terminou. Os alunos não vêem os cursos; a equipa continua a entrar. Fale connosco para a reativar.";
  } else if(a.cancelaNoFim){
    texto = `Cancelada: tudo continua a funcionar até ${dataCobranca(fim)}. Depois disso não há mais cobranças, e os alunos deixam de ver os cursos.`;
    accoes = `<button class="btn btn-secondary" type="button" data-cobranca="retomar" ${ocupado}>Retomar a assinatura</button>`;
  } else {
    if(a.estado === "teste") texto = `Os dias grátis vão até ${dataCobranca(a.testeAte)}. A primeira cobrança, de ${formatarPreco(preco, simbolo)}, é nesse dia.`;
    else if(a.estado === "em_atraso") texto = `A última cobrança falhou${a.ultimoErro ? " (" + textoSeguro(a.ultimoErro).replace(/\.$/, "").replace(/^./, l => l.toLowerCase()) + ")" : ""}. Pague a fatura em aberto para não perder o acesso: passados 7 dias, os alunos deixam de ver os cursos até o pagamento entrar.`;
    else texto = `Próxima cobrança: ${formatarPreco(preco, simbolo)} a ${dataCobranca(fim)}.`;
    accoes = (a.estado === "em_atraso" ? `<button class="btn btn-primary" type="button" data-cobranca="pagar" ${ocupado}>Pagar agora</button>` : "")
           + `<button class="btn btn-perigo-suave" type="button" data-cobranca="cancelar" ${ocupado}>Cancelar assinatura</button>`;
  }
  return `
    <div class="card painel cobranca-bloco" id="cobranca-assinatura">
      <div class="cobranca-cabeca">
        <h3>Assinatura</h3>
        <span class="pill ${e.pill}">${a.cancelaNoFim && a.estado !== "cancelada" ? "Cancelada no fim do período" : e.rotulo}</span>
      </div>
      <p class="cobranca-texto">${texto}</p>
      ${accoes ? `<div class="linha-acoes">${accoes}</div>` : ""}
    </div>`;
}

function blocoPlano(i){
  const a = i.assinatura;
  if(a.estado === "isenta") return "";
  const p = planoDaCobranca(a.plano);
  const limite = i.limite || (p && p.alunosMax) || 0;
  const pct = limite ? Math.min(100, Math.round(i.alunosAtivos / limite * 100)) : 0;
  const ocupado = estadoCobranca.ocupado ? "disabled" : "";
  const aVenda = (i.planos || []).filter(x => x.aVenda);
  const formulario = estadoCobranca.mudarPlano ? `
    <div class="cobranca-mudar">
      <div class="field">
        <label for="cobranca-plano">Plano</label>
        <select id="cobranca-plano">${aVenda.map(x => `<option value="${textoSeguro(x.id)}" ${x.id === a.plano ? "selected" : ""} ${x.alunosMax != null && x.alunosMax < i.alunosAtivos ? "disabled" : ""}>${textoSeguro(x.nome)} — até ${contagemDeAlunos(x.alunosMax)} alunos</option>`).join("")}</select>
      </div>
      <div class="field">
        <label for="cobranca-ciclo">Pagamento</label>
        <select id="cobranca-ciclo">
          <option value="mensal" ${a.ciclo === "mensal" ? "selected" : ""}>Mensal</option>
          <option value="anual" ${a.ciclo === "anual" ? "selected" : ""}>Anual</option>
        </select>
      </div>
      <p class="hint" id="cobranca-novo-preco"></p>
      <div class="linha-acoes">
        <button class="btn btn-primary" type="button" data-cobranca="guardar-plano" ${ocupado}>Guardar</button>
        <button class="btn btn-texto" type="button" data-cobranca="fechar-plano">Cancelar</button>
      </div>
    </div>` : "";
  return `
    <div class="card painel cobranca-bloco" id="cobranca-plano-bloco">
      <div class="cobranca-cabeca">
        <h3>Plano contratado</h3>
        ${estadoCobranca.mudarPlano || a.estado === "cancelada" ? "" : `<button class="btn btn-secondary btn-sm" type="button" data-cobranca="mudar-plano" ${ocupado}>Alterar</button>`}
      </div>
      <p class="cobranca-plano-nome"><strong>${textoSeguro(p ? p.nome : a.plano)}</strong> · ${a.ciclo === "anual" ? "anual" : "mensal"}${p ? ` · ${formatarPreco(precoDoCiclo(p, a.ciclo), simboloDaEscola())} por ${a.ciclo === "anual" ? "ano" : "mês"}` : ""}</p>
      <div class="cobranca-uso" role="img" aria-label="${pct}% utilizado">
        <div class="barra-track"><div class="barra-fill cobranca-fill ${pct >= 90 ? "quase" : ""}" style="width:${pct}%"></div></div>
      </div>
      <p class="hint"><strong>${pct}% utilizado</strong> — ${contagemDeAlunos(i.alunosAtivos)} de ${contagemDeAlunos(limite)} alunos ativos.${pct >= 90 ? " Perto do limite: acima dele não pode convidar mais alunos." : ""}</p>
      ${formulario}
    </div>`;
}

function blocoCartao(i){
  const a = i.assinatura;
  if(a.estado === "isenta") return "";
  const c = a.cartao;
  const ocupado = estadoCobranca.ocupado ? "disabled" : "";
  const marca = c && c.marca ? c.marca.charAt(0).toUpperCase() + c.marca.slice(1) : "Cartão";
  return `
    <div class="card painel cobranca-bloco" id="cobranca-cartao">
      <div class="cobranca-cabeca">
        <h3>Cartão</h3>
        ${a.estado === "cancelada" ? "" : `<button class="btn btn-secondary btn-sm" type="button" data-cobranca="cartao" ${ocupado}>${c ? "Alterar" : "Pôr o pagamento"}</button>`}
      </div>
      ${c ? `<p class="cobranca-cartao-linha"><strong>${textoSeguro(marca)} •••• ${textoSeguro(c.ultimos4 || "")}</strong>${c.expira ? `<span class="sub-celula">Validade ${textoSeguro(c.expira)}</span>` : ""}</p>`
          : `<p class="hint">Ainda não há cartão.</p>`}
      <p class="hint">${a.metodo === "fatura" ? "Paga por fatura mensal. Pode passar a cartão quando quiser." : "A cobrança é feita pelo Payflow, em rand sul-africano (ZAR). O número do cartão fica com ele; aqui só aparecem os últimos 4 dígitos."}</p>
    </div>`;
}

function blocoFaturacao(i){
  const a = i.assinatura;
  if(a.estado === "isenta") return "";
  const f = a.faturacao || {};
  const ocupado = estadoCobranca.ocupado ? "disabled" : "";
  const campo = (id, rotulo, valor, extra) => `<div class="field"><label for="${id}">${rotulo}</label><input id="${id}" value="${textoSeguro(valor || "")}" ${extra || ""}></div>`;
  return `
    <div class="card painel cobranca-bloco" id="cobranca-faturacao">
      <div class="cobranca-cabeca"><h3>Dados de faturação</h3></div>
      <p class="hint" style="margin:0 0 14px;">Aparecem nas faturas.</p>
      <div class="cobranca-campos">
        ${campo("fat-nome", "Nome ou empresa", f.nome, 'maxlength="160" autocomplete="organization"')}
        ${campo("fat-nuit", "NUIT", f.nuit, 'maxlength="30" inputmode="numeric"')}
        ${campo("fat-morada", "Morada", f.morada, 'maxlength="240" autocomplete="street-address"')}
        ${campo("fat-telefone", "Telefone", f.telefone, 'maxlength="40" type="tel" autocomplete="tel"')}
      </div>
      <div class="linha-acoes"><button class="btn btn-primary" type="button" data-cobranca="guardar-faturacao" ${ocupado}>Guardar</button></div>
    </div>`;
}

const ESTADOS_DA_FATURA = {
  paga:        { pill:"pill-ativo",   rotulo:"Paga" },
  pendente:    { pill:"pill-morno",   rotulo:"A confirmar" },
  falhou:      { pill:"pill-quente",  rotulo:"Falhou" },
  reembolsada: { pill:"pill-inativo", rotulo:"Devolvida" }
};
function blocoFaturas(i){
  if(i.assinatura.estado === "isenta") return "";
  const faturas = i.faturas || [];
  const simbolo = simboloDaEscola();
  const valor = v => formatarPreco(v, simbolo).replace(/^\S+\s/, "");
  return `
    <div class="card cobranca-bloco cobranca-faturas" id="cobranca-faturas">
      <div class="cobranca-cabeca" style="padding:22px 22px 0;"><h3>Faturas emitidas</h3></div>
      ${faturas.length ? `
        <div class="table-wrap" tabindex="0">
          <table class="admin-table tabela-faturas">
            <thead><tr><th>Período</th><th>Plano</th><th class="num">Valor (${textoSeguro(simbolo)})</th><th>Pagamento</th><th>Estado</th></tr></thead>
            <tbody>${faturas.map(f => {
              const e = ESTADOS_DA_FATURA[f.estado] || ESTADOS_DA_FATURA.pendente;
              const p = planoDaCobranca(f.plano);
              return `<tr>
                <td data-rotulo="Período">${dataCurtaCobranca(f.inicio)} – ${dataCurtaCobranca(f.fim)}</td>
                <td data-rotulo="Plano">${textoSeguro(p ? p.nome : f.plano)} · ${f.ciclo === "anual" ? "anual" : "mensal"}</td>
                <td data-rotulo="Valor (${textoSeguro(simbolo)})" class="num">${valor(f.valor)}</td>
                <td data-rotulo="Pagamento">${f.pagoEm ? dataCurtaCobranca(f.pagoEm)
                  : f.estado !== "reembolsada" && /^https:\/\//.test(f.link || "") ? `<a class="btn btn-secondary btn-sm" href="${textoSeguro(f.link)}" target="_blank" rel="noopener">Pagar</a>`
                  : f.motivo ? `<span class="sub-celula">${textoSeguro(f.motivo)}</span>` : "—"}</td>
                <td data-rotulo="Estado"><span class="pill ${e.pill}">${e.rotulo}</span></td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>` : `<p class="hint" style="padding:12px 22px 22px;margin:0;">Ainda não há faturas. A primeira chega no fim dos dias grátis.</p>`}
    </div>`;
}

/* ---------------- Desenhar ---------------- */
function renderAdminCobranca(){
  const alvo = document.getElementById("content-admin");
  alvo.innerHTML = `
    ${cabecalhoAdmin({ titulo:"Cobrança", descricao:"A assinatura da sua área de membros: plano, cartão, dados de faturação e faturas." })}
    <div id="cobranca-corpo"><div class="card painel"><p class="hint">A ler a cobrança…</p></div></div>`;
  carregarCobranca().then(desenharCobranca);
}

function desenharCobranca(){
  const corpo = document.getElementById("cobranca-corpo");
  if(!corpo) return;
  if(estadoCobranca.erro){ corpo.innerHTML = `<div class="card painel"><p class="hint">${estadoCobranca.erro}</p></div>`; return; }
  const i = estadoCobranca.info;
  if(!i || !i.assinatura){ corpo.innerHTML = `<div class="card painel"><p class="hint">Esta área de membros não tem assinatura.</p></div>`; return; }
  corpo.innerHTML = blocoAssinatura(i) + blocoPlano(i) + blocoCartao(i) + blocoFaturacao(i) + blocoFaturas(i);
  corpo.querySelectorAll("[data-cobranca]").forEach(b => b.addEventListener("click", () => accaoCobranca(b.dataset.cobranca)));
  const sp = document.getElementById("cobranca-plano"), sc = document.getElementById("cobranca-ciclo");
  if(sp && sc){ const mostrar = () => mostrarNovoPreco(sp.value, sc.value); sp.addEventListener("change", mostrar); sc.addEventListener("change", mostrar); mostrar(); }
}

function mostrarNovoPreco(plano, ciclo){
  const p = planoDaCobranca(plano), alvo = document.getElementById("cobranca-novo-preco");
  if(!alvo || !p) return;
  const preco = precoDoCiclo(p, ciclo);
  alvo.textContent = preco == null ? "Este plano ainda não tem preço neste ciclo."
    : `${formatarPreco(preco, simboloDaEscola())} por ${ciclo === "anual" ? "ano" : "mês"}, a partir da próxima cobrança.`;
}

async function comCobrancaOcupada(qual, trabalho, recarregar = true){
  estadoCobranca.ocupado = qual; desenharCobranca();
  try { await trabalho(); }
  catch(e){ mostrarToast(e.message || "Não foi possível tratar da cobrança agora."); }
  estadoCobranca.ocupado = false;
  if(recarregar && !modoDemonstracao()){ const mudar = estadoCobranca.mudarPlano; await carregarCobranca(); estadoCobranca.mudarPlano = mudar; }
  desenharCobranca();
}

/* O que se paga, muda ou cancela faz-se no Payflow (decisão do Shelton a
   02/10): a Academia só abre os links que ele mandou com os eventos da
   assinatura (academia-receber). Na demonstração, os botões mexem na conta
   que vive no browser, para se ver o caminho inteiro. */
const SEM_LINK = "O link do Payflow ainda não chegou: aparece aqui, e por email, assim que a sua assinatura estiver criada.";
function linkDoPayflow(qual){
  const i = estadoCobranca.info || {}, l = ((i.assinatura || {}).links) || {};
  if(qual === "fatura"){
    const f = (i.faturas || []).find(x => x.estado === "pendente" || x.estado === "falhou");
    if(f && f.link) return f.link;
    qual = "pagamento";
  }
  return l[qual] || (qual === "cartao" ? l.pagamento : null) || null;
}
function abrirNoPayflow(qual){
  const url = linkDoPayflow(qual);
  if(url && /^https:\/\//.test(url)) window.open(url, "_blank", "noopener");
  else mostrarToast(SEM_LINK);
}

function accaoCobranca(accao){
  const demo = modoDemonstracao();
  if(!demo){
    const destino = { "mudar-plano":"gerir", cancelar:"gerir", retomar:"gerir", pagar:"fatura", cartao:"cartao" }[accao];
    if(destino){ abrirNoPayflow(destino); return; }
  }
  if(accao === "mudar-plano"){ estadoCobranca.mudarPlano = true; desenharCobranca(); return; }
  if(accao === "fechar-plano"){ estadoCobranca.mudarPlano = false; desenharCobranca(); return; }
  if(accao === "guardar-plano"){
    const plano = document.getElementById("cobranca-plano").value, ciclo = document.getElementById("cobranca-ciclo").value;
    comCobrancaOcupada("plano", async () => {
      const p = planoDaCobranca(plano);
      if(precoDoCiclo(p, ciclo) == null) throw new Error("Esse plano ainda não está à venda.");
      demoMudar(c => { c.assinatura.plano = plano; c.assinatura.ciclo = ciclo; c.limite = p.alunosMax; });
      estadoCobranca.mudarPlano = false;
      mostrarToast("Plano mudado. Vale a partir da próxima cobrança.");
    });
    return;
  }
  if(accao === "guardar-faturacao"){
    const dados = { nome:val("fat-nome"), nuit:val("fat-nuit"), morada:val("fat-morada"), telefone:val("fat-telefone") };
    comCobrancaOcupada("faturacao", async () => {
      if(demo) demoMudar(c => { c.assinatura.faturacao = dados; });
      else await API.guardarFaturacao(dados);
      mostrarToast("Dados de faturação guardados.");
    });
    return;
  }
  if(accao === "cancelar"){
    const a = estadoCobranca.info.assinatura;
    const fim = a.pagoAte || a.testeAte;
    confirmarAcao({
      titulo: "Cancelar a assinatura",
      mensagem: a.estado === "teste"
        ? `Não é cobrado nada. A área de membros continua até ${dataCobranca(fim)}; depois os alunos deixam de ver os cursos.`
        : `Tudo continua a funcionar até ${dataCobranca(fim)}, que já está pago. Depois disso não há mais cobranças, e os alunos deixam de ver os cursos.`,
      textoConfirmar: "Cancelar assinatura",
      aoConfirmar: () => comCobrancaOcupada("cancelar", async () => {
        demoMudar(c => { c.assinatura.cancelaNoFim = true; });
        mostrarToast("Assinatura cancelada no fim do período.");
      })
    });
    return;
  }
  if(accao === "retomar"){
    comCobrancaOcupada("retomar", async () => {
      demoMudar(c => { c.assinatura.cancelaNoFim = false; });
      mostrarToast("Assinatura retomada.");
    });
    return;
  }
  if(accao === "pagar"){
    comCobrancaOcupada("pagar", async () => {
      demoMudar(c => { c.assinatura.estado = "ativa"; c.assinatura.ultimoErro = null; c.contaEmDia = true;
        c.assinatura.pagoAte = new Date(Date.now() + 30 * 864e5).toISOString(); if(c.faturas[0]){ c.faturas[0].estado = "paga"; c.faturas[0].pagoEm = new Date().toISOString(); c.faturas[0].motivo = null; } });
      mostrarToast("Pagamento feito. Os alunos voltam a ver os cursos.");
    });
    return;
  }
  if(accao === "cartao"){
    comCobrancaOcupada("cartao", async () => {
      demoMudar(c => {
        c.assinatura.cartao = { marca:"mastercard", ultimos4:"4444", expira:"11/2030" };
        if(c.assinatura.estado === "pendente"){ c.assinatura.estado = "teste"; c.assinatura.testeAte = new Date(Date.now() + 7 * 864e5).toISOString(); c.contaEmDia = true; }
      });
      mostrarToast("Cartão guardado.");
    });
  }
}
const val = id => (document.getElementById(id) || {}).value || "";

/* ---------------- O aviso da conta ----------------
   Em cima de cada ecrã: aos alunos, quando a escola não tem a conta em dia
   (não vêem os cursos, e é bom que saibam que não é deles); à equipa, quando
   falta o cartão ou um pagamento falhou. Nas escolas isentas, nada. */
function avisoDaConta(){
  const org = (typeof API !== "undefined" && API.organizacao) || null;
  let conta = org && org.conta, emDia = org ? org.contaEmDia !== false : true;
  if(modoDemonstracao() && new URLSearchParams(location.search).has("cobranca")){
    const d = cobrancaDaDemonstracao(); conta = { estado:d.assinatura.estado }; emDia = d.contaEmDia;
  }
  if(!conta || conta.estado === "isenta") return null;
  const equipa = papelEfetivo() === "administrador";
  if(!equipa) return emDia ? null : { tom:"aviso-conta-aluno", texto:"Os cursos estão temporariamente indisponíveis. A escola já foi avisada; volte a tentar mais tarde." };
  if(conta.estado === "pendente") return { tom:"aviso-conta-equipa", texto:"Falta pôr o pagamento para começar os dias grátis. Até lá, os alunos não vêem os cursos.", ir:"Pôr o pagamento" };
  if(conta.estado === "em_atraso") return { tom:"aviso-conta-equipa", texto: emDia ? "A última cobrança falhou. Trate do pagamento para os alunos não perderem o acesso." : "A conta não está em dia: os alunos não vêem os cursos.", ir:"Ver cobrança" };
  if(!emDia) return { tom:"aviso-conta-equipa", texto:"A assinatura terminou: os alunos não vêem os cursos.", ir:"Ver cobrança" };
  return null;
}
function renderAvisoConta(){
  document.querySelectorAll(".aviso-conta").forEach(el => el.remove());
  if(estado.viewAtual === "admin-cobranca") return;
  const a = avisoDaConta();
  if(!a) return;
  const conteudo = document.querySelector("#app-shell .content > div:not(.hidden)");
  if(!conteudo) return;
  const el = document.createElement("div");
  el.className = "aviso-conta " + a.tom;
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${a.texto}</span>${a.ir ? `<button class="btn btn-secondary btn-sm" type="button" data-ir-cobranca>${a.ir}</button>` : ""}`;
  conteudo.prepend(el);
  const b = el.querySelector("[data-ir-cobranca]");
  if(b) b.addEventListener("click", () => irPara("admin-cobranca"));
}

registarViews({ "admin-cobranca": renderAdminCobranca });
