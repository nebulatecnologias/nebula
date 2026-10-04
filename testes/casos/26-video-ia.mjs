import { abrirPagina } from '../util.mjs';

export const nome = 'Página do curso de vídeo com IA: preços, oferta única no Básico, módulos com filtros, bónus';

/* Pedido do Shelton a 04/10/2026: duas ofertas (Básico R 99,00, antes
   R 199,00; Premium R 199,00, antes R 399,00), uma oferta única de R 147,00
   que aparece num pop-up quando se escolhe o Básico, pelo menos quatro bónus
   no Premium, e a estrutura do catálogo de cursos do Higgsfield. Os links de
   pagamento ainda não existem: o botão avisa em vez de levar a lado nenhum. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await abrirPagina(navegador, `${base}/video-ia/index.html`, { viewport: { width: 1440, height: 900 }, esperar: 600 });
  const texto = sel => pg.evaluate(s => document.querySelector(s).innerText.replace(/ /g, ' '), sel);

  /* As ofertas, no formato do dinheiro da casa. */
  const basico = await texto('.oferta[data-oferta="basico"]');
  contem(basico, 'R 99,00', 'O Básico custa R 99,00, com o símbolo à frente e duas casas');
  contem(basico, 'R 199,00', 'e mostra o preço de antes');
  const premium = await texto('.oferta[data-oferta="premium"]');
  contem(premium, 'R 199,00', 'O Premium custa R 199,00');
  contem(premium, 'R 399,00', 'e mostra o preço de antes');
  verdade(await pg.locator('.oferta[data-oferta="premium"].destaque').count() === 1, 'O Premium vem em destaque');

  /* Pelo menos quatro bónus, e o Premium lista-os. */
  const nBonus = await pg.locator('#bonus .bonus').count();
  verdade(nBonus >= 4, `Pelo menos quatro bónus no Premium (${nBonus})`);
  contem(premium, `${nBonus} bónus`, 'O cartão do Premium diz quantos bónus traz');
  contem(premium, 'Biblioteca de prompts', 'incluindo a biblioteca de prompts');

  /* Escolher o Básico abre a oferta única, e não vai logo pagar. */
  falso(await pg.evaluate(() => document.getElementById('oto').open), 'A oferta única começa fechada');
  await pg.click('[data-comprar="basico"]');
  await pg.waitForTimeout(1600);
  verdade(await pg.evaluate(() => document.getElementById('oto').open), 'Escolher o Básico abre a oferta única');
  const oto = await texto('#oto');
  contem(oto, 'R 147,00', 'A oferta única é de R 147,00');
  contem(oto, 'R 48,00', 'e diz quanto custa a mais do que o Básico');
  igual(await pg.evaluate(() => document.documentElement.dataset.checkout || ''), '', 'Abrir a oferta única ainda não manda pagar nada');

  /* Recusar segue para o Básico. */
  await pg.click('#oto-nao');
  await pg.waitForTimeout(300);
  falso(await pg.evaluate(() => document.getElementById('oto').open), 'Recusar fecha a oferta única');
  igual(await pg.evaluate(() => document.documentElement.dataset.checkout), 'basico', 'e segue para o pagamento do Básico');
  contem(await texto('#aviso'), 'ainda não está ligado', 'Sem link de pagamento, a página avisa em vez de falhar');

  /* Aceitar segue para a oferta única. */
  await pg.click('[data-comprar="basico"]');
  await pg.waitForTimeout(400);
  await pg.click('#oto-sim');
  await pg.waitForTimeout(300);
  igual(await pg.evaluate(() => document.documentElement.dataset.checkout), 'oto', 'Aceitar segue para o pagamento da oferta única');
  contem(await texto('#aviso'), 'R 147,00', 'pelo preço da oferta única');

  /* O Premium vai direito ao pagamento, sem pop-up. */
  await pg.click('[data-comprar="premium"]');
  await pg.waitForTimeout(300);
  falso(await pg.evaluate(() => document.getElementById('oto').open), 'O Premium não abre a oferta única');
  igual(await pg.evaluate(() => document.documentElement.dataset.checkout), 'premium', 'e segue para o pagamento do Premium');

  /* O catálogo de módulos, com filtros e procura. */
  const todos = await pg.locator('#lista-modulos .modulo').count();
  verdade(todos >= 6, `O catálogo mostra os módulos (${todos})`);
  await pg.check('#filtros input[value="premium"]', { force: true });
  await pg.waitForTimeout(700);
  const soPremium = await pg.locator('#lista-modulos .modulo').count();
  verdade(soPremium > 0 && soPremium < todos, `O filtro «Só no Premium» reduz a lista (${soPremium} de ${todos})`);
  igual(await pg.locator('#lista-modulos .modulo .modulo-selo').count(), soPremium, 'e todos os que ficam têm o selo Premium');
  await pg.click('#filtros-limpar');
  await pg.waitForTimeout(700);
  igual(await pg.locator('#lista-modulos .modulo').count(), todos, 'Limpar os filtros volta a mostrar tudo');
  await pg.fill('#procura', 'xyz-nada');
  await pg.waitForTimeout(800);
  verdade(await pg.isVisible('#modulos-vazio'), 'Uma procura sem resultados diz que não há módulos');
  await pg.fill('#procura', 'lip-sync');
  await pg.waitForTimeout(800);
  igual(await pg.locator('#lista-modulos .modulo').count(), 1, 'A procura encontra o módulo certo');

  /* Os totais saem dos módulos e batem certo com o Premium. */
  const aulas = await pg.evaluate(() => document.querySelector('[data-total="aulas"]').textContent);
  contem(premium, aulas.replace(' aulas', ' aulas em vídeo'), 'A abertura e o Premium contam as mesmas aulas');

  /* Os bónus fecham-se ao ver com o Básico. */
  await pg.click('#btn-plano');
  igual(await pg.getAttribute('#bonus-grelha', 'data-plano'), 'basico', 'O interruptor mostra os bónus fechados no Básico');

  /* Espaços reservados para imagens e vídeos. */
  verdade(await pg.locator('.ph-video').count() >= 5, 'Há espaços reservados para vídeos');
  verdade(await pg.locator('.ph-imagem').count() >= 5, 'e para imagens');

  const corpo = await pg.textContent('body');
  naoContem(corpo, 'Kingdom', 'A marca da Kingdom não aparece na página');
  naoContem(corpo, 'Lorem', 'Sem texto de enchimento');
  const tu = (corpo.match(/(?<![\p{L}-])(teu|tua|teus|tuas|tens|podes|queres|estás|vais|precisas|contigo|te)(?![\p{L}])/giu) || []);
  igual(tu.join(', '), '', 'Tratamento por «você»: nenhum «tu» na página');
  igual(pg.errosDeJs.length, 0, `Sem erros de JavaScript: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();

  /* No telemóvel, sem deslizar para o lado, e a oferta única cabe no ecrã. */
  const tel = await abrirPagina(navegador, `${base}/video-ia/index.html`, { viewport: { width: 375, height: 800 } });
  const largura = await tel.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 375, `A página cabe no telemóvel (${largura}px)`);
  await tel.evaluate(() => document.getElementById('ofertas').scrollIntoView());
  await tel.click('[data-comprar="basico"]');
  await tel.waitForTimeout(700);
  const caixa = await tel.locator('#oto').boundingBox();
  verdade(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 375, 'A oferta única cabe na largura do telemóvel');
  verdade(await tel.isVisible('#oto-nao'), 'e o «Não, obrigado» está lá');
  igual(tel.errosDeJs.length, 0, 'Sem erros de JavaScript no telemóvel');
  await tel.close();
}
