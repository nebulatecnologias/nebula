/* O corredor dos testes da Academia.

   No molde do do Payflow (kingdom-dashboard/testes/correr.mjs):
     1. levanta um servidor DENTRO deste processo, a servir os ficheiros
        reais do repositório -- os mesmos, byte a byte, que o Vercel serve
     2. abre um browser
     3. corre cada caso de testes/casos/
     4. conta, diz o que falhou, e sai com código 1 se alguma coisa falhou

   O servidor vive aqui dentro de propósito: um servidor largado em segundo
   plano morre sozinho entre corridas, e quando morre TODOS os casos falham
   com "connection refused" e parece que a Academia está partida.

   Os casos correm no modo de demonstração (?demo=1): dados inventados em
   js/dados.js, nenhum pedido ao Supabase, nenhum email a ninguém. */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { fazerFerramentas, Falha } from './util.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = join(AQUI, '..');
const PORTA = Number(process.env.PORTA_TESTES || 8744);

const TIPOS = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webp':'image/webp',
  '.woff2':'font/woff2', '.woff':'font/woff'
};

function servidor(){
  return createServer(async (req, res) => {
    let caminho = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
    if(caminho === '/' || caminho === '\\') caminho = '/index.html';
    const ficheiro = join(RAIZ, caminho);
    /* Nada fora do repositório, e nada do que o Vercel não publica. */
    if(!ficheiro.startsWith(RAIZ) || /[\/\\](node_modules|\.git|testes)[\/\\]/.test(ficheiro)){
      res.writeHead(403).end('fora'); return;
    }
    try {
      const corpo = await readFile(ficheiro);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(ficheiro)] || 'application/octet-stream' });
      res.end(corpo);
    } catch {
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
      res.end('não existe: ' + caminho);
    }
  });
}

function chromiumLocal(){
  /* No CI o Playwright instala o browser e encontra-o sozinho. No contentor
     de trabalho já existe um, e descarregá-lo outra vez seria esperar por nada. */
  for(const c of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                  '/opt/pw-browsers/chromium/chrome-linux/chrome',
                  '/opt/pw-browsers/chromium']){
    if(existsSync(c)) return { executablePath: c };
  }
  return {};
}

const VERDE = s => `\x1b[32m${s}\x1b[0m`, VERMELHO = s => `\x1b[31m${s}\x1b[0m`,
      CINZA = s => `\x1b[90m${s}\x1b[0m`;

async function principal(){
  const srv = servidor();
  await new Promise((ok, mal) => { srv.once('error', mal); srv.listen(PORTA, '127.0.0.1', ok); });
  const base = `http://127.0.0.1:${PORTA}`;
  console.log(CINZA(`servidor em ${base}`));

  const navegador = await chromium.launch(chromiumLocal());

  const so = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const ficheiros = (await readdir(join(AQUI, 'casos')))
    .filter(f => f.endsWith('.mjs'))
    .filter(f => !so.length || so.some(s => f.includes(s)))
    .sort();

  let falhados = 0, afirmacoes = 0;
  const comecou = Date.now();

  for(const f of ficheiros){
    const modulo = await import(join(AQUI, 'casos', f));
    const nome = modulo.nome || f.replace('.mjs','');
    const t = { total: 0 };
    const arranque = Date.now();
    try {
      await modulo.default({ navegador, base, ...fazerFerramentas(t) });
      afirmacoes += t.total;
      console.log(`${VERDE('✓')} ${nome} ${CINZA(`· ${t.total} afirmações · ${Date.now()-arranque}ms`)}`);
    } catch(e){
      falhados++;
      afirmacoes += t.total;
      const qual = e instanceof Falha ? e.message : (e.stack || String(e));
      console.log(`${VERMELHO('✗')} ${nome}\n    ${VERMELHO(qual.split('\n').join('\n    '))}`);
    }
  }

  await navegador.close();
  await new Promise(ok => srv.close(ok));

  const segundos = ((Date.now()-comecou)/1000).toFixed(1);
  console.log();
  if(falhados){
    console.log(VERMELHO(`${falhados} de ${ficheiros.length} casos falharam`) + CINZA(` · ${afirmacoes} afirmações · ${segundos}s`));
    process.exit(1);
  }
  console.log(VERDE(`${ficheiros.length} casos passaram`) + CINZA(` · ${afirmacoes} afirmações · ${segundos}s`));
}

principal().catch(e => { console.error(VERMELHO('o corredor rebentou:'), e); process.exit(1); });
