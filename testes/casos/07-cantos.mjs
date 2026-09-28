import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Cantos: a escala do Payflow (cartão 16, diálogo 20, campo 10; capa de ponta a ponta)';

/* Pedido do Shelton a 27/09/2026, com o painel do Payflow como referência.
   Afirma-se sobre o que o browser desenha (getComputedStyle), não sobre o
   CSS escrito: um token certo tapado por uma regra mais específica passava
   num teste ao ficheiro e falhava no ecrã. */
const raio = (pg, sel) => pg.evaluate(s => {
  const el = document.querySelector(s);
  return el ? getComputedStyle(el).borderTopLeftRadius : null;
}, sel);

export default async function ({ navegador, base, igual, verdade }){
  const aluno = await entrarDemo(navegador, base, ALUNA);
  await aluno.evaluate(() => irPara('catalogo'));
  await aluno.waitForTimeout(150);
  igual(await raio(aluno, '#catalogo-grid .card'), '16px', 'Um cartão tem 16px, como no Payflow');
  /* 28/09/2026: o cartão de curso passou ao molde do cartão de oferta do
     Payflow — a capa vai de ponta a ponta (o cartão corta-lhe os cantos de
     cima) e não há contorno, só a sombra. */
  igual(await raio(aluno, '#catalogo-grid .course-cover'), '0px', 'A capa vai de ponta a ponta, sem margem nem cantos próprios');
  igual(await aluno.evaluate(() => getComputedStyle(document.querySelector('#catalogo-grid .course-card')).borderTopWidth), '0px',
        'O cartão de curso não tem contorno, como o do Payflow');
  verdade(await aluno.evaluate(() => getComputedStyle(document.querySelector('#catalogo-grid .course-card')).boxShadow !== 'none'),
        'Só a sombra o separa do fundo');
  igual(await raio(aluno, '.nav-item'), '10px', 'Um item do menu tem 10px');
  const botao = await raio(aluno, '.btn');
  verdade(parseFloat(botao) >= 20, `Os botões continuam em pílula (obtive ${botao})`);
  const chip = await raio(aluno, '.chip');
  verdade(parseFloat(chip) >= 19, `Os filtros continuam em pílula (obtive ${chip})`);
  await aluno.close();

  const admin = await entrarDemo(navegador, base, ADMIN);
  await admin.evaluate(() => { irPara('admin-eventos'); editarEvento(null); });
  await admin.waitForTimeout(300);
  igual(await raio(admin, '.drawer'), '20px', 'Uma gaveta tem 20px, como um diálogo do Payflow');
  igual(await raio(admin, '.drawer .field input'), '10px', 'Um campo tem 10px');
  await admin.close();
}
