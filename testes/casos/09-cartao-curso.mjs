import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Cartão do curso: capa, descrição, duração, avaliação e facilitador';

/* Pedido do Shelton a 27/09/2026: o cartão do curso como o de uma oferta,
   sem preço, só com o que interessa ao aluno. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ALUNA);
  await pg.evaluate(() => {
    DB.avaliacoes = [
      { id:'t1', cursoId:'kt', estrelas:5, oculto:false },
      { id:'t2', cursoId:'kt', estrelas:4, oculto:false },
      { id:'t3', cursoId:'kt', estrelas:1, oculto:true }       // escondida pela moderação: não conta
    ];
    irPara('catalogo');
  });
  await pg.waitForTimeout(250);

  const kt = await pg.evaluate(() => {
    const c = document.querySelector('#catalogo-grid .course-card[data-curso="kt"]');
    return c ? { texto: c.innerText, capa: !!c.querySelector('.course-cover'), desc: c.querySelector('.course-desc').innerText,
                 barra: !!c.querySelector('.course-progresso .progress-track') } : null;
  });
  verdade(kt, 'O cartão do Kingdom Tracktion está em Meus cursos');
  verdade(kt.capa, 'Tem capa');
  verdade(kt.desc.length > 10, 'Tem a descrição do curso');
  contem(kt.texto, 'Carla Mendes', 'Diz quem dá o curso');
  contem(kt.texto, '4,5', 'A avaliação é a média das visíveis, em pt-PT (5 e 4 dão 4,5; a escondida não conta)');
  contem(kt.texto, '(2)', 'E de quantas avaliações vem');
  naoContem(kt.texto, 'MZ', 'O cartão do curso não tem preço');

  /* Progresso: só depois de começar. */
  const semComecar = await pg.evaluate(() => {
    const c = DB.cursos.find(x => detalhesDoCartaoHTML && x.id === 'he');
    const p = progressoCurso(c);
    return { concluidas: p.concluidas, temBarra: detalhesDoCartaoHTML(c, p).includes('progress-track') };
  });
  igual(semComecar.temBarra, semComecar.concluidas > 0, 'A barra de progresso só aparece depois de começar o curso');

  /* Sem avaliações, nada de "0,0". */
  const semNotas = await pg.evaluate(() => avaliacaoDoCurso('curso-sem-notas'));
  igual(semNotas, null, 'Um curso sem avaliações não mostra nota nenhuma (0,0 leria-se como má)');

  /* A duração vem das aulas, que vem do leitor. */
  const comDuracao = await pg.evaluate(() => {
    const c = JSON.parse(JSON.stringify(DB.cursos.find(x => x.id === 'kt')));
    c.modulos.forEach(m => m.aulas.forEach(a => a.duracao = '10:00'));
    return detalhesDoCartaoHTML(c, { concluidas:0, total:1, pct:0 });
  });
  contem(comDuracao, '2h', 'A duração é a soma das aulas');

  /* No telemóvel a descrição continua lá (o Shelton pediu-a). */
  await pg.setViewportSize({ width:390, height:844 });
  await pg.waitForTimeout(200);
  const descVisivel = await pg.evaluate(() => getComputedStyle(document.querySelector('#catalogo-grid .course-desc')).display !== 'none');
  verdade(descVisivel, 'No telemóvel o cartão continua a mostrar a descrição');

  /* A página do curso diz o facilitador. */
  await pg.setViewportSize({ width:1280, height:900 });
  await pg.evaluate(() => irPara('curso', 'kt'));
  await pg.waitForTimeout(250);
  contem(await pg.innerText('#content-curso .curso-hero'), 'Com Carla Mendes', 'A página do curso diz quem o dá');
  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();

  /* O painel escreve o facilitador. */
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => { irPara('admin-conteudos'); abrirFormCurso('he'); });
  await adm.waitForTimeout(300);
  verdade(await adm.isVisible('#f-facilitador'), 'O formulário do curso pede o facilitador');
  await adm.fill('#f-facilitador', 'Nome Inventado');
  await adm.click('#btn-guardar-curso');
  await adm.waitForTimeout(400);
  igual(await adm.evaluate(() => DB.cursos.find(c => c.id === 'he').facilitador), 'Nome Inventado', 'O facilitador fica guardado');
  igual(adm.errosDeJs.length, 0, `Sem erros no painel: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
