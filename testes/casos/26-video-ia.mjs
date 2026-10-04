import { abrirPagina } from '../util.mjs';

export const nome = 'Página do curso de vídeo com IA: estrutura do modelo, preços, oferta única no Básico, bónus';

/* Pedido do Shelton a 04/10/2026: duas ofertas (Básico R 99,00, antes
   R 199,00; Premium R 199,00, antes R 399,00), uma oferta única de R 147,00
   que aparece num pop-up quando se escolhe o Básico, pelo menos quatro bónus
   no Premium, e a estrutura do catálogo de cursos do Higgsfield. Os links de
   pagamento ainda não existem: o botão avisa em vez de levar a lado nenhum.
   A 04/10 a estrutura passou a ser a do modelo Little Believers. */
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
  const nBonus = await pg.locator('#lista-bonus .bonus').count();
  verdade(nBonus >= 4, `Pelo menos quatro bónus no Premium (${nBonus})`);
  igual(await pg.locator('.oferta[data-oferta="premium"] .oferta-itens li', { hasText: 'Bónus:' }).count(), nBonus, 'O cartão do Premium lista todos os bónus');
  igual(await pg.locator('#lista-bonus .bonus h3', { hasText: 'Pack de prompts' }).count(), nBonus, 'Todos os bónus são packs de prompts, cada um para uma coisa');
  igual(await pg.locator('#lista-bonus .bonus-copiar').count(), nBonus, 'e cada pack mostra um prompt de exemplo para copiar');

  /* Sem data real de fim, não há contagem decrescente (seria urgência falsa). */
  verdade(await pg.isHidden('#promo-relogio'), 'Sem data de fim da promoção, a barra não mostra relógio');
  contem(await texto('#promo'), 'R 99,00', 'A barra da promoção mostra os preços');

  /* Escolher o Básico abre a oferta única, e não vai logo pagar. */
  falso(await pg.evaluate(() => document.getElementById('oto').open), 'A oferta única começa fechada');
  await pg.click('[data-comprar="basico"]');
  await pg.waitForTimeout(1600);
  verdade(await pg.evaluate(() => document.getElementById('oto').open), 'Escolher o Básico abre a oferta única');
  const oto = await texto('#oto');
  contem(oto, 'R 147,00', 'A oferta única é de R 147,00');
  contem(oto, 'R 199,00', 'e compara com o preço do Premium');
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

  /* A estrutura do modelo, pela ordem. */
  const ordem = await pg.evaluate(() => ['topo', 'depoimentos', 'por-dentro', 'dores', 'para-quem', 'bonus', 'ofertas', 'garantia', 'perguntas']
    .map(id => document.getElementById(id)).every((el, i, a) => el && (i === 0 || (a[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))));
  verdade(ordem, 'As secções seguem a ordem do modelo');
  igual(await pg.locator('#niveis li').count(), 9, 'Os três níveis mostram os módulos todos');
  contem(await texto('#garantia'), '7 dias', 'Há a secção da garantia');
  verdade(await pg.locator('#lista-perguntas .faq-item').count() >= 6, 'Há perguntas frequentes');

  /* Espaços reservados para imagens e vídeos. */
  verdade(await pg.locator('.ph-video').count() >= 1, 'Há espaços reservados para vídeos');
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
  verdade(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 375.5, 'A oferta única cabe na largura do telemóvel');
  verdade(caixa && Math.abs(caixa.y + caixa.height - 800) < 2, 'e sobe do fundo do ecrã, como uma folha');
  verdade(await tel.isVisible('#oto-nao'), 'e o «Não, obrigado» está lá');
  igual(tel.errosDeJs.length, 0, 'Sem erros de JavaScript no telemóvel');
  await tel.close();
}
