# Kingdom — regras de trabalho

## Trabalho em curso — ler primeiro

O plano em curso está em **`PLANO.md`, no repositório `kingdom-dashboard`**.
Também vive como documento em
https://claude.ai/code/artifact/444f99f3-7f1d-4e62-8c2c-2859975afbf9

**Numa sessão nova, ou depois de um `/clear`: lê o `PLANO.md` antes de qualquer
outra coisa.** A secção «REGISTO» diz em que passo se parou. Não é preciso reler
conversas antigas nem voltar a perguntar o que já foi decidido.

Ao fechar um passo, actualizar o registo **nos dois sítios** — o ficheiro e o
documento. Um plano desactualizado é pior do que nenhum, porque alguém confia nele.

## Testes: nunca com dados de alunos reais

**Todos os testes são internos.** Os únicos dados de pessoa que se podem usar
são os do Shelton, e só quando ele os fornecer.

Isto vale para tudo o que produza um efeito visível a alguém de fora:

- Não confirmar pagamentos de alunos reais para «ver se funciona».
- Não convidar, não criar contas, não abrir acessos a quem não pediu.
- Não enviar email nenhum a um endereço que não seja do Shelton.
- Não usar nomes, emails ou telefones reais em dados de exemplo.

A razão não é só privacidade. **Estas pessoas já têm acesso na plataforma
anterior.** A migração acontece de uma vez, quando a plataforma nova estiver
funcional e testada — não a conta-gotas, por causa de um teste.

Antes de pedir ao Shelton que carregue num botão que toca em dados reais:
parar, e montar o caso de teste com os dados dele.

### O que aconteceu quando esta regra não existia

Pedi «confirma um pagamento dos pendentes» para provar a ponte. Todos os
pendentes eram alunos reais. Uma aluna recebeu um convite para uma plataforma
em obras, com um curso de uma aula, meses antes da migração planeada.

## Contexto que poupa tempo

- **Nomes (Shelton, 15/11/2026):** o software deste repositório chama-se
  **One Members** e é aberto ao público. **Kingdom Academy** é o nome de uma
  escola (a nossa) dentro dele, nunca do software. «Academia», no código, na
  base (`academia.*`) e nos documentos antigos, quer dizer o software.

- **Três plataformas, uma base de dados** (Supabase `epqfotzxrcyligwpauwk`):
  painel (`dashboard.kingdomcompny.com`), Payflow (`payflow.kingdomcompny.com`)
  e Academia (`membros.kingdomcompny.com`, repositório `nebula`).
- **Endereços (Shelton, 15/11/2026, «por enquanto»):** o software, One Members,
  vive em `onemembers.kingdomcompny.com` (site de vendas, `/criar`, `/consola`,
  e as escolas sem domínio próprio com `?org=`); os emails dessas escolas saem
  de `onemembers@kingdomcompny.com`. `membros.kingdomcompny.com` é a escola
  Kingdom Academy. O endereço e o remetente estão na base
  (`nucleo.definicoes_plataforma` › `enderecos`).
- **As ofertas são de cada escola (Shelton, 15/11/2026):** montam-se no painel,
  em Ofertas (`academia.ofertas`): os cursos que abre, o prazo do acesso, o
  preço, o link de pagamento e os IDs de produto do checkout. A Vitrine do
  aluno lê daí. O One Members não cobra: o link leva a um checkout de fora (o
  Payflow ou outro) e a venda volta pelo webhook das Integrações
  (`academia-vendas` › `public.escola_aplicar_venda`), que abre os cursos da
  oferta que tem esse produto. `public.ofertas` é do Payflow: só os eventos
  pagos e as comunidades ainda a leem.
- **Turmas e matrículas (especificação do Shelton, 17/11/2026, em passos):**
  uma turma (`academia.turmas`) é uma edição de um curso, com prazo de acesso;
  todo o curso tem a sua turma padrão («Turma A»). A matrícula é a linha de
  `academia.acessos` (pessoa + curso): tem turma, estado (`ativo`, `pendente`,
  `expirado`, `desativado`) e início. Abre o curso quem tem a matrícula ativa
  e dentro do prazo. Quem escreve acessos à moda antiga (a venda, o convite)
  não fala em estado: o gatilho `matricula_coerente` mantém-no certo. Faltam:
  assinaturas, ofertas e vendas no modelo novo, convites por link, filtros
  dos membros, público de eventos e comunidades.
- **Regras de liberação (passo 2 da mesma especificação):** cada turma diz,
  por módulo e por aula, quando o conteúdo abre (`academia.regras_de_liberacao`:
  livre, data, dias após a matrícula, oculto, bloqueado, curso / módulo / aula
  concluída). A regra da aula vale mais do que a do módulo. **Quem aplica é a
  base, não o ecrã:** uma aula oculta ou bloqueada não se lê nem se conclui
  (`aula_liberada` nas regras de leitura e em `tem_acesso_aula`); do que está
  bloqueado o aluno recebe só o título e a razão (`academia.aulas_por_abrir()`,
  que a `API` junta aos cursos como `aula.bloqueio`). A equipa vê tudo.
  Escrevem-se na edição da turma e guardam-se todas de uma vez
  (`academia.turma_regras_guardar`). Na demonstração, a mesma conta faz-se em
  `cursoComLiberacao()` (js/nucleo.js). «Pontuação mínima» ficou de fora: os
  pontos do Ranking ainda se calculam no browser.
- `academy.kingdomcompny.com` está **reservado** para o site de vendas futuro.
  A área de membros é `membros.`, nunca `academy.`.
- HTML/CSS/JS puro, sem compilação. O Vercel serve os ficheiros como estão.
- **Os commits têm de ser assinados `Claude <noreply@anthropic.com>`** ou o
  Vercel recusa o deploy.
- Email transaccional: Resend, chamado directamente pelas Edge Functions. Não
  passa pelo SMTP do Supabase, por isso os limites de email do Supabase não se
  aplicam — aplica-se o plano do Resend.

## Dinheiro escreve-se sempre da mesma maneira

**`MZ 1 500,00`** e **`R 129,00`** — símbolo à frente, duas casas decimais, vírgula
a separá-las. É a disposição dos relatórios financeiros da empresa, e vale em todos
os ecrãs, no PDF da factura e nas descrições que a base escreve.

- O símbolo vem da **tesouraria** (`tesourarias.simbolo`), nunca do teclado. MZN é
  `MZ`, ZAR é `R`.
- No browser é o `dinheiro()`; em SQL é o `privado.dinheiro_escrito()`. Os dois dão
  exactamente o mesmo texto, e isso foi verificado.
- O `mz()` continua a existir e serve para números que **não** são dinheiro: uma
  contagem, uma percentagem, uma quantidade.
- Dentro de uma tabela de linhas o símbolo **não** se repete linha a linha: diz-se
  uma vez no cabeçalho da coluna.
- O separador de milhares é o espaço inquebrável (U+00A0) nos ecrãs — o que o pt-PT
  dá. Nos testes há um normalizador para isso no `testes/util.mjs`; sem ele, um
  `50 000` escrito com um espaço normal não encontra o do ecrã.
- **`useGrouping: 'always'` não é opcional.** Sem ele o pt-PT não agrupa abaixo de
  dez mil, e dava `5766,00` ao lado de `73 816,00` na mesma coluna — dois números
  formatados de maneiras diferentes lêem-se como um erro. Em SQL o padrão do
  `to_char` já agrupa sempre, e é assim que os dois lados dão o mesmo texto.

**Isto é só apresentação.** O que se cobra não passa por nenhum destes: o M-Pesa
recebe `String(valor)` lido do lançamento, e a Paystack o inteiro em subunidades
vindo do SQL. Mudar o formato nunca muda o que sai da conta de alguém — foi
verificado antes de se mudar.

## Armadilhas já encontradas, para não voltarem

- `privado.impedir_auto_promocao` reverte `perfil`, `estado`, `acessos`,
  `lead_id` e `removido_em` **em silêncio** quando quem escreve não é admin.
  Escritas do servidor precisam da reivindicação `service_role` no JWT. Uma
  escrita revertida não devolve erro nenhum.
- O atributo `hidden` perde para qualquer regra `display` do autor. Onde houver
  ecrãs alternados, garantir `[hidden]{display:none !important}`.
- Ligações que existem no esquema e ninguém preenchia: `acessos.inscricao_id`,
  `cursos.oferta_id`, `utilizadores.lead_id`. Ao tocar numa tabela, verificar se
  a coluna de ligação está a ser escrita.
- **As tabelas da Academia têm FORCE ROW LEVEL SECURITY** (todas menos
  `planos`, `plano_cursos`, `vitrine` e `ofertas`). Até uma migração, que corre como
  `postgres`, lê essas tabelas pelas regras de leitura — sem sessão, só vê o
  que um anónimo veria. Uma migração que copie dados de uma tabela para outra
  tem de confirmar a contagem antes e depois; um `insert … select` que não
  copia nada não dá erro.
- Uma versão antiga do painel gravava `""` em vez de `null` em campos de texto
  opcionais. É a única explicação para o link do único evento que existia não
  ter chegado a `academia.salas` a 28/09 (o evento é visível à migração, e o
  filtro era «não nulo e não vazio»). Ao migrar uma coluna, contar vazios e
  nulos à parte, antes de a apagar.
- As migrações da Academia vivem em `supabase/migrations/`, com a versão e o
  nome que ficaram no registo do Supabase. Aplicar com o nome do ficheiro e
  renomeá-lo para a versão que o Supabase atribuir.
