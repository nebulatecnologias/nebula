import { readFile } from 'node:fs/promises';

export const nome = 'Etiquetas de partilha: cada escola com as suas no WhatsApp & cia., a Kingdom igual';

/* W3 (02/10/2026): as redes não correm JavaScript, por isso as etiquetas de
   partilha vêm do servidor (api/partilha.mjs), só para os leitores das redes
   (vercel.json). Aqui prova-se sem rede, com a base fingida:
   - quem vai para a função (os leitores das redes) e quem não vai (alunos,
     o Google);
   - a Kingdom com as etiquetas de sempre (as mesmas do index.html);
   - outra escola com o nome, o texto da entrada e o logótipo dela, e nada da
     Kingdom; SVG não vai; tudo escapado;
   - na plataforma, ?org= diz a escola; base em baixo, pré-visualização neutra. */
const RAIZ = new URL('../../', import.meta.url);

export default async function ({ igual, verdade, falso, contem, naoContem }){
  const P = await import(new URL('api/partilha.mjs', RAIZ));
  const cfg = JSON.parse(await readFile(new URL('vercel.json', RAIZ), 'utf8'));

  /* 1. Quem vai para a função. */
  const leitores = cfg.routes.find(r => r.has?.[0]?.key === 'user-agent');
  const re = new RegExp('^' + leitores.has[0].value + '$');
  const caminho = new RegExp('^' + leitores.src + '$');
  for(const ua of ['WhatsApp/2.23.20.0 A', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                   'Mozilla/5.0 (Macintosh) facebookexternalhit/1.1 Facebot Twitterbot/1.0', 'TelegramBot (like TwitterBot)',
                   'LinkedInBot/1.0 (compatible; Mozilla/5.0)', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'Discordbot/2.0'])
    verdade(re.test(ua), `Vai para as etiquetas: ${ua.slice(0, 40)}`);
  for(const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
                   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36',
                   'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'])
    falso(re.test(ua), `Não vai: ${ua.slice(0, 40)}`);
  verdade(caminho.test('/') && caminho.test('/index.html'), 'Só a entrada (/ e /index.html)');
  falso(caminho.test('/js/app.js') || caminho.test('/consola/'), 'e nunca os ficheiros nem a consola');

  /* 2. A Kingdom fica igual ao index.html. */
  const fingir = marca => async () => ({ ok: !!marca, status: marca ? 200 : 503, json: async () => marca });
  const pedir = async (url, marca, ua = 'WhatsApp/2') => {
    const r = await P.responder(new Request(url, { headers: { 'user-agent': ua } }), fingir(marca));
    return { html: await r.text(), tipo: r.headers.get('content-type'), cache: r.headers.get('cache-control') };
  };
  const kingdom = await pedir('https://membros.kingdomcompny.com/', { slug: 'kingdom', nome: 'Kingdom Company', nomeEscola: 'Kingdom Academy' });
  const indice = await readFile(new URL('index.html', RAIZ), 'utf8');
  for(const m of kingdom.html.match(/<meta (property|name)="(og|twitter):[^>]+>/g))
    contem(indice, m, `A Kingdom tem a mesma etiqueta do index.html: ${m.slice(0, 60)}`);
  contem(kingdom.tipo, 'text/html', 'Sai como página HTML');

  /* 3. Outra escola: a marca dela, nada da Kingdom. */
  const lm = { slug: 'teste', nome: 'Escola de Teste', nomeEscola: 'Little Makers', loginTexto: 'Aprender a criar, <juntos>.',
               logoUrl: 'https://exemplo.invalid/o/logo.png', dominio: 'littlemakersmembers.kingdomcompny.com' };
  const escola = await pedir('https://littlemakersmembers.kingdomcompny.com/?convite=abc', lm);
  contem(escola.html, '<meta property="og:title" content="Little Makers — Área de Membros">', 'O título é o da escola');
  contem(escola.html, 'content="Aprender a criar, &lt;juntos&gt;."', 'a descrição é o texto da entrada dela, escapado');
  contem(escola.html, '<meta property="og:image" content="https://exemplo.invalid/o/logo.png">', 'e a imagem é o logótipo dela');
  contem(escola.html, '<meta property="og:url" content="https://littlemakersmembers.kingdomcompny.com/">', 'no endereço dela');
  naoContem(escola.html, 'Kingdom', 'Nada da Kingdom na pré-visualização de outra escola');
  contem(escola.cache, 's-maxage=600', 'A CDN guarda dez minutos');

  /* 4. Na plataforma, ?org= diz a escola; sem domínio próprio o link leva ?org=. */
  let pedido = '';
  await P.responder(new Request('https://membros.kingdomcompny.com/?org=teste&partilha'), async (u, o) => { pedido = JSON.parse(o.body).p_endereco; return { ok: true, json: async () => ({ ...lm, dominio: null }) }; });
  igual(pedido, 'teste', 'Em membros.?org=teste pergunta-se pela escola teste');
  const semDominio = await pedir('https://membros.kingdomcompny.com/?org=teste', { ...lm, dominio: null });
  contem(semDominio.html, 'content="https://membros.kingdomcompny.com/?org=teste"', 'e o link aponta para a plataforma com ?org=');
  await P.responder(new Request('https://littlemakersmembers.kingdomcompny.com/?org=kingdom'), async (u, o) => { pedido = JSON.parse(o.body).p_endereco; return { ok: true, json: async () => lm }; });
  igual(pedido, 'littlemakersmembers.kingdomcompny.com', 'Num domínio de escola, ?org= não muda de escola');

  /* 5. SVG não vai; base em baixo dá neutro. */
  const svg = await pedir('https://x.exemplo/', { ...lm, logoUrl: 'https://exemplo.invalid/logo.svg' });
  naoContem(svg.html, 'og:image', 'Um logótipo SVG não vai (as redes não o mostram)');
  const neutra = await pedir('https://x.exemplo/', null);
  contem(neutra.html, '<meta property="og:title" content="Área de Membros">', 'Sem resposta da base, pré-visualização neutra');
  naoContem(neutra.html, 'Kingdom', 'e nunca a marca de outra escola');
  contem(neutra.cache, 'no-store', 'que não fica guardada');
}
