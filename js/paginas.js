/* ============================================================
   Páginas internas
   Para onde um banner leva, e o que um cartão da Vitrine abre: um evento,
   uma oferta, ou a página própria de um banner. Decidido pelo Shelton a
   27/09/2026: nenhum banner manda ninguém para fora da Academia sem antes
   lhe mostrar, cá dentro, o que é.

   O molde é a página de produto da Kingdom Library: a capa à esquerda, as
   etiquetas, o título, o resumo, os detalhes e UM botão que resolve. Só
   esse botão leva para fora (checkout, sala, mapa, link do banner).
   ============================================================ */

const ICONE_VOLTAR = `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;

/* Para onde leva cada banner, dentro da Academia. */
function destinoDoBanner(b){
  const id = encodeURIComponent(b.destinoId || "");
  if(b.destinoTipo === "evento" && b.destinoId) return "#/evento/" + id;
  if(b.destinoTipo === "curso"  && b.destinoId) return "#/curso/" + id;
  if(b.destinoTipo === "oferta" && b.destinoId) return "#/oferta/" + id;
  return "#/destaque/" + encodeURIComponent(b.id);
}

/* Voltar ao ecrã de onde se veio. Quem abriu o link directamente não veio de
   lado nenhum: vai para o início. */
function voltarDaPagina(){
  const antes = estado.voltarPara;
  if(antes && !PAGINAS_COM_MORADA.includes(antes)) irPara(antes);
  else irPara(papelEfetivo() === "administrador" ? "admin-visao" : "dashboard");
}

/* O esqueleto comum. `arte` é o HTML da coluna da imagem; `acoes` o dos
   botões. O resto é texto. */
function paginaHTML({ arte, etiquetas = [], titulo, texto, detalhes = [], acoes = "", nota = "" }){
  return `
    <button class="back-link" type="button" data-voltar>${ICONE_VOLTAR}Voltar</button>
    <article class="pagina-destaque">
      <div class="pagina-arte">${arte}</div>
      <div class="pagina-corpo">
        ${etiquetas.length ? `<div class="pagina-etiquetas">${etiquetas.join("")}</div>` : ""}
        <h1>${textoSeguro(titulo)}</h1>
        ${texto ? `<p class="pagina-texto">${textoSeguro(texto).replace(/\n/g, "<br>")}</p>` : ""}
        ${detalhes.length ? `<ul class="pagina-detalhes">${detalhes.map(d => `<li>${d}</li>`).join("")}</ul>` : ""}
        ${acoes ? `<div class="pagina-acoes">${acoes}</div>` : ""}
        ${nota ? `<p class="pagina-nota">${nota}</p>` : ""}
      </div>
    </article>`;
}

function paginaVazia(raiz, frase){
  raiz.innerHTML = `
    <button class="back-link" type="button" data-voltar>${ICONE_VOLTAR}Voltar</button>
    <div class="card pagina-vazia"><p>${frase}</p></div>`;
  ligarVoltar(raiz);
}

function ligarVoltar(raiz){
  raiz.querySelectorAll("[data-voltar]").forEach(b => b.addEventListener("click", voltarDaPagina));
}

function etiqueta(texto, classe){ return `<span class="pagina-etiqueta ${classe || ""}">${texto}</span>`; }

/* ---------------- Evento ---------------- */
function renderEvento(id){
  const raiz = document.getElementById("content-evento");
  const e = (DB.eventos || []).find(x => x.id === id);
  /* Um evento que não aparece aqui ou já foi apagado, ou não é para esta
     pessoa (a regra de leitura do servidor não lho deu). Nos dois casos,
     a mesma frase. */
  if(!e){ paginaVazia(raiz, "Este encontro já não está disponível, ou não é para si."); return; }

  const quando = new Date(e.data + "T" + (e.hora || "00:00") + ":00");
  const passado = quando <= new Date();
  const cat = categoriaDe(e.categoria);
  const { dia, mes } = formatarDataEvento(e.data);
  const oferta = e.ofertaId ? (DB.ofertas || []).find(o => String(o.id) === String(e.ofertaId)) : null;
  /* Num evento pago, o link da sala só chega a quem comprou o lugar -- é o
     servidor que decide. Sem link e com oferta, falta comprar. */
  const porComprar = e.acesso === "pago" && !e.link;
  const checkout = oferta ? (linkCheckout(oferta.atalho) || linkExterno(oferta.link)) : "";
  const confirmado = !!estado.presencasConfirmadas[e.id];
  const dataLonga = quando.toLocaleDateString("pt-PT", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  let acoes = "", nota = "";
  if(passado){
    nota = "Este encontro já aconteceu.";
  } else if(porComprar){
    acoes = checkout && oferta
      ? `<a class="btn btn-primary btn-lg" href="${checkout}" target="_blank" rel="noopener" data-comprar>Garantir lugar · ${formatarPreco(oferta.preco, oferta.moeda)} ${setaCirculo()}</a>`
      : "";
    nota = checkout
      ? "O pagamento abre numa página segura do Payflow. Assim que for confirmado, o link da sala aparece aqui."
      : "Fale com a sua mentoria para garantir o lugar.";
  } else {
    acoes = [
      e.link ? `<a class="btn btn-primary btn-lg" href="${linkExterno(e.link)}" target="_blank" rel="noopener">Entrar na sala ${setaCirculo()}</a>` : "",
      `<button class="btn btn-secondary btn-lg" type="button" data-confirmar-presenca data-done="${confirmado}">${confirmado ? iconeCheck() + " Presença confirmada" : "Confirmar presença"}</button>`,
      `<button class="btn btn-texto btn-lg" type="button" data-lembrete-pagina>Guardar lembrete</button>`
    ].join("");
  }
  if(e.local && !porComprar){
    acoes += `<a class="btn btn-secondary btn-lg" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.local)}" target="_blank" rel="noopener">Ver no mapa ${setaCirculo()}</a>`;
  }

  raiz.innerHTML = paginaHTML({
    arte: `<div class="pagina-data ${passado ? "passada" : ""}"><span class="dia">${dia}</span><span class="mes">${mes}</span></div>`,
    etiquetas: [
      etiqueta(ROTULO_ACESSO[e.acesso] || "Gratuito", "acesso " + (e.acesso || "gratuito")),
      `<span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span>`,
      passado ? etiqueta("Realizado", "passado") : etiqueta("Em breve", "em-breve")
    ],
    titulo: e.titulo,
    texto: e.descricao,
    detalhes: [
      `<span class="rotulo">Quando</span><strong>${dataLonga}, às ${e.hora}</strong>`,
      `<span class="rotulo">Formato</span><strong>${textoSeguro(e.tipo) || "Encontro"}</strong>`,
      `<span class="rotulo">Onde</span><strong>${e.local ? textoSeguro(e.local) : (e.link || porComprar ? "Online" : "A anunciar")}</strong>`
    ],
    acoes, nota
  });

  ligarVoltar(raiz);
  const presenca = raiz.querySelector("[data-confirmar-presenca]");
  if(presenca) presenca.addEventListener("click", () => {
    estado.presencasConfirmadas[e.id] = !estado.presencasConfirmadas[e.id];
    salvarPresenca(e.id, estado.presencasConfirmadas[e.id]);
    if(estado.presencasConfirmadas[e.id]) mostrarToast("Presença confirmada!");
    renderEvento(id);
  });
  const lembrete = raiz.querySelector("[data-lembrete-pagina]");
  if(lembrete) lembrete.addEventListener("click", () => baixarLembrete(e));
}

/* ---------------- Oferta ---------------- */
function renderOferta(id){
  const raiz = document.getElementById("content-oferta");
  const o = (DB.vitrine || []).find(x => String(x.ofertaId) === String(id));

  /* Fora da Vitrine há duas razões: a pessoa já a tem, ou não está à venda.
     O servidor é que decide o que está na Vitrine; aqui só se diz qual. */
  if(!o){
    const jaTem = (DB.cursos || []).find(c => String(c.ofertaId) === String(id) && cursosVisiveis().some(v => v.id === c.id));
    if(jaTem){
      raiz.innerHTML = paginaHTML({
        arte: arteDoCurso(jaTem),
        etiquetas: [etiqueta("Já tem acesso", "tem-acesso")],
        titulo: jaTem.titulo,
        texto: jaTem.subtitulo,
        acoes: `<button class="btn btn-primary btn-lg" type="button" data-abrir-curso="${jaTem.id}">Abrir o curso ${setaCirculo()}</button>`
      });
      ligarVoltar(raiz);
      raiz.querySelector("[data-abrir-curso]").addEventListener("click", () => irPara("curso", jaTem.id));
      return;
    }
    paginaVazia(raiz, "Isto não está disponível de momento. Veja o que há na Vitrine, ou fale com a sua mentoria.");
    return;
  }

  const primeiro = o.cursos[0] || {};
  const varios = o.cursos.length > 1;
  const cat = categoriaDe(primeiro.categoria);
  const aulas = `${o.aulas} aula${o.aulas === 1 ? "" : "s"}`;
  const duracao = duracaoEmTexto(varios ? o.segundos : primeiro.segundos);
  const nota = varios ? null : notaEmTexto(primeiro.nota, primeiro.avaliacoes);
  /* Em pré-venda o conteúdo ainda não existe: diz-se quando abre, em vez de
     «0 aulas», que se leria como um curso vazio. */
  const preVenda = o.emBreve && !o.aulas;
  const conteudo = preVenda ? (o.abreEm ? dataCurta(o.abreEm) : "Em breve")
    : varios ? `${o.cursos.length} cursos · ${aulas}`
    : `${primeiro.modulos || 0} módulo${primeiro.modulos === 1 ? "" : "s"} · ${aulas}`;

  raiz.innerHTML = paginaHTML({
    arte: arteDoCurso(primeiro),
    etiquetas: [
      etiqueta(`${ICONS.cadeado} Por desbloquear`, "bloqueado"),
      o.emBreve ? etiqueta("Pré-venda", "em-breve") : "",
      varios ? etiqueta("Plano", "") : `<span class="cat-tag" style="--c:${cat.cor}">${cat.nome}</span>`
    ].filter(Boolean),
    titulo: varios ? o.nome : (primeiro.titulo || o.nome),
    texto: o.chamada || (varios ? "" : primeiro.subtitulo),
    detalhes: [
      varios ? `<span class="rotulo">Inclui</span><strong>${o.cursos.map(c => textoSeguro(c.titulo)).join(" · ")}</strong>` : "",
      `<span class="rotulo">${preVenda ? "As aulas abrem" : "Conteúdo"}</span><strong>${conteudo}</strong>`,
      duracao ? `<span class="rotulo">Duração</span><strong>${duracao}</strong>` : "",
      nota ? `<span class="rotulo">Avaliação</span><strong>${nota.texto} de 5 · ${nota.n} avaliaç${nota.n === 1 ? "ão" : "ões"}</strong>` : "",
      !varios && primeiro.facilitador ? `<span class="rotulo">Com</span><strong>${textoSeguro(primeiro.facilitador)}</strong>` : ""
    ].filter(Boolean),
    acoes: o.destino
      ? `<a class="btn btn-primary btn-lg" href="${o.destino}" target="_blank" rel="noopener" data-desbloquear-pagina>${ICONS.cadeado} ${o.emBreve ? "Garantir na pré-venda" : "Desbloquear"} · ${formatarPreco(o.preco, o.moeda)}${o.mensal ? "/mês" : ""}</a>`
      : "",
    nota: !o.destino ? "Fale com a sua mentoria para desbloquear isto."
      : preVenda ? `${textoDaPreVenda(o.abreEm)}. O pagamento abre numa página segura do Payflow; assim que for confirmado, o curso aparece em Meus cursos e as aulas vão aparecendo lá.`
      : "O pagamento abre numa página segura do Payflow. Assim que for confirmado, o acesso abre-se aqui."
  });
  ligarVoltar(raiz);
}

/* A capa de um curso na coluna da imagem: a fotografia, ou o campo pastel
   com as iniciais -- as mesmas do cartão, para ser reconhecível. */
function arteDoCurso(c){
  const iniciais = c.sigla || String(c.titulo || "").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0,3).toUpperCase();
  return `<div class="pagina-capa ${c.capa ? "com-capa" : ""}" style="--field:${campoDoCurso(c.id || "")};${c.capa ? `background-image:url(${c.capa})` : ""}">
    ${c.capa ? "" : `<span class="cover-sigla" aria-hidden="true">${iniciais}</span>`}
  </div>`;
}

/* ---------------- Página própria de um banner ---------------- */
function renderDestaque(id){
  const raiz = document.getElementById("content-destaque");
  const b = (DB.banners || []).find(x => x.id === id && x.ativo !== false);
  if(!b){ paginaVazia(raiz, "Isto já não está disponível."); return; }
  const link = linkExterno(b.link);
  raiz.innerHTML = paginaHTML({
    arte: `<div class="pagina-capa ${b.imagem ? "com-capa" : ""}" style="${fundoBanner(b)}"></div>`,
    etiquetas: b.eyebrow ? [etiqueta(textoSeguro(b.eyebrow), "")] : [],
    titulo: b.titulo,
    texto: b.resumo,
    acoes: link ? `<a class="btn btn-primary btn-lg" href="${link}" target="_blank" rel="noopener">${textoSeguro(b.cta) || "Saber mais"} ${setaCirculo()}</a>` : ""
  });
  ligarVoltar(raiz);
}

registarViews({ evento: renderEvento, oferta: renderOferta, destaque: renderDestaque });
