-- Aplicada a 15/11/2026 (versão 20261115221128). Provada antes numa transacção
-- desfeita, com duas contas inventadas (@exemplo.invalid): quem não é membro
-- da escola deixa de ler aulas (lia 40); um convidado para um curso continua a
-- abrir os cursos abertos a todos enquanto os houver e, fechados, abre só o
-- dele; a equipa vê tudo; os 18 alunos com acesso dado ao Escala Previsível
-- mantêm-no.
--
-- Um curso «aberto a todos» abria a qualquer conta com sessão, mesmo sem ser
-- membro da escola: uma conta só do Payflow lia as 40 aulas e os 39 vídeos dos
-- dois cursos abertos da Kingdom. Passa a abrir só a quem é membro activo da
-- escola. O resto da regra fica igual.
--
-- No mesmo dia, por decisão do Shelton, os dois cursos da Kingdom deixaram de
-- estar abertos a todos (dados, não esquema): 10X Mindset e Escala Previsível
-- [Playbook + Masterclass] ficaram com aberto_a_todos = false.
create or replace function academia_privado.tem_acesso_em(p_organizacao uuid, p_curso text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from academia.cursos c0
                  where c0.id = p_curso and c0.organizacao_id = p_organizacao)
     and (
         academia_privado.e_equipa_em(p_organizacao)
      or (nucleo.conta_em_dia(p_organizacao)
          and not exists (
             select 1 from nucleo.membros ms
              where ms.organizacao_id = p_organizacao
                and ms.utilizador_id = auth.uid()
                and ms.app = 'academia'
                and ms.estado <> 'ativo'
          )
          and (
           (exists (
             select 1 from academia.cursos c
              where c.id = p_curso and c.aberto_a_todos and c.publicado and c.removido_em is null
            )
            and exists (
             select 1 from nucleo.membros mm
              where mm.organizacao_id = p_organizacao
                and mm.utilizador_id = auth.uid()
                and mm.app = 'academia'
                and mm.estado = 'ativo'
            ))
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
      ))
     )
$function$;
