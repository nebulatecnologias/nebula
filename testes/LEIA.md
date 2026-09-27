# Os testes da Academia

```bash
npm install     # uma vez
npm test        # todos
npm test even   # só os casos cujo nome contém "even"
```

Correm também no GitHub a cada push (`.github/workflows/testes.yml`).

## O que isto é

Cada caso abre a Academia **a sério** — o `index.html` e os ficheiros de `js/`
e `css/` que o Vercel serve, sem cópias — num Chromium, e afirma sobre o que
aparece. O servidor vive dentro do `correr.mjs`, nasce e morre com ele.

**Nenhum teste toca na base de dados, na rede, ou em pessoas.** Os casos correm
no modo de demonstração (`?demo=1`), com os dados inventados de `js/dados.js`.
Tudo o que não é deste servidor é recusado. Nunca há aqui nomes, emails ou
telefones de pessoas reais — é regra da casa (`CLAUDE.md`).

O que depende do servidor (quem tem acesso a quê, quem vê que evento) prova-se
com SQL, em transacções desfeitas e com utilizadores fictícios, e fica descrito
no commit e no `PLANO.md`.

## Escrever um caso

```js
import { entrarDemo, ALUNA } from '../util.mjs';

export const nome = 'O que isto prova';

export default async function ({ navegador, base, igual, verdade, contem }){
  const pg = await entrarDemo(navegador, base, ALUNA);
  contem(await pg.innerText('#content-dashboard'), 'Olá',
    'Porque é que isto importa, para quem vir o vermelho');
  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
```

Ferramentas: `igual`, `diferente`, `verdade`, `falso`, `contem`, `naoContem`.
A última frase de cada afirmação diz **porque é que importa**, não o que falhou.

Um ecrã novo entra sozinho no `01-ecras.mjs`, que percorre `NAV_ALUNO` e
`NAV_ADMIN` nas duas larguras.
