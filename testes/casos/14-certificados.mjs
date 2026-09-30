import { entrarDemo, ALUNA, ADMIN } from '../util.mjs';

export const nome = 'Certificados: gravam-se ao concluir, com a data desse dia, e ficam guardados';

/* Decidido pelo Shelton a 30/09/2026. Antes o certificado calculava-se a cada
   visita, com a data de hoje, e academia.certificados nunca teve uma linha.
   A sério quem grava é a base (trigger em academia.progresso, migração
   20260930220111); na demonstração grava o browser, pela mesma regra — e é
   isso que aqui se prova: o que o ecrã faz com um certificado gravado. */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ALUNA);

  /* Os dados de exemplo já trazem «Mentalidade Inquebrável» concluído. */
  const inicial = await pg.evaluate(() => meusCertificados().map(c => c.cursoId));
  igual(inicial.join(','), 'mi', 'Quem entra com um curso concluído tem esse certificado gravado');

  await pg.evaluate(() => irPara('certificados'));
  await pg.waitForTimeout(150);
  const grelha = await pg.textContent('#cert-grid');
  contem(grelha, 'Certificado gravado', 'O cartão diz que ficou gravado');
  contem(grelha, 'Emitido em', 'e mostra a data em que se gravou');
  contem(grelha, 'Por desbloquear', 'Os cursos por concluir continuam por desbloquear');

  await pg.click('.cert-card[data-curso="mi"]');
  await pg.waitForTimeout(150);
  const diploma = await pg.textContent('#modal-cert-conteudo');
  contem(diploma, 'Marta Lopes', 'O certificado leva o nome de quem concluiu');
  contem(diploma, 'Mentalidade Inquebrável', 'e o curso');
  const codigo = await pg.evaluate(() => certificadoDoCurso('mi').codigo);
  verdade(/^[0-9A-F]{12}$/.test(codigo), `Tem um código de 12 caracteres (obtive ${codigo})`);
  contem(diploma, 'Código ' + codigo, 'e o código aparece no certificado');
  await pg.click('#btn-fechar-certificado');

  /* Concluir a última aula de um curso grava o certificado nesse momento. */
  await pg.evaluate(() => {
    ['he-m1a1','he-m1a2','he-m1a3','he-m2a1','he-m2a2'].forEach(id => estado.progresso[id] = true);
    estado.progresso['he-m2a3'] = false;
    irPara('aula', 'he', 'he-m2a3');
  });
  await pg.waitForTimeout(200);
  verdade(await pg.evaluate(() => !certificadoDoCurso('he')), 'Antes da última aula não há certificado');
  await pg.click('#btn-concluir');
  await pg.waitForTimeout(300);
  const he = await pg.evaluate(() => certificadoDoCurso('he'));
  verdade(!!he, 'Concluída a última aula, o certificado ficou gravado');
  contem(await pg.textContent('#toast-wrap'), 'o seu certificado ficou gravado', 'e a pessoa fica a saber');
  verdade(Date.now() - new Date(he.emitidoEm).getTime() < 60000, 'com a data de agora');

  /* Fica guardado: desmarcar uma aula não o tira, nem lhe muda a data ou o código. */
  await pg.click('#btn-concluir');
  await pg.waitForTimeout(200);
  const depois = await pg.evaluate(() => certificadoDoCurso('he'));
  verdade(!!depois, 'Desmarcar uma aula não apaga o certificado');
  igual(depois && depois.emitidoEm, he.emitidoEm, 'nem lhe muda a data');
  igual(depois && depois.codigo, he.codigo, 'nem o código');

  /* Nem mudar a regra depois: subir a percentagem não desfaz o que se passou. */
  const guardado = await pg.evaluate(() => {
    DB.config.certificado.regraPct = 100;
    DB.cursos.find(c => c.id === 'mi').certificado = false;
    return !!certificadoDoCurso('mi');
  });
  verdade(guardado, 'Um curso que deixa de emitir não tira o certificado a quem já o tinha');
  await pg.evaluate(() => irPara('certificados'));
  await pg.waitForTimeout(150);
  verdade(await pg.$('.cert-card[data-curso="mi"]:not(.locked)') !== null,
    'e o cartão continua na página de certificados');

  /* Guardado no browser (é a «base» da demonstração). */
  const noBrowser = await pg.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('kingdom-academy:db:v1') || '{}');
    return (db.certificados || []).map(c => c.cursoId).sort().join(',');
  });
  igual(noBrowser, 'he,mi', 'Os dois certificados ficaram guardados');
  igual(pg.errosDeJs.join(' | '), '', 'Sem erros de JavaScript');
  await pg.close();

  /* O painel mostra os que ficaram gravados, e não uma conta feita na hora. */
  const admin = await entrarDemo(navegador, base, ADMIN);
  await admin.evaluate(() => { estado.abaCertificados = 'emitidos'; irPara('admin-certificados'); });
  await admin.waitForTimeout(200);
  const tabela = await admin.textContent('#content-admin');
  contem(tabela, 'Leonor Matsinhe', 'A aba Emitidos lista quem tem certificado');
  contem(tabela, 'A1B2C3D4E5F6', 'com o código');
  contem(tabela, '18 de agosto de 2026', 'e a data em que se gravou');
  naoContem(tabela, 'chegaram aos', 'Já não conta alunos pela percentagem de agora');
  igual(admin.errosDeJs.join(' | '), '', 'O painel abre sem erros de JavaScript');
  await admin.close();
}
