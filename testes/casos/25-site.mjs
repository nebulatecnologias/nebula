import { abrirPagina } from '../util.mjs';

export const nome = 'Site de vendas: preços com o símbolo, moeda, plano no endereço do /criar, efeitos';

/* Pedido do Shelton a 03/10/2026, com a referência Setrex: preto, o laranja
   da identidade no lugar do verde, e os efeitos da referência. Os preços vêm
   de public.planos_da_plataforma; aqui não há rede, por isso a página usa os
   valores decididos a 02/10 (iguais aos da base hoje). */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const pg = await abrirPagina(navegador, `${base}/site/index.html?demo=1`, { viewport: { width: 1440, height: 900 }, esperar: 700 });
  const texto = sel => pg.evaluate(s => document.querySelector(s).innerText.replace(/ /g, ' '), sel);

  igual(await pg.locator('#planos .plano').count(), 3, 'Três planos');
  contem(await texto('[data-plano="essencial"]'), 'MZ 699,00', 'O preço escreve-se com o símbolo à frente e duas casas');
  contem(await texto('[data-plano="profissional"]'), 'MZ 1 350,00', 'com os milhares agrupados');
  contem(await texto('[data-plano="escala"]'), 'Premium', 'O plano «escala» chama-se Premium');
  contem(await texto('[data-plano="escala"]'), 'Até 5 000 alunos activos', 'e diz o limite de alunos');
  verdade(await pg.locator('[data-plano="profissional"].destaque').count() === 1, 'O Profissional vem em destaque, no laranja da identidade');
  verdade(await pg.isHidden('#int-ciclo'), 'Sem preços anuais, não há escolha de ciclo');

  const href = await pg.getAttribute('[data-plano="escala"] a', 'href');
  contem(href, '/criar/?plano=premium', 'O botão leva ao /criar com o plano');
  contem(href, 'moeda=MZN', 'e a moeda');

  await pg.click('#btn-moeda');
  await pg.waitForTimeout(900);
  contem(await texto('[data-plano="profissional"]'), 'R 300,00', 'Em rand, o símbolo é R');
  contem(await pg.getAttribute('[data-plano="profissional"] a', 'href'), 'moeda=ZAR', 'e o /criar recebe a moeda');
  contem(await pg.getAttribute('.hero [data-criar]', 'href'), 'plano=profissional', 'O botão da abertura leva ao plano recomendado');

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
  diferenteDe(await pg.textContent('#slide-escola'), antes);
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

  /* No telemóvel, sem deslizar para o lado. */
  const tel = await abrirPagina(navegador, `${base}/site/index.html?demo=1`, { viewport: { width: 375, height: 800 } });
  const largura = await tel.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 375, `O site cabe no telemóvel (${largura}px)`);
  await tel.close();

  function diferenteDe(depois, antes){ verdade(depois && depois !== antes, `O carrossel passa ao exemplo seguinte (${antes} → ${depois})`); }
}
