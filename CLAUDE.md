# Kingdom — regras de trabalho

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
