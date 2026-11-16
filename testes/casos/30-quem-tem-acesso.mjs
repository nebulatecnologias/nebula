import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Quem tem acesso: no editor de cada curso, a regra, as ofertas, as pessoas (dar, prazo, tirar) e os convites; o convite leva o prazo';

/* Pedido do Shelton a 15/11/2026: «não consigo dentro do painel definir de
   forma clara quem tem acesso a um curso que acabo de criar». Em demonstração,
   em memória (pessoas inventadas de js/dados.js). A sério, a leitura é
   academia.curso_acessos (migração 20261116183409, provada numa transacção
   desfeita) e as ações são as da ficha do membro (academia.membro_*). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-curso-editor', 'kt'));
  await adm.waitForTimeout(400);

  /* O resumo, no editor do curso. */
  const resumo = () => adm.innerText('#curso-acesso-resumo');
  contem(await resumo(), '3 alunos', 'O editor do curso diz quantos alunos o têm');
  contem(await resumo(), '2 convites por aceitar', 'quantos convites à espera o incluem');
  contem(await resumo(), '1 oferta que o vende', 'e quantas ofertas o vendem');

  await adm.click('#btn-gerir-acesso');
  await adm.waitForTimeout(400);
  const painel = () => adm.innerText('#acesso-overlay .drawer');
  const confirmar = async () => { await adm.click('.modal-overlay.confirmacao [data-confirmar]'); await adm.waitForTimeout(400); };
  let t = await painel();
  contem(t, 'Kingdom Tracktion', 'O painel é do curso');
  contem(t, 'Só quem recebeu acesso', 'Diz a regra de acesso');
  contem(t, 'Marta Lopes', 'e quem tem acesso');
  contem(t, 'Plano Kingdom All Access', 'com a origem de cada acesso');
  contem(t, 'Sem prazo', 'e o prazo');
  contem(t, 'Na Vitrine', 'As ofertas que o vendem dizem se estão na Vitrine');
  contem(t, 'Joana Macie', 'Os convites por aceitar que o incluem aparecem');
  contem(t, 'A equipa (1 pessoa) vê todos os cursos', 'e lembra que a equipa vê tudo');
  igual(await adm.locator('#acesso-pessoas [data-pessoa]').count(), 3, 'Três pessoas com acesso próprio');

  /* Dar acesso a quem já é membro, por 30 dias. */
  await adm.click('.seccao-cabeca [data-abrir-dar]');
  await adm.waitForTimeout(200);
  igual(await adm.locator('#dar-acesso-lista input[value="m1"]').count(), 0, 'Quem já tem o curso não aparece para receber');
  await adm.fill('#dar-acesso-busca', 'renato');
  await adm.waitForTimeout(100);
  igual(await adm.locator('#dar-acesso-lista label:visible').count(), 1, 'A procura filtra os membros');
  await adm.click('#dar-acesso-lista label:has(input[value="m4"])');
  await adm.selectOption('#dar-acesso-prazo', '30');
  await adm.click('[data-dar-acesso]');
  await adm.waitForTimeout(400);
  const renato = () => adm.innerText('#acesso-pessoas [data-pessoa="m4"]');
  contem(await renato(), 'Dado à mão', 'Dar acesso abre o curso à pessoa');
  contem(await renato(), 'Até ', 'com o prazo escolhido');
  verdade(await adm.evaluate(() => cursosPermitidos(DB.membros.find(m => m.id === 'm4')).includes('kt')), 'e, na demonstração, o aluno passa a ver o curso');

  /* O prazo. */
  await adm.click('[data-prazo-pessoa="m4"]');
  await adm.waitForTimeout(150);
  await adm.click('[data-sem-prazo-pessoa="m4"]');
  await adm.waitForTimeout(400);
  contem(await renato(), 'Sem prazo', 'O prazo muda-se daqui');

  /* Tirar e abrir outra vez. */
  await adm.click('[data-tirar-pessoa="m4"]');
  await adm.waitForTimeout(200);
  contem(await adm.innerText('.modal-overlay.confirmacao'), 'O progresso fica guardado', 'Tirar avisa que o progresso fica');
  await confirmar();
  igual(await adm.locator('#acesso-pessoas [data-pessoa="m4"]').count(), 0, 'Tirar fecha o acesso');
  contem(await adm.innerText('#acesso-overlay .acessos-fechados summary'), 'Acessos fechados (1)', 'e fica nos fechados');
  await adm.click('#acesso-overlay .acessos-fechados summary');
  await adm.click('[data-reabrir-pessoa="m4"]');
  await adm.waitForTimeout(400);
  igual(await adm.locator('#acesso-pessoas [data-pessoa="m4"]').count(), 1, '«Abrir outra vez» devolve-o');

  /* A regra: abrir a todos pede confirmação. */
  await adm.click('#acesso-overlay .papel-opcao:has(input[value="todos"])');
  await adm.waitForTimeout(200);
  contem(await adm.innerText('.modal-overlay.confirmacao'), 'alunos ativos da escola passam', 'Abrir a todos diz a quantos abre');
  falso(await adm.evaluate(() => cursoPorId('kt').abertoATodos === true), 'e não muda nada antes de confirmar');
  await confirmar();
  verdade(await adm.evaluate(() => cursoPorId('kt').abertoATodos === true), 'Confirmado, o curso fica aberto a todos os membros');
  contem(await painel(), 'Aberto a todos', 'e o painel diz que está aberto a todos');
  await adm.click('#acesso-overlay .papel-opcao:has(input[value="fechado"])');
  await adm.waitForTimeout(400);
  falso(await adm.evaluate(() => cursoPorId('kt').abertoATodos === true), 'Voltar a fechar não pede confirmação');

  /* Ver a ficha de uma pessoa. */
  await adm.click('#acesso-pessoas [data-ver-membro="m1"]');
  await adm.waitForTimeout(400);
  contem(await adm.innerText('#membro-overlay .drawer'), 'Marta Lopes', 'O nome leva à ficha do membro');
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);
  contem(await resumo(), '4 alunos', 'O resumo do editor acompanha o que se fez');

  /* Convidar alguém de fora, já com este curso e com prazo de acesso. */
  await adm.click('#btn-gerir-acesso');
  await adm.waitForTimeout(400);
  await adm.click('.seccao-cabeca [data-convidar]');
  await adm.waitForTimeout(300);
  verdade(await adm.isChecked('#valor-cursos input[value="kt"]'), 'O convite abre já com este curso escolhido');
  contem(await adm.innerText('#drawer-overlay .drawer'), 'abre só os cursos escolhidos aqui', 'e diz que só abre os cursos escolhidos');
  await adm.fill('#valor-email', 'nova.aluna@exemplo.co.mz');
  await adm.selectOption('#valor-acessoDias', '30');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(500);
  const convite = await adm.evaluate(() => DB.convites[0]);
  igual(`${convite.email}/${convite.cursos.join(',')}/${convite.acessoDias}`, 'nova.aluna@exemplo.co.mz/kt/30', 'O convite leva o curso e o prazo do acesso');
  contem(await resumo(), '3 convites por aceitar', 'e o resumo do curso conta-o');
  await adm.evaluate(() => irPara('admin-convites'));
  await adm.waitForTimeout(250);
  contem(await adm.innerText(`tr[data-convite="${convite.id}"]`), 'Acesso 30 dias', 'Na lista, o convite diz por quanto tempo abre os cursos');

  /* Um curso acabado de criar: ninguém, e diz-se. */
  await adm.evaluate(() => irPara('admin-conteudos'));
  await adm.waitForTimeout(200);
  await adm.evaluate(() => abrirFormCurso(null));
  await adm.waitForTimeout(300);
  await adm.fill('#f-titulo', 'Curso de Ensaio');
  await adm.evaluate(() => guardarFormCurso());
  await adm.waitForTimeout(500);
  const novo = await resumo();
  contem(novo, 'Nenhum aluno ainda', 'Num curso novo, o editor diz que ainda ninguém o abre');
  contem(novo, 'Nenhuma oferta o vende', 'e que nenhuma oferta o vende');
  await adm.click('#btn-gerir-acesso');
  await adm.waitForTimeout(400);
  contem(await painel(), 'Ainda ninguém recebeu acesso a este curso', 'O painel do curso novo abre vazio');
  naoContem(await painel(), 'undefined', 'sem textos partidos');

  /* No telemóvel, o painel cabe no ecrã. */
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);
  await adm.setViewportSize({ width:390, height:844 });
  await adm.evaluate(() => irPara('admin-curso-editor', 'kt'));
  await adm.waitForTimeout(400);
  await adm.click('#btn-gerir-acesso');
  await adm.waitForFunction(() => {
    const o = document.getElementById('acesso-overlay');
    const g = o && o.querySelector('.drawer');
    if(!g || !o.classList.contains('aberto')) return false;
    const x = g.getBoundingClientRect().right;
    const parada = window.__direitaAntes === x;
    window.__direitaAntes = x;
    return parada;
  }, null, { polling: 120 });
  const direita = Math.round(await adm.evaluate(() => document.querySelector('#acesso-overlay .drawer').getBoundingClientRect().right));
  verdade(direita <= 390, `O painel cabe no telemóvel (${direita}px)`);
  const largura = await adm.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal da página no telemóvel (${largura}px)`);

  igual(adm.errosDeJs.length, 0, `Sem erros: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
