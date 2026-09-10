/* ============================================================
   Administração › Integrações
   O que liga a área de membros a serviços de fora: o player de
   vídeo das aulas e o canal por onde o aluno pede ajuda.
   ============================================================ */

/* URL final do embed de uma aula, a partir do modelo configurado.
   Sem player ligado ou sem ID de vídeo, devolve null e a aula
   mostra o marcador em vez de um iframe vazio. */
function urlDoVideo(aula){
  const i = DB.config.integracoes || {};
  if(!i.playerAtivo || !aula || !aula.videoId) return null;
  return (i.playerUrl || "")
    .replace("{conta}", i.playerId || "")
    .replace("{id}", aula.videoId);
}

function aulasComVideo(){
  return DB.cursos.flatMap(c => c.modulos.flatMap(m => m.aulas)).filter(a => a.videoId);
}
function totalDeAulas(){
  return DB.cursos.reduce((s,c) => s + c.modulos.reduce((n,m)=>n+m.aulas.length, 0), 0);
}

function renderAdminIntegracoes(){
  const i = DB.config.integracoes;
  const comVideo = aulasComVideo().length;
  const total = totalDeAulas();
  const exemplo = aulasComVideo()[0];
  const porLigar = DB.cursos.flatMap(c => c.modulos.flatMap(m => m.aulas.filter(a=>!a.videoId).map(a => ({ a, m, c }))));
  const urlExemplo = exemplo ? urlDoVideo(exemplo) : null;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Integrações",
      descricao: "As ligações a serviços de fora. O ID de vídeo de cada aula define-se em Conteúdos, no editor do curso."
    })}

    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon ${i.playerAtivo?"accent":""}">${ICONS.plug}</div><div class="stat-label">Player de vídeo</div><div class="stat-value" style="font-size:17px;">${i.playerAtivo ? "Ligado" : "Desligado"}<span>${i.player}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div><div class="stat-label">Aulas com vídeo</div><div class="stat-value">${comVideo}<span>de ${total} aulas</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.chat}</div><div class="stat-label">Canal de apoio</div><div class="stat-value" style="font-size:17px;">${i.suporteUrl ? "Configurado" : "Sem canal"}</div></div>
    </div>

    <div class="section-title"><h2>Ligações</h2></div>
    <div class="card lista-integracoes">
      <div class="integracao">
        <div class="stat-icon ${i.playerAtivo?"accent":""}">${ICONS.plug}</div>
        <div class="integracao-info">
          <strong>${i.player}</strong>
          <span class="sub-celula">Aloja e reproduz os vídeos das aulas. ${i.playerId ? "Conta <strong>"+i.playerId+"</strong>." : "Falta o identificador da conta."}</span>
        </div>
        <span class="pill ${i.playerAtivo?"pill-ativo":"pill-inativo"}">${i.playerAtivo?"Ligado":"Desligado"}</span>
        <button class="btn btn-secondary btn-sm" id="btn-config-player">Configurar</button>
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

    <div class="section-title"><h2>Como fica o embed</h2></div>
    <div class="card painel">
      ${urlExemplo ? `
        <p class="hint" style="margin-bottom:12px;">Com a aula <strong>${exemplo.titulo}</strong> (ID <strong>${exemplo.videoId}</strong>), o endereço gerado é:</p>
        <code class="bloco-codigo">${urlExemplo}</code>
        <div class="previa-player">
          <iframe src="${urlExemplo}" title="Pré-visualização do player" allow="encrypted-media" allowfullscreen loading="lazy"></iframe>
        </div>
        <p class="hint" style="margin-top:10px;">Se o vídeo não aparecer, confirma o identificador da conta — o modelo de endereço tem de bater certo com o da tua biblioteca.</p>
      ` : `
        <div class="empty-note">
          ${i.playerAtivo
            ? "O player está ligado, mas nenhuma aula tem ID de vídeo. Abre Conteúdos › editor do curso e preenche o campo de vídeo de uma aula."
            : "Liga o player em <strong>Configurar</strong> para veres aqui a pré-visualização do embed."}
        </div>`}
    </div>

    <div class="card table-card">
      <div class="table-card-head"><h3>Aulas por ligar</h3><span class="count">${porLigar.length} sem ID de vídeo</span></div>
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
              </tr>`).join("") : `<tr><td colspan="4"><div class="empty-note">${total ? "Todas as aulas têm ID de vídeo." : "Ainda não há aulas."}</div></td></tr>`}
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
  const i = DB.config.integracoes;
  abrirDrawer({
    titulo: "Player de vídeo",
    subtitulo: "Com o player ligado, as aulas com ID de vídeo passam a reproduzir em vez de mostrar o marcador.",
    campos: [
      { nome:"player", rotulo:"Serviço", tipo:"select", opcoes:[
        { valor:"Panda Video", rotulo:"Panda Video" },
        { valor:"YouTube", rotulo:"YouTube (não listado)" },
        { valor:"Vimeo", rotulo:"Vimeo" }
      ]},
      { nome:"playerId", rotulo:"Identificador da conta", tipo:"texto", placeholder:"ex: 1a2b3c4d", dica:"No Panda Video é o código que aparece no endereço do player (player-vz-<strong>xxxx</strong>)." },
      { nome:"playerUrl", rotulo:"Modelo do endereço", tipo:"texto", dica:"<strong>{conta}</strong> é substituído pelo identificador acima e <strong>{id}</strong> pelo ID de vídeo de cada aula." },
      { nome:"playerAtivo", rotulo:"Player ligado", tipo:"toggle", dica:"Desligado, todas as aulas mostram o marcador de vídeo." }
    ],
    valores: i,
    aoGuardar: v => {
      if(v.playerAtivo && !v.playerUrl.includes("{id}")){
        mostrarToast("O modelo do endereço tem de incluir {id}.");
        return false;
      }
      Object.assign(DB.config.integracoes, v);
      guardarDB();
      renderAdminIntegracoes();
      mostrarToast(v.playerAtivo ? "Player ligado — as aulas com ID já reproduzem" : "Player desligado");
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
      guardarDB();
      renderAdminIntegracoes();
      mostrarToast(v.suporteUrl ? "Canal de apoio ativo" : "Canal de apoio removido");
    }
  });
}

registarViews({ "admin-integracoes": renderAdminIntegracoes });
