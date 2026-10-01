import { abrirPagina } from '../util.mjs';

export const nome = 'Consola da plataforma: escolas, dono, equipa, domínio e suspensão';

/* Pedido do Shelton a 01/10/2026: quem administra a plataforma gere as escolas
   numa página própria (/consola/). Corre em demonstração (?demo=1, dados em
   memória). A sério, as mesmas acções vão às funções academia.consola_* e à
   Edge Function convidar-aluno; essas provaram-se em SQL, numa transacção
   desfeita (PLANO.md, registo da consola). */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const pg = await abrirPagina(navegador, `${base}/consola/index.html?demo=1`);
  pg.on('dialog', d => d.accept());

  /* 1. A lista: as duas escolas, com números e equipa. */
  verdade(await pg.isVisible('#ecra-consola'), 'Quem administra a plataforma vê a consola');
  igual(await pg.locator('#lista-escolas [data-escola]').count(), 2, 'A consola lista as escolas');
  contem(await pg.textContent('#resumo'), '2', 'e o resumo conta-as');
  contem(await pg.textContent('[data-escola="kingdom"]'), 'Kingdom Academy', 'A escola mostra o nome da marca dela');
  contem(await pg.textContent('[data-escola="kingdom"]'), 'Na Kingdom, a equipa gere-se no painel de gestão', 'Na Kingdom a equipa não se mexe aqui');
  igual(await pg.locator('[data-escola="kingdom"] [data-estado]').count(), 0, 'e a Kingdom não tem botão de suspender');
  igual(await pg.getAttribute('[data-escola="teste"] a.btn', 'href'), `${base}/?org=teste`, 'Sem domínio, a escola abre com ?org=');

  /* 2. Nova escola: o nome curto acompanha o nome; a validação vem da fonte. */
  await pg.click('#btn-nova-escola');
  await pg.fill('#escola-nome', 'Escola de Liderança');
  igual(await pg.inputValue('#escola-slug'), 'escola-de-lideranca', 'O nome curto nasce do nome, sem acentos');
  await pg.fill('#escola-slug', 'teste');
  await pg.click('#btn-criar-escola');
  await pg.waitForTimeout(100);
  contem(await pg.textContent('#escola-erro'), 'Já existe uma escola', 'Um nome curto repetido é recusado, com o porquê');
  verdade(await pg.isVisible('#dlg-escola'), 'e o diálogo fica aberto para corrigir');
  await pg.fill('#escola-slug', 'lideranca');
  await pg.fill('#escola-dono-nome', 'Carla Exemplo');
  await pg.fill('#escola-dono-email', 'carla@exemplo.invalid');
  await pg.click('#btn-criar-escola');
  await pg.waitForTimeout(200);
  verdade(!(await pg.isVisible('#dlg-escola')), 'Criada, o diálogo fecha');
  contem(await pg.textContent('#aviso-geral'), 'O convite seguiu para carla@exemplo.invalid', 'e diz que o convite do dono seguiu');
  igual(await pg.locator('#lista-escolas [data-escola]').count(), 3, 'A escola nova aparece na lista');
  const nova = await pg.textContent('[data-escola="lideranca"]');
  contem(nova, 'Convites por aceitar', 'com o convite do dono à espera');
  contem(nova, 'Dono', 'como dono');

  /* 3. Convidar para a equipa: por omissão, administrador se já há dono. */
  await pg.click('[data-escola="teste"] [data-convidar]');
  igual(await pg.inputValue('#convite-papel'), 'admin', 'Numa escola com dono, o convite sugere administrador');
  await pg.fill('#convite-email', 'nao-e-email');
  await pg.click('#btn-enviar-convite');
  contem(await pg.textContent('#convite-erro'), 'email válido', 'Um email inválido não sai');
  await pg.fill('#convite-email', 'diana@exemplo.invalid');
  await pg.click('#btn-enviar-convite');
  await pg.waitForTimeout(200);
  contem(await pg.textContent('[data-escola="teste"]'), 'diana@exemplo.invalid', 'O convite aparece na escola');

  /* 4. Revogar o convite. */
  await pg.click('[data-escola="teste"] [data-revogar]');
  await pg.waitForTimeout(150);
  naoContem(await pg.textContent('[data-escola="teste"]'), 'diana@exemplo.invalid', 'Revogado, o convite sai da lista');

  /* 5. Domínio: inválido recusado; válido passa a ser o endereço da escola. */
  await pg.click('[data-escola="lideranca"] [data-dominio]');
  await pg.fill('#dominio-valor', 'sem ponto');
  await pg.click('#form-dominio button[type=submit]');
  contem(await pg.textContent('#dominio-erro'), 'Domínio inválido', 'Um domínio inválido é recusado');
  await pg.fill('#dominio-valor', 'membros.lideranca.exemplo');
  await pg.click('#form-dominio button[type=submit]');
  await pg.waitForTimeout(150);
  /* Desde a W3, um domínio pedido só abre depois de verificado (o TXT da
     prova e o DNS a apontar): até lá a escola abre com ?org= e o cartão diz
     que está à espera do DNS. */
  contem(await pg.getAttribute('[data-escola="lideranca"] a.btn', 'href'), '?org=lideranca', 'Um domínio pedido ainda não abre a escola');
  contem(await pg.textContent('[data-escola="lideranca"]'), 'membros.lideranca.exemplo · à espera do DNS', 'e o cartão diz que está à espera do DNS');

  /* 6. Mexer na equipa: mudar o papel e suspender. */
  await pg.selectOption('[data-escola="teste"] select[data-papel]', 'admin');
  await pg.waitForTimeout(150);
  igual(await pg.inputValue('[data-escola="teste"] select[data-papel]'), 'admin', 'O papel muda');
  await pg.click('[data-escola="teste"] [data-membro-estado]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('[data-escola="teste"]'), 'Suspenso', 'Suspender alguém da equipa fica à vista');

  /* 7. Suspender e reactivar a escola. */
  await pg.click('[data-escola="lideranca"] [data-estado]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('[data-escola="lideranca"] .meta'), 'Suspensa', 'A escola suspensa diz que está suspensa');
  await pg.click('[data-escola="lideranca"] [data-estado]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('[data-escola="lideranca"] .meta'), 'Activa', 'e volta a activa');
  igual(pg.errosDeJs.join(' | '), '', 'Sem erros de JavaScript');
  await pg.close();

  /* 8. Quem não administra a plataforma não vê a consola. */
  const fora = await abrirPagina(navegador, `${base}/consola/index.html?demo=1&visitante=1`);
  verdade(await fora.isVisible('#ecra-sem-acesso'), 'Sem ser da administração, a consola diz que não é para si');
  igual(await fora.locator('#lista-escolas [data-escola]').count(), 0, 'e não mostra escola nenhuma');
  await fora.close();

  /* 9. Sem sessão, pede a entrada. */
  const semSessao = await abrirPagina(navegador, `${base}/consola/index.html?demo=1&sem-sessao=1`);
  verdade(await semSessao.isVisible('#ecra-entrar'), 'Sem sessão, a consola pede a entrada');
  await semSessao.close();

  /* 10. No telemóvel, sem deslizar para o lado. */
  const tel = await abrirPagina(navegador, `${base}/consola/index.html?demo=1`, { viewport: { width: 375, height: 800 } });
  const largura = await tel.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 375, `No telemóvel a consola cabe na largura (${largura}px)`);
  await tel.close();
}
