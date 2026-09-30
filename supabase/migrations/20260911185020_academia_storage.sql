-- Migração 20260911185020 «academia_storage», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- Storage da academia
-- Imagens e ficheiros deixam de viver dentro da base de dados.
--
-- Dois baldes, por razoes diferentes:
--  publico  — capas, banners e fotos de perfil. Sao vistos por toda
--             a academia e ganham um endereco directo, sem assinatura
--             a expirar. O caminho leva um identificador ao calhas,
--             por isso nao se adivinha.
--  privado  — materiais das aulas e anexos da comunidade. Sao
--             conteudo pago ou conversa entre alunos: exigem
--             endereco assinado, com validade.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('academia-publico', 'academia-publico', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('academia-privado', 'academia-privado', false, 10485760, null)
on conflict (id) do nothing;

-- ---------------- Balde publico ----------------
-- Ler: qualquer pessoa (e o que "publico" quer dizer).
-- Escrever: a equipa, em qualquer pasta; o aluno, so na pasta dele.
create policy "academia publico: equipa escreve"
  on storage.objects for all to authenticated
  using (bucket_id = 'academia-publico' and academia_privado.e_equipa())
  with check (bucket_id = 'academia-publico' and academia_privado.e_equipa());

create policy "academia publico: aluno trata da sua foto"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'academia-publico'
    and (storage.foldername(name))[1] = 'perfis'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'academia-publico'
    and (storage.foldername(name))[1] = 'perfis'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------------- Balde privado ----------------
-- Materiais das aulas: a equipa poe, quem tem acesso ao curso le.
create policy "academia privado: equipa gere"
  on storage.objects for all to authenticated
  using (bucket_id = 'academia-privado' and academia_privado.e_equipa())
  with check (bucket_id = 'academia-privado' and academia_privado.e_equipa());

create policy "academia privado: aluno le material a que tem acesso"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'academia-privado'
    and (storage.foldername(name))[1] = 'materiais'
    and academia_privado.tem_acesso_aula((storage.foldername(name))[2])
  );

-- Anexos da comunidade: quem esta na academia le; cada um poe na sua pasta.
create policy "academia privado: comunidade le"
  on storage.objects for select to authenticated
  using (bucket_id = 'academia-privado' and (storage.foldername(name))[1] = 'comunidade');

create policy "academia privado: aluno anexa na sua pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'academia-privado'
    and (storage.foldername(name))[1] = 'comunidade'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "academia privado: aluno apaga o seu anexo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'academia-privado'
    and (storage.foldername(name))[1] = 'comunidade'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
