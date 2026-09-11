/* ============================================================
   Administração › Integrações
   O que liga a área de membros a serviços de fora: o player de
   vídeo das aulas e o canal por onde o aluno pede ajuda.
   ============================================================ */

function aulasComVideo(){
  return DB.cursos.flatMap(c => c.modulos.flatMap(m => m.aulas)).filter(temVideo);
}
function totalDeAulas(){
  return DB.cursos.reduce((s,c) => s + c.modulos.reduce((n,m)=>n+m.aulas.length, 0), 0);
}

function renderAdminIntegracoes(){
  const i = DB.config.integracoes;
  const comVideo = aulasComVideo().length;
  const total = totalDeAulas();
  const porLigar = DB.cursos.flatMap(c => c.modulos.flatMap(m => m.aulas.filter(a=>!temVideo(a)).map(a => ({ a, m, c }))));
  const exemplo = aulasComVideo()[0];
  const urlExemplo = exemplo ? urlDoVideo(exemplo) : null;
  const legado = i.playerAtivo && i.playerUrl;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Integrações",
      descricao: "As ligações a serviços de fora. Os vídeos entram por código de incorporação, colado em cada aula."
    })}

    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.plug}</div><div class="stat-label">Provedor de vídeo</div><div class="stat-value" style="font-size:17px;">${i.player}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Aulas com vídeo</div><div class="stat-value">${comVideo}<span>de ${total} aulas</span></div></div>
      <div class="card stat-card"><div class="stat-icon ${i.suporteUrl?"accent":""}">${ICONS.chat}</div><div class="stat-label">Canal de apoio</div><div class="stat-value" style="font-size:17px;">${i.suporteUrl ? "Configurado" : "Sem canal"}</div></div>
    </div>

    <div class="section-title"><h2>Ligações</h2></div>
    <div class="card lista-integracoes">
      <div class="integracao">
        <div class="stat-icon accent">${ICONS.plug}</div>
        <div class="integracao-info">
          <strong>${i.player}</strong>
          <span class="sub-celula">Aloja os vídeos. Cada aula recebe o código de incorporação copiado de lá.</span>
        </div>
        <span class="pill ${comVideo?"pill-ativo":"pill-inativo"}">${comVideo ? comVideo+" ligada"+(comVideo===1?"":"s") : "Nenhuma aula ligada"}</span>
        <button class="btn btn-secondary btn-sm" id="btn-config-player">Mudar provedor</button>
      </div>
      <div class="integracao">
        <div class="stat-icon ${i.suporteUrl?"accent":""}">${ICONS.chat}</div>
        <div class="integracao-info">
          <strong>Canal de apoio</strong>
          <span class="sub-celula">${i.suporteUrl ? i.suporteUrl : "Um link de WhatsApp ou email para o aluno pedir ajuda a partir das Definições."}</span>
        </div>
        <span class="pill ${i.suporteUrl?"pill-ativo":"pill-inativo"}">${i.suporteUrl?"Ativo":"Sem canal"}</span>
        <button class="btn btn-secondary btn-sm" id="btn-config-suporte">Configurar</button>
      </div>
    </div>

    <div class="section-title"><h2>Como ligar os vídeos</h2></div>
    <div class="card painel">
      <ol class="passos">
        <li><strong>No ${i.player}</strong>, ${ondeCopiar(i.player)}</li>
        <li><strong>Aqui</strong>, abre Conteúdos › o curso › a aula › separador <strong>Vídeo</strong>.</li>
        <li><strong>Cola</strong> o código no campo e confirma a pré-visualização. Guarda.</li>
      </ol>
      <p class="hint">Do código colado aproveitamos só o endereço do vídeo — o player é montado por nós, com a moldura, o arredondamento e as cores da academia. Nenhum HTML de fora entra na página.</p>
      ${urlExemplo ? `
        <label class="rotulo-solto" style="margin-top:18px;">Já ligada: ${exemplo.titulo}</label>
        <code class="bloco-codigo">${urlExemplo}</code>
        <div class="previa-player"><iframe src="${urlExemplo}" title="Pré-visualização do player" allow="encrypted-media" allowfullscreen loading="lazy"></iframe></div>
      ` : ""}
      ${legado ? `<p class="hint" style="margin-top:14px;">Há um modelo de endereço antigo ainda ativo (<code>${i.playerUrl}</code>). As aulas que só tenham ID continuam a usá-lo; as novas usam o código de incorporação.</p>` : ""}
    </div>

    <div class="card table-card">
      <div class="table-card-head"><h3>Aulas por ligar</h3><span class="count">${porLigar.length} sem vídeo</span></div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Aula</th><th>Curso</th><th>Módulo</th><th></th></tr></thead>
          <tbody>
            ${porLigar.length ? porLigar.slice(0,15).map(({a,m,c}) => `
              <tr class="tint-risco">
                <td>${a.titulo}</td>
                <td><span class="sub-celula">${c.titulo}</span></td>
                <td><span class="sub-celula">${m.titulo}</span></td>
                <td><button class="btn btn-secondary btn-sm" data-ligar="${c.id}">Abrir curso</button></td>
              </tr>`).join("") : `<tr><td colspan="4"><div class="empty-note">${total ? "Todas as aulas têm vídeo." : "Ainda não há aulas."}</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btn-config-player").addEventListener("click", configurarPlayer);
  document.getElementById("btn-config-suporte").addEventListener("click", configurarSuporte);
  document.querySelectorAll("#content-admin [data-ligar]").forEach(b =>
    b.addEventListener("click", () => irPara("admin-curso-editor", b.getAttribute("data-ligar"))));
}

function configurarPlayer(){
  abrirDrawer({
    titulo: "Provedor de vídeo",
    subtitulo: "Serve para a academia te dizer onde copiar o código. O vídeo entra sempre pelo código de incorporação de cada aula.",
    campos: [
      { nome:"player", rotulo:"Onde alojas os vídeos", tipo:"select", opcoes:[
        { valor:"Panda Video", rotulo:"Panda Video" },
        { valor:"YouTube", rotulo:"YouTube (não listado)" },
        { valor:"Vimeo", rotulo:"Vimeo" },
        { valor:"Outro", rotulo:"Outro provedor" }
      ]}
    ],
    valores: DB.config.integracoes,
    aoGuardar: v => {
      Object.assign(DB.config.integracoes, v);
      salvarIntegracoes();
      renderAdminIntegracoes();
      mostrarToast("Provedor definido: " + v.player);
    }
  });
}

function configurarSuporte(){
  abrirDrawer({
    titulo: "Canal de apoio",
    subtitulo: "Aparece nas Definições do aluno, como botão para pedir ajuda.",
    campos: [
      { nome:"suporteRotulo", rotulo:"Texto do botão", tipo:"texto", placeholder:"Falar com a mentoria" },
      { nome:"suporteUrl", rotulo:"Link", tipo:"texto", placeholder:"https://wa.me/258... ou mailto:apoio@...", dica:"Deixa vazio para esconder o botão." }
    ],
    valores: DB.config.integracoes,
    aoGuardar: v => {
      Object.assign(DB.config.integracoes, v);
      salvarIntegracoes();
      renderAdminIntegracoes();
      mostrarToast(v.suporteUrl ? "Canal de apoio ativo" : "Canal de apoio removido");
    }
  });
}

registarViews({ "admin-integracoes": renderAdminIntegracoes });
