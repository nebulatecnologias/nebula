# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Alunos:** empresários e líderes, sobretudo em Moçambique, que fazem os cursos da Kingdom (mentalidade, inteligência artificial, marketing e vendas, negócios, espiritualidade, desenvolvimento pessoal). Entram para continuar uma aula onde ficaram, ver o próximo encontro ao vivo, falar na comunidade e acompanhar o seu progresso. Usam tanto o telemóvel como o computador.
- **Equipa Kingdom (administradores):** gerem conteúdos, turmas, eventos, vitrine, convites, membros, comunidade, ranking, relatórios, integrações e aparência no painel de administração da mesma aplicação.

## Product Purpose

Kingdom Academy é a área de membros dos cursos da Kingdom Company, em `membros.kingdomcompny.com`. Junta num só lugar as aulas em vídeo, organizadas em módulos, os encontros ao vivo, a comunidade, as conquistas e os certificados. O sucesso é o aluno voltar e terminar os cursos, e a equipa conseguir gerir tudo sem sair da plataforma.

## Positioning

É uma das três plataformas que partilham uma única base de dados: o painel (`dashboard.`), o Payflow (`payflow.`, onde se paga) e a Academia (`membros.`). O acesso a um curso nasce de um pagamento ou convite real no sistema da empresa. Não há um checkout paralelo: a Vitrine da Academia envia sempre para o Payflow.

## Operating Context

- A entrada é por convite. O convite ou a recuperação de password chegam por email (Resend, enviado pelas Edge Functions do Supabase) e levam o aluno a escolher a password.
- Os vídeos das aulas vêm de um provedor externo (Panda Video, YouTube, Vimeo) e são incorporados pela aplicação.
- A migração dos alunos da plataforma anterior acontece de uma só vez, quando a plataforma estiver pronta. Os testes nunca usam dados de alunos reais.

## Capabilities and Constraints

- HTML, CSS e JS puros, sem passo de compilação; o Vercel serve os ficheiros como estão. Supabase (esquema `academia`) para dados e sessão. Existe um modo de demonstração em `?demo=1`.
- O administrador pode mudar a cor de destaque, o nome, o logótipo, o tema por omissão e os textos do login em **Aparência**. O design tem de continuar a respeitar estas escolhas.
- Dinheiro escreve-se sempre `MZ 1 500,00` / `R 129,00` (símbolo da tesouraria à frente, duas casas decimais).
- O back-end crítico (Edge Functions de pagamentos, acessos e emails; RLS; esquema) fica fora do trabalho de interface.
- Língua da interface: português europeu (Moçambique), tratamento por «tu».

## Brand Commitments

- Família Kingdom: a Academia adopta o design system da **Kingdom Library** (paleta, tipo de letra, ícones, botões, ecrãs e emails), confirmado pelo utilizador.
- A marca é a coroa laranja da Kingdom com o nome «Kingdom Academy». O logótipo que o administrador carregar em Aparência tem prioridade sobre ela.
- O tema por omissão segue a Library: claro, e escuro quando o sistema do utilizador está em modo escuro. O botão de tema e a escolha do administrador continuam a mandar.

## Evidence on Hand

- Dados de demonstração em `js/dados.js` (cursos, alunos e eventos de exemplo, fictícios).
- Não há testemunhos, métricas públicas nem fotografias de alunos para usar; não inventar.

## Product Principles

1. O aluno volta ao ponto onde parou em um toque.
2. Nada que o aluno veja é uma porta fechada pintada de porta aberta: o que não pode abrir mostra-se como tal, com o caminho para o obter.
3. Uma só base de dados, uma só verdade: a interface nunca inventa estado que o servidor não confirmou.
4. Cada falha tem uma saída: o que aconteceu e o botão que resolve.

## Accessibility & Inclusion

Texto legível ao nível AA; a Academia é usada em telemóveis modestos e ligações lentas, por isso o peso da página e o desempenho contam.
