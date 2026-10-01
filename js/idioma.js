/* ============================================================
   A LÍNGUA DA ACADEMIA — português e inglês
   (decidido pelo Shelton a 30/09/2026, no molde do checkout)

   O português é a chave: t("Meus cursos") devolve o inglês quando a
   língua é o inglês e há tradução em EN (js/idioma-en.js), e o próprio
   português em qualquer outro caso. Uma tradução em falta nunca deixa uma
   chave à vista de ninguém — mas também nunca avisa. Por isso há um teste
   (testes/casos/15-idioma.mjs) que junta tudo o que passa pelo t() e exige
   que esteja no dicionário.

   O QUE SE TRADUZ é o que o aluno vê: a entrada, a primeira entrada, os
   ecrãs do aluno, os erros que lhe aparecem, o certificado, e os textos de
   origem da base (conquistas, texto de entrada) enquanto estiverem como
   vieram. O painel da equipa fica em português, e o conteúdo que a equipa
   escreve (cursos, aulas, eventos) fica como foi escrito.

   QUE LÍNGUA ABRE, por esta ordem:
     1. a última escolhida neste browser (o botão PT/EN)
     2. a guardada na conta (Definições; academia.perfis.idioma)
     3. a língua com que a pessoa comprou (user_metadata.idioma, desde o convite)
     4. português
   A escolha feita no browser vem primeiro porque é a mais recente: quem
   carregou em EN à entrada não quer voltar ao português ao entrar.

   O dinheiro escreve-se igual nas duas línguas («MZ 1 500,00»), como no
   checkout. As datas seguem a língua.
   ============================================================ */
const IDIOMAS = [
  { id:"pt", sigla:"PT", nome:"Português" },
  { id:"en", sigla:"EN", nome:"English" }
];
const LEMBRETE_IDIOMA = "academia.idioma";
const idiomaValido = x => x === "pt" || x === "en";
let idiomaAtual = null;

function idiomaLembrado(){
  /* Em janela privada, ou com os dados do sítio bloqueados, isto rebenta. */
  try { const g = localStorage.getItem(LEMBRETE_IDIOMA); return idiomaValido(g) ? g : null; }
  catch(e){ return null; }
}
function idioma(){ return idiomaAtual || idiomaLembrado() || "pt"; }
function localeDoIdioma(){ return idioma() === "en" ? "en-GB" : "pt-PT"; }

/* O painel da equipa fica em português, seja qual for a língua escolhida:
   a equipa trabalha em português. A pré-visualização «como aluno» traduz. */
function emModoEquipa(){
  try { return typeof papelEfetivo === "function" && papelEfetivo() === "administrador"; }
  catch(e){ return false; }
}

function t(pt, vars){
  let fora = (idioma() === "en" && !emModoEquipa() && typeof EN !== "undefined" && Object.prototype.hasOwnProperty.call(EN, pt)) ? EN[pt] : pt;
  /* Uma chave com contexto que caia aqui sem tradução mostra só o texto. */
  if(fora === pt && pt.includes("|")) fora = pt.slice(pt.indexOf("|") + 1);
  if(vars) for(const k in vars) fora = fora.split("{" + k + "}").join(String(vars[k]));
  return fora;
}

/* A mesma palavra em português pode pedir duas em inglês: «Entrar» é «Sign in»
   no ecrã de entrada e «Join» num grupo. Para esses, a chave leva o contexto
   («grupo|Entrar»); sem ele no dicionário, vale a tradução de sempre. */
function tc(contexto, pt, vars){
  const chave = contexto + "|" + pt;
  if(idioma() === "en" && !emModoEquipa() && typeof EN !== "undefined" && Object.prototype.hasOwnProperty.call(EN, chave))
    return t(chave, vars);
  return t(pt, vars);
}

/* A língua que a conta traz, ao entrar. Não se lembra no browser: não foi
   uma escolha feita aqui. */
function aplicarIdiomaDaConta({ perfil, compra }){
  idiomaAtual = idiomaLembrado() || (idiomaValido(perfil) ? perfil : null) || (idiomaValido(compra) ? compra : null) || "pt";
  document.documentElement.lang = idiomaAtual;
  traduzirEstatico();
}

/* Um toque em PT/EN: fica lembrado neste browser. Quem trata de o guardar
   também na conta é quem chama (as Definições). */
function escolherIdioma(id){
  if(!idiomaValido(id)) return false;
  idiomaAtual = id;
  try { localStorage.setItem(LEMBRETE_IDIOMA, id); } catch(e){}
  document.documentElement.lang = id;
  traduzirEstatico();
  return true;
}

/* O HTML fixo do index.html: data-t (o texto), data-t-placeholder e
   data-t-aria. O português original fica guardado no próprio elemento, para
   se poder voltar a ele. Só em elementos sem filhos com eventos: o texto é
   substituído por inteiro. */
function traduzirEstatico(raiz){
  const r = raiz || document;
  r.querySelectorAll("[data-t]").forEach(el => {
    if(el.dataset.tPt === undefined) el.dataset.tPt = el.textContent.trim();
    el.textContent = t(el.dataset.tPt);
  });
  [["data-t-placeholder", "placeholder", "tPtPlaceholder"], ["data-t-aria", "aria-label", "tPtAria"]].forEach(([marca, atributo, chave]) => {
    r.querySelectorAll("[" + marca + "]").forEach(el => {
      if(el.dataset[chave] === undefined) el.dataset[chave] = el.getAttribute(atributo) || "";
      el.setAttribute(atributo, t(el.dataset[chave]));
    });
  });
}

/* O selector PT/EN, igual na entrada e nas Definições. */
function seletorDeIdiomaHTML(){
  return `<div class="seletor-idioma" role="group" aria-label="Idioma · Language">${
    IDIOMAS.map(i => `<button type="button" data-idioma="${i.id}" aria-pressed="${i.id === idioma()}" lang="${i.id}" title="${i.nome}">${i.sigla}</button>`).join("")
  }</div>`;
}

/* ?lang=en no endereço (o link de recuperar a password leva-o). */
(function(){
  try {
    const pedido = new URLSearchParams(location.search).get("lang");
    if(idiomaValido(pedido)) escolherIdioma(pedido);
  } catch(e){}
  document.documentElement.lang = idioma();
})();
