import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Eventos: descrição, local, acesso, público e presenças';

export default async function ({ navegador, base, verdade, igual, contem }){
  const pg = await entrarDemo(navegador, base, ADMIN);
  await pg.evaluate(() => { irPara('admin-eventos'); editarEvento(null); });
  await pg.waitForTimeout(250);
  for(const campo of ['descricao','local','acesso','ofertaId','cursos'])
    verdade(await pg.isVisible('#valor-' + campo), `O formulário do evento tem de pedir "${campo}"`);

  await pg.fill('#valor-titulo', 'Encontro de teste');
  await pg.fill('#valor-descricao', 'Uma tarde de trabalho sobre o plano de 90 dias.');
  await pg.fill('#valor-data', '2030-06-15');
  await pg.fill('#valor-hora', '15:00');
  await pg.fill('#valor-local', 'Rua Inventada 1, Maputo');
  await pg.selectOption('#valor-acesso', 'exclusivo');
  await pg.click('#drawer-guardar');
  await pg.waitForTimeout(300);

  const ev = await pg.evaluate(() => DB.eventos.find(e => e.titulo === 'Encontro de teste'));
  verdade(!!ev, 'O evento fica guardado');
  igual(ev.local, 'Rua Inventada 1, Maputo', 'O local fica guardado');
  igual(ev.acesso, 'exclusivo', 'A etiqueta de acesso fica guardada');
  contem(await pg.textContent('#content-admin table'), 'Exclusivo', 'A tabela mostra a etiqueta');
  contem(await pg.textContent('#content-admin thead'), 'Confirmados', 'A equipa vê quantos confirmaram');

  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
