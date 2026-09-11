/* ============================================================
   Administração › Banners
   O carrossel promocional no topo do Calendário do aluno.
   ============================================================ */

const GRADIENTES = [
  { valor:"linear-gradient(120deg,#ff5a1f,#c23f13)", rotulo:"Laranja (marca)" },
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
          <span class="banner-eyebrow">${b.eyebrow||""}</span>
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
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Banner</th><th>Destino</th><th>Estado</th><th>Ordem</th><th></th></tr></thead>
          <tbody>
            ${DB.banners.length ? DB.banners.map((b, i) => `
              <tr>
                <td><div class="cell-user">
                  <div class="mini-banner" style="${fundoBanner(b)}"></div>
                  <div class="meta"><div class="nome">${b.titulo||"(sem título)"}</div><div class="sub-celula">${b.eyebrow||""}</div></div>
                </div></td>
                <td>${b.link && b.link!=="#" ? `<span class="sub-celula">${b.link}</span>` : `<span class="sub-celula">Sem link</span>`}</td>
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
      guardarDB();
      renderAdminBanners();
    }));
}

function editarBanner(id){
  const banner = id ? DB.banners.find(b=>b.id===id) : null;
  abrirDrawer({
    titulo: banner ? "Editar banner" : "Novo banner",
    subtitulo: "Aparece no topo do Calendário do aluno.",
    campos: [
      { nome:"eyebrow", rotulo:"Etiqueta", tipo:"texto", placeholder:"ex: OFERTA POR TEMPO LIMITADO" },
      { nome:"titulo", rotulo:"Título", tipo:"texto", obrigatorio:true, placeholder:"A mensagem principal do banner." },
      { nome:"cta", rotulo:"Texto do botão", tipo:"texto", placeholder:"ex: Garantir vaga" },
      { nome:"link", rotulo:"Link de destino", tipo:"url", placeholder:"https://...", dica:"Para onde o aluno vai ao clicar no banner." },
      { nome:"imagem", rotulo:"Imagem de fundo", tipo:"imagem", dica:"1600×400 px. Se não puseres imagem, é usada a cor abaixo." },
      { nome:"gradiente", rotulo:"Cor de fundo", tipo:"select", opcoes:GRADIENTES },
      { nome:"ativo", rotulo:"Ativo", tipo:"toggle", padrao:true, dica:"Se desligares, o banner deixa de entrar no carrossel." }
    ],
    valores: banner || { ativo:true, gradiente:GRADIENTES[0].valor },
    aoGuardar: v => {
      if(banner) Object.assign(banner, v);
      else DB.banners.push({ id:novoId("banner"), ...v });
      guardarDB();
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
      guardarDB();
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
      guardarDB();
      renderAdminBanners();
      mostrarToast("Rotação atualizada");
    }
  });
}

registarViews({ "admin-banners": renderAdminBanners });
