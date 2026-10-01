import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entrarDemo, abrirPagina, ALUNA } from '../util.mjs';

export const nome = 'Marca: cada escola com a sua — a Kingdom só nos dados de demonstração';

/* Decidido pelo Shelton a 01/10/2026 (whitelabel, F1a): o código não traz a
   marca da Kingdom. O nome, o sinal, o rodapé, os textos de entrada e o
   certificado vêm da Aparência de cada escola; a Kingdom tem os seus gravados
   na base. A demonstração continua a mostrar a Kingdom Academy como exemplo
   (js/dados.js, APARENCIA_DEMO e CONFIG_DEMO). */

/* Onde «Kingdom» ainda pode aparecer, e porquê. */
const PERMITIDO = [
  /Kingdom Library/,                       // comentários: de onde vem o desenho
  /kingdomcompny\.com\/pagina/,            // comentário: um exemplo de endereço
  /da Kingdom, gravado na Aparência dela/, // comentário: o sinal «coroa»
  /são da Kingdom e continuam a abrir/,    // comentário: os ficheiros antigos
  /payflow\.kingdomcompny\.com/,           // o Payflow é da Kingdom até ao F1b
  /kingdom-dashboard\.vercel\.app/,        // o painel de gestão, idem
  /da Kingdom: noutra escola a Vitrine/,   // comentário do URL_PAYFLOW
];

export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

  /* 1. O código: fora dos dados de demonstração e do dicionário (que traduz o
        que a Kingdom gravou), «Kingdom» só onde está explicado acima. */
  const achados = [];
  for(const f of await readdir(join(raiz, 'js'))){
    if(!f.endsWith('.js') || f === 'dados.js' || f === 'idioma-en.js') continue;
    (await readFile(join(raiz, 'js', f), 'utf8')).split('\n').forEach((l, i) => {
      if(/kingdom/i.test(l) && !PERMITIDO.some(r => r.test(l))) achados.push(`js/${f}:${i + 1}: ${l.trim().slice(0, 90)}`);
    });
  }
  const html = await readFile(join(raiz, 'index.html'), 'utf8');
  const corpo = html.slice(html.indexOf('<body'));
  corpo.split('\n').forEach((l, i) => { if(/kingdom/i.test(l)) achados.push(`index.html <body>: ${l.trim().slice(0, 90)}`); });
  igual(achados.join('\n      '), '', 'Nenhuma marca da Kingdom no código da app nem no corpo do index.html');
  contem(html.slice(0, html.indexOf('<body')), '<title>Área de Membros</title>', 'O título de origem é neutro');

  /* 2. Os valores de origem são neutros: nada de nome nem assinatura de ninguém. */
  const pg0 = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  const origem = await pg0.evaluate(() => JSON.stringify([APARENCIA_PADRAO, CONFIG_PADRAO]));
  naoContem(origem, 'Kingdom', 'APARENCIA_PADRAO e CONFIG_PADRAO não falam da Kingdom');
  naoContem(origem, 'Shelton', 'e o certificado de origem não vem assinado por ninguém');
  await pg0.close();

  /* 3. Uma escola nova: o nome dela, as iniciais no sinal, a cor dela. */
  const pg = await entrarDemo(navegador, base, ALUNA);
  await pg.evaluate(() => {
    DB.aparencia = Object.assign({}, APARENCIA_PADRAO, { nomeEscola: 'Escola de Teste', corAccent: '#1f8f8a' });
    DB.config.certificado = Object.assign({}, CONFIG_PADRAO.certificado);
    aplicarAparencia();
  });
  igual(await pg.title(), 'Escola de Teste — Área de Membros', 'O título da aba é o nome da escola');
  contem(await pg.textContent('.sidebar-head .brand-mark'), 'Escola de Teste', 'A barra lateral mostra o nome da escola');
  contem(await pg.innerHTML('.sidebar-head .brand-mark'), '>ET</text>', 'Sem logótipo, o sinal são as iniciais');
  contem(await pg.innerHTML('.sidebar-head .brand-mark'), 'fill="#1f8f8a"', 'na cor de destaque da escola');
  naoContem(await pg.innerHTML('.sidebar-head .brand-mark'), 'M12.5 27.1', 'e não a coroa da Kingdom');
  verdade((await pg.getAttribute('#icone-marca', 'href')).startsWith('data:image/svg+xml,'), 'O ícone da aba passa a ser o sinal da escola');

  await pg.evaluate(() => irPara('certificados'));
  await pg.waitForTimeout(150);
  await pg.click('.cert-card[data-curso="mi"]');
  await pg.waitForTimeout(150);
  const diploma = await pg.textContent('#modal-cert-conteudo');
  naoContem(diploma, 'Kingdom', 'O certificado de uma escola nova não fala da Kingdom');
  naoContem(diploma, 'Shelton', 'nem vem assinado por quem não é dela');
  contem(await pg.innerHTML('#modal-cert-conteudo'), '>ET</text>', 'e leva o sinal da escola');
  await pg.click('#btn-fechar-certificado');

  /* 4. A Kingdom (como está gravada na base) continua com a coroa. */
  await pg.evaluate(() => { DB.aparencia = Object.assign({}, APARENCIA_DEMO); aplicarAparencia(); });
  contem(await pg.innerHTML('.sidebar-head .brand-mark'), 'M12.5 27.1', 'Com «simbolo: coroa», o sinal é a coroa');
  contem(await pg.textContent('.sidebar-head .brand-mark'), 'Kingdom Academy', 'e o nome é o que a escola gravou');
  igual(pg.errosDeJs.join(' | '), '', 'Sem erros de JavaScript');
  await pg.close();
}
