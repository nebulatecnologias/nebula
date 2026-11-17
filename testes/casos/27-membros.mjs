import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Membros: filtros, a ficha de cada membro (cursos, prazo, assinaturas, acesso ilimitado, papel, suspender, remover), adicionar e reenviar um convite revogado';

/* Pedido do Shelton a 28/10/2026: «quando um link é revogado não existe a
   opção para voltar a enviar o acesso; na aba de membros não tem opções para
   excluir, adicionar, promover, dar acesso a outros conteúdos, remover de um
   conteúdo, dar acesso a uma assinatura». Em demonstração, em memória (pessoas
   inventadas de js/dados.js). A sério, as funções academia.membro_* da base,
   provadas numa transacção desfeita (migração 20261028050645). Desde
   17/11/2026 os Planos deram lugar às Assinaturas: a ficha mostra os cursos
   que vêm de uma assinatura, e dá, muda e desativa a assinatura da pessoa. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-membros'));
  await adm.waitForTimeout(250);

  const contas = async () => adm.$$eval('#content-admin [data-filtro-membros]', els =>
    Object.fromEntries(els.map(e => [e.getAttribute('data-filtro-membros'), e.querySelector('.estado-chip-conta').innerText.trim()])));
  let c = await contas();
  igual(`${c.todos}/${c.alunos}/${c.equipa}/${c.suspensos}`, '9/8/1/1', 'Cada filtro diz quantos membros tem');
  naoContem(await adm.textContent('#content-admin'), 'painel de gestão', 'A aba já não manda para o painel de gestão');

  await adm.click('[data-filtro-membros="equipa"]');
  await adm.waitForTimeout(150);
  igual((await adm.$$eval('#content-admin tr[data-membro]', els => els.map(e => e.getAttribute('data-membro')))).join(','), 'm9', 'Em «Equipa» fica só a equipa');
  await adm.click('[data-filtro-membros="todos"]');
  await adm.waitForTimeout(150);

  /* A ficha da Marta: o curso que tem por matrícula própria e os três que
     lhe vêm da assinatura. */
  const abrir = async id => { await adm.click(`tr[data-membro="${id}"] [data-gerir-membro]`); await adm.waitForTimeout(350); };
  const ficha = () => adm.innerText('#membro-overlay .drawer');
  const confirmar = async () => { await adm.click('.modal-overlay [data-confirmar]'); await adm.waitForTimeout(350); };
  await abrir('m1');
  contem(await ficha(), 'Marta Lopes', 'A ficha abre com o nome');
  igual(await adm.locator('#membro-overlay .acessos-lista').first().locator('[data-acesso]').count(), 4, 'com os quatro cursos que abre');
  contem(await adm.innerText('[data-acesso="kt"]'), 'Compra', 'A matrícula própria diz de onde veio');
  contem(await adm.innerText('[data-acesso="mi"]'), 'Assinatura Kingdom All Access', 'e o curso que vem de uma assinatura diz de qual');
  igual(await adm.locator('[data-acesso="mi"] [data-tirar]').count(), 0, 'Um curso da assinatura não se tira um a um: trata-se na assinatura');
  contem(await adm.innerText('[data-assinatura="all-access"]'), 'Ativada', 'A assinatura dela aparece ativada');
  verdade(await adm.isVisible('[data-tirar-assinatura="all-access"]'), 'e pode desativar-se');
  igual(await adm.locator('[data-assinatura="essencial"] [data-abrir-assinatura]').count(), 1, 'A que não tem pode dar-se');

  /* Tirar um curso e abri-lo outra vez. */
  await adm.click('[data-acesso="kt"] [data-tirar]');
  await adm.waitForTimeout(150);
  await confirmar();
  igual(await adm.locator('#membro-overlay [data-acesso]').count(), 3, 'Tirar um curso fecha-o');
  contem(await adm.innerText('.acessos-fechados summary'), 'Acessos fechados (1)', 'e ele fica nos acessos fechados');
  await adm.click('.acessos-fechados summary');
  await adm.click('[data-reabrir="kt"]');
  await adm.waitForTimeout(350);
  igual(await adm.locator('#membro-overlay [data-acesso]').count(), 4, '«Abrir outra vez» devolve o acesso');

  /* O prazo de um acesso. Num curso que vem da assinatura, é dar-lhe uma
     matrícula própria, que passa a valer mais. */
  await adm.click('[data-acesso="mi"] [data-prazo]');
  await adm.waitForTimeout(150);
  const daqui10 = await adm.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); });
  await adm.fill('#prazo-mi', daqui10);
  await adm.click('[data-guardar-prazo="mi"]');
  await adm.waitForTimeout(350);
  contem(await adm.innerText('[data-acesso="mi"]'), 'Até ', 'O acesso passa a ter prazo');
  naoContem(await adm.innerText('[data-acesso="mi"]'), 'Assinatura', 'e a ser uma matrícula própria');
  await adm.click('[data-acesso="mi"] [data-prazo]');
  await adm.waitForTimeout(150);
  await adm.click('[data-sem-prazo="mi"]');
  await adm.waitForTimeout(350);
  contem(await adm.innerText('[data-acesso="mi"]'), 'Sem prazo', 'e volta a não ter');

  /* Dar outro curso, por 30 dias. */
  await adm.click('[data-abrir="dar"]');
  await adm.waitForTimeout(150);
  await adm.click('#form-dar-cursos label:has(input[value="ia"])');
  await adm.selectOption('#dar-prazo', '30');
  await adm.click('[data-dar-cursos]');
  await adm.waitForTimeout(350);
  contem(await adm.innerText('[data-acesso="ia"]'), 'Dado à mão', 'Dar acesso abre o curso escolhido');
  contem(await adm.innerText('[data-acesso="ia"]'), 'Até ', 'com o prazo escolhido');
  verdade(await adm.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm1')).includes('ia')),
    'e, na demonstração, o aluno passa a ver esse curso');

  /* Desativar a assinatura fecha os cursos que vinham dela, e só esses. */
  await adm.click('[data-tirar-assinatura="all-access"]');
  await adm.waitForTimeout(150);
  contem(await adm.innerText('.modal-overlay.confirmacao'), 'Os que tem por matrícula própria ficam', 'Desativar avisa do que fica');
  await confirmar();
  igual((await adm.$$eval('#membro-overlay [data-acesso]', els => els.map(e => e.getAttribute('data-acesso')))).join(','), 'kt,mi,ia',
    'Desativar a assinatura fecha os cursos dela e deixa os que têm matrícula própria');
  contem(await adm.innerText('[data-assinatura="all-access"]'), 'Desativada', 'A assinatura fica desativada, à vista');
  falso(await adm.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm1')).includes('lp')), 'e o aluno deixa de abrir os cursos dela');

  /* Dar outra: por omissão, com o trial do nível. */
  await adm.click('[data-abrir-assinatura="essencial"]');
  await adm.waitForTimeout(150);
  igual((await adm.locator('#assinatura-prazo option').allInnerTexts()).join(' | '), 'Trial gratuito (15 dias) | Sem prazo', 'Os prazos que se oferecem são os do nível');
  await adm.click('[data-dar-assinatura="essencial"]');
  await adm.waitForTimeout(350);
  verdade(await adm.isVisible('[data-tirar-assinatura="essencial"]'), 'Dar uma assinatura deixa-a ativa');
  contem(await adm.innerText('[data-assinatura="essencial"]'), 'Até ', 'com a data em que o trial acaba');
  igual((await adm.$$eval('#membro-overlay [data-acesso]', els => els.map(e => e.getAttribute('data-acesso')))).join(','), 'kt,mi,ia,he',
    'e abre o curso dela que a pessoa ainda não tinha');

  /* Mudar o estado e a data de uma assinatura. */
  await adm.click('[data-editar-assinatura="essencial"]');
  await adm.waitForTimeout(150);
  await adm.selectOption('#assinatura-estado', 'pendente');
  await adm.click('[data-guardar-assinatura="essencial"]');
  await adm.waitForTimeout(350);
  contem(await adm.innerText('[data-assinatura="essencial"]'), 'Pendente', 'Uma assinatura pode ficar pendente');
  igual(await adm.locator('#membro-overlay [data-acesso="he"]').count(), 0, 'e pendente não abre os cursos');
  await adm.click('[data-editar-assinatura="essencial"]');
  await adm.waitForTimeout(150);
  await adm.selectOption('#assinatura-estado', 'ativo');
  await adm.click('[data-assinatura-sem-prazo="essencial"]');
  await adm.waitForTimeout(350);
  contem(await adm.innerText('[data-assinatura="essencial"]'), 'Sem prazo', 'Ativada de novo, sem prazo');
  igual(await adm.locator('#membro-overlay [data-acesso]').count(), 4, 'os cursos voltam');

  /* Acesso ilimitado. */
  await adm.click('#membro-ilimitado');
  await adm.waitForTimeout(150);
  contem(await adm.innerText('.modal-overlay.confirmacao'), 'todos os cursos publicados', 'Dar acesso ilimitado diz o que abre');
  await confirmar();
  igual(await adm.getAttribute('#membro-ilimitado', 'aria-checked'), 'true', 'O acesso ilimitado fica ligado');
  contem(await ficha(), 'Todos os publicados', 'e a ficha diz que abre todos os cursos publicados');
  igual(await adm.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm1'))), null, 'Na demonstração, o aluno passa a ver tudo');
  contem(await adm.innerText('#content-admin tr[data-membro="m1"]'), 'Acesso ilimitado', 'e a lista di-lo');
  await adm.click('#membro-ilimitado');
  await adm.waitForTimeout(350);
  igual(await adm.getAttribute('#membro-ilimitado', 'aria-checked'), 'false', 'Tirar não pede confirmação');

  /* Promover. */
  await adm.click('.papel-opcao:has(input[value="colaborador"])');
  await adm.waitForTimeout(150);
  await confirmar();
  contem(await ficha(), 'Colaborador', 'Promover muda o papel');
  igual((await contas()).equipa, '2', 'e a equipa da lista conta mais um');

  /* Suspender e reativar. */
  await adm.click('[data-membro-estado="suspenso"]');
  await adm.waitForTimeout(150);
  await confirmar();
  contem(await ficha(), 'Suspenso', 'Suspender muda o estado');
  contem(await adm.innerText('#content-admin tr[data-membro="m1"]'), 'Suspenso', 'também na lista');
  await adm.click('[data-membro-estado="ativo"]');
  await adm.waitForTimeout(350);
  contem(await adm.innerText('#content-admin tr[data-membro="m1"]'), 'Ativo', 'Reativar devolve a entrada');
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);
  falso(await adm.isVisible('#membro-overlay'), 'Esc fecha a ficha');

  /* Na própria ficha não se suspende, remove nem muda o papel. */
  await abrir('m9');
  falso(await adm.isVisible('[data-membro-remover]'), 'Ninguém se remove a si próprio');
  falso(await adm.isVisible('[data-membro-estado]'), 'nem se suspende');
  verdade(await adm.locator('input[name="membro-papel"]:disabled').count() === 3, 'nem muda o seu papel');
  await adm.click('#membro-overlay [data-fechar-membro]');
  await adm.waitForTimeout(250);

  /* Remover. */
  await abrir('m2');
  await adm.click('[data-membro-remover]');
  await adm.waitForTimeout(150);
  await confirmar();
  falso(await adm.isVisible('#content-admin tr[data-membro="m2"]'), 'Remover tira a pessoa da lista');
  igual((await contas()).todos, '8', 'e a contagem acompanha');

  /* Adicionar: quem já é membro recebe os cursos; quem não é, um convite. */
  await adm.click('#btn-novo-membro');
  await adm.waitForTimeout(250);
  await adm.fill('#valor-email', 'renato.cossa@exemplo.co.mz');
  await adm.click('#valor-cursos label:has(input[value="vv"])');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(500);
  contem(await ficha(), 'Renato Cossa', 'Adicionar quem já é membro abre a ficha dele');
  verdade(await adm.isVisible('[data-acesso="vv"]'), 'com o curso escolhido já aberto');
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);

  const convitesAntes = await adm.evaluate(() => DB.convites.length);
  await adm.click('#btn-novo-membro');
  await adm.waitForTimeout(250);
  await adm.fill('#valor-email', 'nova.colaboradora@exemplo.co.mz');
  await adm.fill('#valor-nome', 'Nova Colaboradora');
  await adm.selectOption('#valor-papel', 'colaborador');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(400);
  const convite = await adm.evaluate(() => DB.convites[0]);
  igual(await adm.evaluate(() => DB.convites.length), convitesAntes + 1, 'Adicionar quem ainda não é membro manda um convite');
  igual(`${convite.email}/${convite.papel}`, 'nova.colaboradora@exemplo.co.mz/colaborador', 'com o papel escolhido');

  /* Convites: um revogado volta a enviar-se. */
  await adm.evaluate(() => irPara('admin-convites'));
  await adm.waitForTimeout(250);
  await adm.click('tr[data-convite="cv1"] [data-revogar]');
  await adm.waitForTimeout(150);
  await confirmar();
  verdade(await adm.isVisible('tr[data-convite="cv1"] [data-reenviar]'), 'Um convite revogado tem «Enviar outra vez»');
  await adm.click('tr[data-convite="cv1"] [data-reenviar]');
  await adm.waitForTimeout(150);
  contem(await adm.innerText('.modal-overlay.confirmacao'), 'convite novo', 'O aviso diz que sai um convite novo');
  await confirmar();
  const reenviado = await adm.evaluate(() => DB.convites[0]);
  igual(`${reenviado.email}/${reenviado.estado}`, 'joana.macie@exemplo.co.mz/enviado', 'e sai um convite novo, vivo, para a mesma pessoa');
  contem(await adm.innerText('tr[data-convite="cv1"]'), 'Revogado', 'O revogado fica como estava, no histórico');

  /* Convidar outra vez quem já tem um convite vivo substitui-o: um só link vivo. */
  await adm.click('#btn-novo-convite');
  await adm.waitForTimeout(250);
  await adm.fill('#valor-email', 'Joana.Macie@exemplo.co.mz');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(400);
  const daJoana = await adm.evaluate(() => DB.convites.filter(c => c.email.toLowerCase() === 'joana.macie@exemplo.co.mz').map(c => c.estado));
  igual(daJoana.filter(e => e === 'enviado' || e === 'aberto').length, 1, 'Convidar outra vez deixa um só convite vivo');
  igual(daJoana.length, 3, 'e os anteriores ficam no histórico, revogados');

  /* No telemóvel, a ficha cabe no ecrã. */
  await adm.setViewportSize({ width:390, height:844 });
  await adm.evaluate(() => irPara('admin-membros'));
  await adm.waitForTimeout(250);
  await abrir('m3');
  const direita = await adm.evaluate(() => document.querySelector('#membro-overlay .drawer').getBoundingClientRect().right);
  verdade(direita <= 390, `A ficha cabe no telemóvel (${direita}px)`);
  const largura = await adm.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal da página no telemóvel (${largura}px)`);

  igual(adm.errosDeJs.length, 0, `Sem erros: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
