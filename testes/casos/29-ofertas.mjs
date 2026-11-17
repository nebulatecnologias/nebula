import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Ofertas: a escola monta o que vende (cursos, preço, link, produtos) e a Vitrine do aluno sai daí';

/* Pedido do Shelton a 15/11/2026: «as ofertas devem ser montadas a partir do
   próprio painel e apenas conectar com um checkout e webhooks com o Payflow»;
   «a vitrine ainda depende do Payflow sendo que o software é independente».
   Em demonstração, em memória (ofertas inventadas de js/dados.js). A sério, a
   tabela academia.ofertas com as suas regras, a vitrine_do_aluno e a
   escola_aplicar_venda, provadas numa transacção desfeita (migração
   academia_ofertas): a venda de um produto abre os cursos da oferta, e outra
   escola não vê nada disto. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-ofertas'));
  await adm.waitForTimeout(300);

  const menu = await adm.innerText('.sidebar');
  contem(menu, 'Ofertas', 'O menu do painel tem Ofertas');
  naoContem(menu, 'Vitrine', 'no lugar da Vitrine, que era só um interruptor');

  const linhas = () => adm.locator('#content-admin tr[data-oferta-linha]').count();
  igual(await linhas(), 4, 'A lista mostra as ofertas da escola');
  const hab = await adm.innerText('tr[data-oferta-linha="of2"]');
  contem(hab, 'Hábitos de Elite', 'Cada oferta diz o que abre');
  contem(hab, 'Acesso sem prazo', 'por quanto tempo, que é o prazo da turma');
  contem(hab, 'MZ 1 200,00', 'a que preço');
  contem(hab, 'payflow.kingdomcompny.com', 'onde se paga');
  contem(hab, '1 produto ligado', 'e quantos produtos do checkout a entregam');
  contem(await adm.innerText('tr[data-oferta-linha="of1"]'), 'por mês', 'Uma oferta que se renova diz de quanto em quanto tempo');
  igual(await adm.getAttribute('[data-vitrine="of4"]', 'aria-checked'), 'false', 'Uma oferta montada fica fora da Vitrine até alguém a ligar');

  const toast = async () => (await adm.locator('.toast').allInnerTexts()).join(' | ');
  const guardar = async () => { await adm.click('#drawer-guardar'); await adm.waitForTimeout(400); };

  /* Criar uma oferta: cursos em cartões, preço, link e produtos. O prazo já
     não é da oferta: é o da turma de cada curso (teste 34). */
  await adm.click('#btn-nova-oferta');
  await adm.waitForTimeout(300);
  await adm.fill('#valor-nome', 'Vendas de Alto Impacto · Turma A');
  await adm.click('#valor-cursos label:has(input[value="vv"])');
  igual(await adm.locator('#valor-diasDeAcesso').count(), 0, 'A oferta já não tem duração própria');
  contem(await adm.innerText('#oferta-turmas'), 'Acesso sem prazo', 'Por baixo dos cursos, diz a turma de cada um e o prazo dela');
  await adm.fill('#valor-preco', '900');
  await adm.fill('#valor-link', 'http://exemplo.invalid/pagar');
  await adm.fill('#valor-produtos', 'prod_NOVO_1\nprod_NOVO_1 prod_NOVO_2');
  await adm.click('#valor-naVitrine');
  await guardar();
  contem(await toast(), 'https://', 'Um link de pagamento sem https é recusado');
  verdade(await adm.isVisible('#drawer-overlay'), 'e o formulário fica aberto, com o que se escreveu');
  await adm.fill('#valor-link', 'exemplo.invalid/pagar');
  await adm.fill('#valor-produtos', 'pr@d');
  await guardar();
  contem(await toast(), 'não parece válido', 'Um ID de produto que não é um ID é recusado');
  await adm.fill('#valor-produtos', 'prod_01JDEMO7K2QF');
  await guardar();
  contem(await toast(), 'já está na oferta «Kingdom All Access»', 'Um produto entrega uma só oferta');
  await adm.fill('#valor-produtos', 'prod_NOVO_1\nprod_NOVO_1 prod_NOVO_2');
  await guardar();
  falso(await adm.isVisible('#drawer-overlay'), 'Com tudo certo, a oferta guarda-se');
  igual(await linhas(), 5, 'e entra na lista');

  const nova = await adm.evaluate(() => DB.ofertasDaEscola.find(o => o.nome === 'Vendas de Alto Impacto · Turma A'));
  igual(nova.produtos.join(','), 'prod_NOVO_1,prod_NOVO_2', 'Os produtos repetidos ficam uma vez só');
  igual(`${nova.diasDeAcesso}/${nova.cursos.join(',')}/${nova.link}`, 'null/vv/https://exemplo.invalid/pagar', 'com os cursos e o link (já com https), e sem prazo próprio');
  const linhaNova = await adm.innerText(`tr[data-oferta-linha="${nova.id}"]`);
  contem(linhaNova, 'Acesso sem prazo', 'A linha diz o prazo, que vem da turma');
  contem(linhaNova, 'MZ 900,00', 'e o preço, escrito como o dinheiro se escreve');
  contem(linhaNova, '2 produtos ligados', 'e os produtos');

  /* A Vitrine do aluno sai das ofertas. */
  const naMontra = await adm.evaluate(id => DB.vitrine.find(v => v.ofertaId === id), nova.id);
  verdade(!!naMontra, 'Ligada à Vitrine, a oferta passa a estar à venda para o aluno');
  igual(naMontra.destino, 'https://exemplo.invalid/pagar', 'e o botão leva ao link de pagamento dela');
  await adm.evaluate(() => irPara('vitrine'));
  await adm.waitForTimeout(300);
  const cartao = await adm.innerText(`#vitrine-grid .course-card[data-oferta="${nova.id}"]`);
  contem(cartao, 'Vendas de Alto Impacto', 'O cartão aparece na Vitrine');
  contem(cartao, 'MZ 900,00', 'com o preço da oferta');
  await adm.evaluate(id => irPara('oferta', id), nova.id);
  await adm.waitForTimeout(250);
  const pagina = await adm.innerText('#content-oferta');
  contem(pagina, 'página segura', 'A página da oferta diz que o pagamento é numa página segura');
  naoContem(pagina, 'Payflow', 'sem dizer o nome do checkout, que é de cada escola');

  /* Ligar à Vitrine uma oferta sem link: fica retida, e diz porquê. */
  await adm.evaluate(() => irPara('admin-ofertas'));
  await adm.waitForTimeout(300);
  await adm.click('[data-vitrine="of4"]');
  await adm.waitForTimeout(300);
  contem(await adm.innerText('#content-admin .aviso-retidas'), 'falta o link de pagamento', 'Uma oferta ligada sem link de pagamento fica retida, com o motivo');
  falso(await adm.evaluate(() => DB.vitrine.some(v => v.ofertaId === 'of4')), 'e não chega ao aluno');
  await adm.focus('[data-vitrine="of4"]');
  await adm.keyboard.press('Enter');
  await adm.waitForTimeout(300);
  falso(await adm.isVisible('#content-admin .aviso-retidas'), 'O interruptor também se muda pelo teclado');

  /* Editar: desligar a oferta tira-a da Vitrine. */
  await adm.click(`tr[data-oferta-linha="${nova.id}"] [data-editar]`);
  await adm.waitForTimeout(300);
  igual(await adm.inputValue('#valor-produtos'), 'prod_NOVO_1\nprod_NOVO_2', 'Ao editar, os produtos vêm um por linha');
  await adm.click('#valor-ativa');
  await guardar();
  contem(await adm.innerText(`tr[data-oferta-linha="${nova.id}"]`), 'Desligada', 'Uma oferta desligada diz que o está');
  falso(await adm.evaluate(id => DB.vitrine.some(v => v.ofertaId === id), nova.id), 'e sai da Vitrine do aluno');

  /* As Integrações mostram os produtos das ofertas, e levam a elas. */
  await adm.evaluate(() => irPara('admin-integracoes'));
  await adm.waitForTimeout(300);
  await adm.click('[data-int-aba="disponiveis"]');
  await adm.click('.int-cartao[data-int-abrir="payflow"]');
  await adm.waitForTimeout(200);
  const ficha = await adm.innerText('[data-int-ficha="payflow"]');
  contem(ficha, 'prod_01JDEMO9H4EL', 'A ficha do Payflow mostra os produtos das ofertas ativas');
  naoContem(ficha, 'prod_NOVO_1', 'e não os de uma oferta desligada');
  await adm.click('[data-int-ficha="payflow"] .int-produtos ~ .acoes [data-int-ir="admin-ofertas"]');
  await adm.waitForTimeout(300);
  igual(await adm.evaluate(() => estado.viewAtual), 'admin-ofertas', '«Abrir Ofertas» leva às ofertas');

  /* Apagar. */
  await adm.click(`tr[data-oferta-linha="${nova.id}"] [data-apagar]`);
  await adm.waitForTimeout(200);
  contem(await adm.innerText('.modal-overlay.confirmacao'), 'Quem já comprou fica com o acesso', 'Apagar avisa que quem comprou não perde nada');
  await adm.click('.modal-overlay [data-confirmar]');
  await adm.waitForTimeout(400);
  igual(await linhas(), 4, 'Apagar tira a oferta da lista');

  /* A Vitrine já não é só de quem tem o Payflow de origem. */
  const noutra = await adm.evaluate(() => {
    const antes = API.organizacao;
    API.organizacao = Object.assign({}, antes, { payflow:false });
    const r = [vistaDisponivel('vitrine'), vistaDisponivel('admin-ofertas')].join(',');
    API.organizacao = antes;
    return r;
  });
  igual(noutra, 'true,true', 'Numa escola sem o Payflow de origem, a Vitrine e as Ofertas também existem');

  /* No telemóvel, sem deslize horizontal da página. */
  await adm.setViewportSize({ width:390, height:844 });
  await adm.evaluate(() => irPara('admin-ofertas'));
  await adm.waitForTimeout(250);
  await adm.click('tr[data-oferta-linha="of1"] [data-editar]');
  /* A gaveta entra a deslizar: mede-se só depois de ela parar (a mesma
     posição em duas leituras seguidas), e ao pixel. A meio do caminho a conta
     dá fracções, como 390,001. */
  await adm.waitForFunction(() => {
    const o = document.getElementById('drawer-overlay');
    const g = o && o.querySelector('.drawer');
    if(!g || !o.classList.contains('aberto')) return false;
    const x = g.getBoundingClientRect().right;
    const parada = window.__direitaAntes === x;
    window.__direitaAntes = x;
    return parada;
  }, null, { polling: 120 });
  const direita = Math.round(await adm.evaluate(() => document.querySelector('#drawer-overlay .drawer').getBoundingClientRect().right));
  verdade(direita <= 390, `O formulário cabe no telemóvel (${direita}px)`);
  await adm.keyboard.press('Escape');
  await adm.waitForTimeout(250);
  const largura = await adm.evaluate(() => document.documentElement.scrollWidth);
  verdade(largura <= 390, `Sem deslize horizontal da página no telemóvel (${largura}px)`);

  igual(adm.errosDeJs.length, 0, `Sem erros: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
