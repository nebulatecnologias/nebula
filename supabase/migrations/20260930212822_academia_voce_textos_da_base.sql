-- A Academia trata o aluno por «você» (decidido a 30/09/2026).
-- Muda só os textos que a própria Academia escreveu de raiz: as descrições
-- das quatro conquistas de origem e o texto de entrada por omissão. Cada linha
-- só muda se ainda tiver exactamente o texto antigo — o que a equipa já
-- reescreveu à mão fica como está.
--
-- Os cursos e o banner escritos pela equipa ficam de fora: são texto de quem
-- os escreveu, e mudam-se no painel.
--
-- As tabelas têm FORCE ROW LEVEL SECURITY: confere-se a contagem, para um
-- update que não apanhe nada não passar em silêncio.
do $$
declare
  v_conquistas int;
  v_config int;
  v_antigo constant text := 'Acede à tua área de membros para continuares os teus cursos onde ficaste — módulos, aulas, comunidade e o teu progresso, tudo num só lugar.';
  v_novo constant text := 'Aceda à sua área de membros e continue os seus cursos onde ficou — módulos, aulas, comunidade e o seu progresso, tudo num só lugar.';
begin
  update academia.conquistas c
     set descricao = n.novo
    from (values
      ('Concluíste a tua primeira aula.',        'Concluiu a sua primeira aula.'),
      ('Terminaste um módulo inteiro.',          'Terminou um módulo inteiro.'),
      ('Terminaste um curso do início ao fim.',  'Terminou um curso do início ao fim.'),
      ('Atingiste 50% do teu progresso geral.',  'Atingiu 50% do seu progresso geral.')
    ) as n(antigo, novo)
   where c.descricao = n.antigo;
  get diagnostics v_conquistas = row_count;

  update academia.config
     set valor = jsonb_set(valor, '{loginTexto}', to_jsonb(v_novo))
   where chave in ('aparencia', 'aparencia_anterior')
     and valor->>'loginTexto' = v_antigo;
  get diagnostics v_config = row_count;

  raise notice 'conquistas: %, config: %', v_conquistas, v_config;
  if v_conquistas <> 4 or v_config <> 2 then
    raise exception 'esperava 4 conquistas e 2 linhas de config, mudaram % e %', v_conquistas, v_config;
  end if;
end $$;
