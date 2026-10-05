import { abrirPagina } from '../util.mjs';

export const nome = 'Site de vendas: um por mercado (Moçambique em português, África do Sul em inglês), preços, anual com 2 meses grátis, efeitos';

/* Pedido do Shelton a 03/10/2026, com a referência Setrex: preto, o laranja
   da identidade no lugar do verde, e os efeitos da referência. A 05/10: um
   site por mercado — /site-mz/ em português, em meticais e M-Pesa; /site-za/
   em inglês, em rand e cartão — e o anual com 2 meses grátis (10 × o mensal).
   Os preços vêm de public.planos_da_plataforma; aqui não há rede, por isso a
   página usa os valores decididos (iguais aos da base hoje). */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  /* ===== Moçambique ===== */
  const pg = await abrirPagina(navegador, `${base}/site-mz/index.html?demo=1`, { viewport: { width: 1440, height: 900 }, esperar: 700 });
  const texto = (p, sel) => p.evaluate(s => document.querySelector(s).innerText.replace(/ /g, ' '), sel);

  igual(await pg.getAttribute('html', 'lang'), 'pt', 'O site de Moçambique é em português');
  igual(await pg.locator('#planos .plano').count(), 3, 'Três planos');
  contem(await texto(pg, '[data-plano="essencial"]'), 'MZ 699,00', 'O preço escreve-se com o símbolo à frente e duas casas');
  contem(await texto(pg, '[data-plano="profissional"]'), 'MZ 1 350,00', 'com os milhares agrupados');
  contem(await texto(pg, '[data-plano="escala"]'), 'Premium', 'O plano «escala» chama-se Premium');
  contem(await texto(pg, '[data-plano="escala"]'), 'Até 5 000 alunos activos', 'e diz o limite de alunos');
  verdade(await pg.locator('[data-plano="profissional"].destaque').count() === 1, 'O Profissional vem em destaque, no laranja da identidade');
  igual(await pg.locator('#int-moeda').count(), 0, 'Não há troca de moeda: o site é de um mercado');
  naoContem(await texto(pg, '#planos'), 'R ', 'e não mostra rand');

  let href = await pg.getAttribute('[data-plano="escala"] a', 'href');
  contem(href, '/criar/?plano=premium', 'O botão leva ao /criar com o plano');
  contem(href, 'moeda=MZN', 'e a moeda do mercado');
  verdade(!href.includes('lang='), 'sem mudar a língua');

  /* O anual: 2 meses grátis. */
  verdade(await pg.isVisible('#int-ciclo'), 'Há escolha entre mensal e anual');
  await pg.click('#btn-ciclo');
  await pg.waitForTimeout(900);
  contem(await texto(pg, '[data-plano="essencial"]'), 'MZ 6 990,00', 'O Essencial anual custa 10 meses');
  contem(await texto(pg, '[data-plano="essencial"]'), '2 meses grátis · poupa MZ 1 398,00', 'e diz os 2 meses grátis e quanto se poupa');
  contem(await texto(pg, '[data-plano="profissional"]'), 'MZ 13 500,00', 'O Profissional anual');
  contem(await texto(pg, '[data-plano="profissional"]'), 'poupa MZ 2 700,00', 'poupa MZ 2 700,00');
  contem(await texto(pg, '[data-plano="escala"]'), 'MZ 34 500,00', 'O Premium anual');
  contem(await texto(pg, '[data-plano="escala"]'), 'poupa MZ 6 900,00', 'poupa MZ 6 900,00');
  contem(await pg.getAttribute('[data-plano="essencial"] a', 'href'), 'ciclo=anual', 'O /criar recebe o ciclo anual');
  contem(await pg.getAttribute('.hero [data-criar]', 'href'), 'plano=profissional', 'O botão da abertura leva ao plano recomendado');
  contem(await pg.textContent('#perguntas'), 'Quanto se poupa no plano anual?', 'As perguntas explicam o anual');
  igual(await pg.getAttribute('a[href="/site-za/#precos"]', 'hreflang'), 'en', 'Liga ao site da África do Sul, marcado como inglês');

  /* Experimente: o nome e a cor da escola mudam a janela. */
  await pg.fill('#exp-nome', 'Academia Âncora');
  igual(await pg.textContent('#m-nome'), 'Academia Âncora', 'O nome escrito aparece na área de membros');
  igual(await pg.textContent('#m-iniciais'), 'AÂ', 'com as iniciais no sinal');
  igual(await pg.textContent('#m-url'), 'membros.academiaancora.com', 'e no endereço, sem acentos');
  await pg.click('.cores button[data-cor="#2f6fe4"]');
  igual(await pg.evaluate(() => document.getElementById('janela-hero').style.getPropertyValue('--m')), '#2f6fe4', 'A cor escolhida pinta a área de membros');

  /* O carrossel. */
  const antes = await pg.textContent('#slide-escola');
  await pg.click('#slide-seg');
  await pg.waitForTimeout(500);
  verdade((await pg.textContent('#slide-escola')) !== antes, `O carrossel passa ao exemplo seguinte (${antes})`);
  igual(await pg.textContent('#slide-n'), '2', 'e o contador avança');
  contem(await pg.textContent('#escolas'), 'são inventados', 'Os exemplos dizem que são inventados');

  /* As faixas têm duas voltas iguais, e a segunda não se lê duas vezes. */
  const n = await pg.locator('#trilho-1 .detalhe').count();
  igual(await pg.locator('#trilho-1 .detalhe[aria-hidden="true"]').count(), n / 2, 'A segunda volta da faixa está escondida dos leitores de ecrã');

  /* As perguntas abrem e fecham. */
  await pg.click('#perguntas .faq-item:nth-child(2) summary');
  await pg.waitForTimeout(500);
  verdade(await pg.evaluate(() => document.querySelector('#perguntas .faq-item:nth-child(2)').open), 'Uma pergunta abre-se');

  const corpo = await pg.textContent('body');
  naoContem(corpo, 'Kingdom', 'A marca da Kingdom não aparece no site');
  naoContem(corpo, 'Lorem', 'Sem texto de enchimento');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();

  /* ===== África do Sul ===== */
  const za = await abrirPagina(navegador, `${base}/site-za/index.html?demo=1`, { viewport: { width: 1440, height: 900 }, esperar: 700 });
  igual(await za.getAttribute('html', 'lang'), 'en', 'O site da África do Sul é em inglês');
  igual(await za.locator('#int-moeda').count(), 0, 'sem troca de moeda');
  contem(await texto(za, '[data-plano="essencial"]'), 'R 155,33', 'Os preços em rand, no formato da casa');
  contem(await texto(za, '[data-plano="essencial"]'), 'Essential', 'O plano com o nome em inglês');
  contem(await texto(za, '[data-plano="profissional"]'), 'Recommended', 'o recomendado em inglês');
  contem(await texto(za, '[data-plano="escala"]'), 'Up to 5 000 active students', 'e o limite de alunos');
  contem(await texto(za, '[data-plano="profissional"]'), 'Sell with Payflow: card payments', 'Na África do Sul vende-se por cartão');
  naoContem(await texto(za, '#planos'), 'MZ', 'e não mostra meticais');
  href = await za.getAttribute('[data-plano="profissional"] a', 'href');
  contem(href, 'moeda=ZAR', 'O /criar recebe o rand');
  contem(href, 'lang=en', 'e a língua inglesa');
  await za.click('#btn-ciclo');
  await za.waitForTimeout(900);
  contem(await texto(za, '[data-plano="essencial"]'), 'R 1 553,30', 'O Essencial anual em rand: 10 meses');
  contem(await texto(za, '[data-plano="essencial"]'), '2 months free · save R 310,66', 'com os 2 meses grátis');
  contem(await texto(za, '[data-plano="profissional"]'), 'R 3 000,00', 'O Profissional anual');
  contem(await texto(za, '[data-plano="escala"]'), 'save R 1 533,34', 'O Premium poupa R 1 533,34');
  const zaTexto = await za.evaluate(() => document.body.innerText.replace(/ /g, ' '));
  contem(zaTexto, 'We verify your card with R 18,00', 'A abertura diz a regra do mercado: validação do cartão com R 18,00');
  contem(zaTexto, 'Billed in rand, by debit or credit card', 'e como se paga');
  naoContem(zaTexto, 'M-Pesa', 'Sem M-Pesa no site da África do Sul');
  naoContem(zaTexto, 'grátis', 'Sem português (fora a ligação ao site de Moçambique)');
  await za.fill('#exp-nome', 'Cape Academy');
  igual(await za.textContent('#m-url'), 'members.capeacademy.com', 'O endereço do exemplo em inglês');
  naoContem(await za.textContent('body'), 'Kingdom', 'A marca da Kingdom não aparece');
  igual(za.errosDeJs.length, 0, 'Sem erros de JavaScript no site da África do Sul');
  await za.close();

  /* ===== /site/: escolhe o mercado ===== */
  for (const [fuso, pagina] of [['Africa/Johannesburg', '/site-za/'], ['Africa/Maputo', '/site-mz/']]) {
    const ctx = await navegador.newContext({ timezoneId: fuso });
    const p = await ctx.newPage();
    await p.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    await p.goto(`${base}/site/index.html#precos`);
    await p.waitForURL(`**${pagina}**`, { timeout: 4000 });
    verdade(new URL(p.url()).pathname === pagina && p.url().endsWith('#precos'), `Fora do Vercel, o /site/ abre ${pagina} pelo fuso ${fuso}, e mantém a secção`);
    await ctx.close();
  }

  /* No telemóvel, sem deslizar para o lado. */
  for (const s of ['site-mz', 'site-za']) {
    const tel = await abrirPagina(navegador, `${base}/${s}/index.html?demo=1`, { viewport: { width: 375, height: 800 } });
    const largura = await tel.evaluate(() => document.documentElement.scrollWidth);
    verdade(largura <= 375, `O ${s} cabe no telemóvel (${largura}px)`);
    await tel.close();
  }
}
