import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Ofertas e vendas: a oferta entrega cursos, cada um numa turma, ou uma assinatura; o prazo vem da turma ou da extensão';

/* Passo 4 da especificação «Convites, Assinaturas e Turmas» (Shelton,
   17/11/2026). A oferta deixa de ter duração própria: entrega cursos, cada um
   numa turma (o prazo é o dela), ou uma assinatura (o prazo é a extensão do
   nível). Em demonstração, em memória (ofertas, turmas e níveis inventados
   de js/dados.js). A sério, a venda chega só pelo webhook da integração e é
   a escola_aplicar_venda que a aplica (migração academia_ofertas_e_vendas,
   provada numa transacção desfeita em 28 verificações: compra, recompra que
   soma os dias, reembolso, renovação, pagamento em falta e cancelamento). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ADMIN);
  const toast = async () => (await pg.locator('.toast').allInnerTexts()).join(' | ');
  const guardar = async () => { await pg.click('#drawer-guardar'); await pg.waitForTimeout(400); };
  const visivel = sel => pg.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('.hidden'); }, sel);
  const ofertaDe = n => pg.evaluate(x => DB.ofertasDaEscola.find(o => o.nome === x), n);

  await pg.evaluate(() => irPara('admin-ofertas'));
  await pg.waitForTimeout(300);
  contem(await pg.innerText('#content-admin thead'), 'O que entrega', 'A lista diz o que cada oferta entrega');

  /* Cursos, cada um numa turma. */
  await pg.click('#btn-nova-oferta');
  await pg.waitForTimeout(300);
  igual(await pg.inputValue('#valor-entrega'), 'cursos', 'Uma oferta nova entrega cursos');
  falso(await visivel('#valor-nivelId'), 'e a escolha da assinatura fica escondida');
  igual((await pg.innerText('#oferta-turmas')).trim(), '', 'Sem cursos escolhidos, não há turmas a mostrar');
  await pg.fill('#valor-nome', 'Tracktion em 90 dias');
  await pg.click('#valor-cursos label:has(input[value="kt"])');
  await pg.click('#valor-cursos label:has(input[value="he"])');
  igual(await pg.locator('#oferta-turmas [data-oferta-turma-linha]').count(), 2, 'Cada curso escolhido ganha a sua linha de turma');
  igual(await pg.locator('#oferta-turmas select[data-oferta-turma="kt"] option').count(), 2, 'Num curso com várias turmas escolhe-se em qual se entrega');
  igual(await pg.locator('#oferta-turmas select[data-oferta-turma="he"]').count(), 0, 'Num curso com uma só turma não há nada a escolher');
  contem(await pg.innerText('[data-oferta-turma-linha="kt"]'), 'Acesso sem prazo', 'A turma padrão do curso não tem prazo');
  await pg.selectOption('select[data-oferta-turma="kt"]', 't-kt-90');
  contem(await pg.innerText('[data-oferta-turma-linha="kt"]'), 'Acesso 90 dias', 'Escolhida a turma de 90 dias, o prazo é o dela');
  contem(await pg.innerText('#oferta-turmas'), 'Comprar outra vez soma os dias', 'e diz-se que uma compra nova soma os dias');
  await pg.fill('#valor-preco', '3000');
  await pg.fill('#valor-link', 'https://exemplo.invalid/tracktion');
  await pg.fill('#valor-produtos', 'prod_TURMA_90');
  await guardar();
  falso(await pg.isVisible('#drawer-overlay'), 'A oferta guarda-se');
  const o1 = await ofertaDe('Tracktion em 90 dias');
  igual(JSON.stringify(o1.turmas), '{"kt":"t-kt-90"}', 'Guarda a turma escolhida; a padrão não precisa de se guardar');
  igual(`${o1.nivelId}/${o1.diasDeAcesso}`, 'null/null', 'sem assinatura e sem duração própria');
  contem(await pg.innerText(`tr[data-oferta-linha="${o1.id}"]`), 'Acesso o prazo de cada turma', 'Com turmas de prazos diferentes, a linha diz que o prazo é o de cada turma');

  /* Editar: tirar um curso deixa a linha a dizer a turma e o prazo. */
  await pg.click(`tr[data-oferta-linha="${o1.id}"] [data-editar]`);
  await pg.waitForTimeout(300);
  igual(await pg.inputValue('select[data-oferta-turma="kt"]'), 't-kt-90', 'Ao editar, a turma escolhida vem escolhida');
  await pg.click('#valor-cursos label:has(input[value="he"])');
  igual(await pg.locator('#oferta-turmas [data-oferta-turma-linha]').count(), 1, 'Tirar um curso tira a linha dele');
  await guardar();
  const linha1 = await pg.innerText(`tr[data-oferta-linha="${o1.id}"]`);
  contem(linha1, 'Turma 90 dias', 'A linha diz em que turma entrega');
  contem(linha1, 'Acesso 90 dias', 'e o prazo dela');

  /* O painel do curso diz o mesmo. */
  await pg.evaluate(() => abrirAcessoDoCurso('kt'));
  await pg.waitForTimeout(500);
  const painelKt = await pg.innerText('#acesso-overlay .drawer');
  contem(painelKt, 'Tracktion em 90 dias', 'O painel «Quem tem acesso» do curso mostra a oferta');
  contem(painelKt, 'Turma 90 dias · Acesso 90 dias', 'com a turma e o prazo em que ela entrega');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);

  /* Uma assinatura. */
  await pg.click('#btn-nova-oferta');
  await pg.waitForTimeout(300);
  await pg.fill('#valor-nome', 'All Access mensal');
  await pg.selectOption('#valor-entrega', 'assinatura');
  verdade(await visivel('#valor-nivelId'), 'Para entregar uma assinatura, escolhe-se qual');
  falso(await visivel('#valor-cursos'), 'e os cursos deixam de se escolher: são os da assinatura');
  falso(await visivel('#oferta-turmas'), 'tal como as turmas');
  await pg.selectOption('#valor-nivelId', 'all-access');
  await pg.fill('#valor-preco', '2500');
  await pg.selectOption('#valor-recorrencia', 'mes');
  await pg.fill('#valor-link', 'https://exemplo.invalid/all-access');
  await pg.fill('#valor-produtos', 'prod_ASSINA_1');
  await pg.click('#valor-naVitrine');
  await guardar();
  falso(await pg.isVisible('#drawer-overlay'), 'A oferta de assinatura guarda-se');
  const o2 = await ofertaDe('All Access mensal');
  igual(`${o2.nivelId}/${o2.cursos.length}/${JSON.stringify(o2.turmas)}`, 'all-access/0/{}', 'Guarda a assinatura, sem cursos nem turmas próprios');
  const linha2 = await pg.innerText(`tr[data-oferta-linha="${o2.id}"]`);
  contem(linha2, 'Assinatura Kingdom All Access', 'A linha diz que entrega a assinatura');
  contem(linha2, 'Acesso 30 dias por compra', 'e que cada compra dá os dias da extensão dela');
  contem(linha2, 'Mentalidade Inquebrável', 'e os cursos que a assinatura leva');

  /* Na Vitrine do aluno. */
  const naMontra = await pg.evaluate(id => DB.vitrine.find(v => v.ofertaId === id), o2.id);
  igual(naMontra.assinatura, 'Kingdom All Access', 'Na Vitrine, a oferta leva o nome da assinatura');
  igual(naMontra.cursos.map(c => c.id).join(','), 'mi,he,lp', 'e os cursos que ela abre');
  await pg.evaluate(() => irPara('vitrine'));
  await pg.waitForTimeout(300);
  contem(await pg.innerText(`#vitrine-grid .course-card[data-oferta="${o2.id}"] .cover-badge`), 'Assinatura', 'O cartão diz que é uma assinatura');

  /* O painel de um curso da assinatura, e a ficha do Payflow. */
  await pg.evaluate(() => abrirAcessoDoCurso('mi'));
  await pg.waitForTimeout(500);
  contem(await pg.innerText('#acesso-overlay .drawer'), 'Assinatura Kingdom All Access', 'O painel de um curso da assinatura mostra a oferta que a vende');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);

  await pg.evaluate(() => irPara('admin-integracoes'));
  await pg.waitForTimeout(300);
  await pg.click('[data-int-aba="disponiveis"]');
  await pg.click('.int-cartao[data-int-abrir="payflow"]');
  await pg.waitForTimeout(200);
  const ficha = await pg.innerText('[data-int-ficha="payflow"]');
  contem(ficha, 'subscription.updated', 'A ficha do Payflow diz que eventos marcar para as assinaturas que se repetem');
  contem(await pg.innerText('[data-produto="prod_ASSINA_1"]'), 'Assinatura Kingdom All Access', 'e mostra o produto que entrega a assinatura');
  contem(ficha, 'Comprar outra vez soma os dias', 'e que uma compra nova soma os dias');

  /* Uma assinatura que uma oferta vende não se exclui. */
  await pg.evaluate(() => irPara('admin-assinatura', 'all-access'));
  await pg.waitForTimeout(300);
  await pg.click('#nivel-apagar');
  await pg.waitForTimeout(300);
  contem(await toast(), 'A oferta «All Access mensal» vende esta assinatura', 'Excluir uma assinatura que uma oferta vende é recusado, com o nome da oferta');
  verdade(await pg.evaluate(() => DB.niveis.some(n => n.id === 'all-access')), 'e a assinatura fica');

  /* Passar a oferta de assinatura para cursos limpa a assinatura. */
  await pg.evaluate(() => irPara('admin-ofertas'));
  await pg.waitForTimeout(300);
  await pg.click(`tr[data-oferta-linha="${o2.id}"] [data-editar]`);
  await pg.waitForTimeout(300);
  igual(await pg.inputValue('#valor-entrega'), 'assinatura', 'Ao editar, a oferta de assinatura abre como tal');
  await pg.selectOption('#valor-entrega', 'cursos');
  await pg.click('#valor-cursos label:has(input[value="mi"])');
  await guardar();
  const o3 = await ofertaDe('All Access mensal');
  igual(`${o3.nivelId}/${o3.cursos.join(',')}`, 'null/mi', 'Passada para cursos, deixa de entregar a assinatura');
  naoContem(await pg.innerText(`tr[data-oferta-linha="${o3.id}"]`), 'Assinatura', 'e a linha já não fala nela');

  /* No telemóvel, as turmas cabem na gaveta. */
  await pg.setViewportSize({ width:390, height:844 });
  await pg.click(`tr[data-oferta-linha="${o1.id}"] [data-editar]`);
  await pg.waitForTimeout(700);
  const cabe = await pg.evaluate(() => {
    const g = document.querySelector('#drawer-overlay .drawer').getBoundingClientRect();
    return [...document.querySelectorAll('#oferta-turmas .oferta-turma, #oferta-turmas select')]
      .every(e => { const r = e.getBoundingClientRect(); return r.left >= g.left - 1 && r.right <= g.right + 1; });
  });
  verdade(cabe, 'No telemóvel, as linhas das turmas cabem no formulário');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(250);
  const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal da página no telemóvel (${largura}px)`);

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
