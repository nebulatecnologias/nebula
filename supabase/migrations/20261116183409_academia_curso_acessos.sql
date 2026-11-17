-- Aplicada a 16/11/2026 (versão 20261116183409). É só de leitura. Provada numa
-- transacção desfeita, como administração da Kingdom e com uma conta
-- inventada (ensaio-*@exemplo.invalid), 11 verificações: um aluno e outra
-- escola são recusados; o Escala Previsivel devolve os 18 acessos abertos e a
-- oferta que o vende; um acesso dado aparece com a origem e o prazo, e tirado
-- fica como fechado; um convite por aceitar aparece com o prazo do acesso.
--
-- Quem tem acesso a um curso, e porquê (pedido do Shelton a 15/11/2026: «não
-- consigo dentro do painel definir de forma clara quem tem acesso a um curso
-- que acabo de criar»).
--
-- A regra de quem abre um curso já é da base (academia_privado.tem_acesso_em).
-- Faltava lê-la do lado do curso: até aqui só se via pela ficha de cada
-- membro, um a um. Esta função responde, para um curso da escola:
--   - a regra dele (aberto a todos os membros ou só a quem recebeu acesso) e
--     quantos alunos ativos e quanta equipa a escola tem;
--   - as pessoas com um acesso próprio (aberto ou fechado), com a origem, a
--     nota e o prazo, e as que entram por uma inscrição no Payflow;
--   - os convites por aceitar que o incluem;
--   - as ofertas que o abrem.
--
-- Só lê. Dar, tirar e mudar o prazo continuam nas funções dos membros
-- (academia.membro_dar_acesso, membro_tirar_acesso, membro_prazo), que já
-- conferem quem pede. Só a equipa da escola a chama.

create or replace function academia.curso_acessos(p_curso text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_org uuid := academia_privado.organizacao();
  v_c academia.cursos;
begin
  if v_org is null or not academia_privado.e_equipa() then
    raise exception 'Só a equipa da escola vê quem tem acesso a um curso.';
  end if;
  select * into v_c from academia.cursos c
   where c.id = p_curso and c.organizacao_id = v_org and c.removido_em is null;
  if v_c.id is null then raise exception 'Este curso não é desta escola.'; end if;

  return jsonb_build_object(
    'curso', v_c.id,
    'abertoATodos', v_c.aberto_a_todos,
    'publicado', v_c.publicado,
    'alunosAtivos', (select count(*) from nucleo.membros m
                       join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null and u.estado::text = 'Ativo'
                      where m.organizacao_id = v_org and m.app = 'academia' and m.estado = 'ativo' and m.papel = 'aluno'),
    'equipa', (select count(*) from nucleo.membros m
                 join public.utilizadores u on u.id = m.utilizador_id and u.removido_em is null and u.estado::text = 'Ativo'
                where m.organizacao_id = v_org and m.app = 'academia' and m.estado = 'ativo' and m.papel <> 'aluno'),
    -- Quem tem um acesso próprio a este curso: os abertos primeiro.
    'pessoas', (select coalesce(jsonb_agg(x.j order by x.ativo desc, x.desde desc), '[]'::jsonb)
                  from (select jsonb_build_object(
                                 'id', u.id, 'nome', u.nome, 'email', u.email,
                                 'papel', case m.papel when 'dono' then 'admin' else coalesce(m.papel, 'aluno') end,
                                 'suspenso', not (coalesce(m.estado, 'ativo') = 'ativo' and u.estado::text = 'Ativo'),
                                 'origem', a.origem, 'nota', a.nota,
                                 'plano', case when a.nota like 'plano:%' then substr(a.nota, 7) end,
                                 'expira', a.expira_em, 'desde', a.criado_em,
                                 'ativo', a.expira_em is null or a.expira_em >= current_date) as j,
                               (a.expira_em is null or a.expira_em >= current_date) as ativo, a.criado_em as desde
                          from academia.acessos a
                          join public.utilizadores u on u.id = a.utilizador_id and u.removido_em is null
                          left join nucleo.membros m on m.organizacao_id = v_org and m.utilizador_id = u.id and m.app = 'academia'
                         where a.curso_id = p_curso
                         order by (a.expira_em is null or a.expira_em >= current_date) desc, a.criado_em desc
                         limit 2000) x),
    -- Quem entra por uma inscrição no Payflow (só onde o curso está ligado a
    -- uma oferta de lá): não se tira daqui, trata-se lá.
    'payflow', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email)), '[]'::jsonb)
                  from public.turmas t
                  join public.inscricoes i on i.turma_id = t.id and i.removido_em is null
                  join public.leads l      on l.id = i.lead_id and l.removido_em is null
                  join public.utilizadores u on u.removido_em is null and (u.lead_id = l.id or lower(u.email) = lower(l.email))
                  join nucleo.membros m on m.organizacao_id = v_org and m.utilizador_id = u.id and m.app = 'academia'
                 where v_c.oferta_id is not null and t.oferta_id = v_c.oferta_id and t.removido_em is null
                   and i.estado::text in ('Não iniciada', 'Em curso', 'Concluída')),
    'convites', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', c.id, 'email', c.email, 'nome', c.nome, 'origem', c.origem,
                          'expiraEm', c.expira_em, 'acessoDias', c.acesso_dias, 'criadoEm', c.criado_em)
                          order by c.criado_em desc), '[]'::jsonb)
                   from academia.convites c
                  where c.organizacao_id = v_org and p_curso = any(c.cursos)
                    and c.aceite_em is null and c.revogado_em is null and c.expira_em >= now()),
    'ofertas', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', o.id, 'nome', o.nome, 'ativa', o.ativa, 'naVitrine', o.na_vitrine,
                          'dias', o.dias_de_acesso, 'preco', o.preco, 'moeda', o.moeda,
                          'produtos', cardinality(o.produtos), 'temLink', o.link is not null)
                          order by o.ordem, o.criado_em), '[]'::jsonb)
                  from academia.ofertas o
                 where o.organizacao_id = v_org and o.removido_em is null and p_curso = any(o.cursos))
  );
end $$;
revoke execute on function academia.curso_acessos(text) from public, anon;
grant execute on function academia.curso_acessos(text) to authenticated;
