/* As etiquetas de partilha de cada escola (W3, 02/10/2026).

   Quando alguém cola o link da área de membros no WhatsApp, Facebook,
   LinkedIn, X, Telegram ou Slack, a rede vai buscar a página para fazer a
   pré-visualização — e não corre JavaScript. O index.html só tem as etiquetas
   da Kingdom, por isso o link de outra escola aparecia com a coroa.

   O vercel.json manda para aqui SÓ esses leitores (pelo user-agent, e com
   `?partilha` para se ver à mão). Os alunos recebem o index.html como sempre.
   Aqui lê-se a marca da escola do endereço (public.marca_da_academia, a mesma
   que a entrada usa) e devolve-se uma página só com as etiquetas: o nome, o
   texto da entrada e o logótipo da escola. A Kingdom fica com as de sempre.

   Se a base não responder, sai uma pré-visualização neutra («Área de
   Membros», sem imagem) — nunca a marca de outra escola. */

const SUPABASE_URL = "https://epqfotzxrcyligwpauwk.supabase.co";
/* A chave publicável é pública por desenho (é a mesma de js/config.js). */
const SUPABASE_CHAVE = "sb_publishable_Ye3ZkJ8RoqMJuWgfdNclZQ_zdnal69h";
const DESCRICAO = "Os seus cursos, aulas, encontros ao vivo e comunidade, num só lugar.";
/* Os endereços da plataforma: neles, ?org= diz a escola. */
const PLATAFORMA = new Set(["membros.kingdomcompny.com", "localhost", "127.0.0.1"]);

const escapar = t => String(t ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* De que escola é o pedido: o domínio dela, ou ?org= na plataforma. */
export function enderecoDoPedido(url, host){
  const h = String(host || "").toLowerCase().split(":")[0];
  const org = (url.searchParams.get("org") || "").trim().toLowerCase();
  const plataforma = PLATAFORMA.has(h) || h.endsWith(".vercel.app");
  return { host: h, pedido: plataforma && /^[a-z0-9-]{2,41}$/.test(org) ? org : h, org: plataforma ? org : "" };
}

async function marcaDe(endereco, buscar){
  const r = await buscar(`${SUPABASE_URL}/rest/v1/rpc/marca_da_academia`, {
    method: "POST",
    headers: { apikey: SUPABASE_CHAVE, "Content-Type": "application/json", "Content-Profile": "public", "Accept-Profile": "public" },
    body: JSON.stringify({ p_endereco: endereco }),
    signal: AbortSignal.timeout(4000),
  });
  if(!r.ok) throw new Error("marca: " + r.status);
  return r.json();
}

/* As etiquetas, já resolvidas. */
export function etiquetasDe(marca, { host, org }){
  if(!marca) return { site: "Área de Membros", titulo: "Área de Membros", descricao: DESCRICAO, url: `https://${host}/`, imagem: null };
  if(marca.slug === "kingdom"){
    return {
      site: "Kingdom Academy", titulo: "Kingdom Academy — Área de Membros", descricao: DESCRICAO,
      url: "https://membros.kingdomcompny.com/",
      imagem: { url: "https://membros.kingdomcompny.com/img/partilha.png", tipo: "image/png", largura: 1080, altura: 1080, alt: "Coroa da Kingdom Academy" },
    };
  }
  const nome = String(marca.nomeEscola || marca.nome || "Área de Membros").trim();
  const texto = String(marca.loginTexto || marca.sublinha || "").trim() || DESCRICAO;
  const logo = String(marca.logoUrl || "").trim();
  /* As redes não mostram SVG nem imagens embutidas: só https de PNG/JPG/WebP. */
  const serve = /^https:\/\//i.test(logo) && !/\.svg(\?|$)/i.test(logo);
  const casa = marca.dominio || host;
  const url = `https://${casa}/` + (!marca.dominio && org ? `?org=${encodeURIComponent(org)}` : "");
  return {
    site: nome, titulo: `${nome} — Área de Membros`, descricao: texto, url,
    imagem: serve ? { url: logo, alt: `Logótipo de ${nome}` } : null,
  };
}

export function paginaDe(e){
  const img = e.imagem;
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>${escapar(e.titulo)}</title>
<meta name="description" content="${escapar(e.descricao)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapar(e.site)}">
<meta property="og:title" content="${escapar(e.titulo)}">
<meta property="og:description" content="${escapar(e.descricao)}">
<meta property="og:url" content="${escapar(e.url)}">
<meta property="og:locale" content="pt_PT">
${img ? `<meta property="og:image" content="${escapar(img.url)}">
<meta property="og:image:secure_url" content="${escapar(img.url)}">
${img.tipo ? `<meta property="og:image:type" content="${img.tipo}">\n` : ""}${img.largura ? `<meta property="og:image:width" content="${img.largura}">\n<meta property="og:image:height" content="${img.altura}">\n` : ""}<meta property="og:image:alt" content="${escapar(img.alt)}">
` : ""}<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapar(e.titulo)}">
<meta name="twitter:description" content="${escapar(e.descricao)}">
${img ? `<meta name="twitter:image" content="${escapar(img.url)}">\n` : ""}<link rel="canonical" href="${escapar(e.url)}">
</head>
<body><p><a href="${escapar(e.url)}">${escapar(e.titulo)}</a></p></body>
</html>`;
}

export async function responder(request, buscar = fetch){
  const url = new URL(request.url);
  const lugar = enderecoDoPedido(url, request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host);
  let marca = null;
  try { marca = await marcaDe(lugar.pedido, buscar); }
  catch(e){ console.error("partilha:", e.message); }
  return new Response(paginaDe(etiquetasDe(marca, lugar)), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      /* As redes guardam a pré-visualização; a CDN guarda dez minutos por
         endereço, para uma mudança na Aparência chegar depressa. */
      "Cache-Control": marca ? "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" : "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export default { fetch: request => responder(request) };
