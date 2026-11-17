import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Regras de liberação: a turma diz quando cada módulo e cada aula abrem; o aluno vê o cadeado e a razão, e o que está oculto não aparece';

/* Passo 2 da especificação «Convites, Assinaturas e Turmas» (Shelton,
   17/11/2026). Em demonstração, em memória (curso e pessoas inventados de
   js/dados.js), com a mesma conta que a base faz. A sério quem aplica as
   regras é a base (migrações 20261117103352 e 20261117105620, provadas em
   transacções desfeitas): uma aula oculta ou bloqueada não chega ao aluno,
   nem se marca como concluída. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ADMIN);
  const toast = async () => (await pg.locator('.toast').allInnerTexts()).join(' | ');
  const linha = (tipo, id) => `.regra-linha[data-regra-tipo="${tipo}"][data-regra-alvo="${id}"]`;
  const regra = async (tipo, id, valor) => { await pg.selectOption(`${linha(tipo, id)} [data-campo="regra"]`, valor); await pg.waitForTimeout(120); };
  const adicionar = async id => { await pg.selectOption('#regra-aula-nova', id); await pg.click('#regra-aula-adicionar'); await pg.waitForTimeout(120); };
  const daqui = dias => pg.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }, dias);

  /* As turmas contam os membros: é aí que a matrícula de cada um fica na sua turma. */
  await pg.evaluate(() => irPara('admin-turmas'));
  await pg.waitForTimeout(300);
  await pg.click('[data-turma="t-kt"]');
  await pg.waitForTimeout(300);

  /* O ecrã: uma linha por módulo, todos em acesso livre; nenhuma aula com regra. */
  igual(await pg.locator('#regras-modulos .regra-linha').count(), 3, 'A edição da turma tem uma linha por módulo do curso');
  igual(await pg.inputValue(`${linha('modulo', 'kt-m1')} [data-campo="regra"]`), 'livre', 'Sem regra, o módulo está em acesso livre');
  igual(await pg.locator('#regras-aulas .regra-linha').count(), 0, 'e nenhuma aula tem regra própria');
  igual((await pg.locator(`${linha('modulo', 'kt-m1')} [data-campo="regra"] option`).allInnerTexts()).join(', '),
    'Acesso livre, Data programada, Dias após a matrícula, Oculto, Bloqueado, Curso concluído, Módulo concluído, Aula concluída', 'As regras que há');

  /* Módulo 2 com data; módulo 3 oculto. */
  await regra('modulo', 'kt-m2', 'data');
  verdade(await pg.isVisible(`${linha('modulo', 'kt-m2')} [data-campo="abreEm"]`), 'A data programada pede a data em que abre');
  verdade(await pg.isVisible(`${linha('modulo', 'kt-m2')} [data-campo="fechaEm"]`), 'e deixa pôr a de fecho');
  await regra('modulo', 'kt-m3', 'oculto');
  igual(await pg.locator(`${linha('modulo', 'kt-m3')} .regra-campo`).count(), 1, 'Oculto não pede mais nada');

  /* Aulas com regra própria. */
  await adicionar('kt-m1a2');
  igual(await pg.inputValue(`${linha('aula', 'kt-m1a2')} [data-campo="regra"]`), 'livre', 'Uma aula adicionada começa em acesso livre');
  contem(await pg.innerText(linha('aula', 'kt-m1a2')), 'Módulo 1', 'e a linha diz de que módulo é');
  igual(await pg.locator('#regra-aula-nova option[value="kt-m1a2"]').count(), 0, 'Uma aula que já tem regra sai da lista de adicionar');
  await regra('aula', 'kt-m1a2', 'bloqueado');
  await adicionar('kt-m1a4');
  await regra('aula', 'kt-m1a4', 'aula');
  igual(await pg.locator(`${linha('aula', 'kt-m1a4')} [data-campo="aulaConcluida"] option[value="kt-m1a4"]`).count(), 0, 'Uma aula não pode depender de si própria');
  await adicionar('kt-m2a1');
  await adicionar('kt-m2a4');
  await regra('aula', 'kt-m2a4', 'oculto');
  await adicionar('kt-m1a3');
  await pg.click('[data-tirar-regra="kt-m1a3"]');
  await pg.waitForTimeout(120);
  igual(await pg.locator(linha('aula', 'kt-m1a3')).count(), 0, 'O ✕ tira a regra de uma aula');

  /* Guardar confere as regras por acabar. */
  await pg.click('#turma-guardar');
  await pg.waitForTimeout(200);
  contem(await toast(), 'falta a data em que abre', 'Uma data programada sem data não se guarda');
  igual(await pg.evaluate(() => estado.viewAtual), 'admin-turma', 'e fica-se na edição');
  await pg.fill(`${linha('modulo', 'kt-m2')} [data-campo="abreEm"]`, await daqui(10));
  await pg.fill(`${linha('modulo', 'kt-m2')} [data-campo="fechaEm"]`, await daqui(5));
  await pg.click('#turma-guardar');
  await pg.waitForTimeout(200);
  contem(await toast(), 'a data de fecho é anterior', 'O fecho não pode ser antes da abertura');
  await pg.fill(`${linha('modulo', 'kt-m2')} [data-campo="fechaEm"]`, '');
  await pg.click('#turma-guardar');
  await pg.waitForTimeout(200);
  contem(await toast(), 'escolha a aula que tem de estar concluída', 'Uma regra de aula concluída pede a aula');
  await pg.selectOption(`${linha('aula', 'kt-m1a4')} [data-campo="aulaConcluida"]`, 'kt-m1a3');
  await pg.click('#turma-guardar');
  await pg.waitForTimeout(400);
  igual(await pg.evaluate(() => estado.viewAtual), 'admin-turmas', 'Com tudo certo, guarda e volta à lista');
  igual(await pg.evaluate(() => (DB.regras['t-kt'] || []).map(r => `${r.alvoTipo}:${r.alvoId}:${r.regra}`).sort().join(' ')),
    'aula:kt-m1a2:bloqueado aula:kt-m1a4:aula aula:kt-m2a1:livre aula:kt-m2a4:oculto modulo:kt-m2:data modulo:kt-m3:oculto',
    'As regras ficam guardadas na turma (um módulo em acesso livre não é regra; uma aula livre é)');

  /* Reabrir: as regras estão lá. */
  await pg.click('[data-turma="t-kt"]');
  await pg.waitForTimeout(300);
  igual(await pg.inputValue(`${linha('modulo', 'kt-m2')} [data-campo="regra"]`), 'data', 'Ao reabrir a turma, a regra do módulo está lá');
  igual(await pg.inputValue(`${linha('aula', 'kt-m1a4')} [data-campo="aulaConcluida"]`), 'kt-m1a3', 'e a da aula também, com a condição');
  igual(await pg.locator('#regras-aulas .regra-linha').count(), 4, 'Quatro aulas com regra própria');

  /* No telemóvel, o ecrã das regras cabe. */
  await pg.setViewportSize({ width:390, height:844 });
  await pg.waitForTimeout(200);
  const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `As regras cabem no telemóvel (${largura}px)`);
  await pg.setViewportSize({ width:1280, height:900 });

  /* A equipa continua a ver tudo. */
  igual(await pg.evaluate(() => cursoPorId('kt').modulos.flatMap(m => m.aulas).length), 12, 'A equipa vê as 12 aulas, com regras ou sem elas');
  await pg.evaluate(() => irPara('curso', 'kt'));
  await pg.waitForTimeout(300);
  igual(await pg.locator('#lista-modulos .aula-row.bloqueada').count(), 0, 'e nenhuma com cadeado');

  /* A aluna, que está na Turma A deste curso. */
  await pg.evaluate(() => sairDaConta());
  await pg.waitForTimeout(600);
  await pg.fill('#input-email', ALUNA);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { const m = document.getElementById('onboarding'); if(m) m.remove(); });
  igual(await pg.evaluate(() => membroAtual().id + '/' + papelEfetivo()), 'm1/aluno', 'Entra a aluna');
  await pg.evaluate(() => irPara('curso', 'kt'));
  await pg.waitForTimeout(400);

  const aula = id => `#lista-modulos .aula-row[data-aula="${id}"]`;
  igual(await pg.locator('#lista-modulos .modulo').count(), 2, 'O módulo oculto não aparece à aluna');
  igual(await pg.locator(aula('kt-m2a4')).count(), 0, 'nem a aula oculta');
  igual(await pg.locator('#lista-modulos .aula-row').count(), 7, 'Vê as outras sete aulas');
  igual(await pg.locator('#lista-modulos .aula-row.bloqueada').count(), 4, 'quatro delas com cadeado');
  contem(await pg.innerText(aula('kt-m1a2')), 'Ainda não disponível', 'Uma aula bloqueada di-lo');
  contem(await pg.innerText(aula('kt-m1a4')), 'Abre quando concluir a aula «Construir antes de escalar»', 'A que depende de outra diz de qual');
  contem(await pg.innerText(aula('kt-m2a2')), 'Abre a ', 'A que tem data diz quando abre');
  falso(await pg.evaluate(() => document.querySelector('#lista-modulos .aula-row[data-aula="kt-m2a1"]').classList.contains('bloqueada')),
    'A aula com acesso livre próprio abre, mesmo num módulo que ainda não abriu');
  falso(await pg.evaluate(() => cursoPorId('kt').modulos.flatMap(m => m.aulas).filter(a => a.bloqueio).some(a => a.descricao || a.embed || a.conteudo)),
    'De uma aula bloqueada só chega o título: nem a descrição nem o vídeo');

  /* Não se abre: nem pela lista, nem pelo endereço. */
  await pg.click(aula('kt-m1a2'));
  await pg.waitForTimeout(200);
  contem(await toast(), 'Esta aula está bloqueada', 'Carregar numa aula bloqueada diz que está bloqueada');
  igual(await pg.evaluate(() => estado.viewAtual), 'curso', 'e não sai do curso');
  await pg.evaluate(() => irPara('aula', 'kt', 'kt-m1a4'));
  await pg.waitForTimeout(300);
  const fechada = await pg.innerText('#content-aula');
  contem(fechada, 'O preço da liderança', 'Ir direto a uma aula bloqueada mostra o título');
  contem(fechada, 'Abre quando concluir a aula', 'e a razão');
  igual(await pg.locator('#content-aula #btn-concluir').count(), 0, 'sem botão de concluir');
  igual(await pg.locator('#content-aula .player-wrap').count(), 0, 'nem leitor');

  /* Concluir a aula de que outra depende abre-a. */
  await pg.evaluate(() => irPara('aula', 'kt', 'kt-m1a3'));
  await pg.waitForTimeout(300);
  contem(await pg.innerText('#sidebar-lessons-lista .mini-aula[data-aula="kt-m1a4"]'), 'O preço da liderança', 'Ao lado da aula, a lista do módulo mostra a aula seguinte');
  igual(await pg.getAttribute('#sidebar-lessons-lista .mini-aula[data-aula="kt-m1a4"]', 'data-status'), 'bloqueada', 'com cadeado');
  await pg.click('#pager-proxima');
  await pg.waitForTimeout(200);
  igual(await pg.evaluate(() => estado.ultimaAulaPorCurso.kt), 'kt-m1a3', '«Próxima aula» não entra numa aula bloqueada');
  await pg.click('#btn-concluir');
  await pg.waitForTimeout(300);
  diferenteDe(await pg.getAttribute('#sidebar-lessons-lista .mini-aula[data-aula="kt-m1a4"]', 'data-status'), 'bloqueada');
  await pg.click('#pager-proxima');
  await pg.waitForTimeout(300);
  igual(await pg.evaluate(() => estado.ultimaAulaPorCurso.kt), 'kt-m1a4', 'Concluída a aula de que dependia, a seguinte abre');
  verdade(await pg.isVisible('#content-aula #btn-concluir'), 'e pode concluir-se');

  /* Outra turma do mesmo curso, sem regras: tudo aberto. */
  const noutraTurma = await pg.evaluate(() => {
    const a = membroAtual().acessos.find(x => x.curso === 'kt');
    const antes = a.turma;
    a.turma = 't-kt-90';
    const r = cursoPorId('kt').modulos.flatMap(m => m.aulas);
    a.turma = antes;
    return r.length + '/' + r.filter(x => x.bloqueio).length;
  });
  igual(noutraTurma, '12/0', 'Quem está noutra turma do curso, sem regras, vê as 12 aulas abertas');

  /* Dias após a matrícula: contam do início da matrícula de cada um. */
  const porDias = await pg.evaluate(() => {
    const guardadas = DB.regras['t-kt'];
    const desde = membroAtual().acessos.find(x => x.curso === 'kt').desde;
    const hoje = new Date().toISOString().slice(0, 10);
    const passados = Math.round((Date.parse(hoje) - Date.parse(desde)) / 864e5);
    const ver = dias => {
      DB.regras['t-kt'] = [{ alvoTipo:'modulo', alvoId:'kt-m3', regra:'dias', dias }];
      const a = cursoPorId('kt').modulos.find(m => m.id === 'kt-m3').aulas[0];
      return a.bloqueio ? 'fechada até ' + a.bloqueio.abreEm : 'aberta';
    };
    const r = [ver(passados), ver(passados + 3)];
    DB.regras['t-kt'] = guardadas;
    return r.join(' | ') + ' | ' + isoMaisDias(hoje, 3);
  });
  const [jaPassou, aindaNao, daquiATres] = porDias.split(' | ');
  igual(jaPassou, 'aberta', 'Passados os dias desde o início da matrícula, o módulo abre');
  igual(aindaNao, 'fechada até ' + daquiATres, 'Antes disso está fechado, e sabe-se o dia em que abre');

  naoContem(await pg.innerText('#content-aula'), 'undefined', 'Sem textos partidos');
  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();

  function diferenteDe(obtido, indesejado){ verdade(obtido !== indesejado, `Concluir a aula tira o cadeado à que dependia dela (ficou «${obtido}»)`); }
}
