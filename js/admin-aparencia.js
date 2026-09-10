/* ============================================================
   Administração › Aparência e Configurações
   A identidade da escola e os interruptores gerais da área do aluno.
   ============================================================ */

function renderAdminAparencia(){
  const a = DB.aparencia;

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Aparência",
      descricao: "O nome, o logótipo, a cor e o texto de entrada que os teus alunos veem. As alterações aplicam-se de imediato.",
      acaoRotulo: "Editar identidade",
      acaoId: "btn-editar-marca"
    })}
    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.palette}</div><div class="stat-label">Cor de destaque</div><div class="stat-value" style="font-size:17px;display:flex;align-items:center;gap:8px;"><span class="amostra-cor" style="background:${a.corAccent}"></span>${a.corAccent}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.image}</div><div class="stat-label">Logótipo</div><div class="stat-value" style="font-size:17px;">${a.logoUrl ? "Imagem própria" : "Símbolo Kingdom"}</div></div>
      <div class="card stat-card" style="cursor:pointer;" id="card-tema">
        <div class="stat-icon">${ICONS.gear}</div>
        <div class="stat-label">Tema por omissão</div>
        <div class="stat-value" style="font-size:17px;">${a.temaPadrao==="light" ? "Claro" : "Escuro"}</div>
      </div>
    </div>

    <div class="section-title"><h2>Como os alunos veem a entrada</h2></div>
    <div class="card previa-login">
      <div class="brand-mark previa-marca">${marcaHTML(false)}</div>
      <span class="kicker" style="color:var(--accent);">${a.nomeEscola.toUpperCase()}</span>
      <h3>${a.loginTitulo}</h3>
      <p>${a.loginTexto}</p>
      <div class="previa-botoes">
        <button class="btn btn-primary" type="button" disabled>Entrar</button>
        <button class="btn btn-secondary" type="button" disabled>Esqueceste a senha?</button>
      </div>
      <p class="hint" style="margin-top:14px;">${a.rodape || ""}</p>
    </div>

    <div class="card table-card">
      <div class="table-card-head"><h3>Paleta em uso</h3><span class="count">Derivada da cor de destaque</span></div>
      <div class="paleta-grid">
        <div><span class="amostra-cor grande" style="background:${a.corAccent}"></span><strong>Destaque</strong><span class="sub-celula">Botões e realces</span></div>
        <div><span class="amostra-cor grande" style="background:${clarearHex(a.corAccent,0.18)}"></span><strong>Sobre o rato</strong><span class="sub-celula">Estado hover</span></div>
        <div><span class="amostra-cor grande" style="background:${hexParaRgba(a.corAccent,0.14)}"></span><strong>Fundo suave</strong><span class="sub-celula">Etiquetas e avatares</span></div>
        <div><span class="amostra-cor grande" style="background:${hexParaRgba(a.corAccent,0.35)}"></span><strong>Contorno</strong><span class="sub-celula">Bordas realçadas</span></div>
      </div>
    </div>
  `;

  document.getElementById("btn-editar-marca").addEventListener("click", editarMarca);
  document.getElementById("card-tema").addEventListener("click", () => {
    DB.aparencia.temaPadrao = a.temaPadrao==="light" ? "dark" : "light";
    estado.tema = null;                      // volta a seguir o tema por omissão
    guardarDB(); guardarEstado();
    aplicarAparencia();
    renderAdminAparencia();
    mostrarToast("Tema por omissão: " + (DB.aparencia.temaPadrao==="light" ? "claro" : "escuro"));
  });
}

function editarMarca(){
  abrirDrawer({
    titulo: "Identidade da escola",
    subtitulo: "Aplica-se ao ecrã de entrada, à barra lateral e aos certificados.",
    campos: [
      { nome:"nomeEscola", rotulo:"Nome da escola", tipo:"texto", obrigatorio:true },
      { nome:"sublinha", rotulo:"Sublinha", tipo:"texto", placeholder:"ex: Formação & Mentoria" },
      { nome:"logoUrl", rotulo:"Logótipo", tipo:"imagem", dica:"Quadrado, de preferência com fundo transparente. Sem imagem, fica o símbolo." },
      { nome:"corAccent", rotulo:"Cor de destaque", tipo:"cor", dica:"Botões, realces e o símbolo da marca." },
      { nome:"temaPadrao", rotulo:"Tema por omissão", tipo:"select", opcoes:[{valor:"dark",rotulo:"Escuro"},{valor:"light",rotulo:"Claro"}] },
      { nome:"loginTitulo", rotulo:"Frase de entrada", tipo:"textarea" },
      { nome:"loginTexto", rotulo:"Texto de apoio", tipo:"textarea" },
      { nome:"rodape", rotulo:"Rodapé", tipo:"texto", placeholder:"© 2026 Kingdom Company" }
    ],
    valores: DB.aparencia,
    aoGuardar: v => {
      Object.assign(DB.aparencia, v);
      estado.tema = null;
      guardarDB(); guardarEstado();
      aplicarAparencia();
      renderAdminAparencia();
      mostrarToast("Identidade atualizada");
    }
  });
}

/* ============================================================
   Configurações
   ============================================================ */
function renderAdminConfig(){
  const c = DB.config;
  const abas = new Set(c.abasAluno || []);
  const todasAsAbas = NAV_ALUNO.flatMap(g => g.itens);

  document.getElementById("content-admin").innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Configurações",
      descricao: "Os interruptores gerais da área de membros e o que fazer com os dados desta demonstração."
    })}

    <div class="section-title"><h2>Abas que o aluno vê</h2></div>
    <div class="card painel">
      <p class="hint" style="margin-bottom:14px;">Desligar uma aba retira-a da barra lateral do aluno e fecha o acesso direto. Início está sempre ligado.</p>
      <div class="grelha-toggles">
        ${todasAsAbas.map(it => `
          <div class="toggle-row" data-aba="${it.view}">
            <div class="t-icone">${it.icon}</div>
            <div><div class="t-title">${it.label}</div><div class="t-sub">${it.view==="dashboard" ? "Sempre ligada" : "Visível na barra lateral"}</div></div>
            <div class="toggle ${abas.has(it.view)?"on":""} ${it.view==="dashboard"?"bloqueado":""}" data-toggle-aba="${it.view}"><div class="knob"></div></div>
          </div>`).join("")}
      </div>
    </div>

    <div class="section-title"><h2>Comunidade e conteúdo</h2></div>
    <div class="card painel">
      <div class="toggle-row">
        <div><div class="t-title">Alunos podem publicar</div><div class="t-sub">Desligado, o feed passa a ser só de leitura — só a equipa publica.</div></div>
        <div class="toggle ${c.alunosPublicam!==false?"on":""}" id="tg-publicar"><div class="knob"></div></div>
      </div>
      <div class="toggle-row">
        <div><div class="t-title">Mostrar cursos bloqueados</div><div class="t-sub">O aluno vê os cursos fora do plano dele, com cadeado e a oferta que os desbloqueia.</div></div>
        <div class="toggle ${c.mostrarCursosBloqueados!==false?"on":""}" id="tg-bloqueados"><div class="knob"></div></div>
      </div>
      <div class="toggle-row">
        <div><div class="t-title">Intervalo do carrossel de banners</div><div class="t-sub">Tempo entre banners no topo do Calendário.</div></div>
        <div class="select-wrap">
          <select id="sel-intervalo">
            ${[15,30,45,60,90,120].map(n=>`<option value="${n}" ${Number(c.bannerIntervalo)===n?"selected":""}>${n} segundos</option>`).join("")}
          </select>
        </div>
      </div>
    </div>

    <div class="section-title"><h2>Onde se configura o resto</h2></div>
    <div class="card atalhos-config">
      ${[
        { view:"admin-ranking", icon:ICONS.flag, titulo:"XP e emblemas", sub:"Pontos por aula, XP por nível e regras das conquistas." },
        { view:"admin-certificados", icon:ICONS.cert, titulo:"Certificados", sub:"Percentagem de emissão, títulos e assinatura." },
        { view:"admin-integracoes", icon:ICONS.plug, titulo:"Integrações", sub:"Player de vídeo e canal de apoio." },
        { view:"admin-assinaturas", icon:ICONS.card, titulo:"Planos", sub:"Preços e cursos que cada plano desbloqueia." }
      ].map(x => `
        <div class="atalho" data-ir="${x.view}">
          <div class="stat-icon">${x.icon}</div>
          <div><strong>${x.titulo}</strong><span class="sub-celula">${x.sub}</span></div>
        </div>`).join("")}
    </div>

    <div class="section-title"><h2>Dados desta demonstração</h2></div>
    <div class="card painel">
      <p class="hint" style="margin-bottom:14px;">Nesta fase, tudo o que configuras fica guardado neste browser. Exporta para levar a configuração para outro computador — ou para a guardares antes de repor.</p>
      <div class="linha-acoes">
        <button class="btn btn-secondary" id="btn-exportar">Exportar configuração</button>
        <button class="btn btn-secondary" id="btn-importar">Importar configuração</button>
        <input type="file" accept="application/json" class="hidden" id="ficheiro-import">
        <button class="btn btn-perigo" id="btn-repor">Repor demonstração</button>
      </div>
      <p class="hint" style="margin-top:14px;">Guardado em <strong>${DB.cursos.length}</strong> cursos, <strong>${DB.membros.length}</strong> membros, <strong>${DB.eventos.length}</strong> eventos e <strong>${(DB.posts||[]).length}</strong> publicações.</p>
    </div>
  `;

  document.querySelectorAll("#content-admin [data-toggle-aba]").forEach(t =>
    t.addEventListener("click", () => alternarAba(t.getAttribute("data-toggle-aba"))));
  document.querySelectorAll("#content-admin .atalho[data-ir]").forEach(x =>
    x.addEventListener("click", () => irPara(x.getAttribute("data-ir"))));

  document.getElementById("tg-publicar").addEventListener("click", () => {
    DB.config.alunosPublicam = DB.config.alunosPublicam === false;
    guardarDB(); renderAdminConfig();
    mostrarToast(DB.config.alunosPublicam ? "Os alunos voltam a poder publicar" : "O feed passa a ser só de leitura");
  });
  document.getElementById("tg-bloqueados").addEventListener("click", () => {
    DB.config.mostrarCursosBloqueados = DB.config.mostrarCursosBloqueados === false;
    guardarDB(); renderAdminConfig();
  });
  document.getElementById("sel-intervalo").addEventListener("change", e => {
    DB.config.bannerIntervalo = Number(e.target.value);
    guardarDB();
    mostrarToast("Os banners passam a mudar a cada " + DB.config.bannerIntervalo + " segundos");
  });

  document.getElementById("btn-exportar").addEventListener("click", exportarConfiguracao);
  const ficheiro = document.getElementById("ficheiro-import");
  document.getElementById("btn-importar").addEventListener("click", () => ficheiro.click());
  ficheiro.addEventListener("change", e => importarConfiguracao(e.target.files[0]));
  document.getElementById("btn-repor").addEventListener("click", () => confirmarAcao({
    titulo: "Repor a demonstração",
    mensagem: "Todo o conteúdo que criaste — cursos, membros, eventos, banners — volta ao estado original. Não há forma de desfazer.",
    textoConfirmar: "Repor tudo",
    aoConfirmar: () => { reporDB(); location.reload(); }
  }));
}

/* Início nunca se desliga: seria deixar o aluno sem porta de entrada. */
function alternarAba(view){
  if(view==="dashboard"){ mostrarToast("O Início é a porta de entrada do aluno e fica sempre ligado."); return; }
  const abas = new Set(DB.config.abasAluno || []);
  abas.has(view) ? abas.delete(view) : abas.add(view);
  DB.config.abasAluno = NAV_ALUNO.flatMap(g=>g.itens).map(i=>i.view).filter(v => abas.has(v));
  guardarDB();
  renderAdminConfig();
}

function descarregarFicheiro(nome, conteudo, tipo){
  const url = URL.createObjectURL(new Blob([conteudo], { type:tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarConfiguracao(){
  const data = new Date().toISOString().slice(0,10);
  descarregarFicheiro(`kingdom-academy-${data}.json`, JSON.stringify(DB, null, 2), "application/json");
  mostrarToast("Configuração exportada");
}

function importarConfiguracao(ficheiro){
  if(!ficheiro) return;
  const leitor = new FileReader();
  leitor.onload = ev => {
    let novo;
    try { novo = JSON.parse(ev.target.result); }
    catch(e){ mostrarToast("Este ficheiro não é uma configuração válida"); return; }
    if(!novo || typeof novo !== "object" || !Array.isArray(novo.cursos)){
      mostrarToast("Este ficheiro não parece ser uma configuração da academia");
      return;
    }
    confirmarAcao({
      titulo: "Importar configuração",
      mensagem: `Vais substituir o conteúdo atual por ${novo.cursos.length} cursos e ${(novo.membros||[]).length} membros do ficheiro.`,
      textoConfirmar: "Importar",
      aoConfirmar: () => {
        DB = Object.assign(dbPadrao(), novo);
        normalizarDB();
        guardarDB();
        location.reload();
      }
    });
  };
  leitor.readAsText(ficheiro);
}

registarViews({
  "admin-aparencia": renderAdminAparencia,
  "admin-config": renderAdminConfig
});
