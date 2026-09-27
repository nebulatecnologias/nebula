import { abrirPagina, entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Arranque: produção nunca mostra dados de exemplo; demonstração entra';

export default async function ({ navegador, base, verdade, falso, igual, contem }){
  /* Produção sem a biblioteca do Supabase: explica, e não mostra nada falso. */
  const semLib = await abrirPagina(navegador, `${base}/index.html`, {
    antes: { fn: () => { Object.defineProperty(window, 'supabase', { get(){ return undefined; }, set(){} }); } }
  });
  contem(await semLib.textContent('#view-arranque'), 'Supabase',
    'Sem a biblioteca, a pessoa tem de ler o que falhou em vez de ficar num ecrã parado');
  verdade(await semLib.evaluate(() => document.getElementById('app-shell').classList.contains('hidden')),
    'Sem servidor, a área de membros não pode abrir — abriria com dados que não existem');
  await semLib.close();

  /* Produção normal: o DB começa vazio. Os dados de exemplo só existem em ?demo=1. */
  const prod = await abrirPagina(navegador, `${base}/index.html`, { esperar: 600 });
  igual(await prod.evaluate(() => DB.cursos.length), 0,
    'Em produção nenhum curso de exemplo pode aparecer antes de o servidor responder');
  falso(await prod.evaluate(() => modoDemonstracao()), 'Sem ?demo=1 não é demonstração');
  await prod.close();

  /* Demonstração: entra com os dados inventados. */
  const aluno = await entrarDemo(navegador, base, ALUNA);
  verdade(await aluno.evaluate(() => !document.getElementById('app-shell').classList.contains('hidden')),
    'Na demonstração o aluno entra na área');
  igual(await aluno.evaluate(() => estado.papel), 'aluno', 'Um aluno não pode entrar como equipa');
  igual(aluno.errosDeJs.length, 0, `Sem erros: ${aluno.errosDeJs.join(' | ')}`);
  await aluno.close();

  const admin = await entrarDemo(navegador, base, ADMIN);
  igual(await admin.evaluate(() => estado.papel), 'administrador', 'A equipa entra no painel');
  await admin.close();
}
