import { abrirPagina, ADMIN } from '../util.mjs';

export const nome = 'Panda Video: a escola liga a conta e escolhe o vídeo da aula na biblioteca';

/* Pedido do Shelton a 19/10/2026: deixar de colar códigos de incorporação e
   ter a biblioteca inteira do Panda dentro da academia, escola a escola. Em
   demonstração (?demo=1), uma biblioteca inventada em memória (js/panda.js).
   A sério, a Edge Function panda-video fala com o Panda, e a chave fica no
   Vault (academia.panda_quem_sou, public.escola_panda_chave/guardar),
   provadas numa transacção desfeita. */
export default async function ({ navegador, base, igual, verdade, falso, contem }){
  const pg = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  await pg.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await pg.goto(`${base}/index.html?demo=1`);
  await pg.waitForTimeout(300);
  await pg.fill('#input-email', ADMIN);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('onboarding')?.remove());

  /* 1. Sem o Panda ligado, a aula convida a ligá-lo. */
  await pg.evaluate(() => { DB.config.integracoes.player = 'Panda Video'; });
  const abrirAula = () => pg.evaluate(() => {
    const c = DB.cursos[0], m = c.modulos[0];
    abrirFormAula(c.id, m.id, m.aulas[0].id);
  });
  await abrirAula();
  await pg.waitForTimeout(200);
  await pg.click('#editor-abas button[data-aba="video"]');
  await pg.waitForTimeout(200);
  verdade(await pg.isVisible('#btn-panda-ligar'), 'Sem o Panda ligado, o separador Vídeo mostra como o ligar');
  falso(await pg.isVisible('#btn-panda-biblioteca'), 'e não oferece uma biblioteca que ainda não existe');

  /* 2. Integrações › Panda: uma chave errada não passa; uma certa liga. */
  await pg.click('#btn-panda-ligar');
  await pg.waitForTimeout(300);
  await pg.click('[data-int-aba="disponiveis"]');
  await pg.click('.int-cartao[data-int-abrir="panda"]');
  await pg.waitForTimeout(150);
  verdade(await pg.isVisible('#int-form-panda'), 'A ficha do Panda pede a chave da API');
  contem(await pg.textContent('[data-int-ficha="panda"]'), 'Configurações › Avançado › Chave da API', 'e diz onde a copiar no Panda');
  await pg.fill('#int-panda-chave', 'curta');
  await pg.click('#int-panda-ligar');
  await pg.waitForTimeout(200);
  contem(await pg.textContent('.int-aviso'), 'não aceitou a chave', 'Uma chave que o Panda recusa não fica guardada');
  await pg.fill('#int-panda-chave', 'panda-' + 'a1b2c3d4'.repeat(4));
  await pg.click('#int-panda-ligar');
  await pg.waitForTimeout(200);
  contem(await pg.textContent('.int-aviso'), 'Panda ligado', 'Uma chave certa liga o Panda');
  contem(await pg.textContent('.int-estado'), '····c3d4', 'e só o fim da chave fica à vista');
  await pg.click('[data-int-voltar]');
  await pg.click('[data-int-aba="instaladas"]');
  verdade(await pg.locator('[data-int-instalada="panda"]').count() === 1, 'O Panda passa às instaladas');

  /* 3. A aula: a biblioteca, as pastas, a procura e a escolha. */
  await abrirAula();
  await pg.waitForTimeout(200);
  await pg.click('#editor-abas button[data-aba="video"]');
  await pg.waitForTimeout(200);
  await pg.click('#btn-panda-biblioteca');
  await pg.waitForTimeout(300);
  verdade(await pg.isVisible('.panda-janela'), 'Escolher do Panda abre a biblioteca');
  igual(await pg.locator('.panda-grelha .panda-video').count(), 7, 'Todos os vídeos da conta');
  contem(await pg.textContent('.panda-pastas'), 'Módulo 1 · Fundamentos', 'As pastas do Panda aparecem, com as subpastas');

  await pg.click('.panda-pastas button:has-text("Módulo 1")');
  await pg.waitForTimeout(200);
  igual(await pg.locator('.panda-grelha .panda-video').count(), 3, 'Uma pasta mostra só os vídeos dela');
  igual(await pg.locator('.panda-grelha .panda-video:disabled').count(), 1, 'Um vídeo ainda a converter não se pode escolher');

  await pg.fill('#panda-procura', 'encontro');
  await pg.waitForTimeout(600);
  igual(await pg.locator('.panda-grelha .panda-video').count(), 2, 'A procura corre a biblioteca inteira, não só a pasta');

  await pg.click('.panda-video:has-text("Encontro de março")');
  await pg.waitForTimeout(300);
  falso(await pg.isVisible('.panda-janela'), 'Escolher fecha a biblioteca');
  contem(await pg.inputValue('#a-embed'), 'pandavideo.com.br/embed/?v=demo6', 'A aula fica com o endereço do leitor do Panda');
  igual(await pg.getAttribute('#a-duracao', 'data-duracao'), '1:02:00', 'e a duração vem com o vídeo, sem cronometrar nada');
  contem(await pg.textContent('#btn-panda-biblioteca'), 'Trocar vídeo', 'Depois de escolhido, o botão diz que se pode trocar');

  /* 4. Escape fecha; no telemóvel as pastas passam a uma lista. */
  await pg.click('#btn-panda-biblioteca');
  await pg.waitForTimeout(200);
  verdade(await pg.locator('.panda-video.escolhido').count() === 1, 'O vídeo desta aula vem marcado');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(100);
  falso(await pg.isVisible('.panda-janela'), 'Escape fecha a biblioteca');
  await pg.setViewportSize({ width: 390, height: 800 });
  await pg.click('#btn-panda-biblioteca');
  await pg.waitForTimeout(300);
  verdade(await pg.isVisible('#panda-pasta-movel'), 'No telemóvel, as pastas são uma lista de escolha');
  const largura = await pg.evaluate(() => document.querySelector('.panda-janela').getBoundingClientRect().width);
  verdade(largura <= 390, 'e a biblioteca cabe no ecrã');
  await pg.keyboard.press('Escape');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
