import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'API: tudo o que os ecrãs chamam em API.… existe mesmo';

/* A 17/11/2026 uma reescrita de js/api.js apagou sem querer
   API.recarregarMembros. Em demonstração nada falha, porque esse caminho só
   corre com servidor: os outros testes passaram todos, e em produção cada
   alteração a um membro acabava num erro depois de já ter sido feita. Este
   teste é a rede: lê os ficheiros, junta todas as chamadas `API.nome(` e
   confere que cada nome é uma função do objecto API que a página carrega. */
export default async function ({ navegador, base, igual, verdade }){
  const pasta = join(fileURLToPath(new URL('../..', import.meta.url)), 'js');
  const chamadas = new Map();
  for(const ficheiro of (await readdir(pasta)).filter(f => f.endsWith('.js'))){
    const codigo = await readFile(join(pasta, ficheiro), 'utf8');
    for(const m of codigo.matchAll(/(?<![\w.$])API\.([A-Za-z_$][\w$]*)\s*\(/g)){
      if(!chamadas.has(m[1])) chamadas.set(m[1], ficheiro);
    }
  }
  verdade(chamadas.size > 40, `Encontram-se as chamadas à API nos ficheiros (${chamadas.size})`);

  const pg = await entrarDemo(navegador, base, ADMIN);
  const emFalta = await pg.evaluate(nomes => nomes.filter(n => typeof API[n] !== 'function'), [...chamadas.keys()]);
  igual(emFalta.map(n => `API.${n} (chamada em js/${chamadas.get(n)})`).join(', '), '', 'Nenhuma chamada a uma função da API que não existe');
  verdade(await pg.evaluate(() => typeof API.recarregarMembros === 'function' && typeof GestaoDeMembros.recarregar === 'function'),
    'A releitura da lista de membros depois de uma alteração existe');
  await pg.close();
}
