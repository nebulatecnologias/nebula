import { abrirPagina, ADMIN } from '../util.mjs';

export const nome = 'Biblioteca de vídeos: ligar o Panda, escolher na aula, criar várias aulas de uma vez e a duração nas listas';

/* Pedidos do Shelton a 19/10 e 24/10/2026: a biblioteca inteira do Panda na
   academia, escola a escola; o separador Vídeo abre já com os vídeos; o Embed
   passa a separador ao lado do Quiz; escolhem-se vários vídeos para criar as
   aulas de um módulo; a duração sai do formulário e aparece nas listas só
   quando existe. Em demonstração (?demo=1), uma biblioteca inventada em
   memória (js/panda.js). A sério, a Edge Function panda-video fala com o
   Panda e a chave fica no Vault, provadas numa transacção desfeita. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  await pg.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await pg.goto(`${base}/index.html?demo=1`);
  await pg.waitForTimeout(300);
  await pg.fill('#input-email', ADMIN);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('onboarding')?.remove());

  const abrirAula = () => pg.evaluate(() => {
    const c = DB.cursos[0], m = c.modulos[0];
    abrirFormAula(c.id, m.id, m.aulas[0].id);
  });
  const abaVideo = async () => { await pg.click('#editor-abas button[data-aba="video"]'); await pg.waitForTimeout(300); };

  /* 1. O formulário: sem duração; Embed ao lado do Quiz; sem Panda, convida a ligá-lo. */
  await abrirAula();
  await pg.waitForTimeout(200);
  igual(await pg.locator('#a-duracao').count(), 0, 'A duração já não é um campo do formulário');
  naoContem(await pg.textContent('#content-admin'), 'Vem do próprio vídeo', 'nem o texto que a explicava');
  const abas = await pg.$$eval('#editor-abas button', b => b.map(x => x.dataset.aba));
  igual(abas.join(','), 'texto,video,ficheiros,quiz,embed', 'O Embed é um formato de conteúdo, ao lado do Quiz');
  await abaVideo();
  verdade(await pg.isVisible('#btn-panda-ligar'), 'Sem biblioteca ligada, o separador Vídeo diz como a ligar');
  await pg.click('[data-ir-aba="embed"]');
  await pg.waitForTimeout(200);
  verdade(await pg.isVisible('#a-embed'), 'e leva ao Embed para colar um código');

  /* 2. Integrações › Panda: uma chave errada não passa; uma certa liga. */
  await pg.evaluate(() => irPara('admin-integracoes'));
  await pg.waitForTimeout(300);
  await pg.click('[data-int-aba="disponiveis"]');
  await pg.click('.int-cartao[data-int-abrir="panda"]');
  await pg.waitForTimeout(150);
  await pg.fill('#int-panda-chave', 'curta');
  await pg.click('#int-panda-ligar');
  await pg.waitForTimeout(200);
  contem(await pg.textContent('.int-aviso'), 'não aceitou a chave', 'Uma chave que o Panda recusa não fica guardada');
  await pg.fill('#int-panda-chave', 'panda-' + 'a1b2c3d4'.repeat(4));
  await pg.click('#int-panda-ligar');
  await pg.waitForTimeout(200);
  contem(await pg.textContent('.int-aviso'), 'Panda ligado', 'Uma chave certa liga o Panda');
  contem(await pg.textContent('.int-estado'), '····c3d4', 'e só o fim da chave fica à vista');

  /* 3. A aula: o separador Vídeo abre já com a biblioteca. */
  await abrirAula();
  await pg.waitForTimeout(200);
  await abaVideo();
  verdade(await pg.isVisible('.panda-bib'), 'O separador Vídeo mostra logo a biblioteca, sem botão para a abrir');
  igual(await pg.locator('.panda-grelha .panda-video').count(), 7, 'com todos os vídeos da conta');
  igual(await pg.locator('.panda-provedores').count(), 0, 'Com um só provedor ligado, não há escolha de provedor');
  await pg.click('.panda-pastas button:has-text("Módulo 1")');
  await pg.waitForTimeout(200);
  igual(await pg.locator('.panda-grelha .panda-video').count(), 3, 'Uma pasta mostra só os vídeos dela');
  igual(await pg.locator('.panda-grelha .panda-video:disabled').count(), 1, 'Um vídeo ainda a converter não se pode escolher');
  await pg.fill('.panda-bib [data-panda-procura]', 'encontro');
  await pg.waitForTimeout(600);
  igual(await pg.locator('.panda-grelha .panda-video').count(), 2, 'A procura corre a biblioteca inteira, não só a pasta');

  await pg.click('.panda-video:has-text("Encontro de março")');
  await pg.waitForTimeout(300);
  contem(await pg.textContent('.video-atual'), 'Encontro de março', 'O vídeo escolhido aparece como o vídeo desta aula');
  contem(await pg.textContent('.video-atual'), '1:02:00', 'com a duração que veio do Panda');
  verdade(await pg.locator('.panda-video.escolhido').count() === 1, 'e vem marcado na biblioteca');
  await pg.click('#btn-guardar-aula');
  await pg.waitForTimeout(300);
  const gravada = await pg.evaluate(() => DB.cursos[0].modulos[0].aulas[0]);
  contem(gravada.embed, 'pandavideo.com.br/embed/?v=demo6', 'Guardar grava o endereço do leitor do Panda');
  igual(gravada.duracao, '1:02:00', 'e a duração, sem ninguém a escrever');

  /* 4. Vários de uma vez, no formulário da aula. */
  const antes = await pg.evaluate(() => DB.cursos[0].modulos[1].aulas.length);
  await abrirAula();
  await pg.waitForTimeout(200);
  await abaVideo();
  await pg.click('[data-panda-varios]');
  await pg.waitForTimeout(150);
  await pg.click('.panda-video:has-text("O mapa do programa")');
  await pg.click('.panda-video:has-text("Boas-vindas")');
  contem(await pg.textContent('.panda-acao'), '2 vídeos escolhidos', 'A barra conta os vídeos escolhidos');
  igual(await pg.textContent('.panda-video.marcado:has-text("Boas-vindas") .panda-ordem'), '2', 'e cada um mostra a ordem em que fica');
  await pg.selectOption('[data-panda-modulo]', await pg.evaluate(() => DB.cursos[0].modulos[1].id));
  await pg.click('[data-panda-criar]');
  await pg.waitForTimeout(400);
  const modulo2 = await pg.evaluate(() => DB.cursos[0].modulos[1].aulas.slice(-2).map(a => ({ titulo:a.titulo, duracao:a.duracao, embed:a.embed })));
  igual(await pg.evaluate(() => DB.cursos[0].modulos[1].aulas.length), antes + 2, 'Criar faz uma aula por vídeo no módulo escolhido');
  igual(modulo2.map(a => a.titulo).join(' | '), 'O mapa do programa | Boas-vindas à academia', 'pela ordem da escolha, e sem o «.mp4» no título');
  igual(modulo2.map(a => a.duracao).join(' | '), '06:52 | 03:04', 'cada uma com a duração do seu vídeo');

  /* 5. Vários de uma vez, a partir do editor do curso. */
  await pg.evaluate(() => irPara('admin-curso-editor', DB.cursos[0].id));
  await pg.waitForTimeout(400);
  const m3 = await pg.evaluate(() => DB.cursos[0].modulos[2].id);
  const antes3 = await pg.evaluate(() => DB.cursos[0].modulos[2].aulas.length);
  await pg.click(`[data-aulas-biblioteca="${m3}"]`);
  await pg.waitForTimeout(400);
  verdade(await pg.isVisible('.panda-janela [data-panda-varios][aria-pressed="true"]'), 'O editor do curso abre a biblioteca já a escolher vários');
  igual(await pg.inputValue('.panda-janela [data-panda-modulo]'), m3, 'com o módulo de onde se carregou');
  await pg.click('.panda-janela .panda-video:has-text("Encontro de abril")');
  await pg.click('.panda-janela [data-panda-criar]');
  await pg.waitForTimeout(400);
  falso(await pg.isVisible('.panda-janela'), 'Criar fecha a janela');
  igual(await pg.evaluate(() => DB.cursos[0].modulos[2].aulas.length), antes3 + 1, 'e a aula entra no módulo');

  /* 6. A duração nas listas: só quando existe. */
  await pg.evaluate(() => { const a = DB.cursos[0].modulos[0].aulas[1]; a.embed = ''; a.duracao = '00:00'; irPara('admin-curso-editor', DB.cursos[0].id); });
  await pg.waitForTimeout(300);
  naoContem(await pg.textContent('#lista-modulos-admin'), '--:--', 'Uma aula sem duração não mostra «--:--»');
  const semDuracao = await pg.evaluate(() => {
    const id = DB.cursos[0].modulos[0].aulas[1].id;
    return document.querySelector(`[data-editar-aula="${id}"] .aula-duracao`) === null;
  });
  verdade(semDuracao, 'nem um campo de duração vazio');
  contem(await pg.textContent(`[data-editar-aula="${gravada.id}"]`), '1:02:00', 'A aula com vídeo mostra a duração real dele');

  /* 7. No telemóvel, as pastas passam a uma lista e a biblioteca cabe no ecrã. */
  await pg.setViewportSize({ width: 390, height: 800 });
  await abrirAula();
  await pg.waitForTimeout(200);
  await abaVideo();
  verdade(await pg.isVisible('.panda-bib [data-panda-movel]'), 'No telemóvel, as pastas são uma lista de escolha');
  const largura = await pg.evaluate(() => document.querySelector('.panda-bib').getBoundingClientRect().right);
  verdade(largura <= 390, 'e a biblioteca cabe no ecrã');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
