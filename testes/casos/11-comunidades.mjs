import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Comunidades: a lista de grupos, o botão para o grupo e o painel';

/* Fase 5 do plano (pedido do Shelton a 27/09/2026): o chat sai, ficam os
   grupos de cada programa. Quem vê que grupo decide-o a base (prova SQL à
   parte, com alunas fictícias); aqui prova-se o ecrã. Links inventados. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ALUNA);
  await pg.evaluate(() => irPara('comunidade'));
  await pg.waitForTimeout(250);

  const linhas = await pg.$$eval('#content-comunidade .comunidade', els => els.map(e => ({
    nome: e.querySelector('.comunidade-nome').innerText,
    canal: e.querySelector('.comunidade-canal').innerText,
    href: e.querySelector('a.comunidade-entrar').getAttribute('href'),
    alvo: e.querySelector('a.comunidade-entrar').getAttribute('target'),
    rel: e.querySelector('a.comunidade-entrar').getAttribute('rel')
  })));
  igual(linhas.length, 3, 'Aparecem os três grupos activos (o escondido não)');
  igual(linhas[0].nome, 'Kingdom All Access · Membros', 'Pela ordem escolhida no painel');
  contem(linhas[0].canal, 'WhatsApp', 'Cada grupo diz o canal');
  contem(linhas[1].canal, 'Telegram', 'Telegram também');
  igual(linhas[0].href, 'https://chat.whatsapp.com/exemplo-all-access', 'O botão leva ao link do grupo');
  igual(linhas[0].alvo, '_blank', 'Num separador novo, fora da Academia');
  contem(linhas[0].rel || '', 'noopener', 'Sem dar ao grupo acesso à janela da Academia');
  falso(await pg.isVisible('#content-comunidade textarea'), 'Já não há caixa de escrever: o chat saiu');

  /* O que o aluno escreve (nome do grupo) não vira código. */
  await pg.evaluate(() => { DB.comunidades.push({ id:'x', nome:'<img src=x onerror=window.__mal=1>', canal:'outro', link:'https://exemplo.com', ativa:true, ofertas:[], todos:true }); irPara('comunidade'); });
  await pg.waitForTimeout(200);
  falso(await pg.evaluate(() => window.__mal === 1), 'Um nome com HTML aparece como texto');

  await pg.setViewportSize({ width:390, height:844 });
  await pg.waitForTimeout(200);
  const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal no telemóvel (${largura}px)`);
  verdade(await pg.isVisible('#content-comunidade .comunidade-entrar'), 'O botão continua à vista no telemóvel');
  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();

  /* O painel. */
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-comunidades'));
  await adm.waitForTimeout(250);
  const tabela = await adm.innerText('#content-admin table');
  contem(tabela, 'Kingdom All Access', 'O painel lista os grupos com as ofertas que os vêem');
  contem(tabela, 'Todos os alunos', 'E diz quando um grupo está aberto a todos');
  contem(tabela, 'Ninguém', 'Um grupo sem oferta e sem «todos» fica assinalado');

  await adm.click('#btn-nova-comunidade');
  await adm.waitForTimeout(300);
  await adm.fill('#valor-nome', 'Grupo de teste');
  await adm.fill('#valor-link', 'http://inseguro.exemplo');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(200);
  verdade(await adm.isVisible('#valor-nome'), 'Um link sem https não se guarda (o formulário fica aberto)');
  await adm.fill('#valor-link', 'https://chat.whatsapp.com/exemplo-teste');
  await adm.check('#valor-ofertas input[value="of2"]');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(400);
  const nova = await adm.evaluate(() => DB.comunidades.find(c => c.nome === 'Grupo de teste'));
  verdade(nova, 'A comunidade nova fica guardada');
  igual((nova.ofertas || []).join(','), 'of2', 'Com a oferta escolhida');
  igual(nova.canal, 'whatsapp', 'E o canal por omissão é o WhatsApp');
  igual(adm.errosDeJs.length, 0, `Sem erros no painel: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
