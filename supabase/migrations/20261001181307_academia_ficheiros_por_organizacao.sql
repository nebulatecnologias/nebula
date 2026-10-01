-- F1a — os ficheiros da Academia são de cada organização.
--
-- Os ficheiros novos vão para `o/<id da organização>/<pasta>/…` nos baldes
-- academia-publico e academia-privado. Os 9 de antes (sem prefixo) contam como
-- da Kingdom: mover objectos só se faz pela API do Storage, e não é preciso —
-- quem os usa hoje é toda a Kingdom.
--
-- As regras do Storage não dependem do cabeçalho x-organizacao (a
-- documentação só garante que a API de dados o passa à base). Lêem a
-- organização no próprio caminho e o papel da pessoa nela, em nucleo.membros.
-- Para os materiais, tem_acesso() divide-se em tem_acesso_em(organização,
-- curso); tem_acesso(curso) passa a ser tem_acesso_em(organizacao(), curso),
-- com o mesmo resultado.
--
-- O balde público continua público para leitura (logótipos, capas): o
-- endereço é a protecção, como antes. O que muda é quem lá pode escrever.
--
-- Aplicada por execute_sql (sem `drop`) e registada à mão.

set lock_timeout = '10s';

/* De que organização é um ficheiro, pelo caminho. */
create or replace function academia_privado.organizacao_do_ficheiro(p_nome text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select case
    when split_part(p_nome, '/', 1) = 'o' then
      case when split_part(p_nome, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then split_part(p_nome, '/', 2)::uuid end
    else nucleo.organizacao_kingdom()
  end
$$;

/* A pasta i do caminho, sem contar o prefixo da organização. */
create or replace function academia_privado.pasta_do_ficheiro(p_nome text, p_i int)
returns text language sql immutable set search_path = ''
as $$
  select (storage.foldername(p_nome))[p_i + case when split_part(p_nome, '/', 1) = 'o' then 2 else 0 end]
$$;

/* Membro activo de uma organização dada (não a do pedido). */
create or replace function academia_privado.papel_em(p_organizacao uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case x.p when 'dono' then 'admin' else x.p end
    from (select nucleo.papel(p_organizacao, 'academia') as p) x
   where exists (select 1 from public.utilizadores u
                  where u.id = auth.uid() and u.removido_em is null and u.estado = 'Ativo')
$$;

create or replace function academia_privado.e_equipa_em(p_organizacao uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(academia_privado.papel_em(p_organizacao) in ('admin', 'colaborador'), false) $$;

create or replace function academia_privado.tem_acesso_em(p_organizacao uuid, p_curso text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from academia.cursos c0
                  where c0.id = p_curso and c0.organizacao_id = p_organizacao)
     and (
         academia_privado.e_equipa_em(p_organizacao)
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
     )
$$;

create or replace function academia_privado.tem_acesso_aula_em(p_organizacao uuid, p_aula text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select coalesce((select academia_privado.tem_acesso_em(p_organizacao, m.curso_id)
                     from academia.aulas a join academia.modulos m on m.id = a.modulo_id
                    where a.id = p_aula), false)
$$;

revoke all on function academia_privado.organizacao_do_ficheiro(text), academia_privado.pasta_do_ficheiro(text, int),
  academia_privado.papel_em(uuid), academia_privado.e_equipa_em(uuid),
  academia_privado.tem_acesso_em(uuid, text), academia_privado.tem_acesso_aula_em(uuid, text) from public, anon;
grant execute on function academia_privado.organizacao_do_ficheiro(text), academia_privado.pasta_do_ficheiro(text, int),
  academia_privado.papel_em(uuid), academia_privado.e_equipa_em(uuid),
  academia_privado.tem_acesso_em(uuid, text), academia_privado.tem_acesso_aula_em(uuid, text) to authenticated;

/* A regra de sempre passa a ser a nova com a organização do pedido: o mesmo
   corpo, numa só cópia (e_equipa() é e_equipa_em(organizacao())). */
create or replace function academia_privado.tem_acesso(p_curso text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select academia_privado.tem_acesso_em(academia_privado.organizacao(), p_curso) $$;

/* As regras do Storage. */
alter policy "academia publico: equipa escreve" on storage.objects
  using      (bucket_id = 'academia-publico' and academia_privado.e_equipa_em(academia_privado.organizacao_do_ficheiro(name)))
  with check (bucket_id = 'academia-publico' and academia_privado.e_equipa_em(academia_privado.organizacao_do_ficheiro(name)));

alter policy "academia publico: aluno trata da sua foto" on storage.objects
  using      (bucket_id = 'academia-publico'
              and academia_privado.pasta_do_ficheiro(name, 1) = 'perfis'
              and academia_privado.pasta_do_ficheiro(name, 2) = (auth.uid())::text
              and academia_privado.papel_em(academia_privado.organizacao_do_ficheiro(name)) is not null)
  with check (bucket_id = 'academia-publico'
              and academia_privado.pasta_do_ficheiro(name, 1) = 'perfis'
              and academia_privado.pasta_do_ficheiro(name, 2) = (auth.uid())::text
              and academia_privado.papel_em(academia_privado.organizacao_do_ficheiro(name)) is not null);

alter policy "academia privado: equipa gere" on storage.objects
  using      (bucket_id = 'academia-privado' and academia_privado.e_equipa_em(academia_privado.organizacao_do_ficheiro(name)))
  with check (bucket_id = 'academia-privado' and academia_privado.e_equipa_em(academia_privado.organizacao_do_ficheiro(name)));

alter policy "academia privado: aluno le material a que tem acesso" on storage.objects
  using (bucket_id = 'academia-privado'
         and academia_privado.pasta_do_ficheiro(name, 1) = 'materiais'
         and academia_privado.papel_em(academia_privado.organizacao_do_ficheiro(name)) is not null
         and academia_privado.tem_acesso_aula_em(academia_privado.organizacao_do_ficheiro(name),
                                                 academia_privado.pasta_do_ficheiro(name, 2)));

alter policy "academia privado: comunidade le" on storage.objects
  using (bucket_id = 'academia-privado'
         and academia_privado.pasta_do_ficheiro(name, 1) = 'comunidade'
         and academia_privado.papel_em(academia_privado.organizacao_do_ficheiro(name)) is not null);

alter policy "academia privado: aluno anexa na sua pasta" on storage.objects
  with check (bucket_id = 'academia-privado'
              and academia_privado.pasta_do_ficheiro(name, 1) = 'comunidade'
              and academia_privado.pasta_do_ficheiro(name, 2) = (auth.uid())::text
              and academia_privado.papel_em(academia_privado.organizacao_do_ficheiro(name)) is not null);

alter policy "academia privado: aluno apaga o seu anexo" on storage.objects
  using (bucket_id = 'academia-privado'
         and academia_privado.pasta_do_ficheiro(name, 1) = 'comunidade'
         and academia_privado.pasta_do_ficheiro(name, 2) = (auth.uid())::text
         and academia_privado.papel_em(academia_privado.organizacao_do_ficheiro(name)) is not null);
