import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirPagina, ALUNA, ADMIN } from '../util.mjs';

export const nome = 'Idioma: português e inglês — nada por traduzir, e o painel fica em português';

/* Decidido pelo Shelton a 30/09/2026, no molde do checkout: o português é a
   chave e o dicionário (js/idioma-en.js) só tem o inglês. Uma tradução em
   falta não parte nada — cai no português, sem avisar ninguém. Este teste é
   o aviso. */

/* Os ficheiros do que o aluno vê. O painel da equipa fica em português. */
const DO_ALUNO = ['idioma.js', 'nucleo.js', 'componentes.js', 'aluno.js', 'onboarding.js', 'paginas.js', 'api.js', 'app.js'];

/* Português à vista: acentos que o inglês não tem, ou palavras curtas que só
   o português usa. Aplica-se só ao que é interface, nunca ao conteúdo que a
   equipa escreveu (títulos de cursos, aulas, eventos). */
const PORTUGUES = /[ãõçâêôàáéíóú]|\b(de|do|da|dos|das|não|para|com|seu|sua|seus|suas|aulas?|cursos?|ver|voltar|entrar|sair|guardar|conquistas|definições)\b/i;

function chavesDoCodigo(codigo){
  const fora = new Set();
  for(const m of codigo.matchAll(/(?<![\w.$])t\(\s*"((?:[^"\\]|\\.)*)"/g)) fora.add(JSON.parse('"' + m[1] + '"'));
  /* tc("contexto", "texto"): a chave é «contexto|texto». */
  for(const m of codigo.matchAll(/(?<![\w.$])tc\(\s*"([^"]+)"\s*,\s*"((?:[^"\\]|\\.)*)"/g)) fora.add(m[1] + '|' + JSON.parse('"' + m[2] + '"'));
  return fora;
}

async function entrarEmIngles(navegador, base, email){
  const pg = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  await pg.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await pg.goto(`${base}/index.html?demo=1&lang=en`);
  await pg.waitForTimeout(300);
  if(email){
    await pg.fill('#input-email', email);
    await pg.fill('#input-password', '1');
    await pg.click('#form-login button[type=submit]');
    await pg.waitForTimeout(500);
    await pg.evaluate(() => { const m = document.getElementById('onboarding'); if(m) m.remove(); });
  }
  return pg;
}

export default async function ({ navegador, base, igual, verdade, contem }){
  const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
  const EN = new Function(await readFile(join(raiz, 'js', 'idioma-en.js'), 'utf8') + '; return EN;')();
  verdade(Object.keys(EN).length > 300, `O dicionário tem as traduções (${Object.keys(EN).length})`);

  /* 1. Tudo o que passa pelo t() no código do aluno. */
  const emFalta = [];
  let vistas = 0;
  for(const f of DO_ALUNO){
    for(const chave of chavesDoCodigo(await readFile(join(raiz, 'js', f), 'utf8'))){
      vistas++;
      if(!Object.prototype.hasOwnProperty.call(EN, chave)) emFalta.push(`${f}: ${JSON.stringify(chave)}`);
    }
  }
  verdade(vistas > 250, `Encontrei os textos passados ao t() (${vistas})`);
  igual(emFalta.join('\n      '), '', 'Cada texto passado ao t() tem tradução');

  /* 2. O texto fixo do index.html (data-t, data-t-placeholder, data-t-aria). */
  const html = await readFile(join(raiz, 'index.html'), 'utf8');
  const fixos = [];
  for(const m of html.matchAll(/<[^>]*\sdata-t(?=[\s>])[^>]*>([^<]*)</g)) fixos.push(m[1].trim());
  for(const m of html.matchAll(/<[^>]*placeholder="([^"]*)"[^>]*data-t-placeholder/g)) fixos.push(m[1]);
  for(const m of html.matchAll(/<[^>]*aria-label="([^"]*)"[^>]*data-t-aria/g)) fixos.push(m[1]);
  verdade(fixos.length >= 15, `Encontrei o texto fixo marcado no index.html (${fixos.length})`);
  igual(fixos.filter(x => !Object.prototype.hasOwnProperty.call(EN, x)).join(' | '), '', 'O texto fixo do index.html tem tradução');

  /* 3. Os textos de origem, que chegam ao t() vindos dos dados. */
  const pg0 = await abrirPagina(navegador, `${base}/index.html?demo=1`);
  const deOrigem = await pg0.evaluate(() => [
    ...NAV_ALUNO.flatMap(g => [g.grupo, ...g.itens.map(i => i.label)]),
    ...RITMOS.flatMap(x => [x.rotulo, x.desc]), ...MOMENTOS.flatMap(x => [x.rotulo, x.desc]),
    ...CONQUISTAS_PADRAO.flatMap(b => [b.titulo, b.desc]),
    ...Object.values(CATEGORIAS_PADRAO).map(c => c.nome),
    APARENCIA_PADRAO.sublinha, APARENCIA_PADRAO.loginTitulo, APARENCIA_PADRAO.loginTexto,
    CONFIG_PADRAO.certificado.titulo, CONFIG_PADRAO.certificado.frase, CONFIG_PADRAO.certificado.rodape,
    CONFIG_PADRAO.certificado.assinaturaCargo, CONFIG_PADRAO.integracoes.suporteRotulo,
    ...Object.values(ROTULO_ACESSO), ...Object.values(CANAIS).map(c => c.nome), ...Object.values(ROTULO_CURTO)
  ]);
  await pg0.close();
  const origemEmFalta = [...new Set(deOrigem)].filter(x => x && !Object.prototype.hasOwnProperty.call(EN, x));
  /* Os rótulos curtos do painel ficam de fora: o painel não se traduz. */
  igual(origemEmFalta.filter(x => !['Visão', 'Conteúdos', 'Relatórios'].includes(x)).join(' | '), '',
        'Os textos de origem (menu, conquistas, categorias, questionário, certificado) têm tradução');

  /* 4. Em inglês, a entrada e os ecrãs do aluno. */
  const entrada = await entrarEmIngles(navegador, base, null);
  igual(await entrada.textContent('.login-card h1'), 'Sign in to your account', 'A entrada abre em inglês com ?lang=en');
  igual(await entrada.getAttribute('#input-password', 'placeholder'), 'Your password', 'até nos marcadores dos campos');
  igual(await entrada.evaluate(() => document.documentElement.lang), 'en', 'e o documento diz que é inglês');
  verdade(await entrada.$('#login-idioma [data-idioma="en"][aria-pressed="true"]') !== null, 'O selector mostra EN escolhido');
  await entrada.click('#login-idioma [data-idioma="pt"]');
  await entrada.waitForTimeout(100);
  igual(await entrada.textContent('.login-card h1'), 'Entrar na sua conta', 'Um toque em PT volta ao português');
  await entrada.click('#login-idioma [data-idioma="en"]');
  await entrada.waitForTimeout(100);
  contem(await entrada.textContent('#login-quote'), 'Authority is built in private', 'e o texto de entrada da Aparência também muda');
  await entrada.close();

  const pg = await entrarEmIngles(navegador, base, ALUNA);
  const aVista = [];
  const CHROME = '.page-head h1, .section-title h2, .btn, .stat-label, .nav-item span, .nav-label, .tabbar span, .chip, .empty-note, .widget-label, .settings-card h3, label, .t-title, .t-sub, .cert-locked-note, .pct, .pct-label, .course-legenda, .cert-preview span, .cover-badge.done, .rotulo, .progress-mini-label span, .xp-info h3';
  for(const ecra of ['dashboard', 'catalogo', 'vitrine', 'comunidade', 'conquistas', 'calendario', 'certificados', 'definicoes']){
    await pg.evaluate(v => irPara(v), ecra);
    await pg.waitForTimeout(150);
    const textos = await pg.evaluate(sel => [...document.querySelectorAll(sel)]
      .filter(el => el.offsetParent !== null && !el.closest('#content-admin, .banner-carousel'))
      .map(el => el.innerText.trim()).filter(Boolean), CHROME);
    textos.filter(x => PORTUGUES.test(x)).forEach(x => aVista.push(`${ecra}: ${JSON.stringify(x.slice(0, 80))}`));
  }
  igual([...new Set(aVista)].join('\n      '), '', 'Em inglês, nenhum elemento da interface do aluno fica em português');
  contem(await pg.textContent('#sidebar-nav-items'), 'My courses', 'O menu está em inglês');
  await pg.evaluate(() => irPara('comunidade'));
  await pg.waitForTimeout(150);
  igual((await pg.textContent('.comunidade-entrar')).trim(), 'Join', 'Entrar num grupo é «Join», não «Sign in»');

  /* Uma aula: os botões e a avaliação. */
  await pg.evaluate(() => irPara('aula', 'mi', 'mi-m1a1'));
  await pg.waitForTimeout(200);
  contem(await pg.textContent('#content-aula'), 'Back to the course', 'A aula está em inglês');
  contem(await pg.textContent('#content-aula'), 'Lesson completed', 'incluindo o botão de concluir');

  /* O certificado: título, frase e data em inglês; o nome do curso fica. */
  await pg.evaluate(() => irPara('certificados'));
  await pg.waitForTimeout(150);
  await pg.click('.cert-card[data-curso="mi"]');
  await pg.waitForTimeout(150);
  const diploma = await pg.textContent('#modal-cert-conteudo');
  contem(diploma, 'has successfully completed the course', 'O certificado sai em inglês');
  contem(diploma, 'Issued on', 'com a data em inglês');
  contem(diploma, 'Mentalidade Inquebrável', 'e o nome do curso como a equipa o escreveu');
  await pg.click('#btn-fechar-certificado');

  /* Nas Definições muda-se, e a escolha fica. */
  await pg.evaluate(() => irPara('definicoes'));
  await pg.waitForTimeout(150);
  await pg.click('#definicoes-idioma [data-idioma="pt"]');
  await pg.waitForTimeout(200);
  igual(await pg.textContent('#content-definicoes h1'), 'Definições', 'Nas Definições, PT volta ao português');
  igual(await pg.evaluate(() => localStorage.getItem('academia.idioma')), 'pt', 'e a escolha fica lembrada');
  contem(await pg.textContent('#sidebar-nav-items'), 'Meus cursos', 'O menu acompanha');
  igual(pg.errosDeJs.join(' | '), '', 'Sem erros de JavaScript em inglês');
  await pg.close();

  /* 5. O painel da equipa fica em português, mesmo com o inglês escolhido. */
  const admin = await entrarEmIngles(navegador, base, ADMIN);
  await admin.evaluate(() => irPara('admin-certificados'));
  await admin.waitForTimeout(200);
  contem(await admin.textContent('#content-admin'), 'Certificados', 'O painel fica em português');
  contem(await admin.textContent('#sidebar-nav-items'), 'Visão geral', 'e o menu do painel também');
  /* A pré-visualização «como aluno» mostra o que o aluno vê: em inglês. */
  await admin.evaluate(() => entrarPreviaAluno());
  await admin.waitForTimeout(200);
  contem(await admin.textContent('#sidebar-nav-items'), 'My courses', 'Ver como aluno mostra a língua escolhida');
  igual(admin.errosDeJs.join(' | '), '', 'O painel abre sem erros de JavaScript');
  await admin.close();
}
