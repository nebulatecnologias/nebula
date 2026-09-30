-- Migração 20260912232626 «acesso_consciente_do_pagamento», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- O acesso por inscricao passa a saber se a pessoa esta em dia.
--
-- Estava assim: quem tem inscricao entra, ponto. Isso anulava a data de
-- expiracao em academia.acessos -- a unica alavanca de suspensao que havia --
-- porque as condicoes estao ligadas por OU e bastava uma. Qualquer aviso de
-- "vais perder o acesso" seria um bluff: puxava-se a alavanca e a pessoa
-- continuava a entrar.
--
-- Passa a exigir que nao haja parcela vencida ha mais de 7 dias. Sete dias
-- depois do prazo, e depois de dois avisos, o acesso fecha-se sozinho; no
-- momento em que o pagamento e confirmado, abre-se sozinho tambem. Ninguem tem
-- de executar nada, e por isso nao ha nada para esquecer.
--
-- So contam vencimentos ACORDADOS. As parcelas que vieram do carregamento do
-- historico ficaram com a data em que a importacao correu -- suspender alguem
-- por causa dela seria injusto, e indefensavel se a pessoa perguntar porque.
create or replace function academia_privado.tem_acesso(p_curso text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select academia_privado.e_equipa()
      or exists (
           select 1 from academia.cursos c
            where c.id = p_curso and c.aberto_a_todos and c.publicado and c.removido_em is null
         )
      or exists (
           select 1 from academia.acessos a
            where a.utilizador_id = auth.uid()
              and a.curso_id = p_curso
              and (a.expira_em is null or a.expira_em >= current_date)
         )
      or exists (
           select 1
             from academia.cursos c
             join public.turmas t     on t.oferta_id = c.oferta_id and t.removido_em is null
             join public.inscricoes i on i.turma_id  = t.id        and i.removido_em is null
            where c.id = p_curso
              and c.oferta_id is not null
              and c.removido_em is null
              and i.lead_id in (select academia_privado.leads_do_utilizador())
              and i.estado::text in ('Não iniciada','Em curso','Concluída')
              and not exists (
                    select 1 from public.lancamentos l
                     where l.inscricao_id = i.id
                       and l.tipo   = 'Entrada'
                       and l.estado = 'Pendente'
                       and l.removido_em is null
                       and l.vencimento_acordado
                       and l.data < current_date - 7
                  )
         )
$function$;
