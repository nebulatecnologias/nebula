/* ============================================================
   Administração › Banners
   O carrossel promocional no topo do Calendário do aluno.
   ============================================================ */

const GRADIENTES = [
  { valor:"linear-gradient(160deg,#ff8a45 0%,#f25a12 55%,#d9470a 100%)", rotulo:"Laranja Kingdom" },
  { valor:"linear-gradient(160deg,#7b72e8,#564cc9)", rotulo:"Violeta (encontros e prazos)" },
  { valor:"linear-gradient(120deg,#ff5a1f,#c23f13)", rotulo:"Laranja (anterior)" },
  { valor:"linear-gradient(120deg,#1f8f8a,#0d4d4a)", rotulo:"Verde-azulado" },
  { valor:"linear-gradient(120deg,#7c5cff,#3d2b8f)", rotulo:"Roxo" },
  { valor:"linear-gradient(120deg,#2b6cb0,#12325a)", rotulo:"Azul" },
  { valor:"linear-gradient(120deg,#1f1f23,#0a0a0b)", rotulo:"Preto" }
];

function renderAdminBanners(){
  const ativos = bannersAtivos().length;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Banners",
      descricao: "O carrossel no topo do Calendário do aluno. Usa-o para promover eventos e ofertas.",
      acaoRotulo: "Novo banner",
      acaoId: "btn-novo-banner"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.image}</div><div class="stat-label">Banners ativos</div><div class="stat-value">${ativos}<span>/ ${DB.banners.length}</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.cal}</div><div class="stat-label">Troca a cada</div><div class="stat-value">${DB.config.bannerIntervalo}<span>seg</span></div></div>
      <div class="card stat-card" style="cursor:pointer;" id="card-intervalo"><div class="stat-icon">${ICONS.gear}</div><div class="stat-label">Rotação</div><div class="stat-value" style="font-size:17px;">Ajustar tempo</div></div>
    </div>

    <div class="section-title"><h2>Pré-visualização</h2><span class="count" style="font-size:12.5px;color:var(--text-faint);">Exatamente como o aluno vê · proporção 4:1, igual ao banner do Google Forms</span></div>
    ${ativos ? `
    <div class="banner-carousel" id="carrossel-admin">
      <div class="banner-track">
        ${bannersAtivos().map(b => `<div class="banner-slide" style="${fundoBanner(b)}">
          ${b.eyebrow ? `<span class="banner-etiqueta">${b.eyebrow}</span>` : ""}
          <span class="banner-title">${b.titulo||""}</span>
          <span class="banner-cta">${b.cta||""} ${setaCirculo()}</span>
        </div>`).join("")}
      </div>
      <div class="banner-dots">
        ${bannersAtivos().map((_,i)=>`<span class="banner-dot ${i===0?"active":""}" data-slide="${i}"></span>`).join("")}
      </div>
    </div>` : `<div class="card" style="margin-bottom:24px;"><div class="empty-note">Nenhum banner ativo — o aluno não vê o carrossel.</div></div>`}

    <div class="card table-card">
      <div class="table-card-head">
        <h3>Todos os banners</h3>
        <span class="count">${DB.banners.length} registos · a ordem define a do carrossel</span>
      </div>
      <div class="table-wrap" tabindex="0">
        <table class="admin-table">
          <thead><tr><th>Banner</th><th>Destino</th><th>Estado</th><th>Ordem</th><th></th></tr></thead>
          <tbody>
            ${DB.banners.length ? DB.banners.map((b, i) => `
              <tr>
                <td><div class="cell-user">
                  <div class="mini-banner" style="${fundoBanner(b)}"></div>
                  <div class="meta"><div class="nome">${b.titulo||"(sem título)"}</div><div class="sub-celula">${b.eyebrow||""}</div></div>
                </div></td>
                <td><div>${destinoDoBannerEmTexto(b)}</div>${b.destinoTipo === "pagina" && b.link ? `<div class="sub-celula">botão: ${b.link}</div>` : ""}</td>
                <td><span class="pill ${b.ativo!==false?"pill-ativo":"pill-inativo"}">${b.ativo!==false?"Ativo":"Escondido"}</span></td>
                <td>
                  <div class="acoes-linha">
                    <button class="btn-icone" data-mover-banner="${b.id}" data-dir="-1" ${i===0?"disabled":""} title="Subir"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg></button>
                    <button class="btn-icone" data-mover-banner="${b.id}" data-dir="1" ${i===DB.banners.length-1?"disabled":""} title="Descer"><svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>
                  </div>
                </td>
                <td>${acoesLinha(b.id)}</td>
              </tr>
            `).join("") : `<tr><td colspan="5"><div class="empty-note">Ainda não há banners.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if(ativos) iniciarCarrosselBanners("#carrossel-admin");
  document.getElementById("btn-novo-banner").addEventListener("click", () => editarBanner(null));
  document.getElementById("card-intervalo").addEventListener("click", ajustarIntervaloBanners);
  document.querySelectorAll("#content-admin [data-editar]").forEach(b =>
    b.addEventListener("click", () => editarBanner(b.getAttribute("data-editar"))));
  document.querySelectorAll("#content-admin [data-apagar]").forEach(b =>
    b.addEventListener("click", () => apagarBanner(b.getAttribute("data-apagar"))));
  document.querySelectorAll("#content-admin [data-mover-banner]").forEach(b =>
    b.addEventListener("click", () => {
      mover(DB.banners, DB.banners.findIndex(x=>x.id===b.getAttribute("data-mover-banner")), Number(b.getAttribute("data-dir")));
      salvarOrdem("banner", DB.banners);
      renderAdminBanners();
    }));
}

/* Para onde um banner pode levar: uma página própria, ou um evento, curso ou
   oferta que já existem. Decidido pelo Shelton a 27/09/2026. */
function opcoesDestinoDoBanner(){
  const hoje = new Date().toISOString().slice(0, 10);
  return [{ valor:"pagina", rotulo:"Página própria (resumo e link abaixo)" }]
    .concat((DB.eventos || []).filter(e => e.data >= hoje)
      .map(e => ({ valor:"evento:" + e.id, rotulo:"Evento · " + e.titulo })))
    .concat((DB.cursos || []).filter(c => c.publicado !== false)
      .map(c => ({ valor:"curso:" + c.id, rotulo:"Curso · " + c.titulo })))
    .concat((DB.ofertas || []).filter(o => o.ativa !== false)
      .map(o => ({ valor:"oferta:" + o.id, rotulo:"Oferta · " + o.nome })));
}

/* O que se diz na tabela sobre para onde o banner leva. */
function destinoDoBannerEmTexto(b){
  const achar = (lista, id) => (lista || []).find(x => String(x.id) === String(id));
  if(b.destinoTipo === "evento"){ const e = achar(DB.eventos, b.destinoId); return e ? "Evento · " + e.titulo : "Evento que já não existe"; }
  if(b.destinoTipo === "curso"){ const c = achar(DB.cursos, b.destinoId); return c ? "Curso · " + c.titulo : "Curso que já não existe"; }
  if(b.destinoTipo === "oferta"){ const o = achar(DB.ofertas, b.destinoId); return o ? "Oferta · " + o.nome : "Oferta que já não existe"; }
  return "Página própria";
}

function editarBanner(id){
  const banner = id ? DB.banners.find(b=>b.id===id) : null;
  abrirDrawer({
    titulo: banner ? "Editar banner" : "Novo banner",
    subtitulo: "Aparece no Início e no Calendário do aluno, e abre uma página dentro da Academia.",
    campos: [
      { nome:"destino", rotulo:"Leva a", tipo:"select", opcoes:opcoesDestinoDoBanner(),
        dica:"O banner abre sempre uma página dentro da Academia. Só o botão dessa página leva para fora." },
      { nome:"eyebrow", rotulo:"Etiqueta", tipo:"texto", placeholder:"ex: Evento" },
      { nome:"titulo", rotulo:"Título", tipo:"texto", obrigatorio:true, placeholder:"A mensagem principal do banner." },
      { nome:"cta", rotulo:"Texto do botão", tipo:"texto", placeholder:"ex: Garantir vaga", dica:"No computador aparece no banner. No telemóvel o banner mostra só «Saber mais»." },
      { nome:"resumo", rotulo:"Resumo (página própria)", tipo:"textarea", placeholder:"O que o aluno lê antes de carregar no botão.", dica:"Só para «Página própria»: um evento, curso ou oferta já têm a sua página." },
      { nome:"link", rotulo:"Link do botão (página própria)", tipo:"url", placeholder:"https://...", dica:"Só para «Página própria»: para onde vai o botão da página." },
      { nome:"imagem", rotulo:"Imagem de fundo", tipo:"imagem", pasta:"banners", dica:"1600×400 px. No telemóvel é cortada dos lados; não ponhas texto importante nas pontas." },
      { nome:"gradiente", rotulo:"Cor de fundo", tipo:"select", opcoes:GRADIENTES },
      { nome:"ativo", rotulo:"Ativo", tipo:"toggle", padrao:true, dica:"Se desligares, o banner deixa de entrar no carrossel." }
    ],
    valores: banner
      ? Object.assign({}, banner, { destino: banner.destinoTipo && banner.destinoTipo !== "pagina" ? banner.destinoTipo + ":" + banner.destinoId : "pagina" })
      : { ativo:true, gradiente:GRADIENTES[0].valor, destino:"pagina" },
    aoGuardar: v => {
      /* "tipo:id" num só campo: o motor de formulários não tem campos que
         dependem uns dos outros, e assim a escolha fica numa lista só. */
      const [tipo, ...resto] = String(v.destino || "pagina").split(":");
      v.destinoTipo = tipo || "pagina";
      v.destinoId = v.destinoTipo === "pagina" ? "" : resto.join(":");
      delete v.destino;
      if(v.destinoTipo === "pagina" && !v.resumo && !v.link){
        mostrarToast("Numa página própria, escreve o resumo ou o link do botão — senão a página fica vazia.");
        return false;
      }
      const alvo = banner || { id:novoId("banner"), ordem:DB.banners.length + 1 };
      Object.assign(alvo, v);
      if(!banner) DB.banners.push(alvo);
      salvar("banner", alvo);
      renderAdminBanners();
      mostrarToast(banner ? "Banner atualizado" : "Banner criado");
    }
  });
}

function apagarBanner(id){
  const banner = DB.banners.find(b=>b.id===id);
  confirmarAcao({
    titulo: "Apagar banner",
    mensagem: `"${banner.titulo}" deixa de aparecer no calendário dos alunos.`,
    aoConfirmar: () => {
      DB.banners = DB.banners.filter(b=>b.id!==id);
      remover("banner", id);
      renderAdminBanners();
      mostrarToast("Banner apagado");
    }
  });
}

function ajustarIntervaloBanners(){
  abrirDrawer({
    titulo: "Rotação do carrossel",
    subtitulo: "De quanto em quanto tempo o banner muda sozinho.",
    campos: [
      { nome:"bannerIntervalo", rotulo:"Intervalo (segundos)", tipo:"numero", obrigatorio:true, dica:"O aluno não vê contador; a troca é automática." }
    ],
    valores: { bannerIntervalo: DB.config.bannerIntervalo },
    aoGuardar: v => {
      DB.config.bannerIntervalo = Math.max(5, v.bannerIntervalo || 60);
      salvarConfigGeral();
      renderAdminBanners();
      mostrarToast("Rotação atualizada");
    }
  });
}

registarViews({ "admin-banners": renderAdminBanners });
