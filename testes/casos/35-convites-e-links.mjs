import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Convites e links de inscrição: o convite dá cursos numa turma, uma assinatura ou acesso ilimitado; o link público inscreve, respeita o limite e arquiva-se';

/* Passo 5 da especificação «Convites, Assinaturas e Turmas» (Shelton,
   17/11/2026). O convite à mão deixa de ter duração própria e passa a dar
   uma de três coisas. O link de inscrição é um convite aberto: quem preenche
   a página pública recebe por email o link para entrar, e é ao entrar que o
   que o link dá vira acesso. Em demonstração, em memória (links e pessoas
   inventados de js/dados.js). A sério, a tabela academia.links_de_inscricao,
   public.link_de_inscricao, public.inscricao_registar e academia.aceitar_convite
   (migração academia_convites_e_links, provada numa transacção desfeita em 29
   verificações: limite com pedidos repetidos, membro suspenso, plano cheio). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ADMIN);
  const toast = async () => (await pg.locator('.toast').allInnerTexts()).join(' | ');
  const guardar = async () => { await pg.click('#drawer-guardar'); await pg.waitForTimeout(450); };
  const visivel = sel => pg.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('.hidden'); }, sel);
  const convites = () => pg.evaluate(() => irPara('admin-convites')).then(() => pg.waitForTimeout(300));
  /* Entrar com outra conta: a demonstração guarda tudo no browser. */
  const entrar = async email => {
    await pg.goto(`${base}/index.html?demo=1`);
    await pg.waitForTimeout(400);
    if(!(await pg.isVisible('#input-email'))){ await pg.evaluate(() => sairDaConta()); await pg.waitForTimeout(600); }
    await pg.fill('#input-email', email);
    await pg.fill('#input-password', '1');
    await pg.click('#form-login button[type=submit]');
    await pg.waitForTimeout(600);
    await pg.evaluate(() => { const m = document.getElementById('onboarding'); if(m) m.remove(); });
  };
  const paginaPublica = async codigo => { await pg.goto(`${base}/index.html?demo=1&inscricao=${codigo}`); await pg.waitForTimeout(500); };
  const inscrever = async (nome, email, telefone) => {
    await pg.fill('#inscricao-nome', nome);
    await pg.fill('#inscricao-email', email);
    await pg.fill('#inscricao-telefone', telefone || '');
    await pg.click('#inscricao-enviar');
    await pg.waitForTimeout(400);
  };

  /* ---------- O convite à mão: três modalidades, sem duração própria ---------- */
  await convites();
  contem(await pg.innerText('#content-admin .int-abas'), 'Convites por email', 'O ecrã dos Convites tem dois separadores');
  contem(await pg.innerText('#content-admin .int-abas'), 'Links de inscrição', 'os convites por email e os links de inscrição');

  await pg.click('#btn-novo-convite');
  await pg.waitForTimeout(300);
  igual(await pg.inputValue('#valor-modalidade'), 'cursos', 'Um convite novo dá cursos');
  igual(await pg.locator('#valor-acessoDias').count(), 0, 'e já não tem duração própria');
  await pg.fill('#valor-email', 'assina.ensaio@exemplo.invalid');
  await pg.selectOption('#valor-modalidade', 'assinatura');
  verdade(await visivel('#valor-nivelId'), 'Para dar uma assinatura, escolhe-se qual');
  falso(await visivel('#valor-cursos'), 'e os cursos deixam de se escolher');
  await pg.selectOption('#valor-nivelId', 'essencial');
  await guardar();
  const c1 = await pg.evaluate(() => DB.convites[0]);
  igual(`${c1.niveis.join(',')}/${c1.cursos.length}/${c1.ilimitado}`, 'essencial/0/false', 'O convite guarda só a assinatura');
  const linha1 = await pg.innerText(`tr[data-convite="${c1.id}"]`);
  contem(linha1, 'Assinatura Essencial', 'A linha diz que assinatura dá');
  contem(linha1, 'Acesso 15 dias', 'e por quanto tempo: o trial dela');

  await pg.click('#btn-novo-convite');
  await pg.waitForTimeout(300);
  await pg.fill('#valor-email', 'tudo.ensaio@exemplo.invalid');
  await pg.selectOption('#valor-modalidade', 'ilimitado');
  verdade(await visivel('#aviso-ilimitado'), 'O acesso ilimitado diz o que é');
  falso(await visivel('#valor-cursos') || await visivel('#valor-nivelId'), 'e não pede cursos nem assinatura');
  await guardar();
  const c2 = await pg.evaluate(() => DB.convites[0]);
  igual(`${c2.ilimitado}/${c2.cursos.length}/${c2.niveis.length}`, 'true/0/0', 'O convite guarda só o acesso ilimitado');
  contem(await pg.innerText(`tr[data-convite="${c2.id}"]`), 'Acesso ilimitado', 'e a linha di-lo');

  /* ---------- Os links de inscrição, no painel ---------- */
  await pg.click('[data-aba-convites="links"]');
  await pg.waitForTimeout(300);
  const linhas = () => pg.locator('#content-admin tr[data-link]').count();
  igual(await linhas(), 2, 'O separador mostra os links ativos');
  const lk1 = await pg.innerText('tr[data-link="lk1"]');
  contem(lk1, 'Aula aberta: Mentalidade Inquebrável', 'Cada linha diz o título');
  contem(lk1, 'acesso ao curso completo', 'a descrição');
  naoContem(lk1, '**', 'sem as marcas do negrito');
  contem(lk1, 'Mentalidade Inquebrável', 'o que dá');
  contem(lk1, '0 inscritos de 50', 'e quantos se inscreveram, do limite');
  contem(await pg.inputValue('tr[data-link="lk1"] .link-endereco input'), 'inscricao=GmY4RG', 'O endereço para divulgar leva o código do link');
  contem(await pg.innerText('tr[data-link="lk2"]'), 'Assinatura Essencial', 'Um link pode dar uma assinatura');
  await pg.click('[data-links-arquivados="sim"]');
  await pg.waitForTimeout(250);
  igual(await linhas(), 1, 'Os arquivados ficam num separador à parte');
  contem(await pg.innerText('tr[data-link="lk3"]'), 'Acesso ilimitado', 'ou acesso ilimitado');
  await pg.click('[data-links-arquivados="nao"]');
  await pg.waitForTimeout(250);

  /* Criar um link: cursos numa turma, com limite e WhatsApp obrigatório. */
  await pg.click('#btn-novo-link');
  await pg.waitForTimeout(300);
  await guardar();
  contem(await toast(), 'Preencha o campo "Título"', 'Um link sem título é recusado');
  await pg.fill('#valor-titulo', 'Tracktion: turma de novembro');
  await guardar();
  contem(await toast(), 'pelo menos um curso', 'e um link de cursos sem cursos também');
  await pg.fill('#valor-limite', '1');
  await pg.fill('#valor-descricao', 'Entre na **turma de novembro**. Veja [o programa](https://exemplo.invalid/programa).');
  await pg.click('#valor-telefoneObrigatorio');
  await pg.click('#valor-cursos label:has(input[value="kt"])');
  await pg.selectOption('select[data-oferta-turma="kt"]', 't-kt-90');
  contem(await pg.innerText('[data-oferta-turma-linha="kt"]'), 'Acesso 90 dias', 'O formulário diz o prazo da turma escolhida');
  await guardar();
  falso(await pg.isVisible('#drawer-overlay'), 'Com tudo certo, o link guarda-se');
  igual(await linhas(), 3, 'e entra na lista');
  const novo = await pg.evaluate(() => DB.linksDeInscricao.find(l => l.titulo === 'Tracktion: turma de novembro'));
  verdade(/^[A-HJ-NP-Za-km-z2-9]{6}$/.test(novo.codigo), `Ganha um código de seis caracteres (${novo.codigo})`);
  igual(`${novo.modalidade}/${novo.cursos.join(',')}/${JSON.stringify(novo.turmas)}/${novo.limite}/${novo.telefoneObrigatorio}`,
        'cursos/kt/{"kt":"t-kt-90"}/1/true', 'e guarda o curso, a turma, o limite e o WhatsApp obrigatório');
  contem(await pg.innerText(`tr[data-link="${novo.id}"]`), 'Kingdom Tracktion (Turma 90 dias)', 'A linha diz a turma em que entrega');

  /* Editar não muda o código (é o endereço já divulgado). */
  await pg.click(`[data-editar-link="${novo.id}"]`);
  await pg.waitForTimeout(300);
  igual(await pg.inputValue('select[data-oferta-turma="kt"]'), 't-kt-90', 'Ao editar, a turma vem escolhida');
  await pg.fill('#valor-titulo', 'Tracktion: turma de dezembro');
  await guardar();
  igual(await pg.evaluate(id => DB.linksDeInscricao.find(l => l.id === id).codigo, novo.id), novo.codigo, 'Editar um link não lhe muda o código');

  /* ---------- A página pública ---------- */
  await paginaPublica(novo.codigo);
  falso(await pg.isVisible('#app-shell') || await pg.isVisible('#view-login'), 'A página pública abre sem a navegação da área de membros');
  const cartao = await pg.innerText('.inscricao-cartao');
  contem(cartao, 'Tracktion: turma de dezembro', 'Mostra o título do link');
  igual(await pg.innerText('.inscricao-descricao strong'), 'turma de novembro', 'a descrição com o negrito');
  igual(await pg.getAttribute('.inscricao-descricao a', 'href'), 'https://exemplo.invalid/programa', 'e os links');
  igual(await pg.inputValue('#inscricao-pais'), '+258', 'O indicativo começa em Moçambique');
  contem(await pg.innerText('#inscricao-captcha'), 'Verificado', 'e a verificação anti-robô está feita');
  naoContem(cartao, '(opcional)', 'Com o WhatsApp obrigatório, o campo não diz que é opcional');

  await inscrever('', 'ana.ensaio@exemplo.invalid', '840000001');
  contem(await pg.innerText('#inscricao-aviso'), 'Escreva o seu nome', 'Sem nome, não se inscreve');
  await inscrever('Ana Ensaio', 'nao-e-email', '840000001');
  contem(await pg.innerText('#inscricao-aviso'), 'não parece válido', 'nem com um email que não é email');
  await inscrever('Ana Ensaio', 'ana.ensaio@exemplo.invalid', '');
  contem(await pg.innerText('#inscricao-aviso'), 'WhatsApp', 'nem sem o WhatsApp, quando é obrigatório');
  await inscrever('Ana   Ensaio', 'Ana.Ensaio@exemplo.invalid', '84 000 0001');
  contem(await pg.innerText('#inscricao-sucesso'), 'ana.ensaio@exemplo.invalid', 'Com tudo certo, diz que o link para entrar seguiu por email');
  const insc = await pg.evaluate(id => DB.convites.find(c => c.linkId === id), novo.id);
  igual(`${insc.origem}/${insc.nome}/${insc.telefone}/${insc.cursos.join(',')}/${JSON.stringify(insc.turmas)}/${insc.estado}`,
        'link/Ana Ensaio/+258840000001/kt/{"kt":"t-kt-90"}/enviado', 'A inscrição fica gravada como um convite que nasceu do link');
  falso(await pg.evaluate(() => DB.membros.some(m => m.email === 'ana.ensaio@exemplo.invalid')), 'Ainda não é membro: só ao abrir o email');

  /* Chegado o limite, a página fecha. */
  await paginaPublica(novo.codigo);
  contem(await pg.innerText('#inscricao-fechado'), 'esgotaram', 'Chegado o limite, a página diz que as inscrições esgotaram');
  igual(await pg.locator('#form-inscricao').count(), 0, 'e já não mostra o formulário');

  /* A mesma pessoa outra vez, num link com vagas, não gasta outra. */
  await paginaPublica('GmY4RG');
  await inscrever('Bruno Ensaio', 'bruno.ensaio@exemplo.invalid', '840000002');
  await paginaPublica('GmY4RG');
  await inscrever('Bruno Ensaio', 'bruno.ensaio@exemplo.invalid', '840000002');
  verdade(await pg.isVisible('#inscricao-sucesso'), 'Quem já se inscreveu pode pedir o link outra vez');
  igual(await pg.evaluate(() => DB.convites.filter(c => c.linkId === 'lk1').length), 1, 'sem gastar outra vaga');

  /* Quem a escola suspendeu não reabre por um link; a resposta é a de sempre. */
  await pg.evaluate(() => { DB.membros.find(m => m.id === 'm4').acesso = 'bloqueado'; guardarDB(); });
  await paginaPublica('Kp7TnW');
  contem(await pg.innerText('.inscricao-cartao'), '(opcional)', 'Num link sem WhatsApp obrigatório, o campo diz que é opcional');
  await inscrever('Renato Cossa', 'renato.cossa@exemplo.co.mz', '');
  verdade(await pg.isVisible('#inscricao-sucesso'), 'A página responde o mesmo a um membro suspenso');
  falso(await pg.evaluate(() => DB.convites.some(c => c.email === 'renato.cossa@exemplo.co.mz' && c.origem === 'link')), 'mas não grava inscrição nenhuma');
  /* Uma aluna que já é membro inscreve-se no link da assinatura. */
  await paginaPublica('Kp7TnW');
  await inscrever('Marta Lopes', ALUNA, '');
  verdade(await pg.isVisible('#inscricao-sucesso'), 'Quem já é membro também se pode inscrever');

  /* Em inglês. */
  await paginaPublica('GmY4RG');
  await pg.click('#inscricao-idioma [data-idioma="en"]');
  await pg.waitForTimeout(200);
  contem(await pg.innerText('#inscricao-enviar'), 'Accept invitation', 'A página pública também fala inglês');
  await pg.click('#inscricao-idioma [data-idioma="pt"]');
  await pg.waitForTimeout(200);

  /* No telemóvel. */
  await pg.setViewportSize({ width:390, height:844 });
  await paginaPublica('GmY4RG');
  const largura = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('view-inscricao').scrollWidth));
  verdade(largura <= 390, `A página pública cabe no telemóvel (${largura}px)`);
  await pg.setViewportSize({ width:1280, height:900 });

  /* Um código que não existe. */
  await paginaPublica('zzzzzz');
  contem(await pg.innerText('#inscricao-fechado'), 'não existe', 'Um código que não existe diz que o convite não está disponível');

  /* ---------- Entrar: é aí que a inscrição vira acesso ---------- */
  await entrar('ana.ensaio@exemplo.invalid');
  const ana = await pg.evaluate(() => {
    const m = DB.membros.find(x => x.email === 'ana.ensaio@exemplo.invalid');
    const a = m && (m.acessos || []).find(x => x.curso === 'kt');
    const dias = a && a.expira ? Math.round((new Date(a.expira) - new Date(hojeISO())) / 864e5) : null;
    return m ? `${m.papel}/${a ? a.turma : '-'}/${dias}/${m.telefone}` : 'não é membro';
  });
  igual(ana, 'aluno/t-kt-90/90/+258840000001', 'Quem entra fica matriculado na turma do link, pelo prazo dela, e com o telefone que deu');
  igual(await pg.evaluate(() => DB.convites.find(c => c.email === 'ana.ensaio@exemplo.invalid').estado), 'aceite', 'e a inscrição fica aceite');

  await entrar(ALUNA);
  const marta = await pg.evaluate(() => {
    const m = DB.membros.find(x => x.id === 'm1');
    const s = (m.assinaturas || []).find(x => x.nivel === 'essencial');
    return s ? `${s.estado}/${Math.round((new Date(s.expira) - new Date(hojeISO())) / 864e5)}/${m.telefone}` : 'sem assinatura';
  });
  igual(marta, 'ativo/15/+258 84 000 0001', 'Quem já era membro recebe a assinatura pelo trial dela, e fica com o telefone que já tinha');

  await entrar('assina.ensaio@exemplo.invalid');
  igual(await pg.evaluate(() => {
    const m = DB.membros.find(x => x.email === 'assina.ensaio@exemplo.invalid');
    return (m.assinaturas || []).map(s => s.nivel + ':' + s.estado).join(',') + '/' + (m.acessos || []).length;
  }), 'essencial:ativo/0', 'O convite à mão de assinatura dá a assinatura, e nenhum curso avulso');
  await entrar('tudo.ensaio@exemplo.invalid');
  igual(await pg.evaluate(() => DB.membros.find(x => x.email === 'tudo.ensaio@exemplo.invalid').ilimitado), true, 'O convite à mão de acesso ilimitado dá acesso ilimitado');

  /* ---------- De volta ao painel: os inscritos, arquivar e reverter ---------- */
  await entrar(ADMIN);
  await convites();
  await pg.click('[data-aba-convites="links"]');
  await pg.waitForTimeout(300);
  const linhaNova = await pg.innerText(`tr[data-link="${novo.id}"]`);
  contem(linhaNova, '1 inscrito de 1', 'A lista conta os inscritos do link');
  contem(linhaNova, '1 já entrou', 'quantos já entraram');
  contem(linhaNova, 'Esgotado', 'e avisa que o link esgotou');
  await pg.click(`[data-inscritos-do-link="${novo.id}"]`);
  await pg.waitForTimeout(300);
  contem(await pg.innerText('#convites-filtro-link'), 'Tracktion: turma de dezembro', '«N inscritos» leva aos convites que nasceram do link');
  igual(await pg.locator('#content-admin tr[data-convite]').count(), 1, 'e só a esses');
  contem(await pg.innerText(`tr[data-convite="${insc.id}"]`), 'Inscrição', 'A origem diz que veio de uma inscrição');
  await pg.click('#btn-limpar-filtro-link');
  await pg.waitForTimeout(250);
  verdade(await pg.locator('#content-admin tr[data-convite]').count() > 1, '«Ver todos» volta a mostrar todos os convites');

  await pg.click('[data-aba-convites="links"]');
  await pg.waitForTimeout(250);
  await pg.click('[data-arquivar-link="lk1"]');
  await pg.waitForTimeout(200);
  contem(await pg.innerText('.modal-overlay.confirmacao'), 'fica com o que recebeu', 'Arquivar avisa que quem se inscreveu não perde nada');
  await pg.click('.modal-overlay [data-confirmar]');
  await pg.waitForTimeout(400);
  igual(await pg.locator('tr[data-link="lk1"]').count(), 0, 'Arquivado, o link sai dos ativos');
  igual(await pg.locator('[data-apagar-link], [data-apagar]').count(), 0, 'Não há botão de apagar: arquiva-se');
  await paginaPublica('GmY4RG');
  contem(await pg.innerText('#inscricao-fechado'), 'já não está disponível', 'e a página pública deixa de aceitar inscrições');
  await entrar(ADMIN);
  await convites();
  await pg.click('[data-aba-convites="links"]');
  await pg.waitForTimeout(250);
  await pg.click('[data-links-arquivados="sim"]');
  await pg.waitForTimeout(250);
  await pg.click('[data-repor-link="lk1"]');
  await pg.waitForTimeout(400);
  igual(await pg.locator('tr[data-link="lk1"]').count(), 0, 'Revertido, sai dos arquivados');
  await paginaPublica('GmY4RG');
  verdade(await pg.isVisible('#form-inscricao'), 'e a página volta a aceitar inscrições');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
