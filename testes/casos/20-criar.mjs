import { abrirPagina } from '../util.mjs';

export const nome = 'Criar área de membros (/criar): plano do endereço, conta, validação do M-Pesa ou do cartão, e a área abre no onboarding';

/* W4 (decisões do Shelton a 02/10/2026): no molde do Memberkit, o plano vem
   no endereço e mostra-se em cima; a conta pede nome da área, nome, email e a
   senha duas vezes; o cartão vem a seguir (7 dias grátis). Corre em
   demonstração (?demo=1): preços de mentira, nenhuma conta criada, nenhuma
   Paystack. A sério, a página chama criar-escola e plataforma-cartao, que se
   provaram à parte (caso 40 do painel e SQL desfeito). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  let pg2;
  const NBSP = / /g;
  const txt = async (pg, s) => (await pg.textContent(s)).replace(NBSP, ' ');

  /* 1. O plano vem já escolhido do site: cria-se esse plano, não se escolhe
     outra vez (pedido do Shelton a 04/10, como na Memberkit). */
  let pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&ciclo=anual&moeda=ZAR`);
  verdade(await pg.isVisible('#ecra-criar'), 'Com planos à venda, a página mostra o formulário');
  /* Em rand é a África do Sul: a página fala inglês (pedido do Shelton a 05/10). */
  igual(await pg.getAttribute('html', 'lang'), 'en', 'Em rand (África do Sul), a página é em inglês');
  igual(await pg.textContent('#plano-nome'), 'Essential plan', 'O plano vem do endereço, com o nome em inglês');
  igual(await txt(pg, '#plano-alunos'), 'Up to 500 active students', 'com o limite de alunos');
  igual(await txt(pg, '#plano-valor'), 'R 1 990,00', 'o preço anual, no formato da casa (símbolo, agrupado, vírgula)');
  contem(await txt(pg, '#plano-por'), 'per year · 2 months free, save R 398,00', 'O anual diz os 2 meses grátis e quanto se poupa');
  contem(await txt(pg, '#plano-gratis'), '7 days free. Then R 1 990,00 per year', 'Diz quanto se paga depois dos dias grátis');
  igual(await pg.locator('#plano-escolher, #ciclo, #pais').count(), 0, 'Não há escolha de plano, de ciclo nem de país nesta página');
  igual(await pg.getAttribute('#plano-trocar', 'href'), '/site-za/#precos', 'Trocar de plano volta aos preços do site do mercado (África do Sul)');
  igual(await pg.getAttribute('.ficha-topo .marca', 'href'), '/site-za/', 'e a marca leva ao site desse mercado');
  contem(await pg.textContent('#lado-titulo'), 'Essential plan', 'O painel diz o que o plano inclui');
  contem(await txt(pg, '#lado-inclui'), 'Up to 500 active students', 'com o limite de alunos à cabeça');
  contem(await txt(pg, '#lado-inclui'), 'card payments', 'e, em rand, vende-se por cartão (sem M-Pesa)');
  naoContem(await pg.textContent('#ecra-criar'), 'Os seus dados', 'Nada fica em português');
  contem(await pg.textContent('#btn-conta'), 'Verify and create my members area', 'o botão incluído');
  const corpo = await pg.textContent('body');
  naoContem(corpo, 'Kingdom', 'A página da plataforma não tem a marca da Kingdom');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=MZN`);
  igual(await pg.getAttribute('html', 'lang'), 'pt', 'Em meticais (Moçambique), a página é em português');
  igual(await pg.getAttribute('#plano-trocar', 'href'), '/site-mz/#precos', 'e Trocar de plano volta ao site de Moçambique');
  igual(await txt(pg, '#plano-valor'), 'MZ 3 500,00', 'Em meticais, o preço com o símbolo da tesouraria');
  verdade(new URL(pg.url()).search.includes('moeda=MZN') && new URL(pg.url()).search.includes('ciclo=mensal'), 'e o endereço fica com o plano, o ciclo e a moeda');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=premium&moeda=ZAR`);
  igual(await pg.textContent('#plano-nome'), 'Premium plan', 'O site pode dizer «premium» pelo plano escala');
  igual(await txt(pg, '#plano-alunos'), 'Up to 5 000 active students', 'Os milhares agrupam-se também abaixo de dez mil');
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

  /* 2d. A ligação cai a meio da espera pelo PIN, que foi confirmado (o caso
     do Shelton a 04/10): a página não diz «falhou» — verifica, e abre. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial`);
  await pg.fill('#f-escola', 'Escola Cortada');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'cortada@exemplo.invalid');
  await pg.fill('#f-mpesa', '840000003');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 4000 });
  verdade(true, 'Sem resposta do servidor, verifica o pagamento e a área abre');
  await pg.close();

  /* 2e. Recusado «do nosso lado»: não manda pagar por transferência. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial`);
  await pg.fill('#f-escola', 'Escola Recusada');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'recusada@exemplo.invalid');
  await pg.fill('#f-mpesa', '840000004');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#validar-accoes:not([hidden])', { timeout: 3000 });
  contem(await pg.textContent('#validar-erro'), 'outro número', 'Recusado do nosso lado: tente outra vez ou outro número');
  naoContem(await pg.textContent('#validar-erro'), 'transferência', 'sem mandar pagar por transferência');
  await pg.close();

  /* 2f. Volta à /criar com o email e o nome da escola que ficou à espera, já
     paga: entra com a senha e a área abre, sem criar outra nem pedir PIN. */
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&existe=1&retomar=1`);
  await pg.fill('#f-escola', 'Escola Paga');
  await pg.fill('#f-nome', 'Ana Exemplo');
  await pg.fill('#f-email', 'paga@exemplo.invalid');
  await pg.fill('#f-mpesa', '841234567');
  await pg.fill('#f-senha', 'segredo-forte');
  await pg.fill('#f-senha2', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#campos-existente:not([hidden])', { timeout: 3000 });
  await pg.fill('#f-senha-existente', 'segredo-forte');
  await pg.click('#btn-conta');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 3000 });
  const retomar = await pg.evaluate(() => window.__criarDemo.chamadas);
  falso(retomar.some(c => c[0] === 'pin'), 'A escola já paga abre sem pedir o PIN outra vez');
  igual(await pg.evaluate(() => window.__criarDemo.abriu), '/?org=escola-paga', 'e abre a mesma escola');
  await pg.close();

  /* 2c. Fora de Moçambique: o cartão, na janela segura da Paystack (W4·8·7). */
  const preencherCabo = async p => {
    await p.fill('#f-escola', 'Escola do Cabo');
    await p.fill('#f-nome', 'Ana Exemplo');
    await p.fill('#f-email', 'cabo@exemplo.invalid');
    await p.fill('#f-senha', 'segredo-forte');
    await p.fill('#f-senha2', 'segredo-forte');
    await p.click('#btn-conta');
    await p.waitForSelector('#btn-cartao:not([hidden])', { timeout: 3000 });
  };
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=ZAR`);
  verdade(await pg.isHidden('#campo-mpesa'), 'Em rand não pede número M-Pesa');
  contem(await txt(pg, '#campo-cartao'), 'R 18,00', 'e diz que valida o cartão');
  contem(await txt(pg, '#campo-cartao'), 'Paystack', 'numa janela segura da Paystack');
  falso(await pg.isDisabled('#btn-conta'), 'A inscrição em rand está aberta (já não diz «abre em breve»)');
  contem(await txt(pg, '.consentimento'), 'charged automatically', 'O consentimento diz que o cartão é cobrado sozinho até cancelar');
  pg2 = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=ZAR&lang=pt`);
  igual(await pg2.textContent('#plano-nome'), 'Plano Essencial', 'Com ?lang=pt, a página em rand fica em português');
  await pg2.close();
  await preencherCabo(pg);
  contem(await txt(pg, '#validar-texto'), 'charged every month until you cancel', 'Antes de pagar, diz que o cartão fica a pagar o plano');
  await pg.click('#btn-cartao');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 7000 });
  const chamadasCartao = await pg.evaluate(() => window.__criarDemo.chamadas.filter(c => c[0] === 'cartao' || c[0] === 'janela'));
  igual(chamadasCartao, [['cartao', 'demo123'], ['janela', 'demo123']], 'O botão pede a janela da Paystack pela cobrança da validação');
  verdade(true, 'Paga na janela, a página abre a área sozinha');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=ZAR&cartao=desiste`);
  await preencherCabo(pg);
  await pg.click('#btn-cartao');
  await pg.waitForSelector('#validar-erro:not([hidden])', { timeout: 3000 });
  contem(await txt(pg, '#validar-erro'), 'nothing was charged', 'Quem fecha a janela fica a saber que nada foi cobrado');
  verdade(await pg.isVisible('#btn-cartao'), 'e pode tentar outra vez');
  igual(await pg.locator('#validar-accoes:not([hidden])').count(), 0, 'sem o formulário do M-Pesa');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&plano=essencial&moeda=ZAR&cartao=semscript&pago=1`);
  await preencherCabo(pg);
  await pg.click('#btn-cartao');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 8000 });
  igual(await pg.evaluate(() => window.__criarDemo.separador), 'https://checkout.paystack.com/demo123',
    'Sem a janela (o script não veio), abre a página segura da Paystack noutro separador e a área abre na mesma');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript no caminho do cartão');
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

  /* 4b. Com o Payflow ligado (A5, W4·8): a validação e os dias grátis são os do
     produto de cada plano, e a página diz o que vai acontecer com eles. */
  const preencher = async (p, escola) => {
    await p.fill('#f-escola', escola); await p.fill('#f-nome', 'Ana Exemplo'); await p.fill('#f-email', 'ana@exemplo.invalid');
    await p.fill('#f-mpesa', '84 123 4567'); await p.fill('#f-senha', 'segredo-forte'); await p.fill('#f-senha2', 'segredo-forte');
    await p.click('#btn-conta');
  };
  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&payflow=1&plano=essencial&moeda=MZN`);
  contem(await txt(pg, '#plano-gratis'), '14 dias grátis. Depois, MZ 3 500,00 por mês', 'Os dias grátis são os do produto (14), não os 7 de sempre');
  contem(await txt(pg, '#mpesa-dica'), 'Pedimos MZ 25,00 a este número para validar', 'e a validação também (MZ 25,00)');
  await preencher(pg, 'Escola Do Produto');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 4000 });
  igual(JSON.stringify((await pg.evaluate(() => window.__criarDemo.chamadas)).find(c => c[0] === 'pin')), '["pin","258841234567"]', 'Com validação, pede o PIN pela cobrança da validação');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&payflow=1&plano=profissional&moeda=MZN`);
  contem(await txt(pg, '#plano-gratis'), 'MZ 7 000,00 por mês, a começar hoje', 'Um produto sem dias grátis diz que se paga a partir de hoje');
  naoContem(await txt(pg, '#plano-gratis'), 'grátis', 'e não promete dias grátis');
  contem(await txt(pg, '#mpesa-dica'), 'Pedimos MZ 7 000,00 a este número: é o primeiro mês', 'Sem validação, o que se pede é o primeiro mês');
  await pg.evaluate(() => { window.__textos = []; new MutationObserver(() => window.__textos.push(document.getElementById('validar-texto').textContent))
    .observe(document.getElementById('validar-texto'), { childList:true, characterData:true, subtree:true }); });
  await preencher(pg, 'Escola Sem Validacao');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 4000 });
  const textos = await pg.evaluate(() => window.__textos.join(' | '));
  contem(textos, 'É o primeiro mês do plano.', 'O pedido de PIN diz que é o primeiro mês, não uma validação');
  naoContem(textos, 'descontado na primeira fatura', 'e não fala de desconto');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&payflow=1&abre=1&plano=essencial&moeda=MZN`);
  await preencher(pg, 'Escola Que Abre');
  await pg.waitForSelector('#painel-pronta:not([hidden])', { timeout: 4000 });
  falso((await pg.evaluate(() => window.__criarDemo.chamadas)).some(c => c[0] === 'pin'), 'Sem nada a pagar ao criar (só dias grátis), abre sem pedir o PIN');
  await pg.close();

  pg = await abrirPagina(navegador, `${base}/criar/index.html?demo=1&payflow=1&teste=1&plano=essencial&moeda=MZN`);
  await preencher(pg, 'Escola De Teste');
  await pg.waitForSelector('#painel-validar:not([hidden])', { timeout: 4000 });
  await pg.waitForTimeout(150);
  igual(await txt(pg, '#validar-titulo'), 'Inscrição de teste', 'Com a chave de teste do Payflow, diz que é uma inscrição de teste');
  contem(await txt(pg, '#validar-texto'), 'nada foi cobrado', 'e que nada foi cobrado');
  falso((await pg.evaluate(() => window.__criarDemo.chamadas)).some(c => c[0] === 'pin'), 'sem pedir o PIN (o M-Pesa recusaria a fatura de teste)');
  igual(pg.errosDeJs.length, 0, 'Sem erros de JavaScript');
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
