import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Páginas internas: banners, evento, oferta e página própria';

/* Decidido pelo Shelton a 27/09/2026: nenhum banner manda ninguém para fora
   sem antes lhe mostrar, cá dentro, o que é. Só o botão da página sai. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ALUNA);

  /* ---- os banners levam para dentro ---- */
  const banners = await pg.evaluate(() => [...document.querySelectorAll('#content-dashboard .banner-slide')]
    .map(a => ({ href: a.getAttribute('href'), alvo: a.getAttribute('target') })));
  verdade(banners.length >= 3, `O início tem os três banners de demonstração (tem ${banners.length})`);
  for(const b of banners){
    verdade(b.href.startsWith('#/'), `Um banner aponta para fora da Academia: ${b.href}`);
    igual(b.alvo, null, 'Um banner não abre um separador novo: leva a uma página cá dentro');
  }
  const hrefs = banners.map(b => b.href).join(' ');
  contem(hrefs, '#/evento/e1', 'O banner de um evento leva à página do evento');
  contem(hrefs, '#/oferta/of1', 'O banner de uma oferta leva à página da oferta');
  contem(hrefs, '#/destaque/b3', 'O banner com página própria leva a essa página');

  /* ---- página do evento ---- */
  await pg.evaluate(() => { location.hash = '#/evento/e1'; });
  await pg.waitForTimeout(300);
  igual(await pg.evaluate(() => estado.viewAtual), 'evento', 'A morada #/evento/<id> abre a página do evento');
  const ev = await pg.innerText('#content-evento');
  contem(ev, 'Mentoria em Grupo', 'A página diz o título do evento');
  contem(ev, 'plano dos próximos 90 dias', 'E a descrição');
  contem(ev, 'Entrar na sala', 'Um evento gratuito com sala tem o botão para entrar');
  contem(ev, 'Confirmar presença', 'E o de confirmar presença');
  await pg.click('#content-evento [data-voltar]');
  await pg.waitForTimeout(250);
  igual(await pg.evaluate(() => estado.viewAtual), 'dashboard', 'Voltar leva ao ecrã de onde se veio');

  /* ---- evento pago, ainda não comprado ---- */
  await pg.evaluate(() => {
    const of1 = DB.ofertas.find(o => o.id === 'of1');
    of1.atalho = 'all-access';      // com atalho há checkout
    irPara('evento', 'e5');
  });
  await pg.waitForTimeout(250);
  const pago = await pg.innerText('#content-evento');
  contem(pago, 'Garantir lugar · MZ 2 500,00', 'Um evento pago mostra o preço no botão, escrito como no Payflow');
  naoContem(pago, 'Entrar na sala', 'Sem lugar comprado, a sala não aparece');
  naoContem(pago, 'Confirmar presença', 'Sem lugar, não se confirma presença');
  const destinoCompra = await pg.getAttribute('#content-evento [data-comprar]', 'href');
  contem(destinoCompra, 'payflow.kingdomcompny.com/all-access', 'O botão de compra leva ao checkout da oferta do evento');

  await pg.evaluate(() => irPara('calendario'));
  await pg.waitForTimeout(250);
  const linhaPaga = await pg.evaluate(() => {
    const linha = document.querySelector('.event-row[data-evento="e5"]');
    const botao = linha && linha.querySelector('a[href="#/evento/e5"]');
    return botao ? botao.innerText : null;
  });
  contem(linhaPaga || '', 'Garantir lugar', 'No calendário, o evento pago manda para a página onde se compra');

  /* ---- página da oferta ---- */
  await pg.evaluate(() => irPara('oferta', 'of1'));
  await pg.waitForTimeout(250);
  const of = await pg.innerText('#content-oferta');
  contem(of, 'Kingdom All Access', 'A página da oferta diz o nome');
  contem(of, 'Desbloquear · MZ 2 500,00/mês', 'O botão diz o preço e que é mensal');
  contem(of, 'Kingdom Tracktion', 'Um plano diz os cursos que leva');

  /* A Vitrine abre a página, não o checkout directo. */
  await pg.evaluate(() => irPara('vitrine'));
  await pg.waitForTimeout(200);
  await pg.click('#vitrine-grid .course-card');
  await pg.waitForTimeout(250);
  igual(await pg.evaluate(() => estado.viewAtual), 'oferta', 'Tocar num cartão da Vitrine abre a página da oferta');

  /* ---- página própria de um banner ---- */
  await pg.evaluate(() => irPara('destaque', 'b3'));
  await pg.waitForTimeout(250);
  const dq = await pg.innerText('#content-destaque');
  contem(dq, 'A comunidade da Kingdom mudou de casa', 'A página própria diz o título do banner');
  contem(dq, 'grupos de cada programa', 'E o resumo que a equipa escreveu');
  const saida = await pg.getAttribute('#content-destaque .pagina-acoes a', 'href');
  contem(saida || '', 'exemplo.com', 'Só o botão da página leva para fora');

  /* ---- o que não existe diz-se ---- */
  await pg.evaluate(() => irPara('evento', 'nao-existe'));
  await pg.waitForTimeout(200);
  contem(await pg.innerText('#content-evento'), 'não está disponível', 'Um evento que não existe diz-se, em vez de uma página vazia');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();

  /* ---- telemóvel: só a imagem e «Saber mais» ---- */
  const tel = await entrarDemo(navegador, base, ALUNA, { viewport:{ width:390, height:844 } });
  const vis = await tel.evaluate(() => {
    const s = document.querySelector('#content-dashboard .banner-slide');
    const ve = sel => { const e = s.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
    return { titulo: ve('.banner-title'), cta: ve('.banner-cta'), etiqueta: ve('.banner-etiqueta'), saber: ve('.banner-saber'),
             alturaSaber: s.querySelector('.banner-saber').getBoundingClientRect().height };
  });
  falso(vis.titulo || vis.cta || vis.etiqueta, 'No telemóvel o banner não leva texto por cima da imagem (sobrepunha-se)');
  verdade(vis.saber, 'No telemóvel aparece só «Saber mais»');
  igual(Math.round(vis.alturaSaber), 28, '«Saber mais» tem a altura da etiqueta «Evento» de antes');
  await tel.close();

  /* ---- painel: para onde leva o banner, e o evento pago ---- */
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => { irPara('admin-banners'); editarBanner(null); });
  await adm.waitForTimeout(250);
  const opcoes = await adm.evaluate(() => [...document.querySelectorAll('#valor-destino option')].map(o => o.value));
  verdade(opcoes.includes('pagina'), 'Pode-se escolher «Página própria»');
  verdade(opcoes.some(v => v.startsWith('evento:')), 'Pode-se escolher um evento');
  verdade(opcoes.some(v => v.startsWith('curso:')), 'Pode-se escolher um curso');
  verdade(opcoes.some(v => v.startsWith('oferta:')), 'Pode-se escolher uma oferta');

  await adm.fill('#valor-titulo', 'Banner vazio');
  await adm.click('#drawer-guardar'); await adm.waitForTimeout(200);
  verdade(await adm.isVisible('#drawer-overlay'), 'Uma página própria sem resumo nem link é recusada: ficaria vazia');

  await adm.selectOption('#valor-destino', 'evento:e1');
  await adm.click('#drawer-guardar'); await adm.waitForTimeout(250);
  const gravado = await adm.evaluate(() => DB.banners.find(b => b.titulo === 'Banner vazio'));
  igual(gravado && gravado.destinoTipo, 'evento', 'O banner fica a levar a um evento');
  igual(gravado && gravado.destinoId, 'e1', 'E a qual');

  await adm.evaluate(() => { irPara('admin-eventos'); editarEvento(null); });
  await adm.waitForTimeout(250);
  await adm.fill('#valor-titulo', 'Pago sem oferta');
  await adm.fill('#valor-data', '2030-01-01');
  await adm.selectOption('#valor-acesso', 'pago');
  await adm.click('#drawer-guardar'); await adm.waitForTimeout(200);
  verdade(await adm.isVisible('#drawer-overlay'), 'Um evento pago sem a oferta que vende o lugar é recusado');
  igual(adm.errosDeJs.length, 0, `Sem erros no painel: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
