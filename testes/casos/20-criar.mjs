import { abrirPagina } from '../util.mjs';

export const nome = 'Criar área de membros (/criar): plano do endereço, conta, cartão e pronta';

/* W4 (decisões do Shelton a 02/10/2026): no molde do Memberkit, o plano vem
   no endereço e mostra-se em cima; a conta pede nome da área, nome, email e a
   senha duas vezes; o cartão vem a seguir (7 dias grátis). Corre em
   demonstração (?demo=1): preços de mentira, nenhuma conta criada, nenhuma
   Paystack. A sério, a página chama criar-escola e plataforma-cartao, que se
   provaram à parte (caso 40 do painel e SQL desfeito). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const NBSP = / /g;
  const txt = async (pg, s) => (await pg.textContent(s)).replace(NBSP, ' ');

  /* 1. O plano do endereço, com os dois ciclos. */
  let pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&ciclo=anual`);
  verdade(await pg.isVisible('#ecra-criar'), 'Com planos à venda, a página mostra o formulário');
  igual(await pg.textContent('#plano-nome'), 'Plano Essencial', 'O plano vem do endereço');
  igual(await txt(pg, '#plano-alunos'), 'Até 500 alunos', 'com o limite de alunos');
  igual(await txt(pg, '#plano-valor'), 'R 1 990,00', 'o preço anual, no formato da casa (símbolo, agrupado, vírgula)');
  contem(await pg.textContent('#plano-por'), 'por ano · poupa 17%', 'e quanto se poupa face a doze meses');
  await pg.click('#ciclo [data-ciclo="mensal"]');
  igual(await txt(pg, '#plano-valor'), 'R 199,00', 'Mensal muda o preço');
  verdade(new URL(pg.url()).search.includes('ciclo=mensal'), 'e o endereço acompanha a escolha');
  contem(await txt(pg, '#plano-gratis'), '7 dias grátis. A primeira cobrança, de R 199,00', 'Diz quando e quanto se cobra');
  await pg.selectOption('#plano-escolher', 'escala');
  verdade(await pg.isHidden('#ciclo'), 'Um plano só com preço mensal não mostra a troca de ciclo');
  igual(await txt(pg, '#plano-alunos'), 'Até 5 000 alunos', 'Os milhares agrupam-se também abaixo de dez mil');
  const corpo = await pg.textContent('body');
  naoContem(corpo, 'Kingdom', 'A página da plataforma não tem a marca da Kingdom');
  await pg.close();

  /* 2. A conta: validação, depois o cartão, depois pronta. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=profissional`);
  await pg.fill('#f-escola', 'Escola de Exemplo');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'ana@exemplo.invalid');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'outra-coisa');
  await pg.click('#btn-conta');
  contem(await pg.textContent('#conta-erro'), 'não são iguais', 'Senhas diferentes não passam');
  igual(await pg.getAttribute('#f-senha2', 'aria-invalid'), 'true', 'e o campo fica marcado');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-cartao:not([hidden])');
  const chamadas = await pg.evaluate(() => window.__criarDemo.chamadas);
  const criar = chamadas.find(c => c[0] === 'criar-escola')[1];
  igual(JSON.stringify([criar.plano, criar.ciclo, criar.aceitouTermos]), '["profissional","mensal",true]',
    'Vai para o servidor o plano, o ciclo e os termos aceites');
  verdade(chamadas.some(c => c[0] === 'entrar'), 'e entra com a conta nova');
  igual(await pg.getAttribute('#passo-2', 'aria-current'), 'step', 'O passo do cartão fica marcado');
  contem(await pg.textContent('#cartao-sub'), 'A «Escola de Exemplo» está criada', 'Diz que a área está criada');
  const resumo = (await pg.innerText('#cartao-resumo')).replace(NBSP, ' ').replace(/\s+/g, ' ');
  contem(resumo, 'Hoje R 0,00', 'Hoje não se paga nada');
  contem(resumo, 'R 399,00 por mês', 'e diz o que se cobra depois');
  contem(await pg.textContent('#cartao-seguro'), 'rand sul-africano (ZAR)', 'Avisa que a cobrança é em rand');
  await pg.click('#btn-cartao');
  await pg.waitForSelector('#painel-pronta:not([hidden])');
  igual(await pg.textContent('#pronta-titulo'), 'A «Escola de Exemplo» está pronta', 'Com o cartão, está pronta');
  igual(await pg.getAttribute('#btn-entrar', 'href'), '/?org=escola-de-exemplo', 'e o botão abre a área nova pelo nome curto');
  igual(JSON.stringify((await pg.evaluate(() => window.__criarDemo.chamadas)).map(c => c[0]).slice(-3)),
    '["cartao-iniciar","formulario","cartao-confirmar"]', 'O cartão abre, passa pelo formulário e confirma-se no servidor');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();

  /* 3. O email já tem conta: pede a senha dessa conta. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&existe=1`);
  await pg.fill('#f-escola', 'Outra Escola');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'ana@exemplo.invalid');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#campos-existente:not([hidden])');
  verdade(await pg.isHidden('#campos-senha'), 'Com conta, deixa de pedir a senha nova');
  igual(await pg.textContent('#btn-conta'), 'Entrar e continuar', 'e o botão passa a entrar');
  await pg.fill('#f-senha-existente', 'errada-123');
  await pg.click('#btn-conta');
  await pg.waitForTimeout(250);
  contem(await pg.textContent('#conta-erro'), 'A senha não confere', 'Uma senha errada diz-se');
  await pg.fill('#f-senha-existente', 'a-certa-123');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-cartao:not([hidden])');
  verdade(true, 'Com a senha certa, cria a área com a conta que já existia');
  await pg.close();

  /* 4. Desistir do cartão: a área fica guardada e volta-se ao cartão. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&desiste=1`);
  await pg.fill('#f-escola', 'Escola Três');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'ana@exemplo.invalid');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-cartao:not([hidden])');
  await pg.click('#btn-cartao');
  await pg.waitForTimeout(300);
  contem(await pg.textContent('#cartao-erro'), 'O cartão ficou por pôr', 'Desistir do cartão diz que a área ficou guardada');
  falso(await pg.isDisabled('#btn-cartao'), 'e o botão volta para tentar outra vez');
  await pg.close();

  /* 5. Fechado: sem preços, não se vende. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&fechado=1`);
  verdade(await pg.isVisible('#ecra-fechado'), 'Sem preços, a página diz que ainda não está à venda');
  verdade(await pg.isHidden('#ecra-criar'), 'e não mostra o formulário');
  await pg.close();

  /* 6. No telemóvel: nada sai da largura. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1`, { viewport: { width: 360, height: 760 } });
  const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 360, `No telemóvel não há deslocamento para o lado (${largura}px)`);
  await pg.close();

  /* 7. Os termos e a privacidade existem, e dizem que são rascunho. */
  for (const [caminho, titulo] of [['termos', 'Termos de uso'], ['privacidade', 'Política de privacidade']]) {
    pg = await abrirPagina(navegador, `${base}/${caminho}/index.html`);
    igual(await pg.textContent('h1'), titulo, `/${caminho}/ abre com o título certo`);
    contem(await pg.textContent('.rascunho'), 'revisão jurídica', `e avisa que é rascunho para o jurista`);
    naoContem(await pg.textContent('main'), 'Kingdom', 'sem a marca de nenhuma escola');
    await pg.close();
  }
}
