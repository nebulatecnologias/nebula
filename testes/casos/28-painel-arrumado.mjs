import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Painel arrumado: a opção de acesso do curso diz o que faz; Migração e Assistente IA saíram';

/* Fase 0 do plano de acessos (Shelton, 15/11/2026): «hoje quem entra de um
   convite vê tudo» — a opção «Incluir no plano geral» abria o curso a todos e
   ninguém o lia assim; e duas abas sem uso (Migração, Assistente IA). A regra
   de quem abre um curso é da base (academia_privado.tem_acesso_em, provada
   numa transacção desfeita: quem não é membro não lê nada; um convidado para
   um curso abre só esse). */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const adm = await entrarDemo(navegador, base, ADMIN);
  await adm.evaluate(() => irPara('admin-visao'));
  await adm.waitForTimeout(250);

  const menu = await adm.innerText('.sidebar');
  naoContem(menu, 'Migração', 'A Migração saiu do menu');
  naoContem(menu, 'Assistente', 'e o Assistente IA também');
  contem(menu, 'Membros', 'O resto do menu continua lá');

  for(const antiga of ['admin-ia', 'admin-migracao']){
    await adm.evaluate(v => irPara(v), antiga);
    await adm.waitForTimeout(200);
    igual(await adm.evaluate(() => estado.viewAtual), 'admin-visao', `Um endereço antigo para ${antiga} cai na Visão geral`);
  }

  /* O curso: a opção diz o que faz, e um curso novo nasce fechado. */
  await adm.evaluate(() => irPara('admin-conteudos'));
  await adm.waitForTimeout(250);
  await adm.evaluate(() => abrirFormCurso(null));
  await adm.waitForTimeout(300);
  const opcao = await adm.innerText('#f-abertoATodos');
  contem(opcao, 'Todos os membros da escola abrem este curso', 'A opção de acesso diz o que faz');
  contem(opcao, 'só abre a quem recebeu acesso', 'e o que acontece desligada');
  naoContem(await adm.innerText('#content-admin'), 'plano geral', 'Já não se fala em «plano geral»');
  falso(await adm.evaluate(() => document.getElementById('f-abertoATodos').classList.contains('marcado')), 'Um curso novo nasce fechado: só abre a quem recebe acesso');

  igual(adm.errosDeJs.length, 0, `Sem erros: ${adm.errosDeJs.join(' | ')}`);
  await adm.close();
}
