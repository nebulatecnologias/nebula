import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Turmas: cada curso com a sua turma padrão; criar, editar (nome, prazo, padrão) e excluir; a matrícula do membro numa turma, com estado';

/* Passo 1 da especificação «Convites, Assinaturas e Turmas» (Shelton,
   17/11/2026): uma turma é uma edição de um curso, e quem tem o curso tem-no
   numa turma (a matrícula). Em demonstração, em memória (dados inventados de
   js/dados.js). A sério, a tabela academia.turmas com as suas regras e a
   matrícula em academia.acessos (migração 20261117073524, provada numa
   transacção desfeita: a conversão não muda o acesso de ninguém). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-turmas'));
  await adm.waitForTimeout(300);

  const cartoes = () => adm.locator('#turmas-grelha [data-turma]').count();
  const toast = async () => (await adm.locator('.toast').allInnerTexts()).join(' | ');
  const cursos = await adm.evaluate(() => DB.cursos.length);
  igual(await cartoes(), cursos + 1, 'Cada curso tem a sua turma, e um deles tem duas');
  const padrao = await adm.innerText('[data-turma="t-kt"]');
  contem(padrao, 'Turma A', 'O cartão diz o nome da turma');
  contem(padrao, 'Kingdom Tracktion', 'e o curso');
  contem(padrao, '3 Membros', 'quantos membros têm a matrícula ativa nela');
  contem(padrao, 'Comentário', 'e os comentários deles');
  contem(padrao, 'Padrão', 'e se é a turma padrão do curso');
  contem(await adm.innerText('[data-turma="t-kt-90"]'), 'Acesso 90 dias', 'Uma turma com prazo di-lo');

  await adm.fill('#turmas-busca', '90 dias');
  await adm.waitForTimeout(200);
  igual(await cartoes(), 1, 'A pesquisa filtra as turmas');
  await adm.fill('#turmas-busca', '');
  await adm.waitForTimeout(200);

  /* Criar: nome e curso; a edição abre a seguir. */
  await adm.click('#btn-nova-turma');
  await adm.waitForTimeout(300);
  await adm.fill('#valor-nome', 'Mentoria 7A');
  await adm.selectOption('#valor-cursoId', 'mi');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(500);
  igual(await adm.evaluate(() => estado.viewAtual), 'admin-turma', 'Criada a turma, abre a edição dela');
  const nova = await adm.evaluate(() => DB.turmas.find(t => t.nome === 'Mentoria 7A'));
  igual(`${nova.cursoId}/${nova.padrao}`, 'mi/false', 'A turma nova é do curso escolhido e não é a padrão');
  verdade(await adm.isVisible('#turma-apagar'), 'Uma turma que não é a padrão pode excluir-se');

  await adm.fill('#turma-prazo', '0');
  await adm.click('#turma-guardar');
  await adm.waitForTimeout(200);
  contem(await toast(), 'número de dias', 'Um prazo que não é um número de dias é recusado');
  await adm.fill('#turma-prazo', '30');
  await adm.click('#turma-guardar');
  await adm.waitForTimeout(400);
  igual(await adm.evaluate(() => estado.viewAtual), 'admin-turmas', 'Guardar volta à lista');
  contem(await adm.innerText(`[data-turma="${nova.id}"]`), 'Acesso 30 dias', 'com o prazo novo no cartão');

  /* A padrão: não se desmarca nem se exclui; marcar outra troca. */
  await adm.click('[data-turma="t-kt"]');
  await adm.waitForTimeout(300);
  igual(await adm.getAttribute('#turma-padrao', 'aria-disabled'), 'true', 'A turma padrão não se desmarca: marca-se outra');
  falso(await adm.isVisible('#turma-apagar'), 'e não se exclui');
  await adm.click('#turma-cancelar');
  await adm.waitForTimeout(300);
  await adm.click('[data-turma="t-kt-90"]');
  await adm.waitForTimeout(300);
  await adm.click('#turma-padrao');
  await adm.click('#turma-guardar');
  await adm.waitForTimeout(400);
  igual(await adm.evaluate(() => DB.turmas.filter(t => t.cursoId === 'kt').map(t => `${t.id}:${t.padrao}`).sort().join(',')),
    't-kt-90:true,t-kt:false', 'Marcar outra turma como padrão desmarca a anterior');

  /* Excluir: com membros ativos não; sem ninguém, sim. */
  await adm.click('[data-turma="t-kt"]');
  await adm.waitForTimeout(300);
  await adm.click('#turma-apagar');
  await adm.waitForTimeout(200);
  contem(await toast(), '3 membros com a matrícula ativa', 'Uma turma com membros ativos não se exclui');
  await adm.click('#turma-cancelar');
  await adm.waitForTimeout(300);
  await adm.click(`[data-turma="${nova.id}"]`);
  await adm.waitForTimeout(300);
  await adm.click('#turma-apagar');
  await adm.waitForTimeout(200);
  await adm.click('.modal-overlay.confirmacao [data-confirmar]');
  await adm.waitForTimeout(400);
  igual(await cartoes(), cursos + 1, 'Uma turma sem ninguém exclui-se');

  /* A matrícula, na ficha do membro: turma, estado e prazo. */
  await adm.evaluate(() => irPara('admin-membros'));
  await adm.waitForTimeout(250);
  await adm.click('tr[data-membro="m1"] [data-gerir-membro]');
  await adm.waitForTimeout(400);
  contem(await adm.innerText('#membro-overlay [data-acesso="kt"]'), 'Turma A', 'Num curso com várias turmas, a ficha diz em que turma a pessoa está');
  naoContem(await adm.innerText('#membro-overlay [data-acesso="mi"]'), 'Turma A', 'Num curso com uma só, não faz ruído');
  await adm.click('[data-acesso="kt"] [data-prazo]');
  await adm.waitForTimeout(200);
  await adm.selectOption('#turma-kt', 't-kt-90');
  const daqui20 = await adm.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 20); return d.toISOString().slice(0, 10); });
  await adm.fill('#prazo-kt', daqui20);
  await adm.click('[data-guardar-prazo="kt"]');
  await adm.waitForTimeout(400);
  const linha = await adm.innerText('#membro-overlay [data-acesso="kt"]');
  contem(linha, 'Turma 90 dias', 'Mudar a turma da matrícula');
  contem(linha, 'Até ', 'e o prazo');
  await adm.click('[data-acesso="kt"] [data-prazo]');
  await adm.waitForTimeout(200);
  await adm.selectOption('#estado-kt', 'pendente');
  await adm.click('[data-sem-prazo="kt"]');
  await adm.waitForTimeout(400);
  igual(await adm.locator('#membro-overlay [data-acesso="kt"]').count(), 0, 'Uma matrícula pendente deixa de contar como curso aberto');
  await adm.click('#membro-overlay .acessos-fechados summary');
  contem(await adm.innerText('#membro-overlay .acessos-fechados'), 'Pendente', 'e fica à vista, como pendente');
  falso(await adm.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm1')).includes('kt')), 'Pendente não abre o curso');
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);

  /* No curso: as turmas dele, e dar acesso numa turma com o prazo dela. */
  await adm.evaluate(() => irPara('admin-curso-editor', 'kt'));
  await adm.waitForTimeout(400);
  contem(await adm.innerText('#curso-acesso-resumo'), '2 turmas', 'O editor do curso diz quantas turmas tem');
  await adm.click('#btn-gerir-acesso');
  await adm.waitForTimeout(400);
  igual(await adm.locator('#acesso-overlay [data-turma-do-curso]').count(), 2, 'O painel do curso lista as turmas dele');
  await adm.click('.seccao-cabeca [data-abrir-dar]');
  await adm.waitForTimeout(200);
  await adm.click('#dar-acesso-lista label:has(input[value="m4"])');
  await adm.selectOption('#dar-acesso-turma', 't-kt');
  igual(await adm.inputValue('#dar-acesso-prazo'), 'turma', 'Por omissão, o prazo é o da turma');
  await adm.selectOption('#dar-acesso-turma', 't-kt-90');
  await adm.click('[data-dar-acesso]');
  await adm.waitForTimeout(400);
  const renato = await adm.innerText('#acesso-pessoas [data-pessoa="m4"]');
  contem(renato, 'Turma 90 dias', 'Dar acesso matricula na turma escolhida');
  contem(renato, 'Até ', 'com o prazo dela');
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);

  /* Um curso novo nasce com a sua Turma A. */
  await adm.evaluate(() => irPara('admin-conteudos'));
  await adm.waitForTimeout(200);
  await adm.evaluate(() => abrirFormCurso(null));
  await adm.waitForTimeout(300);
  await adm.fill('#f-titulo', 'Curso de Ensaio');
  await adm.evaluate(() => guardarFormCurso());
  await adm.waitForTimeout(400);
  await adm.evaluate(() => irPara('admin-turmas'));
  await adm.waitForTimeout(300);
  igual(await cartoes(), cursos + 2, 'Um curso novo aparece logo com a sua turma');

  /* No telemóvel, sem deslize horizontal. */
  await adm.setViewportSize({ width:390, height:844 });
  await adm.evaluate(() => irPara('admin-turmas'));
  await adm.waitForTimeout(250);
  let largura = await adm.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `A lista de turmas cabe no telemóvel (${largura}px)`);
  await adm.click('[data-turma="t-kt"]');
  await adm.waitForTimeout(300);
  largura = await adm.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `e a edição também (${largura}px)`);

  igual(adm.errosDeJs.length, 0, `Sem erros: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
