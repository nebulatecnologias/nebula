-- Migração 20260911081130 «academia_dados_de_arranque», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

-- ============================================================
-- Arranque: categorias, espacos, emblemas e configuracao.
-- O conteudo (cursos, aulas, eventos, banners) entra pela
-- importacao do que ja existe no prototipo.
-- ============================================================
insert into academia.categorias (id, nome, cor, ordem) values
  ('negocios',        'Negócios',                 '#ff5a1f', 1),
  ('mentalidade',     'Mentalidade',              '#7c9eff', 2),
  ('ia',              'Inteligência Artificial',  '#34d1c9', 3),
  ('marketing',       'Marketing e Vendas',       '#ffcf5c', 4),
  ('espiritualidade', 'Espiritualidade',          '#b98bff', 5),
  ('pessoal',         'Desenvolvimento Pessoal',  '#3ddc84', 6)
on conflict (id) do nothing;

insert into academia.espacos (id, nome, descricao, cor, ativo, so_admin_publica, ordem) values
  ('geral',    'Geral',              'Conversa aberta a toda a academia.',        '#ff5a1f', true, false, 1),
  ('vitorias', 'Vitórias',           'Partilha resultados e conquistas.',         '#3ddc84', true, false, 2),
  ('duvidas',  'Dúvidas',            'Perguntas sobre as aulas e os exercícios.', '#7c9eff', true, false, 3),
  ('avisos',   'Avisos da Academia', 'Comunicados oficiais. Só a equipa publica.','#ffcf5c', true, true,  4)
on conflict (id) do nothing;

insert into academia.conquistas (id, titulo, descricao, regra, ordem) values
  ('b1','Primeiro Passo','Concluíste a tua primeira aula.',                    '{"tipo":"aulas","valor":1}',       1),
  ('b2','Módulo Completo','Terminaste um módulo inteiro.',                     '{"tipo":"modulos","valor":1}',     2),
  ('b3','Primeiro Curso Concluído','Terminaste um curso do início ao fim.',    '{"tipo":"cursos","valor":1}',      3),
  ('b4','Sequência de Fogo','5 dias seguidos de estudo.',                      '{"tipo":"sequencia","valor":5}',   4),
  ('b5','Mente Multidisciplinar','Progresso em 3 áreas diferentes.',           '{"tipo":"categorias","valor":3}',  5),
  ('b6','Metade do Caminho','Atingiste 50% do teu progresso geral.',           '{"tipo":"percentagem","valor":50}',6)
on conflict (id) do nothing;

insert into academia.config (chave, valor) values
  ('aparencia', jsonb_build_object(
      'nomeEscola','Kingdom Academy',
      'sublinha','Formação & Mentoria',
      'logoUrl','',
      'corAccent','#ff5a1f',
      'temaPadrao','dark',
      'rodape','© 2026 Kingdom Company',
      'loginTitulo','Autoridade constrói-se em privado, muito antes de aparecer em público.',
      'loginTexto','Acede à tua área de membros para continuares os teus cursos onde ficaste — módulos, aulas, comunidade e o teu progresso, tudo num só lugar.')),
  ('geral', jsonb_build_object(
      'bannerIntervalo', 60,
      'mostrarCursosBloqueados', true,
      'alunosPublicam', true,
      'abasAluno', jsonb_build_array('dashboard','catalogo','vitrine','calendario','comunidade','conquistas','certificados','definicoes'))),
  ('gamificacao', jsonb_build_object('xpPorAula', 50, 'xpPorNivel', 500)),
  ('certificado', jsonb_build_object(
      'regraPct', 100,
      'titulo','CERTIFICADO DE CONCLUSÃO',
      'frase','concluiu com sucesso o curso',
      'rodape','na Kingdom Academy',
      'assinaturaNome','Shelton Douglas',
      'assinaturaCargo','Fundador · Kingdom Academy')),
  ('integracoes', jsonb_build_object(
      'player','Panda Video',
      'suporteRotulo','Falar com a mentoria',
      'suporteUrl',''))
on conflict (chave) do nothing;
