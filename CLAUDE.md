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

- **Três plataformas, uma base de dados** (Supabase `epqfotzxrcyligwpauwk`):
  painel (`dashboard.kingdomcompny.com`), Payflow (`payflow.kingdomcompny.com`)
  e Academia (`membros.kingdomcompny.com`, repositório `nebula`).
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
