import { abrirPagina } from '../util.mjs';

export const nome = 'Consola: preços dos planos e isenção de cada organização';

/* W4·4 (02/10/2026). Em demonstração (?demo=1), em memória. A sério, as
   funções academia.consola_cobranca, consola_guardar_plano e consola_isentar
   (só a administração da plataforma), provadas em SQL numa transacção
   desfeita. O ambiente da Paystack saiu da consola: quem cobra é o Payflow
   (W4·6). */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const pg = await abrirPagina(navegador, `${base}/consola/index.html?demo=1#/planos`);
  let confirmou = 0;
  pg.on('dialog', d => { confirmou++; d.accept(); });
  const m = () => pg.evaluate(() => document.getElementById('mensalidade').innerText.replace(/ /g, ' '));
  await pg.waitForTimeout(150);

  contem(await m(), 'Mensalidade das escolas', 'Planos e preços tem o bloco da mensalidade');
  igual(await pg.locator('#mensalidade tr[data-plano]').count(), 3, 'com os três planos');
  contem(await m(), 'até 1 500', 'e o limite de alunos de cada um, agrupado');
  const cab = await pg.textContent('#mensalidade thead');
  verdade(cab.includes('Meticais (MZ)') && cab.includes('Rand (R)'), 'Preços em meticais e em rand, com o símbolo no cabeçalho');
  igual(await pg.locator('#mensalidade tr[data-plano="essencial"] input').count(), 4, 'Quatro preços por plano: mensal e anual, em cada moeda');
  igual(await pg.getAttribute('#mensalidade tr[data-plano="essencial"] [data-moeda="MZN"][data-preco="anual"]', 'placeholder'), 'sem preço', 'Sem preço, o campo diz que não há preço');
  contem(await pg.evaluate(() => document.querySelector('[data-plano-cartao="essencial"]').innerText.replace(/ /g, ' ')), 'MZ 699,00', 'O cartão do plano diz o preço mensal, com o símbolo à frente');
  naoContem(await pg.textContent('#c-vista'), 'Paystack', 'A consola já não fala da Paystack');

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
  await pg.fill('#mensalidade tr[data-plano="profissional"] [data-moeda="ZAR"][data-preco="mensal"]', '');
  await pg.click('#mensalidade [data-guardar-plano="profissional"]');
  await pg.waitForTimeout(150);
  igual(await pg.inputValue('#mensalidade tr[data-plano="profissional"] [data-moeda="ZAR"][data-preco="mensal"]'), '300', 'MZ 1 350 dá R 300,00 pelo câmbio');

  /* Cada organização diz o estado da mensalidade; a Kingdom não se mexe aqui. */
  await pg.evaluate(() => { location.hash = '#/organizacoes/teste/pagamento'; });
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.conta-escola'), 'Isenta', 'A escola de teste está isenta');
  await pg.click('#c-ficha-corpo [data-isentar]');
  await pg.waitForTimeout(150);
  verdade(confirmou > 0, 'Voltar a cobrar pede confirmação');
  contem(await pg.textContent('.conta-escola'), 'Sem pagamento', 'Voltar a cobrar deixa a escola à espera do pagamento');
  contem(await pg.textContent('.c-problema'), 'Pagamento por configurar', 'e a ficha diz que falta configurar o pagamento');
  await pg.click('#c-ficha-corpo [data-isentar]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.conta-escola'), 'Isenta', 'e isentá-la de novo volta atrás');
  await pg.evaluate(() => { location.hash = '#/organizacoes/kingdom/pagamento'; });
  await pg.waitForTimeout(150);
  igual(await pg.locator('#c-ficha-corpo [data-isentar]').count(), 0, 'A Kingdom não tem botão de isentar');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();
}
