import { entrarDemo, ADMIN } from '../util.mjs';

export const nome = 'Domínio próprio: ligar, os registos DNS, verificar e remover (Configurações)';

/* W3 (pedido do Shelton a 01/10/2026): a escola liga o domínio dela nas
   Configurações. Em modo de demonstração não há servidor — o domínio fica no
   browser e verificar dá-o por ligado —, mas o ecrã é o mesmo: o campo, os
   dois registos a criar no DNS (CNAME ou A, e o TXT da prova), os passos da
   verificação e o estado. O servidor e a base provam-se no painel (caso 39)
   e em SQL. */
export default async function ({ navegador, base, igual, verdade, falso, contem, naoContem }){
  const pg = await entrarDemo(navegador, base, ADMIN);
  await pg.evaluate(() => irPara('admin-config'));
  await pg.waitForTimeout(300);

  const bloco = () => pg.evaluate(() => document.getElementById('bloco-dominio')?.innerText || '');
  contem(await bloco(), 'Os seus alunos entram em', 'As Configurações dizem por onde os alunos entram');
  contem(await bloco(), 'Domínio personalizado', 'e têm o campo do domínio personalizado');
  naoContem(await bloco(), 'Remover domínio', 'Sem domínio, não há nada para remover');

  /* Um endereço mal escrito não passa. */
  await pg.fill('#dominio-valor', 'isto não é um domínio');
  await pg.click('#btn-dominio-ligar');
  await pg.waitForTimeout(200);
  contem(await pg.evaluate(() => document.body.innerText), 'Escreva só o domínio', 'Um domínio mal escrito é recusado com o que fazer');

  /* Um subdomínio, colado com https:// e barra, como as pessoas colam. */
  await pg.fill('#dominio-valor', 'https://Academia.Escola-Exemplo.co.mz/');
  await pg.click('#btn-dominio-ligar');
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => ({
    texto: document.getElementById('bloco-dominio').innerText,
    linhas: [...document.querySelectorAll('.tabela-dns tbody tr')].map(tr => [...tr.cells].map(td => td.querySelector('code')?.textContent || td.textContent.trim())),
    estado: document.querySelector('.bloco-dominio .dominio-estado .pill')?.textContent,
  }));
  igual(r.estado, 'À espera do DNS', 'Depois de ligar, fica à espera do DNS');
  igual(r.linhas.length, 2, 'Pede dois registos');
  igual(JSON.stringify(r.linhas[0]), JSON.stringify(['CNAME', 'academia', 'cname.vercel-dns.com']), 'Um CNAME com o nome relativo à zona (.co.mz)');
  igual(r.linhas[1][0], 'TXT', 'e o TXT da prova');
  igual(r.linhas[1][1], '_verificacao-dominio.academia', 'no nome certo');
  verdade(/^verificacao=[a-z0-9]+$/.test(r.linhas[1][2]), `com o código da escola (${r.linhas[1][2]})`);
  contem(r.texto, 'escola-exemplo.co.mz', 'A zona é a do domínio, em minúsculas e sem https://');

  /* Verificar (na demonstração dá por ligado). */
  await pg.click('#btn-dominio-verificar');
  await pg.waitForTimeout(300);
  const depois = await pg.evaluate(() => ({
    texto: document.getElementById('bloco-dominio').innerText,
    estado: document.querySelector('.bloco-dominio .dominio-estado .pill')?.textContent,
    feitos: document.querySelectorAll('.dominio-passos li.feito').length,
    link: document.querySelector('.dominio-atual a')?.textContent,
    tabela: !!document.querySelector('.tabela-dns'),
  }));
  igual(depois.estado, 'Ativo', 'Verificado, fica ativo');
  igual(depois.feitos, 3, 'com os três passos feitos');
  igual(depois.link, 'academia.escola-exemplo.co.mz', 'e os alunos passam a entrar por ele');
  falso(depois.tabela, 'Ativo, já não pede registos');

  /* Remover pede confirmação e volta ao endereço da plataforma. */
  await pg.click('#btn-dominio-remover');
  await pg.waitForTimeout(200);
  await pg.click('.modal-overlay [data-confirmar]');
  await pg.waitForTimeout(300);
  naoContem(await bloco(), 'academia.escola-exemplo.co.mz', 'Removido, o domínio sai das Configurações');

  /* Num domínio de raiz, um A em vez do CNAME. */
  await pg.fill('#dominio-valor', 'escola-exemplo.com');
  await pg.click('#btn-dominio-ligar');
  await pg.waitForTimeout(300);
  const raiz = await pg.evaluate(() => [...document.querySelectorAll('.tabela-dns tbody tr')].map(tr => tr.cells[0].textContent.trim() + ' ' + tr.cells[1].querySelector('code').textContent));
  igual(raiz.join(' | '), 'A @ | TXT _verificacao-dominio', 'Na raiz: um A em @, e o TXT na raiz');

  igual(pg.errosDeJs.join(' | '), '', 'Sem erros de JavaScript');
  await pg.close();
}
