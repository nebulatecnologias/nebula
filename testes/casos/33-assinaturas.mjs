import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Assinaturas: os níveis (lista, criar, editar, excluir passando os membros), a assinatura na ficha do membro, quem abre um curso por ela e a turma em que fica';

/* Passo 3 da especificação «Convites, Assinaturas e Turmas» (Shelton,
   17/11/2026). Uma assinatura é uma ligação viva a um nível: pôr ou tirar um
   curso do nível abre-o ou fecha-o a quem a tem. Substitui os Planos. Em
   demonstração, em memória (níveis e pessoas inventados de js/dados.js). A
   sério, as tabelas academia.niveis, assinaturas e acessos_ilimitados e as
   funções da base (migração academia_assinaturas, provada em transacções
   desfeitas: o acesso de nenhum membro real muda quando se aplica). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ADMIN);
  const toast = async () => (await pg.locator('.toast').allInnerTexts()).join(' | ');
  const confirmar = async () => { await pg.click('.modal-overlay.confirmacao [data-confirmar]'); await pg.waitForTimeout(400); };
  const linhas = () => pg.locator('#content-admin tr[data-nivel]').count();
  const abrirFicha = async id => { await pg.evaluate(() => irPara('admin-membros')); await pg.waitForTimeout(250);
    await pg.click(`tr[data-membro="${id}"] [data-gerir-membro]`); await pg.waitForTimeout(400); };
  const fecharFicha = async () => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); };

  /* A lista. */
  await pg.evaluate(() => irPara('admin-assinaturas'));
  await pg.waitForTimeout(300);
  igual(await linhas(), 2, 'A lista mostra os níveis de assinatura da escola');
  naoContem(await pg.innerText('#content-admin'), 'Plano', 'Já não se fala em planos');
  const todas = await pg.innerText('tr[data-nivel="all-access"]');
  contem(todas, 'Kingdom All Access', 'Cada linha diz o nome');
  contem(todas, 'Mentalidade Inquebrável', 'os cursos que abre');
  contem(todas, '3 membros', 'e quantos membros a têm ativa');
  contem(await pg.innerText('tr[data-nivel="essencial"]'), '15 dias', 'O trial gratuito, quando há');

  await pg.fill('#assinaturas-busca', 'essen');
  await pg.waitForTimeout(200);
  igual(await linhas(), 1, 'A pesquisa filtra as assinaturas');
  await pg.fill('#assinaturas-busca', '');
  await pg.waitForTimeout(200);

  /* «N membros →» leva aos membros desse nível. */
  await pg.click('tr[data-nivel="essencial"] [data-membros-do-nivel][data-estado="ativo"]');
  await pg.waitForTimeout(300);
  igual(await pg.evaluate(() => estado.viewAtual), 'admin-membros', '«N membros» leva à lista de membros');
  igual((await pg.$$eval('#content-admin tr[data-membro]', els => els.map(e => e.getAttribute('data-membro')).sort())).join(','), 'm4,m6,m7', 'só com quem tem essa assinatura ativa');
  contem(await pg.innerText('#membros-filtro-assinatura'), 'Essencial', 'e a lista diz por que assinatura está filtrada');
  await pg.click('#btn-limpar-filtro-assinatura');
  await pg.waitForTimeout(200);
  igual(await pg.locator('#content-admin tr[data-membro]').count(), 9, '«Ver todos» tira o filtro');
  contem(await pg.innerText('tr[data-membro="m6"]'), 'Essencial', 'Na lista, cada membro diz a assinatura que tem');
  contem(await pg.innerText('tr[data-membro="m3"]'), 'Acesso ilimitado', 'e quem tem acesso ilimitado');

  /* Criar um nível. */
  await pg.evaluate(() => irPara('admin-assinaturas'));
  await pg.waitForTimeout(250);
  await pg.click('#btn-nova-assinatura');
  await pg.waitForTimeout(300);
  igual(await pg.evaluate(() => estado.viewAtual), 'admin-assinatura', '«Nova assinatura» abre a edição');
  await pg.click('#nivel-guardar');
  await pg.waitForTimeout(200);
  contem(await toast(), 'Dê um nome', 'Sem nome não se guarda');
  await pg.fill('#nivel-nome', 'Platinum');
  await pg.fill('#nivel-trial', '0');
  await pg.click('#nivel-guardar');
  await pg.waitForTimeout(200);
  contem(await toast(), 'O trial é um número de dias', 'Um trial que não é um número de dias é recusado');
  await pg.fill('#nivel-trial', '7');
  await pg.fill('#nivel-extensao', '30');
  verdade(await pg.isDisabled('[data-nivel-turma="kt"]'), 'A turma só se escolhe depois de marcar o curso');
  await pg.click('[data-nivel-linha="kt"] .nivel-curso-quem');
  falso(await pg.isDisabled('[data-nivel-turma="kt"]'), 'Marcado o curso, escolhe-se a turma');
  await pg.selectOption('[data-nivel-turma="kt"]', 't-kt-90');
  await pg.click('[data-nivel-linha="ia"] .nivel-curso-quem');
  await pg.click('#nivel-guardar');
  await pg.waitForTimeout(400);
  igual(await pg.evaluate(() => estado.viewAtual), 'admin-assinaturas', 'Guardar volta à lista');
  igual(await linhas(), 3, 'com o nível novo');
  const platinum = await pg.evaluate(() => DB.niveis.find(n => n.nome === 'Platinum'));
  igual(`${platinum.trialDias}/${platinum.extensaoDias}/${platinum.turmas.map(x => x.cursoId + ':' + x.turmaId).join(',')}`,
    '7/30/kt:t-kt-90,ia:t-ia', 'O nível guarda o trial, a extensão e a turma de cada curso');

  /* Dar a assinatura a um membro, na ficha. */
  await abrirFicha('m4');
  igual((await pg.$$eval('#membro-overlay [data-acesso]', els => els.map(e => e.getAttribute('data-acesso')))).join(','), 'mi,he',
    'O Renato abre os dois cursos da assinatura que já tinha');
  await pg.click(`[data-abrir-assinatura="${platinum.id}"]`);
  await pg.waitForTimeout(200);
  igual((await pg.locator('#assinatura-prazo option').allInnerTexts()).join(' | '), 'Trial gratuito (7 dias) | 30 dias (a extensão) | Sem prazo',
    'Ao dar, escolhe-se entre o trial, a extensão e sem prazo');
  await pg.selectOption('#assinatura-prazo', 'extensao');
  await pg.click(`[data-dar-assinatura="${platinum.id}"]`);
  await pg.waitForTimeout(400);
  contem(await pg.innerText(`[data-assinatura="${platinum.id}"]`), 'Ativada', 'A assinatura fica ativada');
  contem(await pg.innerText(`[data-assinatura="${platinum.id}"]`), 'Até ', 'com a data da extensão');
  const kt = await pg.innerText('#membro-overlay [data-acesso="kt"]');
  contem(kt, 'Assinatura Platinum', 'Os cursos do nível passam a abrir, e dizem de que assinatura vêm');
  contem(kt, 'Turma 90 dias', 'na turma que o nível escolheu');
  verdade(await pg.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm4')).join(',') === 'mi,he,kt,ia'),
    'Na demonstração, o aluno passa a abrir os cursos das duas assinaturas');
  await fecharFicha();

  /* A turma conta quem lá está por assinatura; o curso diz quem o abre por ela. */
  await pg.evaluate(() => irPara('admin-turmas'));
  await pg.waitForTimeout(300);
  contem(await pg.innerText('[data-turma="t-kt-90"]'), '1 Membro', 'A turma conta quem lá está por assinatura');
  contem(await pg.innerText('[data-turma="t-kt"]'), '3 Membros', 'e a outra turma do curso fica como estava');
  await pg.evaluate(() => irPara('admin-curso-editor', 'kt'));
  await pg.waitForTimeout(400);
  contem(await pg.innerText('#curso-acesso-resumo'), '4 alunos', 'O curso conta quem o abre por assinatura');
  await pg.click('#btn-gerir-acesso');
  await pg.waitForTimeout(400);
  const porAssinatura = await pg.innerText('#acesso-pessoas [data-pessoa="m4"]');
  contem(porAssinatura, 'Assinatura Platinum', 'No painel do curso, quem o abre por assinatura aparece com o nome dela');
  igual(await pg.locator('#acesso-pessoas [data-pessoa="m4"] [data-tirar-pessoa]').count(), 0, 'e não se tira dali: trata-se na assinatura');
  contem(await pg.innerText('#acesso-overlay .drawer'), '2 membros com acesso ilimitado também o abrem', 'O painel lembra quem tem acesso ilimitado');
  await pg.click('.seccao-cabeca [data-abrir-dar]');
  await pg.waitForTimeout(200);
  igual(await pg.locator('#dar-acesso-lista input[value="m4"]').count(), 0, 'Quem já o abre por assinatura não aparece para receber acesso');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(250);

  /* A ligação é viva: tirar um curso do nível fecha-o a quem a tem. */
  await pg.evaluate(() => irPara('admin-assinaturas'));
  await pg.waitForTimeout(250);
  await pg.click(`tr[data-nivel="${platinum.id}"] [data-editar]`);
  await pg.waitForTimeout(300);
  verdade(await pg.isChecked('[data-nivel-curso="ia"]'), 'Ao editar, os cursos do nível vêm marcados');
  igual(await pg.inputValue('[data-nivel-turma="kt"]'), 't-kt-90', 'com a turma escolhida');
  await pg.click('[data-nivel-linha="ia"] .nivel-curso-quem');
  await pg.click('#nivel-guardar');
  await pg.waitForTimeout(400);
  igual(await pg.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm4')).join(',')), 'mi,he,kt',
    'Tirar um curso do nível fecha-o a quem tem a assinatura');

  /* Uma turma que um nível usa não se apaga. */
  await abrirFicha('m4');
  await pg.click(`[data-tirar-assinatura="${platinum.id}"]`);
  await pg.waitForTimeout(200);
  await confirmar();
  contem(await pg.innerText(`[data-assinatura="${platinum.id}"]`), 'Desativada', 'A assinatura desativa-se na ficha');
  await fecharFicha();
  await pg.evaluate(() => irPara('admin-turma', 't-kt-90'));
  await pg.waitForTimeout(300);
  await pg.click('#turma-apagar');
  await pg.waitForTimeout(200);
  contem(await toast(), 'A assinatura «Platinum» entrega o curso nesta turma', 'Uma turma que uma assinatura usa não se apaga');

  /* Excluir: sem ninguém, é só confirmar; com membros, pede para onde passam. */
  await pg.evaluate(() => irPara('admin-assinaturas'));
  await pg.waitForTimeout(250);
  await pg.click(`tr[data-nivel="${platinum.id}"] [data-apagar]`);
  await pg.waitForTimeout(200);
  contem(await pg.innerText('.modal-overlay.confirmacao'), 'Ninguém a tem ativa nem pendente', 'Excluir um nível sem ninguém só pede confirmação');
  await confirmar();
  igual(await linhas(), 2, 'e ele sai da lista');
  await pg.click('tr[data-nivel="essencial"] [data-apagar]');
  await pg.waitForTimeout(300);
  contem(await pg.innerText('#drawer-overlay .drawer'), '3 membros têm «Essencial» ativa ou pendente', 'Excluir um nível com membros diz quantos são');
  igual((await pg.locator('#valor-destino option').allInnerTexts()).join(','), 'Kingdom All Access', 'e pede a assinatura para onde passam');
  await pg.click('#drawer-guardar');
  await pg.waitForTimeout(500);
  igual(await linhas(), 1, 'Passados os membros, o nível exclui-se');
  contem(await pg.innerText('tr[data-nivel="all-access"]'), '6 membros', 'e os membros dele ficam na outra assinatura');
  verdade(await pg.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm6')).includes('lp')), 'com os cursos dela');

  /* Os relatórios falam em assinaturas. */
  await pg.evaluate(() => irPara('admin-relatorios'));
  await pg.waitForTimeout(300);
  const relatorio = await pg.innerText('#content-admin');
  contem(relatorio, 'Alunos por assinatura', 'O relatório agrupa os alunos por assinatura');
  contem(relatorio, 'Assinantes ativos', 'e conta os assinantes ativos');

  /* No telemóvel, a lista e a edição cabem. */
  await pg.setViewportSize({ width:390, height:844 });
  await pg.evaluate(() => irPara('admin-assinaturas'));
  await pg.waitForTimeout(250);
  let largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `A lista de assinaturas cabe no telemóvel (${largura}px)`);
  await pg.click('tr[data-nivel="all-access"] [data-editar]');
  await pg.waitForTimeout(300);
  largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `e a edição também (${largura}px)`);
  await pg.setViewportSize({ width:1280, height:900 });

  /* A aluna: abre os cursos da assinatura, e as Definições dizem qual tem. */
  await pg.evaluate(() => sairDaConta());
  await pg.waitForTimeout(600);
  await pg.fill('#input-email', ALUNA);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { const m = document.getElementById('onboarding'); if(m) m.remove(); });
  igual((await pg.evaluate(() => cursosVisiveis().map(c => c.id).sort())).join(','), 'he,kt,lp,mi',
    'A aluna abre o curso da matrícula própria e os três da assinatura');
  igual(await pg.evaluate(() => { const e = turmaEfetivaDemo('mi'); return e.turma + '/' + e.inicio; }), 't-mi/2026-01-12',
    'Num curso da assinatura, a turma é a do nível e os dias contam do início da assinatura');
  await pg.evaluate(() => irPara('definicoes'));
  await pg.waitForTimeout(300);
  const conta = await pg.innerText('#content-definicoes');
  contem(conta, 'Assinatura', 'As Definições têm a linha da assinatura');
  contem(conta, 'Kingdom All Access', 'com o nome da que a aluna tem');
  naoContem(conta, 'Plano', 'e já não falam em plano');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
