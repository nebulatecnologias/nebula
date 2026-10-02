import { abrirPagina, ADMIN } from '../util.mjs';

export const nome = '«Ver como» da consola: a escola abre na vista do aluno, e o aviso de suporte';

/* Pedido do Shelton a 02/10/2026. A consola abre a escola com ?org= (ver como
   organização) ou com ?org=&ver=aluno (ver como aluno). A base conta quem
   administra a plataforma como administração da escola (provado em SQL numa
   transacção desfeita: um aluno e um anónimo ficam como estavam). */
export default async function ({ navegador, base, igual, verdade, contem }){
  const pg = await abrirPagina(navegador, `${base}/index.html?demo=1&ver=aluno`);
  await pg.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await pg.goto(`${base}/index.html?demo=1&ver=aluno`);
  await pg.waitForTimeout(300);
  await pg.fill('#input-email', ADMIN);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('onboarding')?.remove());
  verdade(await pg.evaluate(() => estado.prevendoComoAluno === true), 'Com ?ver=aluno, a administração entra já como um aluno vê');
  contem(await pg.textContent('.aviso-previa'), 'como um aluno a vê', 'com o aviso de pré-visualização');
  await pg.click('#btn-sair-previa');
  await pg.waitForTimeout(200);
  igual(await pg.evaluate(() => estado.viewAtual), 'admin-visao', 'e volta ao painel da escola num clique');

  /* O aviso de suporte: quando a base diz que se está como suporte. */
  await pg.evaluate(() => { API.organizacao = { slug:'teste', nome:'Escola de Teste', suporte:true }; irPara('admin-visao'); });
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.aviso-suporte'), 'Escola de Teste', 'Como suporte, todos os ecrãs dizem em que escola se está');
  igual(await pg.getAttribute('.aviso-suporte a', 'href'), '/consola/', 'com o caminho de volta à consola');
  await pg.evaluate(() => { API.organizacao = { slug:'teste', nome:'Escola de Teste', suporte:false }; irPara('admin-visao'); });
  await pg.waitForTimeout(150);
  igual(await pg.locator('.aviso-suporte').count(), 0, 'Quem é da equipa não vê o aviso de suporte');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();

  /* No painel: o «Ver como organização» junto ao «Ver como aluno». */
  const p2 = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  await p2.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await p2.goto(`${base}/index.html?demo=1`);
  await p2.waitForTimeout(300);
  await p2.fill('#input-email', ADMIN);
  await p2.fill('#input-password', '1');
  await p2.click('#form-login button[type=submit]');
  await p2.waitForTimeout(600);
  await p2.evaluate(() => document.getElementById('onboarding')?.remove());
  verdade(await p2.isVisible('#btn-ver-como-organizacao'), 'Na barra de cima do painel, «Ver como organização» ao lado de «Ver como aluno»');
  verdade(await p2.isVisible('#btn-ver-como-aluno'), 'e o «Ver como aluno» continua lá');
  await p2.click('#btn-ver-como-organizacao');
  await p2.waitForTimeout(200);
  igual(await p2.locator('.ver-como-escola').count(), 2, 'Abre a lista das escolas');
  igual(await p2.getAttribute('.ver-como-escola[data-escola="teste"] [data-ver-como="organizacao"]', 'href'), `${base}/index.html?org=teste&demo=1`,
    'cada uma com o link para a ver como organização');
  igual(await p2.getAttribute('.ver-como-escola[data-escola="teste"] [data-ver-como="aluno"]', 'href'), `${base}/index.html?org=teste&ver=aluno&demo=1`,
    'e como aluno');
  await p2.click('.ver-como-card [data-fechar]');
  igual(await p2.locator('.ver-como-card').count(), 0, 'Fecha-se sem mais nada');
  igual(p2.errosDeJs.length, 0, 'Sem erros de JavaScript no painel');
  await p2.close();
}
