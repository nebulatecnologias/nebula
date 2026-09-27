/* As afirmações e a abertura de páginas.

   No molde dos testes do Payflow (kingdom-dashboard/testes/util.mjs), para as
   duas casas falarem a mesma língua. Um caso FALHA: lança, o corredor apanha,
   e o push fica vermelho antes de chegar ao Vercel. */

export class Falha extends Error {}

/* O Intl separa milhares com espaços inquebráveis; "1 500" escrito à mão com
   um espaço comum não é igual ao ecrã. As comparações de texto passam por aqui. */
const normalizar = s => String(s ?? '').replace(/[   \s]+/g, ' ');

export function fazerFerramentas(t){
  const erro = (msg) => { throw new Falha(msg); };
  const contar = () => { t.total++; };
  return {
    igual(obtido, esperado, porque){
      contar();
      if(String(obtido) !== String(esperado))
        erro(`${porque}\n      esperava: ${JSON.stringify(esperado)}\n       obtive: ${JSON.stringify(obtido)}`);
    },
    diferente(obtido, indesejado, porque){
      contar();
      if(String(obtido) === String(indesejado)) erro(`${porque}\n       obtive: ${JSON.stringify(obtido)} (não devia)`);
    },
    verdade(valor, porque){ contar(); if(!valor) erro(porque); },
    falso(valor, porque){ contar(); if(valor) erro(porque); },
    contem(texto, pedaco, porque){
      contar();
      if(!normalizar(texto).includes(normalizar(pedaco)))
        erro(`${porque}\n      faltava: ${JSON.stringify(pedaco)}\n       no texto: ${JSON.stringify(normalizar(texto).slice(0, 200))}`);
    },
    naoContem(texto, pedaco, porque){
      contar();
      if(normalizar(texto).includes(normalizar(pedaco))) erro(`${porque}\n      não devia lá estar: ${JSON.stringify(pedaco)}`);
    }
  };
}

/* Uma página limpa, com os erros de JavaScript guardados para o caso afirmar
   sobre eles. Sem rede: tudo o que não é deste servidor é recusado -- um teste
   que precise de internet não é um teste, é uma aposta. As fontes do Google
   caem para as do sistema, e isso não muda nenhum comportamento. */
export async function abrirPagina(navegador, endereco, opcoes = {}){
  const contexto = await navegador.newContext({
    viewport: opcoes.viewport || { width: 1280, height: 900 }
  });
  const pg = await contexto.newPage();
  const origem = new URL(endereco).origin;
  await pg.route('**/*', r => r.request().url().startsWith(origem) ? r.continue() : r.abort());
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e.message)));
  if(opcoes.antes) await pg.addInitScript(opcoes.antes.fn, opcoes.antes.arg);
  await pg.goto(endereco);
  await pg.waitForTimeout(opcoes.esperar ?? 400);
  pg.errosDeJs = erros;
  const fechar = pg.close.bind(pg);
  pg.close = async () => { await fechar(); await contexto.close(); };
  return pg;
}

/* Entrar no modo de demonstração (?demo=1): os dados são os de js/dados.js,
   todos inventados, e nada sai do browser. O onboarding do aluno fecha-se,
   para não tapar o ecrã que o caso quer ver. */
export async function entrarDemo(navegador, base, email, opcoes = {}){
  const pg = await abrirPagina(navegador, `${base}/index.html?demo=1`, opcoes);
  await pg.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await pg.goto(`${base}/index.html?demo=1`);
  await pg.waitForTimeout(300);
  await pg.fill('#input-email', email);
  await pg.fill('#input-password', '1');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const m = document.getElementById('onboarding'); if(m) m.remove(); });
  return pg;
}

export const ADMIN = 'admin@kingdomacademy.com';
export const ALUNA = 'marta.lopes@exemplo.co.mz';   // inventada: js/dados.js
