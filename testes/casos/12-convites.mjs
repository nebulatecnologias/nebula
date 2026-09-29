import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Convites: estados com contagem, prazo à vista, revogar sem apagar e a gaveta nova';

/* Pedido do Shelton a 29/09/2026: o ecrã de convites no molde do da Library,
   e um prazo nos convites. O prazo verdadeiro é do servidor (convite-entrar
   só deixa entrar dentro dele); aqui prova-se o que o ecrã mostra e manda.
   Pessoas e emails inventados (js/dados.js). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-convites'));
  await adm.waitForTimeout(250);

  const contas = async () => adm.$$eval('#content-admin [data-estado-convite]', els =>
    Object.fromEntries(els.map(e => [e.getAttribute('data-estado-convite'), e.querySelector('.estado-chip-conta').innerText.trim()])));
  let c = await contas();
  igual(`${c.todos}/${c.enviado}/${c.aberto}/${c.aceite}/${c.expirado}/${c.revogado}`, '4/1/1/1/1/0',
    'Cada separador diz quantos convites tem');

  const linha = id => adm.innerText(`#content-admin tr[data-convite="${id}"]`);
  const l1 = await linha('cv1');
  contem(l1, 'Joana Macie', 'A pessoa aparece pelo nome');
  contem(l1, 'joana.macie@exemplo.co.mz', 'com o email por baixo');
  contem(l1, 'Expira em 6 dias', 'O prazo lê-se em dias');
  contem(l1, 'Manual', 'A origem diz quem o criou');
  contem(l1, 'PT', 'e o idioma do email');
  contem(await linha('cv2'), 'Pagamento', 'Os convites da ponte dizem que vieram de um pagamento');
  contem(await linha('cv2'), 'Aberto', 'O convite aberto e ainda não aceite tem estado próprio');
  contem(await linha('cv4'), 'Expirou a', 'O expirado diz quando expirou');
  falso(await adm.isVisible('tr[data-convite="cv3"] [data-revogar]'), 'Um convite aceite não se revoga nem se copia');
  verdade(await adm.isVisible('tr[data-convite="cv4"] [data-reenviar]'), 'Um expirado pode enviar-se outra vez');
  falso(await adm.isVisible('tr[data-convite="cv4"] [data-copiar]'), 'mas o link dele já não se copia');

  /* Filtrar e procurar. */
  await adm.click('[data-estado-convite="aceite"]');
  await adm.waitForTimeout(150);
  igual((await adm.$$eval('#content-admin tr[data-convite]', els => els.map(e => e.getAttribute('data-convite')))).join(','),
    'cv3', 'Em «Aceite» fica só o aceite');
  igual(await adm.getAttribute('[data-estado-convite="aceite"]', 'aria-pressed'), 'true', 'O separador escolhido diz-se ao leitor de ecrã');
  await adm.click('[data-estado-convite="todos"]');
  await adm.waitForTimeout(150);
  await adm.fill('#convites-busca', 'thandi');
  await adm.waitForTimeout(150);
  igual((await adm.$$eval('#content-admin tr[data-convite]', els => els.map(e => e.getAttribute('data-convite')))).join(','),
    'cv2', 'A procura encontra pelo nome');
  igual(await adm.evaluate(() => document.activeElement.id), 'convites-busca', 'e o cursor fica na caixa enquanto se escreve');
  await adm.fill('#convites-busca', '');
  await adm.waitForTimeout(150);

  /* A gaveta nova. */
  await adm.click('#btn-novo-convite');
  await adm.waitForTimeout(300);
  igual(await adm.inputValue('#valor-dias'), '7', 'O prazo começa nos 7 dias');
  igual(await adm.inputValue('#valor-idioma'), 'pt', 'e o idioma em português');
  const cartoes = await adm.$$eval('.drawer .checklist-cartao', els => els.map(e => e.innerText.trim()));
  igual(cartoes.length, await adm.evaluate(() => DB.cursos.length), 'Um cartão por curso');
  verdade(cartoes.some(t => t.includes('Em breve')), 'O curso ainda sem aulas diz «Em breve»');
  verdade(await adm.evaluate(() => {
    const [a, b] = [...document.querySelectorAll('.drawer .campos-par .field')].map(e => e.getBoundingClientRect());
    return a && b && Math.abs(a.top - b.top) < 2;
  }), 'Idioma e prazo ficam lado a lado');

  await adm.fill('#valor-email', 'isto-nao-e-email');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(150);
  verdade(await adm.isVisible('#valor-email'), 'Um email mal escrito não segue (a gaveta fica aberta)');
  await adm.fill('#valor-email', 'novo.aluno@exemplo.co.mz');
  await adm.fill('#valor-nome', 'Novo Aluno');
  await adm.selectOption('#valor-dias', '3');
  await adm.selectOption('#valor-idioma', 'en');
  await adm.check('.drawer .checklist-cartao input[value="kt"]');
  await adm.click('#drawer-guardar');
  await adm.waitForTimeout(400);
  const novo = await adm.evaluate(() => DB.convites[0]);
  igual(novo.email, 'novo.aluno@exemplo.co.mz', 'O convite novo fica em primeiro');
  igual(novo.idioma, 'en', 'no idioma escolhido');
  igual((novo.cursos || []).join(','), 'kt', 'com o curso escolhido');
  const dias = await adm.evaluate(() => Math.round((new Date(DB.convites[0].expiraEm) - Date.now()) / 864e5));
  igual(dias, 3, 'e com o prazo escolhido');
  contem(await linha(novo.id), 'Expira em 3 dias', 'A linha mostra o prazo novo');
  c = await contas();
  igual(c.enviado, '2', 'O separador «Enviado» conta mais um');

  /* Revogar não apaga. */
  await adm.click('tr[data-convite="cv1"] [data-revogar]');
  await adm.waitForTimeout(150);
  await adm.click('.modal-overlay [data-confirmar]');
  await adm.waitForTimeout(250);
  contem(await linha('cv1'), 'Revogado', 'O convite revogado fica na lista, como revogado');
  falso(await adm.isVisible('tr[data-convite="cv1"] [data-copiar]'), 'e o link dele já não se copia');
  igual((await contas()).revogado, '1', 'O separador «Revogado» conta-o');

  /* Reenviar o expirado: um convite novo, e o antigo deixa de valer. */
  await adm.click('tr[data-convite="cv4"] [data-reenviar]');
  await adm.waitForTimeout(150);
  await adm.click('.modal-overlay [data-confirmar]');
  await adm.waitForTimeout(300);
  const reenviado = await adm.evaluate(() => DB.convites[0]);
  igual(reenviado.email, 'lina.cossa@exemplo.co.mz', 'O reenvio cria um convite novo para a mesma pessoa');
  contem(await linha(reenviado.id), 'Expira em 7 dias', 'com mais 7 dias');

  /* O que alguém escreveu no nome não vira código. */
  await adm.evaluate(() => { DB.convites.unshift({ id:'mal', codigo:'x', email:'mal@exemplo.co.mz', nome:'<img src=x onerror=window.__mal=1>', cursos:[], estado:'enviado', criadoEm:new Date().toISOString(), expiraEm:new Date(Date.now()+864e5*2).toISOString() }); renderAdminConvites(); });
  await adm.waitForTimeout(150);
  falso(await adm.evaluate(() => window.__mal === 1), 'Um nome com HTML aparece como texto');

  /* No telemóvel a tabela desliza dentro do cartão, a página não. */
  await adm.setViewportSize({ width:390, height:844 });
  await adm.waitForTimeout(200);
  const largura = await adm.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal da página no telemóvel (${largura}px)`);
  igual(adm.errosDeJs.length, 0, `Sem erros: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
