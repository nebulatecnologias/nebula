import { abrirPagina } from '../util.mjs';

export const nome = 'Criar área de membros (/criar): plano do endereço, conta, validação do M-Pesa ou do cartão, e a área abre no onboarding';

/* W4 (decisões do Shelton a 02/10/2026): no molde do Memberkit, o plano vem
   no endereço e mostra-se em cima; a conta pede nome da área, nome, email e a
   senha duas vezes; o cartão vem a seguir (7 dias grátis). Corre em
   demonstração (?demo=1): preços de mentira, nenhuma conta criada, nenhuma
   Paystack. A sério, a página chama criar-escola e plataforma-cartao, que se
   provaram à parte (caso 40 do painel e SQL desfeito). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const NBSP = / /g;
  const txt = async (pg, s) => (await pg.textContent(s)).replace(NBSP, ' ');

  /* 1. O plano vem já escolhido do site: cria-se esse plano, não se escolhe
     outra vez (pedido do Shelton a 04/10, como na Memberkit). */
  let pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&ciclo=anual&moeda=ZAR`);
  verdade(await pg.isVisible('#ecra-criar'), 'Com planos à venda, a página mostra o formulário');
  igual(await pg.textContent('#plano-nome'), 'Plano Essencial', 'O plano vem do endereço');
  igual(await txt(pg, '#plano-alunos'), 'Até 500 alunos activos', 'com o limite de alunos');
  igual(await txt(pg, '#plano-valor'), 'R 1 990,00', 'o preço anual, no formato da casa (símbolo, agrupado, vírgula)');
  contem(await pg.textContent('#plano-por'), 'por ano · poupa 17%', 'e quanto se poupa face a doze meses');
  contem(await txt(pg, '#plano-gratis'), '7 dias grátis. Depois, R 1 990,00 por ano', 'Diz quanto se paga depois dos dias grátis');
  igual(await pg.locator('#plano-escolher, #ciclo, #pais').count(), 0, 'Não há escolha de plano, de ciclo nem de país nesta página');
  igual(await pg.getAttribute('#plano-trocar', 'href'), '/site/?moeda=ZAR#precos', 'Trocar de plano volta aos preços do site, na mesma moeda');
  contem(await pg.textContent('#lado-titulo'), 'plano Essencial', 'O painel diz o que o plano inclui');
  contem(await txt(pg, '#lado-inclui'), 'Até 500 alunos activos', 'com o limite de alunos à cabeça');
  const corpo = await pg.textContent('body');
  naoContem(corpo, 'Kingdom', 'A página da plataforma não tem a marca da Kingdom');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=MZN`);
  igual(await txt(pg, '#plano-valor'), 'MZ 3 500,00', 'Em meticais, o preço com o símbolo da tesouraria');
  verdade(new URL(pg.url()).search.includes('moeda=MZN') && new URL(pg.url()).search.includes('ciclo=mensal'), 'e o endereço fica com o plano, o ciclo e a moeda');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=premium&moeda=ZAR`);
  igual(await pg.textContent('#plano-nome'), 'Plano Premium', 'O site pode dizer «premium» pelo plano escala');
  igual(await txt(pg, '#plano-alunos'), 'Até 5 000 alunos activos', 'Os milhares agrupam-se também abaixo de dez mil');
  igual(await txt(pg, '#plano-valor'), 'R 799,00', 'Sem preço anual, fica o mensal');
  await pg.close();

  /* 2. A conta e a validação do M-Pesa (W4·7): o número paga MZ 10,00 pela
     cobrança do Payflow; confirmado, a área abre no onboarding. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=profissional`);
  verdade(await pg.isVisible('#campo-mpesa'), 'Em meticais pede o número M-Pesa');
  verdade(await pg.isHidden('#campo-cartao'), 'e não fala de cartão');
  await pg.fill('#f-escola', 'Escola de Exemplo');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'ana@exemplo.invalid');
  await pg.fill('#f-mpesa', '86 123 4567');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  contem(await pg.textContent('#conta-erro'), '84 ou 85', 'Um número que não é M-Pesa não passa');
  await pg.fill('#f-mpesa', '84 123 4567');
  await pg.fill('#f-senha2', 'outra-coisa');
  await pg.click('#btn-conta');
  contem(await pg.textContent('#conta-erro'), 'não são iguais', 'Senhas diferentes não passam');
  igual(await pg.getAttribute('#f-senha2', 'aria-invalid'), 'true', 'e o campo fica marcado');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 4000 });
  const chamadas = await pg.evaluate(() => window.__criarDemo.chamadas);
  const criar = chamadas.find(c => c[0] === 'criar-escola')[1];
  igual(JSON.stringify([criar.plano, criar.ciclo, criar.moeda, criar.msisdn, criar.aceitouTermos]), '["profissional","mensal","MZN","258841234567",true]',
    'Vai para o servidor o plano, o ciclo, a moeda, o número M-Pesa e os termos aceites');
  verdade(chamadas.some(c => c[0] === 'entrar'), 'entra com a conta nova');
  igual(JSON.stringify(chamadas.find(c => c[0] === 'pin')), '["pin","258841234567"]', 'pede o PIN a esse número');
  verdade(chamadas.some(c => c[0] === 'confirmar'), 'e, pago, pergunta se a área já abriu');
  igual(await pg.textContent('#pronta-titulo'), 'A «Escola de Exemplo» está aberta', 'Diz que a área está aberta');
  igual(await pg.evaluate(() => window.__criarDemo.abriu), '/?org=escola-de-exemplo', 'e abre-a no onboarding');
  igual(await pg.getAttribute('#btn-entrar', 'href'), '/?org=escola-de-exemplo', 'com um botão para o mesmo sítio');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
  await pg.close();

  /* 2a. O M-Pesa recusa (sem saldo): diz porquê, e outro número resolve. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial`);
  await pg.fill('#f-escola', 'Escola Sem Saldo');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'saldo@exemplo.invalid');
  await pg.fill('#f-mpesa', '840000001');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#validar-accoes:not([hidden])', { timeout: 3000 });
  contem(await pg.textContent('#validar-erro'), 'saldo suficiente', 'Uma recusa do M-Pesa diz porquê');
  contem(await pg.textContent('#validar-texto'), 'Nada foi cobrado', 'e que nada foi cobrado');
  await pg.fill('#f-outro', '85 765 4321');
  await pg.click('#form-outro button[type=submit]');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 3000 });
  verdade(true, 'Outro número paga e a área abre');
  await pg.close();

  /* 2c. Fora de Moçambique: o cartão, na página segura do Payflow. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=ZAR&pago=1`);
  verdade(await pg.isHidden('#campo-mpesa'), 'Em rand não pede número M-Pesa');
  contem(await pg.textContent('#campo-cartao'), 'R 18,00', 'e diz que valida o cartão');
  await pg.fill('#f-escola', 'Escola do Cabo');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'cabo@exemplo.invalid');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#btn-cartao:not([hidden])', { timeout: 3000 });
  igual(await pg.getAttribute('#btn-cartao', 'href'), 'https://payflow.kingdomcompny.com/c/demo123', 'O botão abre a cobrança da validação no Payflow');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 7000 });
  verdade(true, 'Paga no Payflow, a página abre a área sozinha');
  await pg.close();

  /* 2b. Já com sessão de outra conta no browser (o /criar partilha o endereço
     da área de membros): sai dessa sessão e cria com o email escrito, em vez
     de o servidor recusar com «Entrou com outra conta» (achado do Shelton a 04/10). */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&sessao=equipa@exemplo.invalid`);
  await pg.fill('#f-escola', 'Escola Nova');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'nova@exemplo.invalid');
  await pg.fill('#f-mpesa', '841234567');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 3000 });
  const ch2 = await pg.evaluate(() => window.__criarDemo.chamadas.map(c => c[0]));
  igual(ch2.slice(0, 2).join(','), 'sair,criar-escola', 'Com a sessão de outra conta, sai dela antes de criar');
  verdade(ch2.includes('entrar'), 'e entra depois com a conta nova');
  await pg.close();

  /* 3. O email já tem conta: pede a senha dessa conta. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&existe=1`);
  await pg.fill('#f-escola', 'Outra Escola');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'ana@exemplo.invalid');
  await pg.fill('#f-mpesa', '841234567');
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
  await pg.waitForSelector('#painel-pronta:not([hidden])');
  verdade(true, 'Com a senha certa, cria a área com a conta que já existia');
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
