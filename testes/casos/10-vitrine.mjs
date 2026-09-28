import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Vitrine: categorias, cartão com preço, pré-venda e o painel';

/* Fase 4 do plano (pedido do Shelton a 27/09/2026). O que aparece vem do
   servidor (vitrine_do_aluno, com prova SQL à parte); aqui prova-se o que o
   ecrã faz com isso. Tudo com dados inventados. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ALUNA);
  await pg.evaluate(() => irPara('vitrine'));
  await pg.waitForTimeout(250);

  /* Categorias: as dos cursos que lá estão, mais «Planos» para os pacotes. */
  const chips = await pg.$$eval('#vitrine-chips .chip', els => els.map(e => e.innerText.trim()));
  igual(chips[0], 'Todas', 'A primeira categoria é «Todas»');
  verdade(chips.includes('Planos'), 'Um pacote de vários cursos fica em «Planos»');
  verdade(chips.includes('Negócios') && chips.includes('Desenvolvimento Pessoal'), 'As outras são as categorias dos cursos');
  falso(chips.includes('Inteligência Artificial'), 'Uma categoria sem nada à venda não aparece');

  await pg.click('#vitrine-chips .chip[data-cat="planos"]');
  await pg.waitForTimeout(150);
  const soPlanos = await pg.$$eval('#vitrine-grid .course-card', els => els.map(e => e.getAttribute('data-oferta')));
  igual(soPlanos.join(','), 'of1', 'Em «Planos» fica só o pacote');
  igual(await pg.getAttribute('#vitrine-chips .chip[data-cat="planos"]', 'aria-pressed'), 'true', 'A categoria escolhida diz-se ao leitor de ecrã');
  await pg.click('#vitrine-chips .chip[data-cat="todos"]');
  await pg.waitForTimeout(150);

  /* O cartão é o do curso, com o preço por baixo. */
  const he = await pg.innerText('#vitrine-grid .course-card[data-oferta="of2"]');
  contem(he, 'Sara Muchanga', 'O cartão diz quem dá o curso');
  contem(he, '4,5', 'E a avaliação');
  contem(he, '2h 54m', 'E a duração');
  contem(he, 'MZ 1 200,00', 'E o preço, escrito como o dinheiro se escreve');

  /* Pré-venda: etiqueta, data, e nada de «0 aulas». */
  const ol = await pg.innerText('#vitrine-grid .course-card[data-oferta="of3"]');
  contem(ol, 'Em breve', 'A oferta em pré-venda tem a etiqueta «Em breve»');
  contem(ol, 'Pré-venda: as aulas abrem a', 'E diz quando as aulas abrem');
  naoContem(ol, '0 aulas', 'Não diz «0 aulas», que se leria como um curso vazio');

  /* O cartão abre a página da oferta, e ela diz o mesmo. */
  await pg.click('#vitrine-grid .course-card[data-oferta="of3"]');
  await pg.waitForTimeout(250);
  igual(await pg.evaluate(() => location.hash), '#/oferta/of3', 'O cartão abre a página da oferta cá dentro');
  const pagina = await pg.innerText('#content-oferta');
  contem(pagina, 'Pré-venda', 'A página da oferta diz que é pré-venda');
  contem(pagina, 'Garantir na pré-venda · MZ 1 800,00', 'O botão diz o que se compra e quanto custa');
  contem(pagina, 'Inês Cumbe', 'E quem dá o curso');

  /* Pelo teclado também se abre. */
  await pg.evaluate(() => irPara('vitrine'));
  await pg.waitForTimeout(200);
  await pg.focus('#vitrine-grid .course-card[data-oferta="of2"]');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(200);
  igual(await pg.evaluate(() => location.hash), '#/oferta/of2', 'O cartão abre-se com Enter');

  /* Quem comprou em pré-venda entra no curso e vê quando abre. */
  await pg.evaluate(() => irPara('curso', 'lp'));
  await pg.waitForTimeout(250);
  const curso = await pg.innerText('#content-curso');
  contem(curso, 'Pré-venda: as aulas abrem a', 'O curso comprado em pré-venda diz quando as aulas abrem');
  naoContem(curso, 'Conteúdo do curso', 'Em vez de uma lista de módulos vazia');
  falso(await pg.isVisible('#content-curso .curso-hero-progresso'), 'Sem barra de progresso a 0%');

  /* Um curso normal continua como estava. */
  await pg.evaluate(() => irPara('curso', 'kt'));
  await pg.waitForTimeout(200);
  contem(await pg.innerText('#content-curso'), 'Conteúdo do curso', 'Um curso com aulas mostra o conteúdo como sempre');

  /* No telemóvel as categorias deslizam, sem partir a página. */
  await pg.setViewportSize({ width:390, height:844 });
  await pg.evaluate(() => irPara('vitrine'));
  await pg.waitForTimeout(250);
  const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal da página no telemóvel (${largura}px)`);
  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();

  /* O painel: um só interruptor por oferta, pré-venda com data, retidas à vista. */
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-conteudos'));
  await adm.waitForTimeout(200);
  await adm.evaluate(() => abrirFormCurso('he'));
  await adm.waitForTimeout(250);
  falso(await adm.isVisible('#f-vitrine'), 'O curso já não tem interruptor de Vitrine (é por oferta)');
  falso(await adm.isVisible('#f-urlVendas'), 'Nem o campo da página de vendas, que a Vitrine já não usava');

  await adm.evaluate(() => { ofertasDaVitrine = null; irPara('admin-vitrine'); });
  await adm.waitForTimeout(300);
  verdade(await adm.isVisible('[data-pre-venda="of3"][aria-checked="true"]'), 'A oferta em pré-venda aparece ligada no painel');
  verdade(await adm.isVisible('[data-abre-em="of3"]'), 'Com a data de abertura à vista');

  /* Desligar a pré-venda de uma oferta sem aulas retém-na, e diz porquê em cima. */
  await adm.click('[data-pre-venda="of3"]');
  await adm.waitForTimeout(250);
  const retidas = await adm.innerText('#content-admin .aviso-retidas');
  contem(retidas, 'Oratória para Líderes', 'A oferta retida aparece no aviso de cima');
  contem(retidas, 'não tem nenhuma aula', 'Com o motivo');
  await adm.click('[data-pre-venda="of3"]');
  await adm.waitForTimeout(250);
  falso(await adm.isVisible('#content-admin .aviso-retidas'), 'Com a pré-venda ligada outra vez, deixa de estar retida');
  igual(adm.errosDeJs.length, 0, `Sem erros no painel: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
