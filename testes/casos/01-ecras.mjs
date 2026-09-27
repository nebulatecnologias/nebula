import { entrarDemo, ADMIN, ALUNA } from '../util.mjs';

export const nome = 'Cada ecrã abre, no computador e no telemóvel, sem erros';

/* A lista vem da própria aplicação (NAV_ALUNO e NAV_ADMIN), para um ecrã novo
   entrar aqui sem ninguém se lembrar de o acrescentar. */
async function percorrer(pg, lista, verdade, igual, quem){
  for(const view of lista){
    await pg.evaluate(v => irPara(v), view);
    await pg.waitForTimeout(120);
    const alvo = view.startsWith('admin-') ? 'content-admin' : 'content-' + view;
    const r = await pg.evaluate(id => {
      const el = document.getElementById(id);
      return { existe: !!el, texto: el ? el.innerText.trim().length : 0,
               largo: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, alvo);
    verdade(r.existe && r.texto > 0, `${quem}: o ecrã "${view}" ficou vazio — quem lá entra vê uma página em branco`);
    igual(r.largo <= 1, true, `${quem}: o ecrã "${view}" é mais largo que o ecrã (${r.largo}px) — no telemóvel obriga a arrastar para o lado`);
  }
}

export default async function ({ navegador, base, verdade, igual }){
  for(const [largura, altura, onde] of [[1280, 900, 'computador'], [390, 844, 'telemóvel']]){
    const aluno = await entrarDemo(navegador, base, ALUNA, { viewport:{ width:largura, height:altura } });
    const doAluno = await aluno.evaluate(() => NAV_ALUNO.flatMap(g => g.itens ? g.itens : [g]).map(n => n.view).filter(v => v && abaDoAlunoLigada(v)));
    verdade(doAluno.length >= 5, `O aluno devia ter pelo menos 5 abas; tem ${doAluno.length}`);
    await percorrer(aluno, doAluno, verdade, igual, `aluno no ${onde}`);
    igual(aluno.errosDeJs.length, 0, `Aluno no ${onde}, sem erros de JavaScript: ${aluno.errosDeJs.join(' | ')}`);
    await aluno.close();

    const admin = await entrarDemo(navegador, base, ADMIN, { viewport:{ width:largura, height:altura } });
    const doAdmin = await admin.evaluate(() => NAV_ADMIN.flatMap(g => g.itens ? g.itens : [g]).map(n => n.view).filter(Boolean));
    verdade(doAdmin.length >= 15, `O painel devia ter pelo menos 15 ecrãs; tem ${doAdmin.length}`);
    await percorrer(admin, doAdmin, verdade, igual, `equipa no ${onde}`);
    igual(admin.errosDeJs.length, 0, `Equipa no ${onde}, sem erros de JavaScript: ${admin.errosDeJs.join(' | ')}`);
    await admin.close();
  }
}
