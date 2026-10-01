/* ============================================================
   Configurações › Endereço da área de membros (W3, 01/10/2026)

   A escola liga o domínio dela (academia.a-sua-escola.com): escreve-o aqui,
   cria dois registos no DNS — um CNAME (ou um A, na raiz) que faz o endereço
   abrir a área de membros, e um TXT que prova que o domínio é dela — e
   carrega em Verificar. O servidor (`dominio-proprio`) confere o DNS, liga o
   domínio na Vercel, que emite o certificado, e diz em que passo está.

   A conta dos registos é a mesma da função, no repositório do painel
   (supabase/functions/_shared/dominio.ts, registosDe): se mudar lá, muda aqui.

   Os emails não mudam: saem com o nome da escola, como já saíam. Só os links
   passam a levar o domínio dela quando ele estiver ativo.
   ============================================================ */

const DOMINIO_TXT = "_verificacao-dominio";
const DOMINIO_CNAME = "cname.vercel-dns.com";
const DOMINIO_IP = "76.76.21.21";
const SUFIXOS_DUPLOS = new Set([
  "co.mz","org.mz","ac.mz","gov.mz","edu.mz","net.mz","com.mz",
  "co.za","org.za","ac.za","gov.za","net.za","web.za","edu.za",
  "co.ao","com.ao","org.ao","com.br","org.br","net.br","edu.br",
  "co.uk","org.uk","ac.uk","com.pt","org.pt","co.ke","co.tz","co.zw","co.bw","com.na"
]);

function registosDoDominio(dominio, token){
  const p = String(dominio).toLowerCase().split(".").filter(Boolean);
  const n = p.length >= 3 && SUFIXOS_DUPLOS.has(p.slice(-2).join(".")) ? 3 : 2;
  const zona = p.slice(-n).join("."), nome = p.slice(0, -n).join(".");
  return {
    zona,
    apontar: nome ? { tipo:"CNAME", nome, valor:DOMINIO_CNAME } : { tipo:"A", nome:"@", valor:DOMINIO_IP },
    prova: { tipo:"TXT", nome: DOMINIO_TXT + (nome ? "." + nome : ""), valor:"verificacao=" + token }
  };
}

const ESTADOS_DO_DOMINIO = {
  pendente:   { pill:"pill-inativo", rotulo:"À espera do DNS",
                texto:"Crie os dois registos abaixo no DNS do seu domínio e carregue em Verificar." },
  verificado: { pill:"pill-morno",   rotulo:"A ligar",
                texto:"O domínio é seu. Falta o endereço abrir a área de membros: o DNS pode demorar algumas horas a chegar a todo o lado, e o certificado de segurança é emitido logo a seguir." },
  ativo:      { pill:"pill-ativo",   rotulo:"Ativo",
                texto:"Os seus alunos já entram por este endereço, e os emails da academia passam a levá-lo." }
};

let estadoDominio = { carregado:false, info:null, erro:"", ocupado:false };

/* Na demonstração não há servidor: o domínio fica neste browser, e verificar
   dá-o por ligado, para se ver o caminho inteiro. */
function dominioDaDemonstracao(){
  return { enderecoPlataforma: location.host + "/", dominio: DB.dominioProprio || null };
}

async function carregarDominio(){
  estadoDominio = { carregado:false, info:null, erro:"", ocupado:false };
  if(modoDemonstracao()){ estadoDominio.info = dominioDaDemonstracao(); estadoDominio.carregado = true; return; }
  try { estadoDominio.info = await API.dominioProprio(); }
  catch(e){ estadoDominio.erro = "Não foi possível ler o domínio agora."; }
  estadoDominio.carregado = true;
}

function linhaDeRegisto(r){
  return `<tr>
    <td data-rotulo="Tipo"><strong>${r.tipo}</strong></td>
    <td data-rotulo="Nome"><code class="dns-valor">${textoSeguro(r.nome)}</code> <button class="btn btn-texto btn-sm" type="button" data-copiar="${textoSeguro(r.nome)}" aria-label="Copiar o nome ${textoSeguro(r.nome)}">Copiar</button></td>
    <td data-rotulo="Valor"><code class="dns-valor">${textoSeguro(r.valor)}</code> <button class="btn btn-texto btn-sm" type="button" data-copiar="${textoSeguro(r.valor)}" aria-label="Copiar o valor">Copiar</button></td>
  </tr>`;
}

function passoDaVerificacao(feito, texto){
  return `<li class="${feito ? "feito" : ""}"><span class="marca" aria-hidden="true">${feito ? "✓" : "○"}</span>${texto}<span class="so-leitor">${feito ? " — feito" : " — por fazer"}</span></li>`;
}

function blocoDominioHTML(){
  if(!estadoDominio.carregado) return `<p class="hint">A ler o endereço da sua área de membros…</p>`;
  if(estadoDominio.erro) return `<p class="hint">${estadoDominio.erro}</p>`;
  const info = estadoDominio.info || {};
  const d = info.dominio;
  const ativo = d && d.estado === "ativo";
  const endereco = ativo ? d.dominio : (info.enderecoPlataforma || location.host);
  const e = d ? (ESTADOS_DO_DOMINIO[d.estado] || ESTADOS_DO_DOMINIO.pendente) : null;
  const v = (d && d.verificacao) || {};
  const r = d ? registosDoDominio(d.dominio, d.token || "") : null;
  const ocupado = estadoDominio.ocupado ? "disabled" : "";

  return `
    <div class="dominio-atual">
      <span class="sub-celula">Os seus alunos entram em</span>
      <a href="https://${textoSeguro(endereco)}" target="_blank" rel="noopener">${textoSeguro(endereco)}</a>
    </div>

    <div class="field">
      <label for="dominio-valor">Domínio personalizado</label>
      <div class="linha-campo">
        <input id="dominio-valor" type="text" inputmode="url" autocomplete="off" spellcheck="false"
               placeholder="academia.a-sua-escola.com" value="${d ? textoSeguro(d.dominio) : ""}" ${ocupado}>
        <button class="btn btn-primary" type="button" id="btn-dominio-ligar" ${ocupado}>${d ? "Mudar" : "Ligar domínio"}</button>
      </div>
      <p class="hint">Use um subdomínio do site da sua escola, como <strong>academia.</strong>a-sua-escola.com — o site fica onde está. Vai precisar de entrar no sítio onde gere o domínio (onde o comprou).</p>
    </div>

    ${d ? `
      <div class="dominio-estado">
        <span class="pill ${e.pill}">${e.rotulo}</span>
        <p>${e.texto}</p>
      </div>

      ${ativo ? "" : `
        <p class="dominio-instrucao">No DNS de <strong>${textoSeguro(r.zona)}</strong>, crie estes dois registos:</p>
        <div class="table-wrap" tabindex="0">
          <table class="admin-table tabela-dns">
            <thead><tr><th>Tipo</th><th>Nome</th><th>Valor</th></tr></thead>
            <tbody>${linhaDeRegisto(r.apontar)}${linhaDeRegisto(r.prova)}</tbody>
          </table>
        </div>
        <p class="hint">O primeiro faz o endereço abrir a sua área de membros. O segundo prova que o domínio é seu; depois de verificado, pode apagá-lo. Se o seu fornecedor pedir o nome completo, junte <strong>.${textoSeguro(r.zona)}</strong> no fim.</p>
      `}

      <ul class="dominio-passos" aria-label="Verificação do domínio">
        ${passoDaVerificacao(d.estado !== "pendente", "O domínio é seu (registo TXT)")}
        ${passoDaVerificacao(!!v.aponta || ativo, "O endereço aponta para a plataforma (registo " + r.apontar.tipo + ")")}
        ${passoDaVerificacao(!!v.https || ativo, "Certificado de segurança emitido (https)")}
      </ul>
      ${v.quando ? `<p class="hint">Última verificação: ${new Date(v.quando).toLocaleString("pt-PT", { dateStyle:"short", timeStyle:"short" })}.</p>` : ""}

      <div class="linha-acoes">
        ${ativo ? "" : `<button class="btn btn-secondary" type="button" id="btn-dominio-verificar" ${ocupado}>${estadoDominio.ocupado ? "A verificar…" : "Verificar agora"}</button>`}
        <button class="btn btn-perigo-suave" type="button" id="btn-dominio-remover" ${ocupado}>Remover domínio</button>
      </div>
    ` : ""}
  `;
}

function desenharBlocoDominio(){
  const bloco = document.getElementById("bloco-dominio");
  if(!bloco) return;
  bloco.innerHTML = blocoDominioHTML();
  const ligar = document.getElementById("btn-dominio-ligar");
  if(ligar) ligar.addEventListener("click", () => ligarDominio(document.getElementById("dominio-valor").value));
  const campo = document.getElementById("dominio-valor");
  if(campo) campo.addEventListener("keydown", ev => { if(ev.key === "Enter"){ ev.preventDefault(); ligarDominio(campo.value); } });
  const verificar = document.getElementById("btn-dominio-verificar");
  if(verificar) verificar.addEventListener("click", verificarDominio);
  const remover = document.getElementById("btn-dominio-remover");
  if(remover) remover.addEventListener("click", removerDominio);
  bloco.querySelectorAll("[data-copiar]").forEach(b => b.addEventListener("click", () => {
    const texto = b.getAttribute("data-copiar");
    if(navigator.clipboard) navigator.clipboard.writeText(texto).then(() => mostrarToast("Copiado"), () => mostrarToast(texto));
    else mostrarToast(texto);
  }));
}

/* O que a escola escreveu, limpo: sem https://, sem barras, em minúsculas. */
function dominioEscrito(texto){
  return String(texto || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^\.+|\.+$/g, "");
}

async function comOcupado(trabalho){
  estadoDominio.ocupado = true; desenharBlocoDominio();
  try { await trabalho(); }
  catch(e){ mostrarToast(e.message || "Não foi possível tratar o domínio agora."); }
  estadoDominio.ocupado = false; desenharBlocoDominio();
}

function aplicarResposta(resposta){
  estadoDominio.info = Object.assign({}, estadoDominio.info, { dominio: resposta && resposta.dominio });
}

function ligarDominio(texto){
  const dominio = dominioEscrito(texto);
  if(!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dominio)){
    mostrarToast("Escreva só o domínio, por exemplo academia.a-sua-escola.com.");
    return;
  }
  const atual = estadoDominio.info && estadoDominio.info.dominio;
  if(atual && atual.dominio === dominio){ verificarDominio(); return; }
  const fazer = () => comOcupado(async () => {
    if(modoDemonstracao()){
      DB.dominioProprio = { dominio, estado:"pendente", token: novoId("dv").replace(/[^a-z0-9]/gi, "").toLowerCase(), verificacao:{} };
      guardarDB();
      aplicarResposta({ dominio: DB.dominioProprio });
    } else {
      aplicarResposta(await API.gerirDominio("ligar", dominio));
    }
    mostrarToast("Domínio guardado. Crie os registos no DNS e verifique.");
  });
  if(atual && atual.estado === "ativo"){
    confirmarAcao({
      titulo: "Mudar de domínio",
      mensagem: `Os alunos deixam de entrar por ${textoSeguro(atual.dominio)} e voltam ao endereço da plataforma até ${textoSeguro(dominio)} ficar ativo.`,
      textoConfirmar: "Mudar",
      aoConfirmar: fazer
    });
  } else fazer();
}

function verificarDominio(){
  comOcupado(async () => {
    if(modoDemonstracao()){
      const d = DB.dominioProprio;
      if(!d) return;
      d.estado = "ativo";
      d.verificacao = { quando:new Date().toISOString(), prova:true, aponta:true, https:true, vercel:true };
      guardarDB();
      aplicarResposta({ dominio:d });
    } else {
      aplicarResposta(await API.gerirDominio("verificar"));
    }
    const d = estadoDominio.info.dominio;
    mostrarToast(!d ? "Sem domínio para verificar"
      : d.estado === "ativo" ? "Domínio ativo: os alunos já entram por " + d.dominio
      : d.estado === "verificado" ? "O domínio é seu. Falta o endereço abrir — volte a verificar daqui a pouco."
      : "Ainda não encontrámos o registo TXT. O DNS pode demorar; volte a verificar daqui a pouco.");
  });
}

function removerDominio(){
  const d = estadoDominio.info && estadoDominio.info.dominio;
  if(!d) return;
  confirmarAcao({
    titulo: "Remover o domínio",
    mensagem: `${textoSeguro(d.dominio)} deixa de abrir a sua área de membros. Os alunos voltam a entrar pelo endereço da plataforma.`,
    textoConfirmar: "Remover",
    aoConfirmar: () => comOcupado(async () => {
      if(modoDemonstracao()){ DB.dominioProprio = null; guardarDB(); aplicarResposta({ dominio:null }); }
      else aplicarResposta(await API.gerirDominio("remover"));
      mostrarToast("Domínio removido");
    })
  });
}

/* Chamado pelas Configurações depois de desenharem o ecrã. Os interruptores
   redesenham o ecrã inteiro: o domínio já lido não se volta a pedir. */
async function mostrarBlocoDominio(){
  if(estadoDominio.carregado && !estadoDominio.erro){ desenharBlocoDominio(); return; }
  desenharBlocoDominio();
  await carregarDominio();
  desenharBlocoDominio();
}
