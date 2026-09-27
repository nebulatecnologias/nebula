import { entrarDemo, ALUNA } from '../util.mjs';

export const nome = 'Acesso: só se mostra o curso que se pode abrir';

/* Em produção quem decide é o servidor (meus_cursos). Um cartão de um curso
   que a pessoa não pode abrir é uma porta fechada pintada de porta aberta. */
export default async function ({ navegador, base, igual, verdade, contem }){
  const pg = await entrarDemo(navegador, base, ALUNA);

  const nada = await pg.evaluate(() => {
    DB.meusCursos = [];
    irPara('catalogo');
    return { cartoes: document.querySelectorAll('#catalogo-grid .course-card').length,
             texto: document.getElementById('content-catalogo').innerText };
  });
  igual(nada.cartoes, 0, 'Sem acesso a nada, nenhum cartão de curso pode aparecer');
  contem(nada.texto, 'Vitrine', 'E a pessoa tem de saber para onde ir');

  const um = await pg.evaluate(() => {
    DB.meusCursos = [DB.cursos.find(c => c.publicado !== false).id];
    irPara('catalogo');
    return document.querySelectorAll('#catalogo-grid .course-card').length;
  });
  igual(um, 1, 'Com acesso a um curso, aparece exactamente esse');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
