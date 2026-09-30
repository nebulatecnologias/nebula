import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entrarDemo, ALUNA, ADMIN } from '../util.mjs';

export const nome = 'Tratamento por «você»: nenhum «tu» nos textos nem nos ecrãs';

/* Decidido pelo Shelton a 30/09/2026: a Academia trata quem a usa por «você»,
   como a Kingdom Library, o Payflow e as cartas. Antes disso misturava as duas
   formas — «Esqueceste a password?» no login e «Escolha a sua palavra-passe»
   no email do convite.

   Duas camadas, porque falham de maneiras diferentes:
     1. o código: um texto novo escrito com «tu» apanha-se aqui, antes de
        chegar a um ecrã que nenhum outro teste abra;
     2. os ecrãs: o que o browser desenha com os dados de demonstração,
        incluindo textos montados de pedaços.

   Só entram formas que em português europeu nunca são de «você»: os possessivos
   (teu, tua…), os verbos na 2.ª pessoa que não coincidem com a 3.ª (tens,
   podes, estás…), o pretérito em -aste (ficaste, criaste) e os pronomes
   (te, ti, contigo). Um imperativo como «Escolhe» coincide com «ele escolhe»,
   e por isso não se pode apanhar por máquina; esses reviram-se à mão. */

const PROIBIDAS = ['teu', 'tua', 'teus', 'tuas', 'tens', 'podes', 'queres', 'estás', 'vais', 'fazes',
  'sabes', 'precisas', 'consegues', 'contigo', 'ti', 'te', 'esqueceste'];
/* -aste que são palavras de «você» ou nomes. */
const ASTE_PERMITIDAS = new Set(['contraste', 'haste', 'desgaste', 'traste', 'baste', 'gaste', 'paste']);

const LETRA = '\\p{L}';
const RE_PALAVRA = new RegExp(`(?<![${LETRA}-])(${PROIBIDAS.join('|')})(?![${LETRA}])`, 'giu');
const RE_ENCLITICO = new RegExp(`(?<=[${LETRA}])-te(?![${LETRA}-])`, 'giu');
const RE_ASTE = new RegExp(`(?<![${LETRA}])([${LETRA}]+aste)(?![${LETRA}])`, 'giu');

function formasDeTu(texto){
  const achadas = [];
  for(const m of texto.matchAll(RE_PALAVRA)) achadas.push(m[0]);
  for(const m of texto.matchAll(RE_ENCLITICO)) achadas.push(m[0]);
  for(const m of texto.matchAll(RE_ASTE)) if(!ASTE_PERMITIDAS.has(m[1].toLowerCase())) achadas.push(m[0]);
  return achadas;
}

/* Só os textos entre aspas. Os comentários ficam de fora (são a equipa a falar
   para a equipa), e o código também. Lê-se carácter a carácter, porque uma
   expressão regular com aspas lá dentro — /"/g — trocava as voltas a quem
   procurasse cadeias só com outra expressão regular. */
function cadeias(codigo){
  const fora = [];
  const pilha = [];            // templates abertos: a profundidade de { dentro de cada ${
  let i = 0, anterior = '';
  const n = codigo.length;
  const lerCadeia = (aspa) => {  // devolve o texto; i fica depois da aspa final
    let texto = '';
    while(i < n){
      const c = codigo[i];
      if(c === '\\'){ texto += codigo[i + 1] ?? ''; i += 2; continue; }
      if(c === aspa){ i++; return { texto, fim: true }; }
      if(aspa === '`' && c === '$' && codigo[i + 1] === '{'){ i += 2; return { texto, fim: false }; }
      if(aspa !== '`' && c === '\n') return { texto, fim: true };
      texto += c; i++;
    }
    return { texto, fim: true };
  };
  while(i < n){
    const c = codigo[i];
    if(c === '/' && codigo[i + 1] === '*'){ const f = codigo.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
    if(c === '/' && codigo[i + 1] === '/'){ const f = codigo.indexOf('\n', i); i = f < 0 ? n : f; continue; }
    if(c === '/' && (anterior === '' || /[(,=:[!&|?{};+\-*%<>~^\n]/.test(anterior))){
      i++; let classe = false;
      while(i < n){
        const d = codigo[i];
        if(d === '\\'){ i += 2; continue; }
        if(d === '[') classe = true; else if(d === ']') classe = false;
        else if(d === '/' && !classe){ i++; break; } else if(d === '\n') break;
        i++;
      }
      while(/[a-z]/i.test(codigo[i] ?? '')) i++;
      anterior = 'x'; continue;
    }
    if(c === '"' || c === "'" || c === '`'){
      i++;
      const { texto, fim } = lerCadeia(c);
      fora.push(texto);
      if(!fim) pilha.push(0);
      anterior = 'x'; continue;
    }
    if(pilha.length && c === '{'){ pilha[pilha.length - 1]++; }
    if(pilha.length && c === '}'){
      if(pilha[pilha.length - 1] === 0){
        pilha.pop(); i++;
        /* volta ao template de onde se saiu */
        let r = lerCadeia('`'); fora.push(r.texto);
        if(!r.fim) pilha.push(0);
        anterior = 'x'; continue;
      }
      pilha[pilha.length - 1]--;
    }
    if(!/\s/.test(c)) anterior = c;
    i++;
  }
  return fora;
}

function textoDoHtml(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    /* os atributos que se leem: placeholder, content, aria-label, title, alt */
    .replace(/<[^>]*?\b(?:placeholder|content|aria-label|title|alt)="([^"]*)"[^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ');
}

export default async function ({ navegador, base, igual, verdade }){
  const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

  const ficheiros = (await readdir(join(raiz, 'js'))).filter(f => f.endsWith('.js')).map(f => join('js', f));
  verdade(ficheiros.length > 10, `Encontrei os ficheiros da interface (${ficheiros.length})`);
  const noCodigo = [];
  for(const f of ficheiros){
    const codigo = await readFile(join(raiz, f), 'utf8');
    for(const c of cadeias(codigo)){
      const achadas = formasDeTu(c);
      if(achadas.length) noCodigo.push(`${f}: «${achadas.join(', ')}» em ${JSON.stringify(c.trim().slice(0, 90))}`);
    }
  }
  const html = textoDoHtml(await readFile(join(raiz, 'index.html'), 'utf8'));
  const noHtml = formasDeTu(html);
  if(noHtml.length) noCodigo.push(`index.html: «${noHtml.join(', ')}»`);
  igual(noCodigo.join('\n      '), '', 'Nenhum texto da interface usa «tu»');

  /* O próprio detector: se deixasse de apanhar, o teste passava sempre. */
  igual(formasDeTu('Esqueceste a tua password? Ficaste a meio — avisamos-te.').join(','),
        'Esqueceste,tua,-te,Ficaste', 'O detector apanha possessivo, pretérito e pronome');
  igual(formasDeTu('Esqueceu-se da sua password? O contraste está bom; ele escolhe.').join(','), '',
        'O detector não se engana com «você» nem com «contraste»');

  const naTela = [];
  const aluno = await entrarDemo(navegador, base, ALUNA);
  for(const ecra of ['dashboard', 'catalogo', 'vitrine', 'comunidade', 'conquistas', 'calendario', 'certificados', 'definicoes']){
    await aluno.evaluate(v => irPara(v), ecra);
    await aluno.waitForTimeout(120);
    const texto = await aluno.evaluate(() => document.querySelector('.view:not([hidden]):not(.hidden)')?.innerText
      || document.getElementById('app')?.innerText || document.body.innerText);
    const achadas = formasDeTu(texto);
    if(achadas.length) naTela.push(`${ecra}: ${achadas.join(', ')}`);
  }
  igual(aluno.errosDeJs.join(' | '), '', 'Os ecrãs do aluno abrem sem erros de JavaScript');
  await aluno.close();

  const admin = await entrarDemo(navegador, base, ADMIN);
  for(const ecra of ['admin-visao', 'admin-conteudos', 'admin-membros', 'admin-convites', 'admin-eventos', 'admin-banners', 'admin-comunidades', 'admin-vitrine', 'admin-integracoes', 'admin-certificados', 'admin-aparencia', 'admin-config', 'admin-ia']){
    await admin.evaluate(v => irPara(v), ecra);
    await admin.waitForTimeout(120);
    const texto = await admin.evaluate(() => document.body.innerText);
    const achadas = formasDeTu(texto);
    if(achadas.length) naTela.push(`${ecra}: ${achadas.join(', ')}`);
  }
  await admin.close();
  igual(naTela.join('\n      '), '', 'Nenhum ecrã desenha «tu» com os dados de demonstração');
}
