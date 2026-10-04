# Guia: como gerar um site de vendas como o da área de membros

Este guia junta tudo o que foi preciso para fazer o site de vendas que está em
`membros.kingdomcompny.com/site/` (e o `/criar` no mesmo estilo). Serve para pedir
outro site do mesmo nível, para outro produto, sem começar do zero.

Ficheiros de referência neste repositório:

| O quê | Onde |
|---|---|
| A página | `site/index.html` |
| O estilo | `site/site.css` |
| Os efeitos e os preços ao vivo | `site/site.js` |
| O formulário de inscrição no mesmo estilo | `criar/index.html` |
| O teste automático | `testes/casos/25-site.mjs` |
| O resumo da direcção de design | `.impeccable/surfaces/site-index-html.md` |

---

## 1. O que preparar antes de pedir

Quanto mais disto vier no primeiro pedido, menos voltas há.

1. **A referência visual.** Capturas de ecrã de todas as secções do site que quer
   seguir, de cima a baixo, e o link. Se possível, um vídeo curto do scroll, para
   se verem os efeitos. Se o site estiver bloqueado na rede do ambiente da nuvem,
   as capturas são a única forma de o ver (ver a secção 9).
2. **A referência de texto** (pode ser de outro site). Diga se é para seguir à
   letra ou só como inspiração, e se é provisória.
3. **A identidade.** A cor (no nosso caso o gradiente laranja da capa da área de
   membros, `#ff8a45 → #f25a12 → #d9470a`), a letra (Google Sans) e o logótipo
   ou o sinal.
4. **O nome do produto e o domínio.** Sem isto o site fica com um nome
   provisório e com `noindex`.
5. **Os factos do produto.** O que ele faz hoje, de verdade. Nada que ainda não
   exista entra no site.
6. **Os preços e de onde vêm.** No nosso caso, a função
   `public.planos_da_plataforma` na base de dados, a mesma que a consola edita.
7. **Para onde vai o botão principal.** No nosso caso:
   `/criar/?plano=…&ciclo=…&moeda=…`.
8. **Provas reais**, se houver: depoimentos, números e logótipos de clientes,
   com autorização. Se não houver, o site usa exemplos rotulados como inventados.

---

## 2. O pedido, pronto a copiar

Substitua o que está entre `[ ]`.

```text
Crie a página de vendas de [PRODUTO] usando as skills impeccable e ui-ux-pro-max.

Referência visual: [link] e as capturas em anexo. Siga a estrutura e os
elementos dinâmicos da referência (efeitos ao deslizar, faixas em movimento,
órbita, carrossel, alternância de preços, etc.), mas com a nossa cor
[gradiente/cor] no lugar da cor da referência. Letra: Google Sans em todas as
páginas.

Texto: use [site/documento] como referência [provisória]. Só pode afirmar o que
o produto faz hoje; o que não temos fica de fora e diga-me o que ficou.

Preços: ler ao vivo de [função/tabela]. Dinheiro sempre «MZ 1 500,00» / «R 129,00».
Botão principal: [URL], levando o plano, o ciclo e a moeda no endereço.
Nome do produto: [nome ou "provisório"]. Domínio: [domínio ou "por decidir"].

HTML, CSS e JS puros, sem compilação. Português de Moçambique, tratamento por
«você». Teste automático novo, capturas no computador e no telemóvel com a letra
verdadeira, e só depois commit e push. Actualize o PLANO.md e o documento do plano.
```

Para pedir **depois** mudanças no mesmo site, basta dizer o que muda, por exemplo:
«a demonstração em modo escuro, em vidro», «o /criar no mesmo estilo», «use este
texto como referência».

---

## 3. O mundo visual

O site é escuro de propósito: a referência (Setrex) era preta, com uma única cor
forte. A nossa cor forte é o laranja da identidade.

### Cores

```css
--preto:#000;               /* fundo da página */
--cartao-a:#151413;         /* cartões: gradiente de cima-esquerda… */
--cartao-b:#0a0a0a;         /* …para baixo-direita */
--linha:rgba(255,255,255,.075);      /* contornos finos */
--linha-forte:rgba(255,255,255,.14);
--texto:#fff;  --texto-2:#bdb7b0;  --texto-3:#8f8881;   /* 3 níveis de texto */
--laranja:#ff6a1f;  --laranja-ink:#ff9a5c;  --laranja-suave:rgba(255,106,31,.13);
--marca:linear-gradient(160deg,#ff8a45 0%,#f25a12 55%,#d9470a 100%);  /* a identidade */
--cta:linear-gradient(180deg,#ff7f37 0%,#f2570f 100%);                /* botões */
```

- O laranja vai **só** onde a referência tinha a cor forte: o botão principal, o
  plano em destaque, o núcleo da órbita, a pílula «Grátis», os indicadores
  activos e a luz difusa por trás da demonstração.
- O plano em destaque leva o `--marca` com dois realces radiais por cima, iguais
  aos da capa da área de membros:
  `radial-gradient(80% 60% at 100% 0%, rgba(255,255,255,.2), transparent 60%)` e
  `radial-gradient(70% 55% at 0% 100%, rgba(120,30,0,.3), transparent 65%)`.

### Letra

- **Google Sans**, pelo Google Fonts: `family=Google+Sans:wght@400;500;700`.
  Inputs e botões têm `font-family:inherit`, senão o browser usa a dele.
- Títulos com peso 500 e espaçamento apertado (`letter-spacing:-.04em`, que é o
  limite: mais apertado do que isto começa a colar letras).
  - Abertura: `clamp(40px, 6.2vw, 84px)`.
  - Secções: `clamp(34px, 4.8vw, 60px)`.
  - Cartões: 24–44px.
- Texto corrido a 15,5–16px, com `text-wrap:pretty`. Títulos com `text-wrap:balance`.

### Formas

- Cantos: 30px nos cartões grandes, 22px nos médios, 16px nos pequenos, 999px
  nos botões e nas pílulas.
- Cartões sem sombra pesada: contorno de 1px a 7–14% de branco e o gradiente
  escuro. A profundidade vem da luz laranja por trás, não de sombras.
- **Vidro** (a demonstração da área de membros):
  `background:rgba(18,16,14,.38); backdrop-filter:blur(22px) saturate(1.35);`
  com um contorno de 16% de branco. Por dentro, tudo em contorno:
  `background:rgba(255,255,255,.025); box-shadow:inset 0 0 0 1px rgba(255,255,255,.11);`

### O que não se faz

- Não há etiqueta pequena por cima dos títulos («eyebrow»): o título vale sozinho.
- Não há texto com gradiente.
- Não há números de secção (01, 02…) a não ser que a ordem importe.
- Não há emojis no lugar de ícones: os ícones são SVG de traço, todos com a
  mesma espessura (1.8).

---

## 4. As secções, por ordem

Cada secção diz o que faz pelo visitante e qual é o efeito.

| # | Secção | Para que serve | Efeito |
|---|---|---|---|
| 1 | **Barra de cima** | marca, links das secções e botão «Começar grátis» | fica fixa; ao deslizar ganha fundo escuro desfocado |
| 2 | **Abertura** | o que é, para quem, e o botão | grelha fina a desvanecer, luz laranja; a janela da demonstração começa inclinada e **endireita-se ao deslizar** |
| 3 | **«Experimente com a sua escola»** | prova que é a marca do cliente | o visitante escreve o nome e escolhe a cor, e a demonstração muda na hora (nome, iniciais, endereço, cor) |
| 4 | **Faixa** | os tipos de cliente | texto grande e apagado, a correr sem fim, com as pontas a desvanecer |
| 5 | **Pilares** | o produto explicado em 6 partes, texto à esquerda e desenho à direita | separadores presos em cima que seguem a leitura (indicador laranja a deslizar); cada desenho acorda ao entrar no ecrã |
| 6 | **Bento** | três ideias fortes em cartões | luz que segue o rato; janela de aula com a barra a encher; **órbita** de ícones a girar; número gigante apagado com pílula a flutuar |
| 7 | **Faixas de detalhes** | muitas funcionalidades sem cansar | duas filas de cartões em sentidos opostos; param ao passar o rato |
| 8 | **Carrossel** | o produto para cada tipo de cliente | setas, avanço sozinho a cada 7 s, deslizar com o dedo; o telemóvel muda de cor e de nome |
| 9 | **Preços** | decidir | interruptor de moeda (e de ciclo, só se houver preço anual); os números **correm** até ao valor novo; plano do meio em destaque |
| 10 | **Perguntas** | tirar objecções | abrem e fecham com movimento |
| 11 | **Fecho** | último empurrão | **estrelas** a cintilar num canvas, luz laranja a nascer em baixo |
| 12 | **Rodapé** | termos, privacidade | — |

Os desenhos dos pilares (secção 5):

- vitrine de cursos;
- fluxo de entrega com os passos a acender um a um;
- certificado com a assinatura a desenhar-se;
- email com a marca da escola, ligado por linhas pontilhadas em movimento;
- ranking com o XP a subir;
- gráfico com as linhas a correr.

---

## 5. Como cada efeito está feito

Tudo em CSS e JavaScript simples, sem bibliotecas. O código completo está em
`site/site.css` e `site/site.js`.

**Entrar ao deslizar.** Os elementos com `.revela` começam invisíveis, desfocados
e 26px abaixo, e aparecem quando entram no ecrã (IntersectionObserver), com um
pequeno atraso entre irmãos. Só se escondem se o JavaScript correr: a classe
`.anima` vai para o `<html>` no arranque, por isso sem JavaScript tudo se vê.

```css
.anima .revela{ opacity:0; transform:translateY(26px); filter:blur(8px);
  transition:opacity .9s var(--sai), transform 1.1s var(--sai), filter .9s var(--sai);
  transition-delay:var(--atraso,0s); }
.anima .revela.visto{ opacity:1; transform:none; filter:none; }
/* --sai: cubic-bezier(.16,1,.3,1) — rápido no início, suave no fim */
```

**A janela que endireita.** Um `perspective` no contentor; no scroll, um
`requestAnimationFrame` calcula a fracção `p` dos primeiros 520px e põe
`--rx:16deg → 0` e `--sc:.93 → 1` na janela (`rotateX(var(--rx)) scale(var(--sc))`).

**Faixas sem fim.** A lista vai duas vezes seguidas (a segunda com
`aria-hidden="true"`) e anima `translateX(0 → -50%)` em `linear infinite`. As
pontas desvanecem com uma `mask-image` em gradiente horizontal.

**Órbita.** Anéis concêntricos. Cada «roda» gira (`rotate 360deg`) e os ícones
ficam no anel com `rotate(ang) translateX(raio) rotate(-ang)`. Cada ícone gira ao
contrário à mesma velocidade, para ficar sempre direito.

**Mudança de cor suave.** `@property --m { syntax:"<color>" }` deixa animar a
cor da escola com `transition:--m .6s`.

**Números que correm.** Ao trocar a moeda, guarda-se o valor antigo de cada
plano e interpola-se até ao novo em 700 ms, com `ease-out`, formatando sempre
como dinheiro.

**Separadores que seguem a leitura.** Um IntersectionObserver vê que pilar ocupa
mais ecrã e move o indicador com `translateX(offsetLeft)` e `width`.

**Linhas do gráfico e assinatura.** Os caminhos SVG têm `pathLength="1"` e
`stroke-dasharray:1`, e o `stroke-dashoffset` vai de 1 a 0 quando o desenho fica
`.visto`.

**Estrelas.** Um canvas com pontos de 0,25–1,35px, com o brilho a seguir um seno
por estrela e uma deriva lenta para cima. Só anima enquanto está à vista.

**Movimento reduzido.** Com `prefers-reduced-motion: reduce`, nada se esconde,
as faixas param (e passam a deslizar à mão), a janela fica direita e os números
não correm.

---

## 6. Regras do conteúdo (não negociáveis)

- **Só se afirma o que o produto faz hoje.** Da referência saíram: «suporte
  24/7» (virou «7 dias grátis»), «investidores» (virou funcionalidades reais),
  quizzes, IA, pesquisa nos vídeos, entrega programada e anti-pirataria.
- **Sem depoimentos inventados.** Sem provas reais, os exemplos levam a nota
  «Exemplos ilustrativos: as escolas e os endereços são inventados.» Dados de
  gráficos levam «Dados ilustrativos».
- **Nomes de exemplo inventados**, nunca de pessoas reais (regra do `CLAUDE.md`).
- **Dinheiro:** `MZ 1 350,00`, `R 300,00`. Símbolo à frente, espaço inquebrável,
  vírgula, duas casas, milhares sempre agrupados (`useGrouping:'always'`). O
  símbolo vem da tesouraria, nunca do teclado.
- **Língua:** português de Moçambique, por «você» (o teste `13-voce.mjs` falha
  se aparecer um «tu»).
- **Marca:** a página de vendas não diz «Kingdom» enquanto o nome do produto não
  estiver decidido (o teste 25 verifica-o).

---

## 7. Técnica

- **HTML, CSS e JS puros.** O Vercel serve os ficheiros como estão. Os caminhos
  são absolutos (`/site/site.css`), para funcionarem com ou sem `/` no fim do
  endereço.
- **Preços ao vivo:**

  ```js
  fetch(`${SUPABASE_URL}/rest/v1/rpc/planos_da_plataforma`, { method:"POST",
    headers:{ apikey:SUPABASE_CHAVE, Authorization:`Bearer ${SUPABASE_CHAVE}`,
      "Content-Type":"application/json", "Content-Profile":"public", "Accept-Profile":"public" },
    body:"{}" })
  ```

  Sem ligação, a página usa os valores decididos (iguais aos da base).
- **Botões:** `https://membros.kingdomcompny.com/criar/?plano=profissional&ciclo=mensal&moeda=MZN`.
  O `/criar` entende `premium` como o plano `escala`.
- **Antes de ter domínio:** `<meta name="robots" content="noindex">`. Quando
  houver domínio, tira-se o `noindex` e aponta-se o domínio para o projecto da
  Academia na Vercel (e decide-se se o site passa a ser a raiz desse domínio).
- **Commits** assinados `Claude <noreply@anthropic.com>`, ou a Vercel recusa o
  deploy.

---

## 8. Verificar antes de publicar

1. Capturas no computador (1440×900) e no telemóvel (390×844), de cada secção.
2. **Com a letra verdadeira:** nas capturas, servir o CSS e os ficheiros do Google
   Fonts a partir de cópias locais (ver a secção 9).
3. Uma captura com movimento (para ver a janela inclinada, o fluxo a acender, as
   linhas a correr) e o resto com `reducedMotion:'reduce'`, para nada ficar
   escondido por uma animação a meio.
4. Sem deslizar para o lado no telemóvel (`scrollWidth ≤ largura`).
5. `node testes/correr.mjs 13 16 20 25`: «você», marca, `/criar` e site.
6. O verificador de design: `.claude/skills/impeccable/scripts/impeccable detect --json site/…`.
   Corrigir o que é mecânico. O brilho laranja é da referência e tem excepção
   registada.

---

## 9. Armadilhas já encontradas

- **A rede da nuvem bloqueia sites de fora** (o Webflow e o Framer da referência).
  Ou se junta o domínio às «Allowed domains» do ambiente, ou se mandam capturas.
- **O Chromium das capturas não confia no proxy**, por isso o Google Fonts não
  carrega e aparece outra letra. Não é um defeito do site. Solução: descarregar
  o CSS e os `.woff2` com `curl` e servi-los com `page.route(...)` nas capturas.
- **Captura de um elemento com a barra fixa:** a barra aparece a meio da imagem.
  É da captura, não da página.
- **Input dentro de flex em coluna** com `flex:1` encolhe para altura zero. No
  telemóvel: `flex:none; width:100%`.
- **Títulos com uma palavra órfã** («Uma plataforma, a / cara de cada escola»):
  `text-wrap:balance` não chega sempre; reescrever o título.
- **Contraste:** texto claro sobre o topo claro de uma capa com gradiente falha.
  Pôr um véu escuro por baixo do texto (`linear-gradient(0deg, rgba(0,0,0,.6), transparent)`).
- **O atributo `hidden` perde para `display:`**: manter `[hidden]{display:none !important}`.
- **Datas nos exemplos:** confirmar o dia da semana (20/09/2026 é domingo, não sábado).

---

## 10. Ainda por decidir

- O nome do produto (hoje «Área de membros»).
- O domínio (`academy.kingdomcompny.com` está reservado para isto).
- Os textos definitivos (os de agora são provisórios, com a Memberkit como referência).
- Depoimentos reais, quando houver.
