import { abrirPagina } from '../util.mjs';

export const nome = 'Consola da plataforma: painel, organizações, ficha, equipa, domínio e suspensão';

/* Pedido do Shelton a 01/10/2026 (a consola) e a 02/10/2026 (um painel de
   gestão a sério: números, o que precisa de atenção, a lista com a linha
   seleccionada, a ficha de cada organização). Corre em demonstração
   (?demo=1, dados em memória). A sério, as acções vão às funções
   academia.consola_* e à Edge Function convidar-aluno, provadas em SQL numa
   transacção desfeita (PLANO.md, registo da consola). */
export default async function ({ navegador, base, igual, verdade, contem, naoContem }){
  const B = `${base}/consola/index.html?demo=1`;
  const pg = await abrirPagina(navegador, B, { viewport: { width: 1440, height: 900 } });
  pg.on('dialog', d => d.accept());
  const ir = async h => { await pg.evaluate(h => { location.hash = h; }, h); await pg.waitForTimeout(150); };
  const texto = sel => pg.evaluate(s => document.querySelector(s).innerText.replace(/ /g, ' '), sel);

  /* 0. Os estilos carregam em /consola e em /consola/ (02/10: em /consola, sem a
        barra, o caminho relativo «consola.css» ia para /consola.css e a consola
        aparecia sem desenho nenhum). Caminhos absolutos, e o desenho aplicado. */
  const caminhos = await pg.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet], script[src]')]
    .map(e => e.getAttribute('href') || e.getAttribute('src')).filter(x => !/^https?:/.test(x)));
  verdade(caminhos.length >= 5 && caminhos.every(x => x.startsWith('/')), `Estilos e scripts com caminho absoluto (${caminhos.join(', ')})`);
  igual(await pg.evaluate(() => getComputedStyle(document.querySelector('.c-kpis')).display), 'grid', 'e o desenho da consola está aplicado');

  /* 1. A visão geral: números, desempenho, saúde, atenção. */
  verdade(await pg.isVisible('#ecra-consola'), 'Quem administra a plataforma vê a consola');
  contem(await texto('#c-demo'), 'demonstração', 'Em demonstração, a consola diz que os dados são inventados');
  igual(await pg.locator('.c-kpi').count(), 4, 'Quatro números da carteira');
  contem(await texto('[data-kpi="receita"]'), 'MZ ', 'A receita mensal em meticais, com o símbolo à frente');
  contem(await texto('[data-kpi="organizacoes"]'), 'de 14', 'e as organizações activas, de quantas');
  igual(await pg.locator('#c-grafico .c-barra').count(), 12, 'O desempenho mostra doze meses');
  verdade(await pg.locator('#c-grafico .c-barra.em-curso').count() === 1, 'com o mês em curso às riscas');
  contem(await texto('#c-dica'), 'face a', 'e a dica compara o último mês fechado com o anterior');
  await pg.hover('#c-grafico .c-barra:last-of-type');
  await pg.waitForTimeout(100);
  contem(await texto('#c-dica'), 'Mês em curso', 'Sobre o mês em curso, a dica não compara');
  await pg.click('[data-serie="alunos"]');
  contem(await texto('#c-dica'), 'alunos', 'O desempenho troca para alunos');
  contem(await texto('.c-medidor'), 'em dia', 'O medidor diz a parte das organizações em dia');
  contem(await texto('.c-insights'), 'Escola Raízes', 'Precisa de atenção: a escola com o pagamento em atraso');
  contem(await texto('.c-insights .c-insight:first-child'), 'Pagamento em atraso', 'e é a primeira, por ser a mais urgente');

  /* 2. A lista: filtros, procura, a linha seleccionada e a paginação. */
  await ir('#/organizacoes');
  igual(await pg.locator('#lista-escolas tbody tr').count(), 8, 'A lista mostra oito por página');
  contem(await texto('.c-paginacao'), 'A mostrar 01–08 de 14', 'e diz quantas mostra, de quantas');
  igual(await pg.locator('#lista-escolas tr.sel').count(), 1, 'Uma linha está seleccionada');
  await pg.click('.c-paginas [data-pagina="2"]');
  contem(await texto('.c-paginacao'), '09–14 de 14', 'A segunda página mostra o resto');
  const segunda = await pg.getAttribute('#lista-escolas tbody tr:nth-child(2)', 'data-escola');
  await pg.click('#lista-escolas tbody tr:nth-child(2)');
  await pg.waitForTimeout(150);
  igual(await pg.getAttribute('#lista-escolas tr.sel', 'data-escola'), segunda, 'Um clique numa linha selecciona-a, a tinta');
  igual(await pg.getAttribute('.c-previa', 'data-previa'), segunda, 'e a pré-visualização passa a ser a dela');
  await pg.click('[data-filtro="em_atraso"]');
  igual(await pg.locator('#lista-escolas tbody tr').count(), 2, 'O filtro «Em atraso» deixa só as que estão em atraso');
  await pg.click('[data-filtro="todas"]');
  await pg.fill('#c-filtro-texto', 'teste');
  await pg.waitForTimeout(100);
  igual(await pg.locator('#lista-escolas tbody tr').count(), 1, 'A procura encontra pelo nome curto');
  verdade(await pg.locator('#lista-escolas tr[data-escola="teste"].sel').count() === 1, 'e selecciona-a, com a pré-visualização ao lado');
  igual(await pg.getAttribute('.c-previa [data-ver-como="organizacao"]', 'href'), `${base}/?org=teste&demo=1`,
    'A pré-visualização tem «Ver como organização», com ?org=');
  igual(await pg.getAttribute('.c-previa [data-ver-como="aluno"]', 'href'), `${base}/?org=teste&ver=aluno&demo=1`,
    'e «Ver como aluno», já na vista do aluno');
  await pg.click('#lista-escolas tr[data-escola="teste"]');
  await pg.waitForTimeout(150);
  verdade(await pg.isVisible('[data-ficha="teste"]'), 'Clicar outra vez na linha seleccionada abre a ficha');
  igual(await pg.getAttribute('[data-ficha="teste"] .c-ficha-accoes [data-ver-como="aluno"]', 'href'), `${base}/?org=teste&ver=aluno&demo=1`,
    'A ficha também tem os dois «ver como»');

  /* 3. A ficha da Kingdom: a equipa não se mexe aqui, e não se suspende. */
  await ir('#/organizacoes/kingdom/equipa');
  contem(await texto('[data-ficha="kingdom"]'), 'Kingdom Academy', 'A ficha mostra o nome da marca dela');
  contem(await texto('#c-ficha-corpo'), 'Na Kingdom, a equipa gere-se no painel de gestão', 'Na Kingdom a equipa não se mexe aqui');
  await ir('#/organizacoes/kingdom/dados');
  igual(await pg.locator('#c-ficha-corpo [data-estado]').count(), 0, 'e a Kingdom não tem botão de suspender');

  /* 4. A ficha de uma escola com problemas: faturas, alunos, pagamento. */
  await ir('#/organizacoes/raizes/faturas');
  verdade(await pg.locator('#faturas-escola tbody tr').count() > 3, 'As faturas da escola, uma por mês');
  contem(await texto('#faturas-escola thead'), 'Valor (MZ)', 'com o símbolo uma vez, no cabeçalho');
  contem(await texto('#faturas-escola'), 'Falhou', 'e a última, que falhou');
  await ir('#/organizacoes/raizes/alunos');
  contem(await texto('#c-ficha-corpo'), 'Por curso', 'Os alunos: os números por curso');
  contem(await texto('#c-ficha-corpo'), 'números, não nomes', 'e a consola diz que não mostra nomes de alunos');
  await ir('#/organizacoes/raizes/pagamento');
  contem(await texto('.c-problema'), 'O cartão não tinha saldo suficiente', 'O pagamento diz porque falhou');
  contem(await texto('#c-ficha-corpo'), 'assinatura.pagamento_falhou', 'e os eventos do Payflow que chegaram');

  /* 5. Pagamentos: as contas a rever e as faturas de todas. */
  await ir('#/pagamentos');
  verdade(await pg.locator('[data-rever="raizes"]').count() === 1, 'Pagamentos: a escola em atraso está nas contas a rever');
  await pg.click('[data-faturas="falhadas"]');
  verdade(await pg.locator('#faturas-todas tbody tr').count() >= 2, 'O filtro das faturas que falharam');

  /* 6. Nova organização: o nome curto acompanha o nome; abre na ficha. */
  await pg.click('#btn-nova-escola');
  await pg.fill('#escola-nome', 'Escola de Liderança');
  igual(await pg.inputValue('#escola-slug'), 'escola-de-lideranca', 'O nome curto nasce do nome, sem acentos');
  await pg.fill('#escola-slug', 'teste');
  await pg.click('#btn-criar-escola');
  await pg.waitForTimeout(100);
  contem(await pg.textContent('#escola-erro'), 'Já existe uma escola', 'Um nome curto repetido é recusado, com o porquê');
  verdade(await pg.isVisible('#dlg-escola'), 'e o diálogo fica aberto para corrigir');
  await pg.fill('#escola-slug', 'lideranca');
  await pg.fill('#escola-dono-nome', 'Carla Exemplo');
  await pg.fill('#escola-dono-email', 'carla@exemplo.invalid');
  await pg.click('#btn-criar-escola');
  await pg.waitForTimeout(300);
  verdade(!(await pg.isVisible('#dlg-escola')), 'Criada, o diálogo fecha');
  verdade(await pg.isVisible('[data-ficha="lideranca"]'), 'e abre a ficha da organização nova');
  contem(await pg.textContent('#aviso-geral'), 'O convite seguiu para carla@exemplo.invalid', 'O aviso diz que o convite do dono seguiu');
  await ir('#/organizacoes/lideranca/equipa');
  contem(await texto('#c-ficha-corpo'), 'Convites por aceitar', 'com o convite do dono à espera');
  contem(await texto('#c-ficha-corpo'), 'Dono', 'como dono');

  /* 7. Convidar para a equipa: por omissão, administrador se já há dono. */
  await ir('#/organizacoes/teste/equipa');
  await pg.click('#c-ficha-corpo [data-convidar]');
  igual(await pg.inputValue('#convite-papel'), 'admin', 'Numa escola com dono, o convite sugere administrador');
  await pg.fill('#convite-email', 'nao-e-email');
  await pg.click('#btn-enviar-convite');
  contem(await pg.textContent('#convite-erro'), 'email válido', 'Um email inválido não sai');
  await pg.fill('#convite-email', 'diana@exemplo.invalid');
  await pg.click('#btn-enviar-convite');
  await pg.waitForTimeout(200);
  contem(await texto('#c-ficha-corpo'), 'diana@exemplo.invalid', 'O convite aparece na equipa');

  /* 8. Revogar o convite. */
  await pg.click('#c-ficha-corpo [data-revogar]');
  await pg.waitForTimeout(150);
  naoContem(await texto('#c-ficha-corpo'), 'diana@exemplo.invalid', 'Revogado, o convite sai da lista');

  /* 9. Mexer na equipa: mudar o papel e suspender. */
  await pg.selectOption('#c-ficha-corpo select[data-papel]', 'admin');
  await pg.waitForTimeout(150);
  igual(await pg.inputValue('#c-ficha-corpo select[data-papel]'), 'admin', 'O papel muda');
  await pg.click('#c-ficha-corpo [data-membro-estado]');
  await pg.waitForTimeout(150);
  contem(await texto('#c-ficha-corpo'), 'Suspenso', 'Suspender alguém da equipa fica à vista');

  /* 10. Domínio: inválido recusado; válido fica à espera do DNS. */
  await ir('#/organizacoes/lideranca/dados');
  await pg.click('#c-ficha-corpo [data-dominio]');
  await pg.fill('#dominio-valor', 'sem ponto');
  await pg.click('#form-dominio button[type=submit]');
  contem(await pg.textContent('#dominio-erro'), 'Domínio inválido', 'Um domínio inválido é recusado');
  await pg.fill('#dominio-valor', 'membros.lideranca.exemplo');
  await pg.click('#form-dominio button[type=submit]');
  await pg.waitForTimeout(150);
  /* Desde a W3, um domínio pedido só abre depois de verificado: até lá a
     escola abre com ?org= e a ficha diz que está à espera do DNS. */
  contem(await pg.getAttribute('[data-ficha="lideranca"] [data-ver-como="organizacao"]', 'href'), '?org=lideranca', 'Um domínio pedido ainda não abre a escola');
  contem(await texto('#c-ficha-corpo'), 'membros.lideranca.exemplo · à espera do DNS', 'e a ficha diz que está à espera do DNS');

  /* 11. Suspender e reactivar a organização. */
  await pg.click('#c-ficha-corpo [data-estado]');
  await pg.waitForTimeout(150);
  contem(await texto('[data-ficha="lideranca"] .meta'), 'Suspensa', 'A organização suspensa diz que está suspensa');
  await pg.click('#c-ficha-corpo [data-estado]');
  await pg.waitForTimeout(150);
  contem(await texto('[data-ficha="lideranca"] .meta'), 'Activa', 'e volta a activa');
  igual(pg.errosDeJs.join(' | '), '', 'Sem erros de JavaScript');
  await pg.close();

  /* 12. Quem não administra a plataforma não vê a consola. */
  const fora = await abrirPagina(navegador, `${B}&visitante=1`);
  verdade(await fora.isVisible('#ecra-sem-acesso'), 'Sem ser da administração, a consola diz que não é para si');
  igual(await fora.locator('#lista-escolas tbody tr').count(), 0, 'e não mostra organização nenhuma');
  await fora.close();

  /* 13. Sem sessão, pede a entrada. */
  const semSessao = await abrirPagina(navegador, `${B}&sem-sessao=1`);
  verdade(await semSessao.isVisible('#ecra-entrar'), 'Sem sessão, a consola pede a entrada');
  await semSessao.close();

  /* 14. No telemóvel, nenhum ecrã desliza para o lado. */
  const tel = await abrirPagina(navegador, B, { viewport: { width: 375, height: 800 } });
  for(const h of ['#/visao', '#/organizacoes', '#/organizacoes/raizes', '#/organizacoes/raizes/faturas', '#/organizacoes/teste/equipa', '#/pagamentos', '#/planos']){
    await tel.evaluate(h => { location.hash = h; }, h);
    await tel.waitForTimeout(150);
    const largura = await tel.evaluate(() => document.documentElement.scrollWidth);
    verdade(largura <= 375, `No telemóvel, ${h} cabe na largura (${largura}px)`);
  }
  verdade(await tel.isVisible('#c-tabbar'), 'e a navegação passa para a barra de baixo');
  await tel.close();
}
