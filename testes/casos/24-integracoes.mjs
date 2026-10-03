import { abrirPagina, ADMIN } from '../util.mjs';

export const nome = 'Integrações: a escola liga o Payflow e os produtos; a consola liga o Payflow da plataforma';

/* Pedido do Shelton a 02/10/2026, no modelo da Memberkit: Instaladas,
   Disponíveis, Histórico, um cartão por aplicação e a ficha com as
   instruções. Em demonstração (?demo=1), em memória. A sério, as funções
   academia.integracoes_da_escola, integracao_payflow_guardar,
   produto_externo_guardar/tirar, consola_integracoes e
   consola_integracao_payflow (segredos no Vault), provadas numa transacção
   desfeita; os recetores são academia-vendas e academia-receber. */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  /* 1. A escola. */
  const pg = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  await pg.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await pg.goto(`${base}/index.html?demo=1`);
  await pg.waitForTimeout(300);
  await pg.fill('#input-email', ADMIN);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('onboarding')?.remove());
  await pg.evaluate(() => irPara('admin-integracoes'));
  await pg.waitForTimeout(300);

  igual(await pg.locator('.int-aba').count(), 3, 'Três separadores: Instaladas, Disponíveis, Histórico');
  contem(await pg.textContent('.int-aba.ativa'), 'Instaladas', 'Abre nas instaladas');
  verdade(await pg.locator('[data-int-instalada="payflow"]').count() === 1, 'O Payflow aparece instalado');
  await pg.click('[data-int-aba="disponiveis"]');
  verdade(await pg.locator('.int-cartao').count() >= 8, 'Disponíveis: um cartão por aplicação');
  contem(await pg.textContent('[data-int-abrir="webhook"]'), 'Em breve', 'O que ainda não existe diz «Em breve»');

  await pg.click('.int-cartao[data-int-abrir="payflow"]');
  await pg.waitForTimeout(150);
  verdade(await pg.isVisible('[data-int-ficha="payflow"]'), 'O cartão abre a ficha com as instruções');
  contem(await pg.textContent('.int-copiar-valor'), '/functions/v1/academia-vendas?escola=', 'A ficha dá o endereço da escola para o Payflow');
  contem(await pg.textContent('[data-int-ficha="payflow"]'), 'order.paid', 'e diz que eventos marcar');

  /* O segredo: um errado não passa; um certo liga. */
  await pg.fill('#int-segredo', 'errado');
  await pg.click('#int-guardar-segredo');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.int-aviso'), 'começa por whsec_', 'Um segredo que não é do Payflow é recusado');
  await pg.fill('#int-segredo', 'whsec_' + 'A1b2C3d4'.repeat(4));
  await pg.click('#int-guardar-segredo');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.int-aviso'), 'Payflow ligado', 'Um segredo certo liga o Payflow');
  contem(await pg.textContent('.int-estado'), '····C3d4', 'e só o fim do segredo fica à vista');

  /* Ligar um produto aos cursos. */
  await pg.fill('#int-produto', 'xyz');
  await pg.click('#int-ligar-produto');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.int-aviso'), 'começa por prod_', 'Um ID de produto errado é recusado');
  await pg.fill('#int-produto', 'prod_TESTE01');
  await pg.click('#int-ligar-produto');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.int-aviso'), 'pelo menos um curso', 'Sem cursos, o produto não se liga');
  await pg.fill('#int-produto', 'prod_TESTE01');
  await pg.fill('#int-produto-nome', 'Produto de teste');
  await pg.check('.int-cursos input >> nth=0');
  await pg.click('#int-ligar-produto');
  await pg.waitForTimeout(150);
  verdade(await pg.locator('[data-produto="prod_TESTE01"]').count() === 1, 'O produto fica ligado aos cursos');
  await pg.click('[data-int-tirar="prod_TESTE01"]');
  await pg.waitForTimeout(150);
  igual(await pg.locator('[data-produto="prod_TESTE01"]').count(), 0, 'e tira-se');

  /* Vídeo: escolher o provedor. */
  await pg.click('[data-int-voltar]');
  await pg.click('[data-int-aba="disponiveis"]');
  await pg.click('.int-cartao[data-int-abrir="vimeo"]');
  await pg.click('[data-int-provedor="Vimeo"]');
  await pg.waitForTimeout(150);
  igual(await pg.evaluate(() => DB.config.integracoes.player), 'Vimeo', 'Escolher o Vimeo muda o provedor de vídeo');

  /* Histórico, com procura por email. */
  await pg.click('[data-int-voltar]');
  await pg.click('[data-int-aba="historico"]');
  await pg.waitForTimeout(150);
  verdade(await pg.locator('.int-historico tbody tr').count() >= 3, 'O histórico mostra as notificações do Payflow');
  await pg.fill('#int-procura', 'ana@');
  await pg.waitForTimeout(150);
  igual(await pg.locator('.int-historico tbody tr').count(), 1, 'A procura por email filtra');
  contem(await pg.textContent('.int-historico tbody'), 'convite enviado', 'e diz o que se fez com a venda');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript na escola');
  await pg.close();

  /* 2. A consola. */
  const c = await abrirPagina(navegador, `${base}/consola/index.html?demo=1#/integracoes`, { viewport: { width: 1440, height: 900 } });
  await c.waitForTimeout(250);
  contem(await c.textContent('#c-nav'), 'Integrações', 'A consola tem Integrações na navegação');
  igual(await c.locator('[data-int-instalada]').count(), 0, 'Sem o Payflow ligado, nada instalado');
  await c.click('[data-int-aba="disponiveis"]');
  await c.click('.int-cartao[data-int-abrir="payflow"]');
  await c.waitForTimeout(150);
  contem(await c.textContent('.int-copiar-valor'), '/functions/v1/academia-receber', 'A ficha dá o endereço da plataforma');
  await c.fill('#c-int-segredo', 'whsec_' + 'Z9y8X7w6'.repeat(4));
  await c.click('#c-int-payflow button[type=submit]');
  await c.waitForTimeout(200);
  contem(await c.textContent('#aviso-geral'), 'Payflow ligado', 'Colar o segredo liga o Payflow da plataforma');
  contem(await c.textContent('.int-estado'), '····X7w6', 'e só o fim fica à vista');
  await c.click('[data-int-voltar]');
  await c.waitForTimeout(150);
  await c.click('[data-int-aba="instaladas"]');
  await c.waitForTimeout(150);
  verdade(await c.locator('[data-int-instalada="payflow"]').count() === 1, 'Ligado, aparece nas instaladas');
  await c.click('[data-int-aba="historico"]');
  verdade(await c.locator('.int-historico tbody tr').count() > 0, 'O histórico mostra os eventos do Payflow');
  igual(c.errosDeJs.length, 0, 'Sem erros de JavaScript na consola');
  await c.close();

  /* 3. No telemóvel, sem deslizar para o lado. */
  const tel = await abrirPagina(navegador, `${base}/consola/index.html?demo=1#/integracoes/payflow`, { viewport: { width: 375, height: 800 } });
  await tel.waitForTimeout(250);
  const largura = await tel.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 375, `A ficha da consola cabe no telemóvel (${largura}px)`);
  await tel.close();
}
