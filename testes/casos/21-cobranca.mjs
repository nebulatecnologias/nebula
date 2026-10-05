import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Cobrança da escola: assinatura, plano, cartão, faturação, faturas e o aviso da conta';

/* W4·4 (02/10/2026), no molde da referência do Memberkit. Em demonstração a
   conta vive no browser e ?cobranca= escolhe o estado. A sério, os mesmos
   botões vão às funções academia.cobranca_da_escola, guardar_faturacao,
   mudar_plano, cancelar_assinatura e às Edge Functions plataforma-cartao e
   plataforma-cobrar (provadas no caso 40 do painel e em SQL desfeito). */
function estadoDaConta(pg, estado){
  return pg.evaluate(e => {
    history.replaceState(null, '', '?demo=1&cobranca=' + e);
    DB.cobrancaDemo = null;
    irPara('admin-cobranca');
  }, estado);
}
const texto = (pg, sel) => pg.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/ /g, ' '), sel);

export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  let pg = await entrarDemo(navegador, base, ADMIN);
  verdade(await pg.evaluate(() => !!document.querySelector('.nav-item[data-view="admin-cobranca"], [data-view="admin-cobranca"]')),
    'A Cobrança aparece no menu, no grupo Conta');

  /* 1. Ativa: os cinco blocos. */
  await estadoDaConta(pg, 'ativa');
  await pg.waitForTimeout(300);
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Ativa', 'A assinatura diz o estado');
  contem(await texto(pg, '#cobranca-assinatura'), 'Próxima cobrança: R 399,00 a', 'e a próxima cobrança, com o valor no formato da casa');
  contem(await texto(pg, '#cobranca-plano-bloco'), '30% utilizado — 450 de 1 500 alunos ativos', 'O plano mostra o uso, como na referência');
  contem(await texto(pg, '#cobranca-cartao'), 'Visa •••• 8204', 'O cartão mostra a marca e os últimos 4');
  contem(await texto(pg, '#cobranca-cartao'), 'Validade 03/2029', 'e a validade');
  igual(await pg.inputValue('#fat-nuit'), '400000000', 'Os dados de faturação pedem o NUIT');
  igual(await pg.locator('.tabela-faturas tbody tr').count(), 3, 'As faturas emitidas aparecem numa tabela');
  contem(await texto(pg, '.tabela-faturas thead'), 'Valor (R)', 'com o símbolo uma vez, no cabeçalho');
  naoContem(await texto(pg, '.tabela-faturas tbody'), 'R 399', 'e não repetido linha a linha');

  /* 2. Mudar de plano: o preço novo antes de guardar; um plano abaixo dos alunos fica de fora. */
  await pg.click('[data-cobranca="mudar-plano"]');
  await pg.evaluate(() => { DB.cobrancaDemo.alunosAtivos = 600; guardarDB(); estadoCobranca.info.alunosAtivos = 600; desenharCobranca(); });
  verdade(await pg.evaluate(() => document.querySelector('#cobranca-plano option[value="essencial"]').disabled),
    'Com 600 alunos ativos, o Essencial (até 500) não se pode escolher');
  await pg.selectOption('#cobranca-plano', 'escala');
  await pg.selectOption('#cobranca-ciclo', 'anual');
  contem(await texto(pg, '#cobranca-novo-preco'), 'R 7 990,00 por ano, a partir da próxima cobrança', 'Antes de guardar, diz o preço novo e quando vale');
  await pg.click('[data-cobranca="guardar-plano"]');
  await pg.waitForTimeout(250);
  contem(await texto(pg, '#cobranca-plano-bloco'), 'Premium · anual', 'Guardado, o plano muda');
  contem(await texto(pg, '#cobranca-plano-bloco'), '12% utilizado — 600 de 5 000 alunos', 'e o uso conta com o limite novo');

  /* 3. Faturação guardada. */
  await pg.fill('#fat-nuit', '123 456 789');
  await pg.click('[data-cobranca="guardar-faturacao"]');
  await pg.waitForTimeout(250);
  contem(await pg.evaluate(() => document.body.innerText), 'Dados de faturação guardados', 'Os dados de faturação guardam-se');

  /* 4. Cancelar no fim do período, e retomar. */
  await pg.click('[data-cobranca="cancelar"]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.modal-overlay .confirm-card'), 'já está pago', 'Cancelar explica que o período pago continua');
  await pg.click('.modal-overlay [data-confirmar]');
  await pg.waitForTimeout(250);
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Cancelada no fim do período', 'Cancelada, fica até ao fim do período');
  await pg.click('[data-cobranca="retomar"]');
  await pg.waitForTimeout(250);
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Ativa', 'Retomar desfaz o cancelamento');

  /* 5. Em atraso: o motivo, «Pagar agora» e o aviso à equipa nos outros ecrãs. */
  await estadoDaConta(pg, 'em_atraso');
  await pg.waitForTimeout(300);
  contem(await texto(pg, '#cobranca-assinatura'), '(o cartão não tinha saldo suficiente)', 'Em atraso, diz porque falhou');
  igual(await texto(pg, '.tabela-faturas tbody tr:first-child .pill'), 'Falhou', 'e a fatura aparece como falhada');
  await pg.evaluate(() => irPara('admin-visao'));
  await pg.waitForTimeout(200);
  contem(await texto(pg, '.aviso-conta'), 'A última cobrança falhou', 'Nos outros ecrãs, a equipa vê o aviso');
  await pg.click('.aviso-conta [data-ir-cobranca]');
  await pg.waitForTimeout(300);
  igual(await pg.locator('.aviso-conta').count(), 0, 'O aviso leva à Cobrança, onde não se repete');
  await pg.click('[data-cobranca="pagar"]');
  await pg.waitForTimeout(300);
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Ativa', '«Pagar agora» põe a conta em dia');

  /* 6. Pendente: falta o cartão. */
  await estadoDaConta(pg, 'pendente');
  await pg.waitForTimeout(300);
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Falta o pagamento', 'Sem pagamento posto, a assinatura diz que falta');
  await pg.click('#cobranca-assinatura [data-cobranca="cartao"]');
  await pg.waitForTimeout(300);
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Em teste', 'Com o cartão, começam os dias grátis');
  contem(await texto(pg, '#cobranca-cartao'), '•••• 4444', 'e o cartão novo aparece');

  /* 7. Isenta: nada para pagar. */
  await estadoDaConta(pg, 'isenta');
  await pg.waitForTimeout(300);
  contem(await texto(pg, '#cobranca-assinatura'), 'não paga mensalidade', 'Uma escola isenta não tem nada para pagar');
  igual(await pg.locator('#cobranca-cartao').count(), 0, 'nem cartão');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();

  /* 8. O aluno, com a conta da escola fora de dia. */
  pg = await entrarDemo(navegador, base, ALUNA);
  await pg.evaluate(() => { history.replaceState(null, '', '?demo=1&cobranca=cancelada'); DB.cobrancaDemo = null; irPara('dashboard'); });
  await pg.waitForTimeout(300);
  contem(await texto(pg, '.aviso-conta'), 'Os cursos estão temporariamente indisponíveis', 'O aluno vê porque não há cursos');
  naoContem(await texto(pg, '.aviso-conta'), 'cartão', 'sem detalhes da cobrança da escola');
  igual(await pg.locator('.aviso-conta button').count(), 0, 'e sem botão para a Cobrança');
  await pg.evaluate(() => { history.replaceState(null, '', '?demo=1&cobranca=em_atraso'); DB.cobrancaDemo = null; irPara('dashboard'); });
  await pg.waitForTimeout(200);
  igual(await pg.locator('.aviso-conta').count(), 0, 'Com a conta em atraso mas ainda dentro da tolerância, o aluno não vê aviso');
  await pg.close();

  /* 9. No telemóvel, as faturas viram cartões e nada sai da largura. */
  pg = await entrarDemo(navegador, base, ADMIN, { viewport: { width: 375, height: 800 } });
  await estadoDaConta(pg, 'ativa');
  await pg.waitForTimeout(300);
  const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 375, `No telemóvel não há deslocamento para o lado (${largura}px)`);
  await pg.close();

  /* 10. Fora da demonstração, os botões abrem o Payflow: o link da fatura em
     aberto, o do cartão (ou o de pagamento), e sem link diz-se que ainda vem. */
  pg = await entrarDemo(navegador, base, ADMIN);
  await estadoDaConta(pg, 'em_atraso');
  await pg.waitForTimeout(250);
  const links = await pg.evaluate(() => {
    estadoCobranca.info.assinatura.links = { pagamento:'https://payflow.exemplo/pagar', gerir:'https://payflow.exemplo/gerir' };
    estadoCobranca.info.faturas[0].link = 'https://payflow.exemplo/f3';
    const r = { fatura: linkDoPayflow('fatura'), cartao: linkDoPayflow('cartao'), gerir: linkDoPayflow('gerir') };
    estadoCobranca.info.assinatura.links = {};
    estadoCobranca.info.faturas.forEach(f => { f.link = null; });
    r.semNada = linkDoPayflow('fatura');
    return r;
  });
  igual(links.fatura, 'https://payflow.exemplo/f3', '«Pagar agora» abre a fatura em aberto no Payflow');
  igual(links.cartao, 'https://payflow.exemplo/pagar', 'Trocar o cartão, sem link próprio, abre o de pagamento');
  igual(links.gerir, 'https://payflow.exemplo/gerir', 'Mudar de plano e cancelar abrem a gestão no Payflow');
  igual(links.semNada, null, 'Sem links ainda, não há para onde ir (e a página diz que o link vem)');
  await pg.close();

  /* 11. A assinatura criada pela API do Payflow (A6), fora da demonstração:
     não tem link de gestão; cancela-se aqui mesmo (a criar-escola chama
     POST /v1/subscriptions/{id}/cancel), e o plano e o retomar são connosco.
     A base e a função ficam simuladas no browser. */
  pg = await entrarDemo(navegador, base, ADMIN);
  await estadoDaConta(pg, 'ativa');
  await pg.waitForTimeout(250);
  await pg.evaluate(() => {
    const info = JSON.parse(JSON.stringify(estadoCobranca.info));
    info.assinatura.pelaApi = true; info.assinatura.links = {};
    window.__pedidos = [];
    window.modoDemonstracao = () => false;
    API.cobrancaDaEscola = async () => JSON.parse(JSON.stringify(info));
    API.cancelarAssinatura = async () => { window.__pedidos.push('cancelar'); info.assinatura.cancelaNoFim = true; return { ok:true, cancelaNoFim:true }; };
    window.open = u => { window.__pedidos.push('abriu ' + u); };
    renderAdminCobranca();
  });
  await pg.waitForTimeout(250);
  await pg.click('[data-cobranca="mudar-plano"]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('body'), 'Fale connosco e mudamos por si', 'Mudar de plano numa assinatura da API diz que é connosco');
  await pg.click('[data-cobranca="cancelar"]');
  await pg.waitForTimeout(150);
  contem(await pg.textContent('.modal-overlay .confirm-card'), 'já está pago', 'Cancelar pede confirmação, como sempre');
  await pg.click('.modal-overlay [data-confirmar]');
  await pg.waitForTimeout(400);
  igual(await pg.evaluate(() => window.__pedidos.join(',')), 'cancelar', 'Confirmado, cancela pela criar-escola, sem abrir o Payflow');
  igual(await texto(pg, '#cobranca-assinatura .pill'), 'Cancelada no fim do período', 'e a Cobrança, relida, mostra-a cancelada no fim do período');
  igual(await pg.locator('[data-cobranca="retomar"]').count(), 0, 'Sem botão de retomar (a API ainda não retoma)');
  contem(await texto(pg, '#cobranca-assinatura'), 'Fale connosco e retomamos a assinatura', 'diz que se retoma connosco');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();
}
