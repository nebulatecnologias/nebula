/* ============================================================
   Dados mock — Kingdom Academy
   ============================================================ */
const ALUNO = { nome: "Sofia Domingos" };

const ICONS = {
  home:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
  book:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></svg>',
  cal:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>',
  people: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="6" r="4"/><path d="M23 20v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  trophy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1 5 5 0 0 0 4 4.9"/><path d="M17 5h3a1 1 0 0 1 1 1 5 5 0 0 1-4 4.9"/></svg>',
  cert:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/></svg>',
  lapis:  '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  ficheiro: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
  quiz:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5"/><path d="m3 12 1.5 1.5L7 11"/><path d="m3 18 1.5 1.5L7 17"/></svg>',
  gear:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/></svg>',
  layers: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  image:  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-9 9"/></svg>',
  card:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  mail:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/></svg>',
  chat:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-.95L3 20l1.05-3.5A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>',
  globe:  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  flag:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>',
  tag:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m20.5 12.4-8-8A2 2 0 0 0 11 3.7H4.7A1.7 1.7 0 0 0 3 5.4V11.7a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6.1-6.1a2 2 0 0 0 0-2.6Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
  chart:  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  spark:  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z"/></svg>',
  plug:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2v6M15 2v6M6 8h12l-1 5a5 5 0 0 1-5 4 5 5 0 0 1-5-4L6 8Z"/><path d="M12 17v5"/></svg>',
  palette:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 1.6-1.9-.2-.5-.1-1.1.3-1.5.4-.4 1-.5 1.5-.3 1.7.7 3.6-.5 3.6-2.3 0-4.4-3.1-8-7-9Z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10.5" cy="7.5" r="1.2"/><circle cx="15" cy="8.5" r="1.2"/></svg>',
  chevronDown: '<svg class="icon icon-sm chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  cadeado: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z"/></svg>'
};

const NAV_ALUNO = [
  { grupo:"Geral", itens:[
    { view:"dashboard", label:"Início", icon:ICONS.home },
    { view:"catalogo", label:"Meus cursos", icon:ICONS.book },
    { view:"vitrine", label:"Vitrine", icon:ICONS.tag },
    { view:"calendario", label:"Calendário", icon:ICONS.cal, dot:"calendario" },
    { view:"comunidade", label:"Comunidade", icon:ICONS.people, dot:"comunidade" }
  ]},
  { grupo:"Progresso", itens:[
    { view:"conquistas", label:"Conquistas", icon:ICONS.trophy },
    { view:"certificados", label:"Certificados", icon:ICONS.cert, dot:"certificados" }
  ]},
  { grupo:"Conta", itens:[
    { view:"definicoes", label:"Definições", icon:ICONS.gear }
  ]}
];

const NAV_ADMIN = [
  { grupo:"Geral", itens:[
    { view:"admin-visao", label:"Visão geral", icon:ICONS.home }
  ]},
  { grupo:"Conteúdo", itens:[
    { view:"admin-conteudos", label:"Conteúdos", icon:ICONS.book },
    { view:"admin-vitrine", label:"Vitrine", icon:ICONS.tag },
    { view:"admin-turmas", label:"Turmas", icon:ICONS.layers },
    { view:"admin-eventos", label:"Eventos", icon:ICONS.cal },
    { view:"admin-certificados", label:"Certificados", icon:ICONS.cert },
    { view:"admin-banners", label:"Banners", icon:ICONS.image }
  ]},
  { grupo:"Alunos e Comunidade", itens:[
    { view:"admin-assinaturas", label:"Assinaturas", icon:ICONS.card },
    { view:"admin-convites", label:"Convites", icon:ICONS.mail },
    { view:"admin-migracao", label:"Migração", icon:ICONS.people },
    { view:"admin-membros", label:"Membros", icon:ICONS.people },
    { view:"admin-comentarios", label:"Comentários", icon:ICONS.chat },
    { view:"admin-comunidades", label:"Comunidades", icon:ICONS.globe },
    { view:"admin-ranking", label:"Ranking", icon:ICONS.flag }
  ]},
  { grupo:"Negócio", itens:[
    { view:"admin-relatorios", label:"Relatórios", icon:ICONS.chart },
    { view:"admin-ia", label:"Assistente IA", icon:ICONS.spark },
    { view:"admin-integracoes", label:"Integrações", icon:ICONS.plug }
  ]},
  { grupo:"Conta", itens:[
    { view:"admin-aparencia", label:"Aparência", icon:ICONS.palette },
    { view:"admin-config", label:"Configurações", icon:ICONS.gear }
  ]}
];

const CATEGORIAS_PADRAO = {
  negocios:      { nome:"Negócios",                  cor:"#ff5a1f" },
  mentalidade:   { nome:"Mentalidade",                cor:"#7c9eff" },
  ia:            { nome:"Inteligência Artificial",    cor:"#34d1c9" },
  marketing:     { nome:"Marketing e Vendas",         cor:"#ffcf5c" },
  espiritualidade:{ nome:"Espiritualidade",           cor:"#b98bff" },
  pessoal:       { nome:"Desenvolvimento Pessoal",    cor:"#3ddc84" }
};

const CURSOS_PADRAO = [
  { id:"kt", categoria:"negocios", titulo:"Kingdom Tracktion", subtitulo:"Mastermind de empresários para decisões de alto impacto entre pares.",
    modulos:[
      { id:"kt-m1", titulo:"Módulo 1: Fundamentos da Autoridade", descricao:"Antes de escalar um negócio, escala-se a si mesmo.", aulas:[
        { id:"kt-m1a1", titulo:"A identidade do fundador", duracao:"12:34", descricao:"Como a forma como te vês a ti mesmo determina o teto do teu negócio, muito antes de qualquer estratégia entrar em jogo." },
        { id:"kt-m1a2", titulo:"Visão vs. ambição", duracao:"09:15", descricao:"A diferença entre construir a partir de um chamado e construir a partir da pressa." },
        { id:"kt-m1a3", titulo:"Construir antes de escalar", duracao:"15:02", descricao:"Os alicerces que a maioria ignora sob pressão de crescer depressa." },
        { id:"kt-m1a4", titulo:"O preço da liderança", duracao:"11:48", descricao:"Decisões impopulares, solidão no topo e a disciplina de manter o rumo." }
      ]},
      { id:"kt-m2", titulo:"Módulo 2: Estrutura e Sistemas", descricao:"Negócios que dependem de ti não escalam — dependem de sistemas.", aulas:[
        { id:"kt-m2a1", titulo:"Modelar o negócio", duracao:"14:20", descricao:"Desenhar o modelo de receita e operação antes de contratar a próxima pessoa." },
        { id:"kt-m2a2", titulo:"Processos que escalam", duracao:"10:33", descricao:"Documentar o que funciona para que deixe de depender só de ti." },
        { id:"kt-m2a3", titulo:"Equipas de alto nível", duracao:"13:07", descricao:"Contratar por carácter e treinar por competência." },
        { id:"kt-m2a4", titulo:"Cultura como vantagem competitiva", duracao:"10:58", descricao:"Como princípios claros substituem centenas de regras não escritas." }
      ]},
      { id:"kt-m3", titulo:"Módulo 3: Capital e Decisão", descricao:"Ler números com clareza para decidir com coragem.", aulas:[
        { id:"kt-m3a1", titulo:"Ler os números com clareza", duracao:"16:45", descricao:"Os quatro indicadores que todo o fundador deveria conhecer de memória." },
        { id:"kt-m3a2", titulo:"Risco calculado", duracao:"12:10", descricao:"Separar risco de imprudência." },
        { id:"kt-m3a3", titulo:"Negociação de alto nível", duracao:"14:58", descricao:"Negociar a partir de posição, não de necessidade." },
        { id:"kt-m3a4", titulo:"Sair da sala com decisões", duracao:"09:40", descricao:"Porque reuniões sem decisão são o maior custo escondido de uma equipa." }
      ]}
    ]},
  { id:"mi", categoria:"mentalidade", titulo:"Mentalidade Inquebrável", subtitulo:"Reprograma crenças limitantes e constrói uma mente antifrágil.",
    modulos:[
      { id:"mi-m1", titulo:"Módulo 1: A Origem das Crenças", descricao:"O que molda a tua forma de pensar sem que percebas.", aulas:[
        { id:"mi-m1a1", titulo:"Como se formam as crenças limitantes", duracao:"08:12", descricao:"A raiz emocional por trás de quase toda a autossabotagem." },
        { id:"mi-m1a2", titulo:"O ciclo pensamento-emoção-ação", duracao:"10:05", descricao:"Como um pensamento automático se transforma num resultado real." },
        { id:"mi-m1a3", titulo:"Identificar o teu diálogo interno", duracao:"07:40", descricao:"A voz que te acompanha o dia todo — e como a treinar." }
      ]},
      { id:"mi-m2", titulo:"Módulo 2: Reprogramação Mental", descricao:"Ferramentas práticas para mudar padrões em semanas, não anos.", aulas:[
        { id:"mi-m2a1", titulo:"A técnica dos 90 segundos", duracao:"09:30", descricao:"Como deixar uma emoção intensa passar sem te dominar." },
        { id:"mi-m2a2", titulo:"Ancorar novos estados emocionais", duracao:"11:15", descricao:"Criar gatilhos físicos para estados de confiança sob comando." },
        { id:"mi-m2a3", titulo:"Rotina matinal de mentalidade vencedora", duracao:"06:55", descricao:"Os primeiros 20 minutos do dia que decidem os outros 23 horas." }
      ]}
    ]},
  { id:"ia", categoria:"ia", titulo:"IA Aplicada aos Negócios", subtitulo:"Usa inteligência artificial para vender mais e trabalhar menos.",
    modulos:[
      { id:"ia-m1", titulo:"Módulo 1: Fundamentos de IA para Empresários", descricao:"O essencial sem jargão técnico.", aulas:[
        { id:"ia-m1a1", titulo:"O que a IA já pode fazer pelo teu negócio", duracao:"10:20", descricao:"Um mapa realista de onde a IA já poupa tempo e dinheiro hoje." },
        { id:"ia-m1a2", titulo:"Escolher as ferramentas certas", duracao:"08:45", descricao:"Como não te perderes entre centenas de opções novas todas as semanas." },
        { id:"ia-m1a3", titulo:"Prompting eficaz para resultados de negócio", duracao:"12:30", descricao:"A estrutura de prompt que transforma respostas genéricas em trabalho pronto a usar." }
      ]},
      { id:"ia-m2", titulo:"Módulo 2: Automação e Escala", descricao:"Da ferramenta isolada ao sistema que trabalha por ti.", aulas:[
        { id:"ia-m2a1", titulo:"Automatizar atendimento ao cliente", duracao:"09:50", descricao:"Responder mais rápido sem contratar mais uma pessoa." },
        { id:"ia-m2a2", titulo:"IA na criação de conteúdo", duracao:"11:05", descricao:"Produzir semanas de conteúdo em horas, mantendo a tua voz." },
        { id:"ia-m2a3", titulo:"Montar o teu primeiro fluxo automatizado", duracao:"13:40", descricao:"Passo a passo para ligar as tuas primeiras ferramentas entre si." }
      ]}
    ]},
  { id:"vv", categoria:"marketing", titulo:"Vendas de Alto Impacto", subtitulo:"Sistemas e psicologia de venda para fechar mais, com mais dignidade.",
    modulos:[
      { id:"vv-m1", titulo:"Módulo 1: Psicologia da Venda", descricao:"Entender antes de convencer.", aulas:[
        { id:"vv-m1a1", titulo:"Porque as pessoas realmente compram", duracao:"09:12", descricao:"A diferença entre a razão que dizem e o motivo que sentem." },
        { id:"vv-m1a2", titulo:"Construir confiança em 60 segundos", duracao:"07:28", descricao:"Os sinais que fazem alguém baixar a guarda numa conversa de venda." },
        { id:"vv-m1a3", titulo:"Lidar com objeções sem parecer desesperado", duracao:"10:44", descricao:"Responder ao \"vou pensar\" sem pressionar nem desistir." }
      ]},
      { id:"vv-m2", titulo:"Módulo 2: Sistemas de Vendas", descricao:"Processos que vendem mesmo quando não estás a olhar.", aulas:[
        { id:"vv-m2a1", titulo:"O funil que nunca dorme", duracao:"12:15", descricao:"Desenhar um percurso de venda que continua a trabalhar 24 horas." },
        { id:"vv-m2a2", titulo:"Scripts que convertem", duracao:"08:50", descricao:"Estrutura de conversa que se adapta sem soar decorada." },
        { id:"vv-m2a3", titulo:"Fechar sem pressionar", duracao:"09:33", descricao:"Convidar para a decisão em vez de empurrar para ela." }
      ]}
    ]},
  { id:"pf", categoria:"espiritualidade", titulo:"Propósito em Movimento", subtitulo:"Fé, direção e significado para quem lidera um negócio.",
    modulos:[
      { id:"pf-m1", titulo:"Módulo 1: Fé e Direção", descricao:"Discernir o caminho em meio ao ruído da vida empresarial.", aulas:[
        { id:"pf-m1a1", titulo:"Ouvir a voz certa em meio ao ruído", duracao:"11:02", descricao:"Como distinguir intuição, medo e direção real." },
        { id:"pf-m1a2", titulo:"Propósito não é destino, é caminho", duracao:"09:18", descricao:"Porque a pergunta \"para quê\" importa mais do que \"para onde\"." },
        { id:"pf-m1a3", titulo:"Disciplina espiritual do empresário", duracao:"10:07", descricao:"Práticas diárias que sustentam decisões de longo prazo." }
      ]},
      { id:"pf-m2", titulo:"Módulo 2: Serviço e Significado", descricao:"Fazer do negócio um instrumento maior do que o lucro.", aulas:[
        { id:"pf-m2a1", titulo:"Negócio como instrumento, não como ídolo", duracao:"08:40", descricao:"Reordenar prioridades sem perder ambição." },
        { id:"pf-m2a2", titulo:"Gerar impacto além do lucro", duracao:"09:55", descricao:"Formas concretas de servir através daquilo que já constróis." },
        { id:"pf-m2a3", titulo:"Descansar sem culpa", duracao:"07:20", descricao:"Porque parar também é uma decisão de liderança." }
      ]}
    ]},
  { id:"he", categoria:"pessoal", titulo:"Hábitos de Elite", subtitulo:"A rotina diária que separa quem sonha de quem executa.",
    modulos:[
      { id:"he-m1", titulo:"Módulo 1: Fundamentos dos Hábitos", descricao:"A ciência simples por trás de mudanças duradouras.", aulas:[
        { id:"he-m1a1", titulo:"A ciência por trás dos hábitos", duracao:"09:40", descricao:"O loop de hábito e porque a força de vontade não é suficiente." },
        { id:"he-m1a2", titulo:"Empilhar hábitos pequenos", duracao:"07:55", descricao:"Como usar o que já fazes para instalar o que ainda não fazes." },
        { id:"he-m1a3", titulo:"Eliminar o que já não serve", duracao:"08:22", descricao:"Identificar hábitos que só existem por inércia." }
      ]},
      { id:"he-m2", titulo:"Módulo 2: Rotinas de Alta Performance", descricao:"Desenhar dias que produzem resultados de anos.", aulas:[
        { id:"he-m2a1", titulo:"Desenhar o teu dia ideal", duracao:"10:12", descricao:"Partir do resultado desejado para montar a rotina, não o contrário." },
        { id:"he-m2a2", titulo:"Energia antes de tempo", duracao:"08:47", descricao:"Porque geris energia, não apenas minutos." },
        { id:"he-m2a3", titulo:"Revisão semanal de elite", duracao:"06:58", descricao:"O ritual de 20 minutos que mantém tudo o resto no rumo." }
      ]}
    ]}
];

const OFERTAS_PADRAO = [
  { id:"of1", nome:"Kingdom All Access", descricao:"Todos os cursos, mentorias ao vivo e comunidade.", preco:2500,  precoAntes:3500, periodo:"mês",   planoId:"all-access", link:"#", destaque:true,  ativa:true },
  { id:"of2", nome:"Acesso Vitalício",   descricao:"Paga uma vez e fica com tudo, para sempre.",       preco:38000, precoAntes:0,    periodo:"único", planoId:"vitalicio",  link:"#", destaque:false, ativa:true }
];

/* A Vitrine da demonstração. Com servidor isto vem de vitrine_do_aluno(), já
   filtrado e guardado; aqui é escrito à mão para os ecrãs se poderem ver e
   testar sem ligação nenhuma. */
const VITRINE_PADRAO = [
  { ofertaId:"of1", nome:"Kingdom All Access", preco:2500, moeda:"MZN", mensal:true,
    entrega:"Plano", destaque:true, chamada:"Todos os cursos, mentorias ao vivo e comunidade.",
    ordem:1, aulas:24, checkout:true, destino:"https://payflow.kingdomcompny.com/all-access",
    cursos:[{ id:"kt", titulo:"Kingdom Tracktion", subtitulo:"", capa:"", categoria:"negocios", aulas:12, modulos:3 },
            { id:"mi", titulo:"Mentalidade Inquebrável", subtitulo:"", capa:"", categoria:"mentalidade", aulas:12, modulos:3 }] },
  { ofertaId:"of2", nome:"Hábitos de Elite", preco:1200, moeda:"MZN", mensal:false,
    entrega:"Academia", destaque:false, chamada:"", ordem:2, aulas:8,
    checkout:true, destino:"https://payflow.kingdomcompny.com/habitos-de-elite",
    cursos:[{ id:"he", titulo:"Hábitos de Elite", subtitulo:"O que se faz todos os dias.",
              capa:"", categoria:"pessoal", aulas:8, modulos:2 }] }
];

const TURMAS_PADRAO = [
  { id:"t1", nome:"Kingdom Tracktion · Turma 2", cursoId:"kt", inicio:"2026-09-01", fim:"2026-12-15", membros:["m1","m7"], ativa:true },
  { id:"t2", nome:"IA Aplicada · Janeiro",       cursoId:"ia", inicio:"2026-01-15", fim:"2026-03-30", membros:["m2"],      ativa:true }
];

/* Um plano é só um nome e os cursos que leva dentro. O preço não está aqui:
   está na oferta que o vende, no Payflow. Enquanto estiveram nos dois sítios,
   os dois números discordavam. */
const PLANOS_PADRAO = [
  { id:"all-access", nome:"Kingdom All Access", descricao:"Tudo o que há na academia.", ofertaId:null, cursos:["kt","mi","he"], ordem:1 },
  { id:"essencial",  nome:"Essencial",          descricao:"Os dois cursos de base.",    ofertaId:null, cursos:["mi","he"],      ordem:2 }
];

const MEMBROS_PADRAO = [
  { id:"m1", nome:"Marta Macomo",        email:"marta@studiomacomo.co",  telefone:"+258 84 221 4408", papel:"aluno", planoId:"all-access", acesso:"ativo",     membroDesde:"2026-01-12", curso:"Kingdom Tracktion",       categoria:"negocios",       origem:"Instagram",      ultimoAcesso:"há 2 dias",  engajamento:"quente", progresso:82,  estagio:"ativo",     responsavel:"Maria M." },
  { id:"m2", nome:"Airson Zunguze",      email:"airson@worldofpunch.co", telefone:"+258 87 445 2210", papel:"aluno", planoId:"all-access", acesso:"ativo",     membroDesde:"2026-02-03", curso:"IA Aplicada aos Negócios", categoria:"ia",            origem:"Instagram",      ultimoAcesso:"há 5 dias",  engajamento:"morno",  progresso:45,  estagio:"ativo",     responsavel:"Shelton D." },
  { id:"m3", nome:"Leatricia Vilanculos", email:"leatricia@tongasbbq.co", telefone:"+258 85 118 6640", papel:"aluno", planoId:"vitalicio",  acesso:"ativo",     membroDesde:"2026-01-20", curso:"Mentalidade Inquebrável", categoria:"mentalidade",    origem:"Indicação",      ultimoAcesso:"hoje",       engajamento:"quente", progresso:100, estagio:"concluido", responsavel:"Maria M." },
  { id:"m4", nome:"Renato Alfredo",      email:"renato@mtanation.co",    telefone:"+258 84 002 9931", papel:"aluno", planoId:"essencial",  acesso:"ativo",     membroDesde:"2026-03-14", curso:"Vendas de Alto Impacto",  categoria:"marketing",      origem:"Instagram",      ultimoAcesso:"há 12 dias", engajamento:"frio",   progresso:8,   estagio:"risco",     responsavel:"Shelton D." },
  { id:"m5", nome:"Hostina Daia",        email:"hostina@daiaenergias.co", telefone:"+258 86 330 7781", papel:"aluno", planoId:"all-access", acesso:"ativo",     membroDesde:"2026-02-28", curso:"Propósito em Movimento",  categoria:"espiritualidade", origem:"Facebook",      ultimoAcesso:"há 1 dia",   engajamento:"morno",  progresso:60,  estagio:"ativo",     responsavel:"Maria M." },
  { id:"m6", nome:"Clarisse Jamnadas",   email:"clarisse@visador.co",    telefone:"+258 82 900 1177", papel:"aluno", planoId:"essencial",  acesso:"ativo",     membroDesde:"2026-04-02", curso:"Hábitos de Elite",        categoria:"pessoal",        origem:"Perfil pessoal", ultimoAcesso:"há 3 dias",  engajamento:"morno",  progresso:30,  estagio:"ativo",     responsavel:"Shelton D." },
  { id:"m7", nome:"Mendes Alfazema",     email:"mendes@cafridjah.co",    telefone:"+258 84 776 3092", papel:"aluno", planoId:"essencial",  acesso:"bloqueado", membroDesde:"2026-01-08", curso:"Kingdom Tracktion",       categoria:"negocios",       origem:"Indicação",      ultimoAcesso:"há 20 dias", engajamento:"frio",   progresso:15,  estagio:"inativo",   responsavel:"Maria M." },
  { id:"m8", nome:"Ana Chissano",        email:"ana@chissanoco.co",      telefone:"+258 84 550 1120", papel:"aluno", planoId:"vitalicio",  acesso:"ativo",     membroDesde:"2026-02-10", curso:"Mentalidade Inquebrável", categoria:"mentalidade",    origem:"Instagram",      ultimoAcesso:"hoje",       engajamento:"quente", progresso:100, estagio:"concluido", responsavel:"Shelton D." },
  { id:"m9", nome:"Shelton Douglas",     email:"admin@kingdomacademy.com", telefone:"+258 84 000 0000", papel:"administrador", planoId:"vitalicio", acesso:"ativo", membroDesde:"2026-01-01", curso:"—", categoria:"negocios", origem:"Equipa", ultimoAcesso:"hoje", engajamento:"quente", progresso:0, estagio:"ativo", responsavel:"—" }
];

const CURSO_STATS_PADRAO = {
  kt:{ inscritos:186, avaliacao:4.8, conclusao:34 },
  mi:{ inscritos:142, avaliacao:4.9, conclusao:88 },
  ia:{ inscritos:97,  avaliacao:4.7, conclusao:52 },
  vv:{ inscritos:64,  avaliacao:4.6, conclusao:21 },
  pf:{ inscritos:53,  avaliacao:4.9, conclusao:47 },
  he:{ inscritos:41,  avaliacao:4.5, conclusao:19 }
};

const EVENTOS_PADRAO = [
  { id:"e1", titulo:"Mentoria em Grupo: Plano de 90 Dias", categoria:"negocios", data:"2026-09-16", hora:"19:00", tipo:"Mentoria ao vivo", link:"" },
  { id:"e2", titulo:"Q&A: Vender com Ajuda da IA", categoria:"ia", data:"2026-09-19", hora:"20:00", tipo:"Perguntas e respostas", link:"" },
  { id:"e3", titulo:"Roda de Espiritualidade e Propósito", categoria:"espiritualidade", data:"2026-09-24", hora:"19:30", tipo:"Encontro em grupo", link:"" },
  { id:"e4", titulo:"Masterclass: Como Precificar Serviços", categoria:"marketing", data:"2026-08-28", hora:"19:00", tipo:"Masterclass", link:"" }
];

const ESPACOS_PADRAO = [
  { id:"geral",    nome:"Geral",              descricao:"Conversa aberta a toda a academia.",            cor:"#ff5a1f", ativo:true, soAdminPublica:false },
  { id:"vitorias", nome:"Vitórias",           descricao:"Partilha resultados e conquistas.",             cor:"#3ddc84", ativo:true, soAdminPublica:false },
  { id:"duvidas",  nome:"Dúvidas",            descricao:"Perguntas sobre as aulas e os exercícios.",     cor:"#7c9eff", ativo:true, soAdminPublica:false },
  { id:"avisos",   nome:"Avisos da Academia", descricao:"Comunicados oficiais. Só a equipa publica.",    cor:"#ffcf5c", ativo:true, soAdminPublica:true }
];

const POSTS_PADRAO = [
  { id:"p4", autor:"Kingdom Academy", iniciais:"KA", tempo:"há 2h", categoria:"negocios", espacoId:"avisos", fixado:true, oculto:false, texto:"Lembrete: a Mentoria em Grupo do Plano de 90 Dias é já esta semana. Traz a tua pergunta mais difícil.", likes:24, curtido:false },
  { id:"p3", autor:"Marcos Vilanculos", iniciais:"MV", tempo:"há 5h", categoria:"ia", espacoId:"vitorias", fixado:false, oculto:false, texto:"Apliquei o prompt da aula 3 no meu atendimento e poupei 2h por dia. Quem mais já testou?", likes:18, curtido:false },
  { id:"p2", autor:"Ana Chissano", iniciais:"AC", tempo:"há 1 dia", categoria:"mentalidade", espacoId:"vitorias", fixado:false, oculto:false, texto:"A técnica dos 90 segundos mudou a forma como lido com clientes difíceis. Recomendo sem dúvida.", likes:31, curtido:true },
  { id:"p1", autor:"Rui Macuácua", iniciais:"RM", tempo:"há 2 dias", categoria:"espiritualidade", espacoId:"geral", fixado:false, oculto:false, texto:"\"Negócio como instrumento, não como ídolo\" — aula que precisava de ouvir hoje.", likes:12, curtido:false }
];

/* Avaliações das aulas: são conteúdo que o administrador modera, por isso
   vivem no DB e não na sessão de cada aluno. */
const AVALIACOES_PADRAO = [
  { id:"av1", cursoId:"kt", aulaId:"kt-m1a1", membroId:"m1", nome:"Marta Macomo",        estrelas:5, comentario:"A parte da identidade do fundador arrumou-me a cabeça.", data:"2026-09-02", oculto:false },
  { id:"av2", cursoId:"mi", aulaId:"mi-m2a1", membroId:"m8", nome:"Ana Chissano",        estrelas:5, comentario:"A técnica dos 90 segundos vale o curso inteiro.",        data:"2026-09-05", oculto:false },
  { id:"av3", cursoId:"ia", aulaId:"ia-m1a3", membroId:"m2", nome:"Airson Zunguze",      estrelas:4, comentario:"Bom, mas gostava de mais exemplos práticos de prompts.", data:"2026-09-06", oculto:false },
  { id:"av4", cursoId:"vv", aulaId:"vv-m1a1", membroId:"m4", nome:"Renato Alfredo",      estrelas:2, comentario:"Achei o áudio baixo nesta aula.",                        data:"2026-09-08", oculto:false },
  { id:"av5", cursoId:"he", aulaId:"he-m1a2", membroId:"m6", nome:"Clarisse Jamnadas",   estrelas:5, comentario:"", data:"2026-09-09", oculto:false }
];

const ICONS_BADGE = [
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1 5 5 0 0 0 4 4.9"/><path d="M17 5h3a1 1 0 0 1 1 1 5 5 0 0 1-4 4.9"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C8 6 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-2-7-6-11z"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m9 12 2 2 4-4"/></svg>',
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="6" r="4"/></svg>'
];

const NOTIFICACOES_PADRAO = [
  { titulo:"Nova conquista desbloqueada", desc:"Mente Multidisciplinar — continua assim!", tempo:"há 2h", lida:false },
  { titulo:"Lembrete: Mentoria em Grupo", desc:"Plano de 90 Dias começa esta semana.", tempo:"há 5h", lida:false },
  { titulo:"Certificado disponível", desc:"O teu certificado de Mentalidade Inquebrável já pode ser descarregado.", tempo:"há 1 dia", lida:true },
  { titulo:"Nova publicação na comunidade", desc:"Marcos Vilanculos respondeu à tua pergunta.", tempo:"há 2 dias", lida:true }
];

const BANNERS_PADRAO = [
  { id:"b1", ativo:true, eyebrow:"MENTORIA EM GRUPO", titulo:"Plano de 90 Dias — inscreve-te já", cta:"Garantir vaga", link:"#", imagem:"", gradiente:"linear-gradient(160deg,#ff8a45 0%,#f25a12 55%,#d9470a 100%)" },
  { id:"b2", ativo:true, eyebrow:"OFERTA POR TEMPO LIMITADO", titulo:"IA Aplicada aos Negócios com 20% de desconto", cta:"Ver oferta", link:"#", imagem:"", gradiente:"linear-gradient(120deg,#1f8f8a,#0d4d4a)" },
  { id:"b3", ativo:true, eyebrow:"NOVO EVENTO", titulo:"Roda de Espiritualidade e Propósito — 24 de Setembro", cta:"Confirmar presença", link:"#", imagem:"", gradiente:"linear-gradient(160deg,#7b72e8,#564cc9)" }
];

/* Regras declarativas (guardáveis): avaliadas por conquistaDesbloqueada() em nucleo.js */
const CONQUISTAS_PADRAO = [
  { id:"b1", titulo:"Primeiro Passo", desc:"Concluíste a tua primeira aula.", regra:{ tipo:"aulas", valor:1 } },
  { id:"b2", titulo:"Módulo Completo", desc:"Terminaste um módulo inteiro.", regra:{ tipo:"modulos", valor:1 } },
  { id:"b3", titulo:"Primeiro Curso Concluído", desc:"Terminaste um curso do início ao fim.", regra:{ tipo:"cursos", valor:1 } },
  { id:"b4", titulo:"Sequência de Fogo", desc:"5 dias seguidos de estudo.", regra:{ tipo:"sequencia", valor:5 } },
  { id:"b5", titulo:"Mente Multidisciplinar", desc:"Progresso em 3 áreas de conhecimento diferentes.", regra:{ tipo:"categorias", valor:3 } },
  { id:"b6", titulo:"Metade do Caminho", desc:"Atingiste 50% do teu progresso geral.", regra:{ tipo:"percentagem", valor:50 } },
  { id:"b7", titulo:"Mentor da Comunidade", desc:"Em breve: ajuda outros alunos na comunidade.", regra:{ tipo:"manual", valor:0 } }
];

const APARENCIA_PADRAO = {
  nomeEscola: "Kingdom Academy",
  sublinha: "Formação & Mentoria",
  logoUrl: "",
  corAccent: "#f4621d",
  temaPadrao: "auto",
  rodape: "© 2026 Kingdom Company",
  loginTitulo: "Autoridade constrói-se em privado, muito antes de aparecer em público.",
  loginTexto: "Acede à tua área de membros para continuares os teus cursos onde ficaste — módulos, aulas, comunidade e o teu progresso, tudo num só lugar."
};

const CONFIG_PADRAO = {
  bannerIntervalo: 60,
  gamificacao: { xpPorAula:50, xpPorNivel:500 },
  certificado: {
    regraPct: 100,
    titulo: "CERTIFICADO DE CONCLUSÃO",
    frase: "concluiu com sucesso o curso",
    rodape: "na Kingdom Academy",
    assinaturaNome: "Shelton Douglas",
    assinaturaCargo: "Fundador · Kingdom Academy"
  },
  integracoes: {
    player: "Panda Video",
    playerId: "",
    /* {id} é substituído pelo ID de vídeo de cada aula. */
    playerUrl: "https://player-vz-{conta}.tv.pandavideo.com.br/embed/?v={id}",
    playerAtivo: false,
    suporteRotulo: "Falar com a mentoria",
    suporteUrl: ""
  },
  planoPadrao: "Kingdom All Access",
  mostrarCursosBloqueados: true,
  /* Abas da área do aluno que estão ligadas. */
  abasAluno: ["dashboard","catalogo","vitrine","calendario","comunidade","conquistas","certificados","definicoes"],
  alunosPublicam: true
};

/* ============================================================
   DB — fonte única de conteúdo/configuração.
   O administrador escreve; a área do aluno lê.
   ============================================================ */
function novoId(prefixo){ return prefixo + "-" + Math.random().toString(36).slice(2,8); }

const DB_CHAVE = "kingdom-academy:db:v1";
const ESTADO_CHAVE = "kingdom-academy:estado:v1";

function dbPadrao(){
  return JSON.parse(JSON.stringify({
    versao: 1,
    aparencia: APARENCIA_PADRAO,
    config: CONFIG_PADRAO,
    categorias: CATEGORIAS_PADRAO,
    cursos: CURSOS_PADRAO,
    turmas: TURMAS_PADRAO,
    eventos: EVENTOS_PADRAO,
    banners: BANNERS_PADRAO,
    membros: MEMBROS_PADRAO,
    planos: PLANOS_PADRAO,
    ofertas: OFERTAS_PADRAO,
    vitrine: VITRINE_PADRAO,
    cursoStats: CURSO_STATS_PADRAO,
    posts: POSTS_PADRAO,
    espacos: ESPACOS_PADRAO,
    avaliacoes: AVALIACOES_PADRAO,
    notificacoes: NOTIFICACOES_PADRAO,
    conquistas: CONQUISTAS_PADRAO,
    convites: [],
  }));
}

function lerArmazenado(chave){
  try { const bruto = localStorage.getItem(chave); return bruto ? JSON.parse(bruto) : null; }
  catch(e){ return null; }
}

function escreverArmazenado(chave, valor){
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; }
  catch(e){ return false; }
}

/* A academia arranca vazia: o conteúdo vem do Supabase, carregado
   depois de sabermos quem entrou. Só o modo de demonstração usa os
   dados de exemplo deste ficheiro. */
function dbVazio(){
  const molde = dbPadrao();
  Object.keys(molde).forEach(chave => {
    if(Array.isArray(molde[chave])) molde[chave] = [];
    else if(chave !== "config" && chave !== "aparencia" && typeof molde[chave] === "object") molde[chave] = {};
  });
  return molde;
}

let DB = modoDemonstracao()
  ? Object.assign(dbPadrao(), lerArmazenado(DB_CHAVE) || {})
  : dbVazio();

/* Um DB guardado por uma versão anterior pode não ter campos novos.
   Preenche-os aqui para as abas de administração nunca receberem
   registos incompletos. */
function normalizarDB(){
  /* Um registo guardado por uma versão anterior pode ter perdido a forma
     (uma lista virou objeto, um mapa desapareceu). Antes de qualquer outra
     coisa, garantimos que cada chave tem o tipo que o resto do código espera,
     recuperando o valor de origem quando não tem. */
  const molde = dbPadrao();
  Object.keys(molde).forEach(chave => {
    const esperado = Array.isArray(molde[chave]) ? "lista" : typeof molde[chave];
    const atual = Array.isArray(DB[chave]) ? "lista" : typeof DB[chave];
    if(DB[chave] === null || DB[chave] === undefined || atual !== esperado) DB[chave] = molde[chave];
  });
  if(!DB.config) DB.config = JSON.parse(JSON.stringify(CONFIG_PADRAO));
  if(!DB.aparencia) DB.aparencia = JSON.parse(JSON.stringify(APARENCIA_PADRAO));
  if(DB.config.bannerIntervalo === undefined) DB.config.bannerIntervalo = 60;
  DB.config.certificado = Object.assign({}, CONFIG_PADRAO.certificado, DB.config.certificado || {});
  if(!Array.isArray(DB.turmas)) DB.turmas = [];
  DB.turmas.forEach(t => { if(!t.id) t.id = novoId("turma"); if(!Array.isArray(t.membros)) t.membros = []; });
  (DB.cursos||[]).forEach(c => {
    if(c.publicado === undefined) c.publicado = true;
    if(c.sigla === undefined) c.sigla = c.titulo.split(/\s+/).map(x=>x[0]).join("").slice(0,3).toUpperCase();
    if(c.vitrine === undefined) c.vitrine = true;
    if(c.moderacao === undefined) c.moderacao = false;
    if(!Array.isArray(c.modulos)) c.modulos = [];
    c.modulos.forEach(m => {
      if(!m.id) m.id = novoId("mod");
      if(!Array.isArray(m.aulas)) m.aulas = [];
      m.aulas.forEach(a => {
        if(!a.id) a.id = novoId("aula");
        if(!Array.isArray(a.ficheiros)) a.ficheiros = [];
        if(!Array.isArray(a.quiz)) a.quiz = [];
        if(a.conteudo === undefined) a.conteudo = "";
        if(a.embed === undefined) a.embed = "";
        if(a.semComentarios === undefined) a.semComentarios = false;
        if(a.semBuscaIA === undefined) a.semBuscaIA = false;
      });
    });
  });
  (DB.banners||[]).forEach(b => {
    if(!b.id) b.id = novoId("banner");
    if(b.ativo === undefined) b.ativo = true;
  });
  (DB.eventos||[]).forEach(e => { if(!e.id) e.id = novoId("evento"); });
  if(!Array.isArray(DB.espacos)) DB.espacos = JSON.parse(JSON.stringify(ESPACOS_PADRAO));
  if(!Array.isArray(DB.avaliacoes)) DB.avaliacoes = [];
  if(!Array.isArray(DB.ofertas)) DB.ofertas = JSON.parse(JSON.stringify(OFERTAS_PADRAO));
  if(DB.config.mostrarCursosBloqueados === undefined) DB.config.mostrarCursosBloqueados = true;
  DB.config.gamificacao = Object.assign({}, CONFIG_PADRAO.gamificacao, DB.config.gamificacao || {});
  DB.config.integracoes = Object.assign({}, CONFIG_PADRAO.integracoes, DB.config.integracoes || {});
  DB.aparencia = Object.assign({}, APARENCIA_PADRAO, DB.aparencia || {});
  if(!Array.isArray(DB.config.abasAluno) || !DB.config.abasAluno.length) DB.config.abasAluno = CONFIG_PADRAO.abasAluno.slice();
  if(DB.config.alunosPublicam === undefined) DB.config.alunosPublicam = true;
  (DB.conquistas||[]).forEach(c => { if(!c.regra) c.regra = { tipo:"manual", valor:0 }; });
  (DB.posts||[]).forEach(p => {
    if(!p.espacoId) p.espacoId = "geral";
    if(p.oculto === undefined) p.oculto = false;
    if(p.fixado === undefined) p.fixado = false;
  });
}
normalizarDB();

/* Em produção quem guarda é o Supabase, registo a registo. Esta função
   só escreve no browser no modo de demonstração. */
function guardarDB(){
  if(!modoDemonstracao()) return;
  if(!escreverArmazenado(DB_CHAVE, DB)) mostrarToast("Não foi possível guardar neste browser");
}

function reporDB(){
  DB = dbPadrao();
  escreverArmazenado(DB_CHAVE, DB);
}

/* ============================================================
   Estado do aluno (sessão e progresso) — persistido à parte do DB
   ============================================================ */
const estado = {
  nome: ALUNO.nome,
  email: "sofia@email.com",
  papel: "aluno",
  ultimoCurso: "kt",
  ultimaAulaPorCurso: { kt:"kt-m1a3", ia:"ia-m1a3", pf:"pf-m1a2" },
  streakDias: 6,
  tema: null,
  onboarding: null,
  filtroCategoria: "todos",
  abaAdmin: "alunos",
  filtroCategoriaAdmin: "todos",
  buscaAdmin: "",
  notificacoes: { email:true, lembretes:true, comunidade:false },
  fotoUrl: null,
  avaliacoes: {},
  presencasConfirmadas: {},
  progresso: {
    "kt-m1a1":true, "kt-m1a2":true, "kt-m1a3":false, "kt-m1a4":false,
    "kt-m2a1":false, "kt-m2a2":false, "kt-m2a3":false, "kt-m2a4":false,
    "kt-m3a1":false, "kt-m3a2":false, "kt-m3a3":false, "kt-m3a4":false,
    "mi-m1a1":true, "mi-m1a2":true, "mi-m1a3":true, "mi-m2a1":true, "mi-m2a2":true, "mi-m2a3":true,
    "ia-m1a1":true, "ia-m1a2":true, "ia-m1a3":false, "ia-m2a1":false, "ia-m2a2":false, "ia-m2a3":false,
    "vv-m1a1":false, "vv-m1a2":false, "vv-m1a3":false, "vv-m2a1":false, "vv-m2a2":false, "vv-m2a3":false,
    "pf-m1a1":true, "pf-m1a2":false, "pf-m1a3":false, "pf-m2a1":false, "pf-m2a2":false, "pf-m2a3":false,
    "he-m1a1":false, "he-m1a2":false, "he-m1a3":false, "he-m2a1":false, "he-m2a2":false, "he-m2a3":false
  }
};

if(modoDemonstracao()) Object.assign(estado, lerArmazenado(ESTADO_CHAVE) || {});

/* O mesmo cuidado do DB, para a sessão guardada no browser. */
["ultimaAulaPorCurso","notificacoes","progresso","avaliacoes","presencasConfirmadas"].forEach(chave => {
  if(!estado[chave] || typeof estado[chave] !== "object" || Array.isArray(estado[chave])) estado[chave] = {};
});

/* Guarda apenas o que interessa manter entre sessões (não os filtros de ecrã). */
function guardarEstado(){
  if(!modoDemonstracao()) return;
  escreverArmazenado(ESTADO_CHAVE, {
    nome: estado.nome,
    email: estado.email,
    membroId: estado.membroId,
    fotoUrl: estado.fotoUrl,
    streakDias: estado.streakDias,
    notificacoes: estado.notificacoes,
    progresso: estado.progresso,
    avaliacoes: estado.avaliacoes,
    presencasConfirmadas: estado.presencasConfirmadas,
    tema: estado.tema,
    onboarding: estado.onboarding,
    ultimoCurso: estado.ultimoCurso,
    ultimaAulaPorCurso: estado.ultimaAulaPorCurso
  });
}

