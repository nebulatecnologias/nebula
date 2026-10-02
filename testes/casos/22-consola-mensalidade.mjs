import { abrirPagina } from '../util.mjs';

export const nome = 'Consola: preços dos planos, ambiente da Paystack e isenção de cada escola';

/* W4·4 (02/10/2026). Em demonstração (?demo=1), em memória. A sério, as
   funções academia.consola_cobranca, consola_guardar_plano, consola_isentar e
   consola_ambiente (só a administração da plataforma), provadas em SQL numa
   transacção desfeita. */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const pg = await abrirPagina(navegador, `${base}/consola/index.html?demo=1`);
  let confirmou = 0;
  pg.on('dialog', d => { confirmou++; d.accept(); });
  const m = () => pg.evaluate(() => document.getElementById('mensalidade').innerText.replace(/ /g, ' '));

  contem(await m(), 'Mensalidade das escolas', 'A consola tem o bloco da mensalidade');
  igual(await pg.locator('#mensalidade tr[data-plano]').count(), 3, 'com os três planos');
  contem(await m(), 'até 1 500', 'e o limite de alunos de cada um, agrupado');
  const cab = await pg.textContent('#mensalidade thead');
  verdade(cab.includes('Meticais (MZ)') && cab.includes('Rand (R)'), 'Preços em meticais e em rand, com o símbolo no cabeçalho');
  igual(await pg.locator('#mensalidade tr[data-plano="essencial"] input').count(), 4, 'Quatro preços por plano: mensal e anual, em cada moeda');
  igual(await pg.getAttribute('#mensalidade tr[data-plano="essencial"] [data-moeda="MZN"][data-preco="mensal"]', 'placeholder'), 'sem preço', 'Sem preço, o campo diz que não há preço');

  /* Um preço mal escrito não passa; um bem escrito (com vírgula) guarda-se. */
  await pg.fill('#mensalidade tr[data-plano="essencial"] [data-moeda="MZN"][data-preco="mensal"]', 'cem');
  await pg.click('#mensalidade [data-guardar-plano="essencial"]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('#aviso-geral'), 'só com números', 'Um preço que não é número é recusado');
  await pg.fill('#mensalidade tr[data-plano="essencial"] [data-moeda="MZN"][data-preco="mensal"]', '3 500,00');
  await pg.fill('#mensalidade tr[data-plano="essencial"] [data-moeda="ZAR"][data-preco="mensal"]', '199,00');
  await pg.fill('#mensalidade tr[data-plano="essencial"] [data-moeda="ZAR"][data-preco="anual"]', '1 990,50');
  await pg.click('#mensalidade [data-guardar-plano="essencial"]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('#aviso-geral'), 'Preço guardado', 'Um preço com vírgula guarda-se');
  igual(await pg.inputValue('#mensalidade tr[data-plano="essencial"] [data-moeda="ZAR"][data-preco="anual"]'), '1990,5', 'e volta como foi guardado');
  igual(await pg.inputValue('#mensalidade tr[data-plano="essencial"] [data-moeda="MZN"][data-preco="mensal"]'), '3500', 'tanto em meticais');
  igual(await pg.inputValue('#mensalidade tr[data-plano="essencial"] [data-moeda="MZN"][data-preco="anual"]'), '', 'e um preço deixado vazio fica sem preço');

  /* O rand pelo câmbio (1 R = 4,5 MT): o metical preenche o rand vazio. */
  contem(await m(), '1 R = 4,5 MT', 'A consola diz o câmbio');
  await pg.fill('#mensalidade tr[data-plano="profissional"] [data-moeda="MZN"][data-preco="mensal"]', '1 350');
  await pg.click('#mensalidade [data-guardar-plano="profissional"]');
  await pg.waitForTimeout(150);
  igual(await pg.inputValue('#mensalidade tr[data-plano="profissional"] [data-moeda="ZAR"][data-preco="mensal"]'), '300', 'MZ 1 350 dá R 300,00 pelo câmbio');

  /* O ambiente: passar a produção pede confirmação. */
  igual(await pg.textContent('#pill-ambiente'), 'Modo de teste', 'A Paystack começa em teste');
  await pg.selectOption('#ambiente-paystack', 'producao');
  await pg.waitForTimeout(150);
  verdade(confirmou > 0, 'Passar a produção pede confirmação');
  igual(await pg.textContent('#pill-ambiente'), 'A cobrar a sério', 'e depois diz que cobra a sério');

  /* Cada escola diz o estado da mensalidade; a Kingdom não se mexe aqui. */
  contem(await pg.textContent('[data-escola="teste"] .conta-escola'), 'Isenta', 'A escola de teste está isenta');
  igual(await pg.locator('[data-escola="kingdom"] [data-isentar]').count(), 0, 'A Kingdom não tem botão de isentar');
  await pg.click('[data-escola="teste"] [data-isentar]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('[data-escola="teste"] .conta-escola'), 'Falta o cartão', 'Voltar a cobrar sem cartão deixa a escola à espera do cartão');
  await pg.click('[data-escola="teste"] [data-isentar]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('[data-escola="teste"] .conta-escola'), 'Isenta', 'e isentá-la de novo volta atrás');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();
}
