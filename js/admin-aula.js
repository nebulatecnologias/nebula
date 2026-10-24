/* ============================================================
   Administração › Conteúdos › Aula
   Página inteira, com quatro formatos de conteúdo: texto,
   vídeo, ficheiros e quiz. Tudo o que aqui se guarda aparece
   na aula que o aluno abre.
   ============================================================ */

/* O balde privado aceita ate 10 MB por ficheiro. */
const LIMITE_MATERIAL = 10 * 1024 * 1024;

function abrirFormAula(cursoId, moduloId, aulaId){
  estado.aulaNoForm = { cursoId, moduloId, aulaId };
  estado.abaAulaForm = "texto";
  estado.rascunhoAula = null;          // cada aula abre com o seu próprio rascunho
  irPara("admin-aula-form");
}

function contextoDaAula(){
  const ctx = estado.aulaNoForm || {};
  const curso = cursoPorId(ctx.cursoId);
  if(!curso) return null;
  const modulo = moduloPorIdNoCurso(curso, ctx.moduloId) || curso.modulos[0];
  if(!modulo) return null;
  const aula = ctx.aulaId ? modulo.aulas.find(a=>a.id===ctx.aulaId) : null;
  return { curso, modulo, aula };
}

function renderFormAula(){
  const ctx = contextoDaAula();
  if(!ctx){ irPara("admin-conteudos"); return; }
  const { curso, modulo, aula } = ctx;
  const v = aula || { ficheiros:[], quiz:[], conteudo:"" };
  const aba = estado.abaAulaForm || "texto";

  document.getElementById("content-admin").innerHTML = `
    <div class="form-page">
      <div class="form-topo">
        <h1>${aula ? "Editar aula" : "Nova aula"}</h1>
        <p class="desc" style="margin:4px 0 0;color:var(--muted);">${curso.titulo}${modulo ? " · " + modulo.titulo : ""}</p>
      </div>

      <div class="aula-form-grid">
        <div>
          <div class="field">
            <label>Título</label>
            <input type="text" id="a-titulo" value="${(v.titulo||"").replace(/"/g,"&quot;")}" placeholder="ex: A identidade do fundador">
          </div>
          <div class="field">
            <label for="a-modulo">Módulo</label>
            <div class="select-wrap" style="display:block;">
              <select id="a-modulo" style="width:100%;">
                ${curso.modulos.map(m=>`<option value="${m.id}" ${m.id===modulo.id?"selected":""}>${m.titulo}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="field">
            <label for="a-descricao">Descrição curta</label>
            <textarea id="a-descricao" rows="2" placeholder="A frase que aparece logo por baixo do título.">${(rascunhoAula().descricao||"").replace(/</g,"&lt;")}</textarea>
          </div>
          ${checkCardHTML("a-semComentarios", !!v.semComentarios, "Desativar comentários neste conteúdo", "O aluno deixa de poder avaliar e comentar esta aula.")}
          ${checkCardHTML("a-semBuscaIA", !!v.semBuscaIA, "Desativar busca por IA neste conteúdo", "O Assistente ignora esta aula ao gerar rascunhos.")}
        </div>
        <div>
          <label class="rotulo-solto">Imagem de capa</label>
          ${uploadHTML("capaAula", v.capa, "480 × 270 px (16:9). É a miniatura da aula na lista do curso, sem cortes.", "pequena", "capas/aulas")}
        </div>
      </div>

      <div class="editor-abas" id="editor-abas">
        <button data-aba="texto" class="${aba==="texto"?"active":""}">${ICONS.book}Texto</button>
        <button data-aba="video" class="${aba==="video"?"active":""}">${ICONE_VIDEO}Vídeo</button>
        <button data-aba="ficheiros" class="${aba==="ficheiros"?"active":""}">${ICONS.ficheiro}Ficheiros</button>
        <button data-aba="quiz" class="${aba==="quiz"?"active":""}">${ICONS.quiz}Quiz</button>
        <button data-aba="embed" class="${aba==="embed"?"active":""}">${ICONE_EMBED}Embed</button>
      </div>
      <div id="editor-painel"></div>

      <div class="form-rodape">
        ${aula ? `<button class="btn btn-perigo-suave" id="btn-apagar-aula-form">Apagar aula</button>` : ""}
        <div class="form-rodape-acoes">
          <button class="btn btn-texto" id="btn-cancelar-aula">Cancelar</button>
          <button class="btn btn-contorno" id="btn-guardar-outra">Guardar e criar outra</button>
          <button class="btn btn-primary" id="btn-guardar-aula">Guardar</button>
        </div>
      </div>
    </div>
  `;

  ligarCheckCards();
  ligarUploads();
  renderPainelEditor();

  document.querySelectorAll("#editor-abas button").forEach(b => b.addEventListener("click", () => mudarAbaAula(b.getAttribute("data-aba"))));

  document.getElementById("btn-cancelar-aula").addEventListener("click", () => irPara("admin-curso-editor", curso.id));
  document.getElementById("btn-guardar-aula").addEventListener("click", () => guardarFormAula(false));
  document.getElementById("btn-guardar-outra").addEventListener("click", () => guardarFormAula(true));
  const btnApagar = document.getElementById("btn-apagar-aula-form");
  if(btnApagar) btnApagar.addEventListener("click", () => apagarAula(curso, modulo, aula));
}

function mudarAbaAula(aba){
  recolherPainelAtual();
  estado.abaAulaForm = aba;
  document.querySelectorAll("#editor-abas button").forEach(x => x.classList.toggle("active", x.getAttribute("data-aba") === aba));
  renderPainelEditor();
}

const ICONE_VIDEO = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.5 4.5 2.5-4.5 2.5Z" fill="currentColor"/></svg>';
const ICONE_EMBED = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="m13.5 5-3 14"/></svg>';

/* O painel troca de formato sem perder o que já lá está: antes de
   mudar de aba, o que está no ecrã é recolhido para o rascunho. */
function rascunhoAula(){
  if(!estado.rascunhoAula){
    const ctx = contextoDaAula();
    const a = ctx && ctx.aula;
    estado.rascunhoAula = {
      conteudo: a ? (a.conteudo||"") : "",
      embed: a ? (a.embed||"") : "",
      videoId: a ? (a.videoId||"") : "",
      duracao: a ? duracaoLegivel(a) : "",
      videoTitulo: "",
      descricao: a ? (a.descricao||"") : "",
      ficheiros: a ? JSON.parse(JSON.stringify(a.ficheiros||[])) : [],
      quiz: a ? JSON.parse(JSON.stringify(a.quiz||[])) : []
    };
  }
  return estado.rascunhoAula;
}

function recolherPainelAtual(){
  const r = rascunhoAula();
  const editor = document.getElementById("editor-texto");
  if(editor) r.conteudo = editor.innerHTML;
  const emb = document.getElementById("a-embed");
  if(emb) r.embed = emb.value.trim();
  const desc = document.getElementById("a-descricao");
  if(desc) r.descricao = desc.value.trim();
}

function renderPainelEditor(){
  const painel = document.getElementById("editor-painel");
  const aba = estado.abaAulaForm || "texto";
  if(aba==="texto") return renderPainelTexto(painel);
  if(aba==="video") return renderPainelVideo(painel);
  if(aba==="ficheiros") return renderPainelFicheiros(painel);
  if(aba==="embed") return renderPainelEmbed(painel);
  return renderPainelQuiz(painel);
}

/* ---------------- Texto ---------------- */
const FERRAMENTAS = [
  { cmd:"bold",          rotulo:"<b>B</b>",  titulo:"Negrito" },
  { cmd:"italic",        rotulo:"<i>I</i>",  titulo:"Itálico" },
  { cmd:"underline",     rotulo:"<u>U</u>",  titulo:"Sublinhado" },
  { cmd:"cor",           rotulo:svgFerramenta('<path d="M4 20h16"/><path d="m7 16 5-11 5 11"/><path d="M9 12h6"/>'), titulo:"Cor do texto" },
  { cmd:"titulo",        rotulo:svgFerramenta('<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/>'), titulo:"Título" },
  { cmd:"justifyLeft",   rotulo:svgFerramenta('<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h14"/>'), titulo:"Alinhar" },
  { cmd:"insertUnorderedList", rotulo:svgFerramenta('<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'), titulo:"Lista" },
  { cmd:"link",          rotulo:svgFerramenta('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'), titulo:"Ligação" },
  { cmd:"imagem",        rotulo:svgFerramenta('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/>'), titulo:"Imagem" },
  { cmd:"emoji",         rotulo:svgFerramenta('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>'), titulo:"Emoji" },
  { cmd:"tabela",        rotulo:svgFerramenta('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 10v10"/>'), titulo:"Tabela" },
  { cmd:"sugerir",       rotulo:svgFerramenta('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m7.5 7.5 2.5 2.5M14 14l2.5 2.5M16.5 7.5 14 10M10 14l-2.5 2.5"/>'), titulo:"Sugerir texto" },
  { cmd:"removeFormat",  rotulo:svgFerramenta('<path d="M4 7V5h11v2"/><path d="M9 5 7 19"/><path d="m15 13 6 6M21 13l-6 6"/>'), titulo:"Limpar formatação" },
  { cmd:"codigo",        rotulo:svgFerramenta('<path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/>'), titulo:"Bloco de código" },
  { cmd:"ecra",          rotulo:svgFerramenta('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/>'), titulo:"Ecrã inteiro" }
];
function svgFerramenta(caminho){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${caminho}</svg>`;
}
const EMOJIS = ["🔥","💡","✅","⚠️","📌","🎯","🙏","💪","📈","🚀","❤️","👏"];

function renderPainelTexto(painel){
  const r = rascunhoAula();
  painel.innerHTML = `
    <div class="card editor-caixa" id="editor-caixa">
      <div class="editor-toolbar">
        ${FERRAMENTAS.map(f=>`<button type="button" data-cmd="${f.cmd}" title="${f.titulo}">${f.rotulo}</button>`).join("")}
      </div>
      <div class="editor-area" id="editor-texto" contenteditable="true" spellcheck="true">${r.conteudo}</div>
      <input type="color" class="hidden" id="editor-cor" value="#ff5a1f">
      <input type="file" accept="image/*" class="hidden" id="editor-imagem">
    </div>
    <p class="hint" style="margin-top:8px;">Este texto aparece por baixo do vídeo, na aula do aluno.</p>
  `;

  const area = document.getElementById("editor-texto");
  const corInput = document.getElementById("editor-cor");
  const imgInput = document.getElementById("editor-imagem");

  corInput.addEventListener("input", () => aplicarComando("foreColor", corInput.value));
  imgInput.addEventListener("change", async e => {
    const f = e.target.files[0];
    if(!f) return;
    try {
      const url = await enviarImagem(f, "conteudo");
      area.focus();
      aplicarComando("insertImage", url);
    } catch(erro){ mostrarToast(erro.message || "Não foi possível enviar a imagem."); }
  });

  painel.querySelectorAll("[data-cmd]").forEach(b => b.addEventListener("click", () => {
    const cmd = b.getAttribute("data-cmd");
    area.focus();
    if(cmd==="cor") return corInput.click();
    if(cmd==="imagem") return imgInput.click();
    if(cmd==="titulo") return aplicarComando("formatBlock", "<h3>");
    if(cmd==="codigo") return aplicarComando("formatBlock", "<pre>");
    if(cmd==="link"){
      const url = prompt("Endereço da ligação:", "https://");
      if(url) aplicarComando("createLink", url);
      return;
    }
    if(cmd==="tabela") return inserirHTML(tabelaVaziaHTML());
    if(cmd==="emoji") return abrirMenu(b, EMOJIS.map(e => ({ rotulo:e, accao:() => { area.focus(); inserirHTML(e); } })));
    if(cmd==="sugerir") return sugerirTextoDaAula();
    if(cmd==="ecra"){
      document.getElementById("editor-caixa").classList.toggle("ecra-inteiro");
      return;
    }
    aplicarComando(cmd);
  }));
}

function aplicarComando(cmd, valor){ document.execCommand(cmd, false, valor); }
function inserirHTML(html){ document.execCommand("insertHTML", false, html); }
function tabelaVaziaHTML(){
  const celula = "<td>&nbsp;</td>";
  const linha = `<tr>${celula.repeat(3)}</tr>`;
  return `<table class="tabela-conteudo"><tbody>${linha.repeat(3)}</tbody></table><p><br></p>`;
}

/* Um primeiro parágrafo a partir do título, para não começar em branco. */
function sugerirTextoDaAula(){
  const titulo = document.getElementById("a-titulo").value.trim();
  if(!titulo){ mostrarToast("Escreva primeiro o título da aula."); return; }
  const ctx = contextoDaAula();
  inserirHTML(`<h3>${titulo}</h3><p>Nesta aula do ${ctx.curso.titulo} vamos ver ${titulo.toLowerCase()} — o que é, porque conta e como aplicar já a seguir.</p><ul><li>O ponto de partida</li><li>O erro mais comum</li><li>O que fazer esta semana</li></ul>`);
}

/* ---------------- Vídeo (24/10/2026) ----------------
   O separador Vídeo é a biblioteca do provedor ligado (hoje o Panda),
   já aberta: escolher um vídeo liga-o a esta aula; «Selecionar vários»
   cria uma aula por vídeo no módulo escolhido. Colar um código de
   incorporação passou para o separador Embed. */
function renderPainelVideo(painel){
  const r = rascunhoAula();
  const url = urlDoVideo({ embed:r.embed });
  const p = Panda.estado;

  if(!p){
    painel.innerHTML = `<div class="card painel"><p class="empty-note">A abrir a biblioteca de vídeos…</p></div>`;
    Panda.lerEstado().then(() => { if(painel.isConnected && estado.abaAulaForm === "video") renderPainelVideo(painel); });
    return;
  }

  const atual = url ? `
      <div class="video-atual">
        <div class="player-wrap previa">${playerHTML({ embed:r.embed }, "Pré-visualização")}</div>
        <div class="video-atual-info">
          <span class="rotulo-solto">Vídeo desta aula</span>
          <strong>${Panda.esc(r.videoTitulo || nomeDoProvedor(url))}</strong>
          ${r.duracao ? `<span class="sub-celula">${Panda.esc(r.duracao)}</span>` : ""}
          <button class="btn btn-texto btn-sm" type="button" id="btn-video-tirar">Tirar o vídeo</button>
        </div>
      </div>` : "";

  if(!Panda.provedoresLigados().length){
    painel.innerHTML = `<div class="card painel">${atual}
      <div class="video-sem-biblioteca">
        <strong>${p.podeLigar ? "Ligue a sua biblioteca de vídeos" : "A biblioteca de vídeos ainda não está ligada"}</strong>
        <p>${p.podeLigar
          ? "Com o Panda ligado, este separador mostra todos os seus vídeos e escolhe-os sem copiar código nenhum."
          : "Peça à administração da escola que ligue o Panda em Integrações."} Entretanto, pode colar um código no separador Embed.</p>
        <div class="acoes">${p.podeLigar ? `<button class="btn btn-primary btn-sm" type="button" id="btn-panda-ligar">Ligar o Panda</button>` : ""}
          <button class="btn btn-secondary btn-sm" type="button" data-ir-aba="embed">Usar um código (Embed)</button></div>
      </div></div>`;
    ligarPainelVideo(painel);
    return;
  }

  painel.innerHTML = `<div class="card painel painel-biblioteca">${atual}<div id="biblioteca-video"></div></div>`;
  const ctx = contextoDaAula();
  const moduloAtual = (document.getElementById("a-modulo") || {}).value || (ctx.modulo && ctx.modulo.id);
  Panda.montar(document.getElementById("biblioteca-video"), {
    atual: url,
    aoEscolher: v => {
      recolherPainelAtual();
      r.embed = v.player;
      r.duracao = formatarDuracao(v.duracao);
      r.videoTitulo = v.titulo;
      const titulo = document.getElementById("a-titulo");
      if(titulo && !titulo.value.trim()) titulo.value = Panda.tituloDaAula(v.titulo);
      renderPainelVideo(painel);
      mostrarToast(`Vídeo escolhido: ${v.titulo}. Guarde a aula para o aluno o ver.`);
    },
    varios: {
      modulos: ctx.curso.modulos.map(m => ({ id:m.id, titulo:m.titulo })),
      modulo: moduloAtual,
      aoCriar: async (videos, moduloId) => {
        const m = await criarAulasDosVideos(ctx.curso, moduloId, videos);
        mostrarToast(`${videos.length === 1 ? "1 aula criada" : videos.length + " aulas criadas"} em ${m.titulo}.`);
        /* Uma aula nova ainda em branco não fica: volta-se ao curso, com as aulas criadas. */
        if(!ctx.aula){ estado.rascunhoAula = null; irPara("admin-curso-editor", ctx.curso.id); }
      }
    }
  });
  ligarPainelVideo(painel);
}

function ligarPainelVideo(painel){
  const r = rascunhoAula();
  const tirar = document.getElementById("btn-video-tirar");
  if(tirar) tirar.addEventListener("click", () => {
    r.embed = ""; r.duracao = ""; r.videoTitulo = "";
    renderPainelVideo(painel);
  });
  const ligar = document.getElementById("btn-panda-ligar");
  if(ligar) ligar.addEventListener("click", () => irPara("admin-integracoes"));
  painel.querySelectorAll("[data-ir-aba]").forEach(b => b.addEventListener("click", () => mudarAbaAula(b.dataset.irAba)));
  /* Um vídeo colado sem duração gravada: pergunta-se ao leitor. */
  const leitor = painel.querySelector("iframe.player-embed");
  if(leitor && !r.duracao) medirDuracao(leitor, anotarDuracao);
}

function nomeDoProvedor(url){
  try {
    const h = new URL(url).hostname;
    if(/pandavideo/i.test(h)) return "Vídeo do Panda";
    if(/youtube|youtu\.be/i.test(h)) return "Vídeo do YouTube";
    if(/vimeo/i.test(h)) return "Vídeo do Vimeo";
    if(/mediadelivery|bunny/i.test(h)) return "Vídeo do Bunny";
    return h.replace(/^www\./, "");
  } catch(e){ return "Vídeo ligado"; }
}

/* Uma aula por vídeo, no fim do módulo, pela ordem em que foram escolhidos. */
async function criarAulasDosVideos(curso, moduloId, videos){
  const modulo = moduloPorIdNoCurso(curso, moduloId);
  if(!modulo) throw new Error("Escolha o módulo onde as aulas ficam.");
  for(const v of videos){
    const aula = {
      id: novoId("aula"), ordem: modulo.aulas.length + 1,
      titulo: Panda.tituloDaAula(v.titulo), duracao: formatarDuracao(v.duracao) || "00:00",
      capa: "", semComentarios: false, semBuscaIA: false,
      conteudo: "", embed: v.player, descricao: "", ficheiros: [], quiz: []
    };
    modulo.aulas.push(aula);
    await salvarAula(aula, modulo.id);
  }
  return modulo;
}

/* ---------------- Embed ----------------
   Para os vídeos de um provedor sem biblioteca ligada (YouTube, Vimeo,
   Bunny…) ou para quem prefira colar. */
function renderPainelEmbed(painel){
  const r = rascunhoAula();
  const provedor = (DB.config.integracoes||{}).player || "Panda Video";
  const aulaFicticia = { embed:r.embed };
  const url = urlDoVideo(aulaFicticia);
  const codigoDado = (r.embed||"").trim();

  painel.innerHTML = `
    <div class="card painel">
      <div class="field">
        <label for="a-embed">Código de incorporação (embed)</label>
        <textarea id="a-embed" rows="4" class="campo-codigo" placeholder="Cole aqui o código copiado do ${provedor} — algo como &lt;iframe src=&quot;...&quot;&gt;&lt;/iframe&gt;">${(r.embed||"").replace(/</g,"&lt;")}</textarea>
        <p class="hint">Aceita o código completo, ou só o endereço do vídeo. Aproveitamos apenas o endereço: o player é montado por nós, com o estilo da academia.</p>
      </div>
      <div class="estado-embed ${codigoDado ? (url?"bom":"mau") : ""}">
        ${codigoDado
          ? (url ? `${iconeCheck()} Endereço reconhecido: <code>${url}</code>`
                 : `⚠ Não encontrámos um endereço neste código. Copie o bloco que traz <code>&lt;iframe&gt;</code>.`)
          : `Sem código, a aula mostra o marcador ao aluno.`}
      </div>
      <label class="rotulo-solto">Como o aluno vai ver</label>
      <div class="player-wrap previa">${playerHTML(aulaFicticia, "Pré-visualização")}</div>
      <p class="hint" style="margin-top:10px;">Onde copiar no ${provedor}: ${ondeCopiar(provedor)}</p>
    </div>
  `;

  const campo = document.getElementById("a-embed");
  /* Colar já mostra o resultado, sem ter de sair do campo. Um código novo
     larga a duração do anterior: a nova vem do leitor. */
  const mudou = () => {
    const antes = r.embed;
    recolherPainelAtual();
    if(r.embed !== antes){ r.duracao = ""; r.videoTitulo = ""; }
    renderPainelEmbed(painel);
  };
  campo.addEventListener("change", mudou);
  campo.addEventListener("paste", () => setTimeout(mudou, 0));

  const leitor = painel.querySelector("iframe.player-embed");
  if(leitor && !r.duracao) medirDuracao(leitor, anotarDuracao);
}

/* A duração não se escreve: guarda-se o que o vídeo disser. */
function anotarDuracao(texto){
  const rascunho = rascunhoAula();
  if(rascunho && texto) rascunho.duracao = texto;
}

function ondeCopiar(provedor){
  if(/panda/i.test(provedor)) return "abra o vídeo na biblioteca, carregue em <strong>Compartilhar › Embed</strong> e copie o bloco inteiro.";
  if(/youtube/i.test(provedor)) return "no vídeo, <strong>Partilhar › Incorporar</strong>, e copie o código.";
  if(/vimeo/i.test(provedor)) return "no vídeo, <strong>Share › Embed</strong>, e copie o código.";
  return "procure a opção de partilha ou incorporação (embed) do seu provedor e copie o bloco com <code>&lt;iframe&gt;</code>.";
}

/* ---------------- Ficheiros ---------------- */
function renderPainelFicheiros(painel){
  const r = rascunhoAula();
  painel.innerHTML = `
    <div class="card painel">
      <div class="table-card-head" style="padding:0 0 14px;">
        <h3>Materiais da aula</h3>
        <button class="btn btn-secondary btn-sm" id="btn-add-ficheiro">+ Adicionar ficheiro</button>
      </div>
      ${r.ficheiros.length ? `<div class="lista-ficheiros">
        ${r.ficheiros.map((f,i)=>`
          <div class="ficheiro-linha">
            ${ICONS.ficheiro}
            <div class="ficheiro-info"><strong>${f.nome}</strong><span class="sub-celula">${f.tamanho ? f.tamanho+" · " : ""}${f.url.startsWith("data:") ? "Guardado nesta demonstração" : f.url}</span></div>
            <button class="btn-icone perigo" data-remover-ficheiro="${i}" title="Remover"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
          </div>`).join("")}
      </div>` : `<div class="empty-note">Sem materiais. Junte o PDF, a folha de trabalho ou o modelo que o aluno deve descarregar.</div>`}
      <input type="file" class="hidden" id="ficheiro-anexo">
    </div>
  `;

  const input = document.getElementById("ficheiro-anexo");
  document.getElementById("btn-add-ficheiro").addEventListener("click", () => input.click());
  input.addEventListener("change", async e => {
    const f = e.target.files[0];
    if(!f) return;
    if(f.size > LIMITE_MATERIAL){
      mostrarToast(`"${f.name}" tem ${formatarTamanho(f.size)}. O limite é ${formatarTamanho(LIMITE_MATERIAL)}.`);
      return;
    }
    const botao = document.getElementById("btn-add-ficheiro");
    botao.disabled = true; botao.textContent = "A enviar...";
    try {
      const ctxAula = contextoDaAula();
      const aulaId = (ctxAula && ctxAula.aula) ? ctxAula.aula.id : "novas";
      const url = await enviarAnexo(f, "materiais/" + aulaId);
      r.ficheiros.push({ nome:f.name, url, tipo:f.type, tamanho:formatarTamanho(f.size) });
      renderPainelFicheiros(painel);
    } catch(erro){
      mostrarToast(erro.message || "Não foi possível enviar o ficheiro.");
      botao.disabled = false; botao.textContent = "+ Adicionar ficheiro";
    }
  });
  painel.querySelectorAll("[data-remover-ficheiro]").forEach(b => b.addEventListener("click", () => {
    r.ficheiros.splice(Number(b.getAttribute("data-remover-ficheiro")), 1);
    renderPainelFicheiros(painel);
  }));
}

/* ---------------- Quiz ---------------- */
function renderPainelQuiz(painel){
  const r = rascunhoAula();
  painel.innerHTML = `
    <div class="card painel">
      <div class="table-card-head" style="padding:0 0 14px;">
        <h3>Quiz da aula</h3>
        <button class="btn btn-secondary btn-sm" id="btn-add-pergunta">+ Nova pergunta</button>
      </div>
      ${r.quiz.length ? r.quiz.map((q,i)=>`
        <div class="quiz-bloco">
          <div class="quiz-bloco-head">
            <span class="quiz-num">${i+1}</span>
            <input type="text" class="quiz-pergunta" data-pergunta="${i}" value="${(q.pergunta||"").replace(/"/g,"&quot;")}" placeholder="Escreva a pergunta">
            <button class="btn-icone perigo" data-remover-pergunta="${i}" title="Remover"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
          </div>
          <div class="quiz-opcoes">
            ${q.opcoes.map((o,j)=>`
              <label class="quiz-opcao ${q.certa===j?"certa":""}">
                <input type="radio" name="certa-${i}" data-certa="${i}" value="${j}" ${q.certa===j?"checked":""}>
                <input type="text" class="quiz-texto" data-opcao="${i}-${j}" value="${(o||"").replace(/"/g,"&quot;")}" placeholder="Opção ${j+1}">
                ${q.opcoes.length>2 ? `<button class="btn-icone" data-remover-opcao="${i}-${j}" title="Remover opção">×</button>` : ""}
              </label>`).join("")}
          </div>
          <button class="btn-nova-aula" data-add-opcao="${i}">+ Adicionar opção</button>
        </div>`).join("")
      : `<div class="empty-note">Sem perguntas. Um quiz curto no fim da aula ajuda a fixar o que ficou.</div>`}
      <p class="hint" style="margin-top:12px;">Marque o círculo da opção certa. O aluno responde no fim da aula e vê logo o resultado.</p>
    </div>
  `;

  document.getElementById("btn-add-pergunta").addEventListener("click", () => {
    r.quiz.push({ pergunta:"", opcoes:["",""], certa:0 });
    renderPainelQuiz(painel);
  });
  painel.querySelectorAll("[data-remover-pergunta]").forEach(b => b.addEventListener("click", () => {
    r.quiz.splice(Number(b.getAttribute("data-remover-pergunta")), 1);
    renderPainelQuiz(painel);
  }));
  painel.querySelectorAll("[data-pergunta]").forEach(i =>
    i.addEventListener("input", () => { r.quiz[Number(i.getAttribute("data-pergunta"))].pergunta = i.value; }));
  painel.querySelectorAll("[data-opcao]").forEach(i => i.addEventListener("input", () => {
    const [q,o] = i.getAttribute("data-opcao").split("-").map(Number);
    r.quiz[q].opcoes[o] = i.value;
  }));
  painel.querySelectorAll("[data-certa]").forEach(i => i.addEventListener("change", () => {
    r.quiz[Number(i.getAttribute("data-certa"))].certa = Number(i.value);
    renderPainelQuiz(painel);
  }));
  painel.querySelectorAll("[data-add-opcao]").forEach(b => b.addEventListener("click", () => {
    r.quiz[Number(b.getAttribute("data-add-opcao"))].opcoes.push("");
    renderPainelQuiz(painel);
  }));
  painel.querySelectorAll("[data-remover-opcao]").forEach(b => b.addEventListener("click", () => {
    const [q,o] = b.getAttribute("data-remover-opcao").split("-").map(Number);
    r.quiz[q].opcoes.splice(o,1);
    if(r.quiz[q].certa >= r.quiz[q].opcoes.length) r.quiz[q].certa = 0;
    renderPainelQuiz(painel);
  }));
}

/* ---------------- Guardar ---------------- */
function guardarFormAula(criarOutra){
  const ctx = contextoDaAula();
  if(!ctx) return;
  recolherPainelAtual();
  const r = rascunhoAula();

  const titulo = document.getElementById("a-titulo").value.trim();
  if(!titulo){ mostrarToast("Dá um título à aula."); return; }

  const { curso } = ctx;
  const moduloDestino = moduloPorIdNoCurso(curso, document.getElementById("a-modulo").value) || ctx.modulo;

  const dados = {
    titulo,
    duracao: urlDoVideo({ embed:r.embed }) ? (r.duracao || "00:00") : "00:00",
    capa: document.getElementById("valor-capaAula").value,
    semComentarios: document.getElementById("a-semComentarios").classList.contains("marcado"),
    semBuscaIA: document.getElementById("a-semBuscaIA").classList.contains("marcado"),
    conteudo: r.conteudo,
    embed: r.embed,
    descricao: r.descricao,
    ficheiros: r.ficheiros,
    /* Perguntas em branco não servem de nada ao aluno. */
    quiz: r.quiz.filter(q => q.pergunta.trim() && q.opcoes.filter(o=>o.trim()).length >= 2)
  };

  let aulaGravada;
  if(ctx.aula){
    Object.assign(ctx.aula, dados);
    aulaGravada = ctx.aula;
    /* Mudou de módulo: sai de um e entra no outro, no fim. */
    if(moduloDestino.id !== ctx.modulo.id){
      ctx.modulo.aulas = ctx.modulo.aulas.filter(a => a.id !== ctx.aula.id);
      moduloDestino.aulas.push(ctx.aula);
      ctx.aula.ordem = moduloDestino.aulas.length;
    }
  } else {
    aulaGravada = Object.assign({ id:novoId("aula"), ordem:moduloDestino.aulas.length + 1 }, dados);
    moduloDestino.aulas.push(aulaGravada);
  }

  salvarAula(aulaGravada, moduloDestino.id);
  estado.rascunhoAula = null;
  mostrarToast(ctx.aula ? "Aula atualizada" : "Aula criada");

  if(criarOutra) abrirFormAula(curso.id, moduloDestino.id, null);
  else irPara("admin-curso-editor", curso.id);
}

registarViews({ "admin-aula-form": renderFormAula });
