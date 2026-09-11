/* ============================================================
   Camada de dados
   O resto da aplicação continua a ler o objeto DB em memória.
   Este ficheiro é o único que sabe que por trás está o Supabase:
   carrega o DB à entrada e escreve registo a registo.
   ============================================================ */

const API = {
  cliente: null,
  utilizador: null,          // { id, nome, email, perfil }

  iniciar(){
    if(this.cliente) return this.cliente;
    if(typeof supabase === "undefined")
      throw new Error("A biblioteca do Supabase não carregou.");
    this.cliente = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      db: { schema: ESQUEMA },
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return this.cliente;
  },

  /* O schema academia é o predefinido; para as tabelas do CRM
     (ofertas, turmas) é preciso pedir o schema public. */
  pub(){ return this.cliente.schema("public"); },

  /* ---------------- Autenticação ---------------- */
  async sessao(){
    const { data } = await this.cliente.auth.getSession();
    if(!data.session) return null;
    return this.carregarUtilizador(data.session.user.id);
  },

  async carregarUtilizador(id){
    const { data, error } = await this.pub()
      .from("utilizadores")
      .select("id, nome, email, perfil, estado, foto_url")
      .eq("id", id)
      .maybeSingle();
    if(error) throw error;
    if(!data) throw new Error("A tua conta ainda não está ligada à academia. Fala com a mentoria.");
    if(data.estado !== "Ativo") throw new Error("Este acesso está suspenso. Fala com a tua mentoria.");
    this.utilizador = data;
    return data;
  },

  async entrar(email, password){
    const { data, error } = await this.cliente.auth.signInWithPassword({ email, password });
    if(error) throw new Error(traduzirErroAuth(error));
    return this.carregarUtilizador(data.user.id);
  },

  async sair(){
    await this.cliente.auth.signOut();
    this.utilizador = null;
  },

  async pedirNovaPassword(email){
    const { error } = await this.cliente.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname + "#nova-password"
    });
    if(error) throw new Error(traduzirErroAuth(error));
  },

  async definirPassword(nova){
    const { error } = await this.cliente.auth.updateUser({ password: nova });
    if(error) throw new Error(traduzirErroAuth(error));
  },

  /* ---------------- Leitura ---------------- */
  async carregarTudo(){
    const c = this.cliente;
    const eu = this.utilizador.id;

    const [
      categorias, cursos, espacos, mensagens, eventos, banners,
      conquistas, config, avaliacoes, notificacoes, lidas,
      progresso, presencas, onboarding, perfil, certificados,
      ofertas, turmas
    ] = await Promise.all([
      lista(c.from("categorias").select("*").order("ordem")),
      lista(c.from("cursos").select(`
        *, modulos ( *, aulas ( *, aula_ficheiros (*), aula_quiz (*) ) )
      `).is("removido_em", null).order("ordem")),
      lista(c.from("espacos").select("*").order("ordem")),
      lista(c.from("mensagens").select("*").order("criado_em", { ascending:false }).limit(300)),
      lista(c.from("eventos").select("*").order("data")),
      lista(c.from("banners").select("*").order("ordem")),
      lista(c.from("conquistas").select("*").order("ordem")),
      lista(c.from("config").select("*")),
      lista(c.from("avaliacoes").select("*").order("criado_em", { ascending:false })),
      lista(c.from("notificacoes").select("*").order("criado_em", { ascending:false }).limit(50)),
      lista(c.from("notificacoes_lidas").select("notificacao_id").eq("utilizador_id", eu)),
      lista(c.from("progresso").select("aula_id").eq("utilizador_id", eu)),
      lista(c.from("presencas").select("evento_id").eq("utilizador_id", eu)),
      um(c.from("onboarding").select("*").eq("utilizador_id", eu)),
      um(c.from("perfis").select("*").eq("utilizador_id", eu)),
      lista(c.from("certificados").select("*").eq("utilizador_id", eu)),
      lista(this.pub().from("ofertas").select("id, nome, preco, moeda, cobranca, link_vendas, estado").is("removido_em", null)),
      lista(this.pub().from("turmas").select("id, oferta_id, nome, estado, inicio, fim").is("removido_em", null))
    ]);

    DB.categorias  = Object.fromEntries(categorias.map(r => [r.id, { nome:r.nome, cor:r.cor }]));
    DB.cursos      = cursos.map(deCurso);
    DB.espacos     = espacos.map(deEspaco);
    DB.posts       = mensagens.map(deMensagem);
    DB.eventos     = eventos.map(deEvento);
    DB.banners     = banners.map(deBanner);
    DB.conquistas  = conquistas.map(deConquista);
    DB.avaliacoes  = avaliacoes.map(deAvaliacao);
    DB.ofertas     = ofertas.map(deOferta);
    DB.turmas      = turmas.map(t => deTurma(t, cursos));
    DB.certificados = certificados;

    const idsLidas = new Set(lidas.map(l => l.notificacao_id));
    DB.notificacoes = notificacoes.map(n => ({
      id:n.id, titulo:n.titulo, desc:n.descricao||"", tempo:tempoRelativo(n.criado_em),
      lida: idsLidas.has(n.id)
    }));

    aplicarConfig(config);
    aplicarEstadoDoAluno({ progresso, presencas, onboarding, perfil });

    /* Quem é da equipa vê também os rascunhos e os membros. */
    if(ehEquipa()){
      DB.membros = (await lista(this.pub()
        .from("utilizadores")
        .select("id, nome, email, perfil, estado, criado_em, lead_id")
        .is("removido_em", null))).map(deMembro);
    } else {
      DB.membros = [deMembro(this.utilizador)];
    }
  },

  /* ---------------- Escrita ---------------- */
  async guardar(entidade, registo){
    const mapa = MAPAS[entidade];
    if(!mapa) throw new Error("Entidade desconhecida: " + entidade);
    const linha = mapa.para(registo);
    const { data, error } = await this.cliente
      .from(mapa.tabela).upsert(linha).select().maybeSingle();
    if(error) throw new Error(traduzirErroDados(error));
    return data;
  },

  async apagar(entidade, id){
    const mapa = MAPAS[entidade];
    if(!mapa) throw new Error("Entidade desconhecida: " + entidade);
    /* Cursos, módulos e aulas não desaparecem: ficam marcados como
       removidos, para o progresso dos alunos não se perder. */
    const { error } = mapa.suave
      ? await this.cliente.from(mapa.tabela).update({ removido_em:new Date().toISOString() }).eq("id", id)
      : await this.cliente.from(mapa.tabela).delete().eq("id", id);
    if(error) throw new Error(traduzirErroDados(error));
  },

  /* Progresso e presenças são linhas que existem ou não existem. */
  async marcarAula(aulaId, concluida){
    const eu = this.utilizador.id;
    const { error } = concluida
      ? await this.cliente.from("progresso").upsert({ utilizador_id:eu, aula_id:aulaId })
      : await this.cliente.from("progresso").delete().eq("utilizador_id", eu).eq("aula_id", aulaId);
    if(error) throw new Error(traduzirErroDados(error));
  },

  async marcarPresenca(eventoId, confirmada){
    const eu = this.utilizador.id;
    const { error } = confirmada
      ? await this.cliente.from("presencas").upsert({ utilizador_id:eu, evento_id:eventoId })
      : await this.cliente.from("presencas").delete().eq("utilizador_id", eu).eq("evento_id", eventoId);
    if(error) throw new Error(traduzirErroDados(error));
  },

  async guardarConfig(chave, valor){
    const { error } = await this.cliente.from("config").upsert({ chave, valor });
    if(error) throw new Error(traduzirErroDados(error));
  }
};

/* ============================================================
   Conversões entre as linhas da base de dados e a forma que os
   ecrãs já esperam. É aqui, e só aqui, que os nomes mudam.
   ============================================================ */
async function lista(consulta){
  const { data, error } = await consulta;
  if(error) throw new Error(traduzirErroDados(error));
  return data || [];
}
async function um(consulta){
  const { data, error } = await consulta.maybeSingle();
  if(error && error.code !== "PGRST116") throw new Error(traduzirErroDados(error));
  return data || null;
}

function deCurso(r){
  return {
    id:r.id, ofertaId:r.oferta_id, titulo:r.titulo, sigla:r.sigla, subtitulo:r.subtitulo,
    categoria:r.categoria_id, capa:r.capa_url||"", urlVendas:r.url_vendas||"",
    vitrine:r.vitrine, moderacao:r.moderacao, publicado:r.publicado,
    certificado:r.certificado, ordem:r.ordem,
    modulos: (r.modulos||[])
      .filter(m => !m.removido_em)
      .sort(porOrdem)
      .map(m => ({
        id:m.id, titulo:m.titulo, descricao:m.descricao||"", ordem:m.ordem,
        aulas: (m.aulas||[]).filter(a => !a.removido_em).sort(porOrdem).map(deAula)
      }))
  };
}

function deAula(a){
  return {
    id:a.id, titulo:a.titulo, duracao:a.duracao||"00:00", descricao:a.descricao||"",
    conteudo:a.conteudo||"", embed:a.embed||"", capa:a.capa_url||"",
    semComentarios:a.sem_comentarios, semBuscaIA:a.sem_busca_ia, ordem:a.ordem,
    ficheiros: (a.aula_ficheiros||[]).sort(porOrdem)
      .map(f => ({ id:f.id, nome:f.nome, url:f.url, tipo:f.tipo, tamanho:f.tamanho })),
    quiz: (a.aula_quiz||[]).sort(porOrdem)
      .map(q => ({ id:q.id, pergunta:q.pergunta, opcoes:q.opcoes||[], certa:q.certa }))
  };
}

function deEspaco(r){
  return { id:r.id, nome:r.nome, descricao:r.descricao||"", cor:r.cor,
           ativo:r.ativo, soAdminPublica:r.so_admin_publica, ordem:r.ordem };
}

function deMensagem(r){
  return {
    id:r.id, espacoId:r.espaco_id, autorId:r.autor_id,
    autor:r.autor_nome||"Aluno", iniciais:r.autor_iniciais||"A",
    texto:r.texto||"", respostaA:r.resposta_a, ficheiro:r.ficheiro,
    categoria:r.categoria_id, fixado:r.fixado, oculto:r.oculto,
    tempo: tempoRelativo(r.criado_em), criadoEm:r.criado_em,
    likes:0, curtido:false
  };
}

function deEvento(r){
  return { id:r.id, titulo:r.titulo, descricao:r.descricao||"", data:r.data,
           hora:(r.hora||"19:00").slice(0,5), tipo:r.tipo,
           categoria:r.categoria_id, link:r.link||"" };
}

function deBanner(r){
  return { id:r.id, eyebrow:r.eyebrow||"", titulo:r.titulo, cta:r.cta,
           link:r.link||"", imagem:r.imagem_url||"", gradiente:r.gradiente||"", ativo:r.ativo, ordem:r.ordem };
}

function deConquista(r){
  return { id:r.id, titulo:r.titulo, desc:r.descricao||"", regra:r.regra, ordem:r.ordem };
}

function deAvaliacao(r){
  return { id:r.id, membroId:r.utilizador_id, aulaId:r.aula_id, cursoId:r.curso_id,
           nome:r.autor_nome||"Aluno", estrelas:r.estrelas, comentario:r.comentario||"",
           oculto:r.oculto, data:(r.criado_em||"").slice(0,10) };
}

/* A oferta do CRM é a oferta que a Vitrine mostra. */
function deOferta(r){
  return { id:String(r.id), nome:r.nome, preco:Number(r.preco)||0,
           periodo: r.cobranca === "Recorrente mensal" ? "mês" : "único",
           link:r.link_vendas||"", ativa:r.estado === "Ativa", descricao:"" };
}

function deTurma(t, cursos){
  const curso = cursos.find(c => c.oferta_id === t.oferta_id);
  return { id:String(t.id), nome:t.nome, cursoId:curso ? curso.id : null,
           inicio:t.inicio, fim:t.fim, ativa:t.estado !== "Concluída", membros:[] };
}

function deMembro(u){
  return { id:u.id, nome:u.nome, email:u.email,
           papel: u.perfil === "aluno" ? "aluno" : "administrador",
           acesso: u.estado === "Ativo" ? "ativo" : "bloqueado",
           membroDesde:(u.criado_em||"").slice(0,10), leadId:u.lead_id,
           curso:"—", categoria:"negocios", origem:"—", ultimoAcesso:"—",
           engajamento:"morno", progresso:0, estagio:"ativo", responsavel:"—" };
}

function aplicarConfig(linhas){
  const porChave = Object.fromEntries(linhas.map(l => [l.chave, l.valor]));
  DB.aparencia = Object.assign({}, APARENCIA_PADRAO, porChave.aparencia || {});
  DB.config = Object.assign({}, CONFIG_PADRAO, porChave.geral || {}, {
    gamificacao: Object.assign({}, CONFIG_PADRAO.gamificacao, porChave.gamificacao || {}),
    certificado: Object.assign({}, CONFIG_PADRAO.certificado, porChave.certificado || {}),
    integracoes: Object.assign({}, CONFIG_PADRAO.integracoes, porChave.integracoes || {}),
    email: porChave.email || {}
  });
}

/* O que era guardado no browser passa a vir da base de dados. */
function aplicarEstadoDoAluno({ progresso, presencas, onboarding, perfil }){
  estado.progresso = Object.fromEntries(progresso.map(p => [p.aula_id, true]));
  estado.presencasConfirmadas = Object.fromEntries(presencas.map(p => [p.evento_id, true]));
  estado.onboarding = onboarding
    ? { feito:true, saltado:onboarding.saltado, objetivos:onboarding.objetivos||[],
        ritmo:onboarding.ritmo, momento:onboarding.momento }
    : null;
  if(perfil){
    estado.fotoUrl = perfil.foto_url || null;
    estado.tema = perfil.tema || null;
    estado.streakDias = perfil.streak_dias || 0;
    estado.notificacoes = perfil.notificacoes || estado.notificacoes;
  }
  estado.nome  = API.utilizador.nome;
  estado.email = API.utilizador.email;
  estado.membroId = API.utilizador.id;
  estado.papel = API.utilizador.perfil === "aluno" ? "aluno" : "administrador";
}

function ehEquipa(){
  return API.utilizador && API.utilizador.perfil !== "aluno";
}

function porOrdem(a, b){ return (a.ordem||0) - (b.ordem||0); }

function tempoRelativo(iso){
  if(!iso) return "agora";
  const seg = Math.floor((Date.now() - new Date(iso)) / 1000);
  if(seg < 60) return "agora";
  if(seg < 3600) return `há ${Math.floor(seg/60)} min`;
  if(seg < 86400) return `há ${Math.floor(seg/3600)}h`;
  const dias = Math.floor(seg/86400);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

/* ============================================================
   Onde cada entidade do ecrã vive na base de dados
   ============================================================ */
const MAPAS = {
  categoria: { tabela:"categorias", para: c => ({ id:c.id, nome:c.nome, cor:c.cor, ordem:c.ordem||0 }) },
  curso: {
    tabela:"cursos", suave:true,
    para: c => ({ id:c.id, oferta_id:c.ofertaId||null, titulo:c.titulo, sigla:c.sigla,
                  subtitulo:c.subtitulo, categoria_id:c.categoria, capa_url:c.capa||null,
                  url_vendas:c.urlVendas||null, vitrine:c.vitrine, moderacao:c.moderacao,
                  publicado:c.publicado, certificado:c.certificado, ordem:c.ordem||0 })
  },
  modulo: {
    tabela:"modulos", suave:true,
    para: m => ({ id:m.id, curso_id:m.cursoId, titulo:m.titulo, descricao:m.descricao, ordem:m.ordem||0 })
  },
  aula: {
    tabela:"aulas", suave:true,
    para: a => ({ id:a.id, modulo_id:a.moduloId, titulo:a.titulo, duracao:a.duracao,
                  descricao:a.descricao, conteudo:a.conteudo, embed:a.embed,
                  capa_url:a.capa||null, sem_comentarios:a.semComentarios,
                  sem_busca_ia:a.semBuscaIA, ordem:a.ordem||0 })
  },
  ficheiro: { tabela:"aula_ficheiros", para: f => ({ id:f.id, aula_id:f.aulaId, nome:f.nome, url:f.url, tipo:f.tipo, tamanho:f.tamanho, ordem:f.ordem||0 }) },
  pergunta: { tabela:"aula_quiz", para: q => ({ id:q.id, aula_id:q.aulaId, pergunta:q.pergunta, opcoes:q.opcoes, certa:q.certa, ordem:q.ordem||0 }) },
  espaco:   { tabela:"espacos", para: e => ({ id:e.id, nome:e.nome, descricao:e.descricao, cor:e.cor, ativo:e.ativo, so_admin_publica:e.soAdminPublica, ordem:e.ordem||0 }) },
  mensagem: { tabela:"mensagens", para: m => ({ id:m.id, espaco_id:m.espacoId, autor_id:m.autorId || API.utilizador.id,
                  texto:m.texto||null, resposta_a:m.respostaA||null, ficheiro:m.ficheiro||null,
                  categoria_id:m.categoria||null, fixado:!!m.fixado, oculto:!!m.oculto }) },
  evento:   { tabela:"eventos", para: e => ({ id:e.id, titulo:e.titulo, descricao:e.descricao, data:e.data, hora:e.hora, tipo:e.tipo, categoria_id:e.categoria, link:e.link }) },
  banner:   { tabela:"banners", para: b => ({ id:b.id, eyebrow:b.eyebrow, titulo:b.titulo, cta:b.cta, link:b.link, imagem_url:b.imagem||null, gradiente:b.gradiente||null, ativo:b.ativo, ordem:b.ordem||0 }) },
  conquista:{ tabela:"conquistas", para: c => ({ id:c.id, titulo:c.titulo, descricao:c.desc, regra:c.regra, ordem:c.ordem||0 }) },
  avaliacao:{ tabela:"avaliacoes", para: a => ({ id:a.id, utilizador_id:a.membroId || API.utilizador.id, aula_id:a.aulaId, curso_id:a.cursoId, estrelas:a.estrelas, comentario:a.comentario, oculto:!!a.oculto }) },
  acesso:   { tabela:"acessos", para: a => ({ id:a.id, utilizador_id:a.utilizadorId, curso_id:a.cursoId, origem:a.origem||"manual", expira_em:a.expiraEm||null, nota:a.nota||null }) },
  convite:  { tabela:"convites", para: c => ({ id:c.id, email:c.email, nome:c.nome, oferta_id:c.ofertaId||null, cursos:c.cursos||[] }) },
  onboarding:{ tabela:"onboarding", para: o => ({ utilizador_id:API.utilizador.id, objetivos:o.objetivos||[], ritmo:o.ritmo, momento:o.momento, saltado:!!o.saltado }) },
  perfil:   { tabela:"perfis", para: p => ({ utilizador_id:API.utilizador.id, foto_url:p.fotoUrl||null, tema:p.tema||null, streak_dias:p.streakDias||0, notificacoes:p.notificacoes||{} }) }
};

/* ============================================================
   Erros em português, com o que fazer a seguir
   ============================================================ */
function traduzirErroAuth(erro){
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "Não conseguimos falar com o servidor. Verifica a tua ligação à internet e tenta de novo.";
  if(m.includes("invalid login")) return "Email ou password errados.";
  if(m.includes("email not confirmed")) return "Confirma o email antes de entrares. Procura a mensagem que te enviámos.";
  if(m.includes("rate limit") || m.includes("too many")) return "Demasiadas tentativas. Espera um minuto e tenta de novo.";
  if(m.includes("password should be")) return "A password é demasiado curta ou demasiado comum. Escolhe outra.";
  return erro && erro.message ? erro.message : "Não foi possível entrar.";
}

function traduzirErroDados(erro){
  const codigo = erro && erro.code;
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "Perdemos a ligação ao servidor. Verifica a internet e recarrega a página.";
  if(codigo === "42P01" || (erro.message||"").includes("schema must be one of"))
    return 'O schema "academia" ainda não está exposto na API do Supabase (Settings → Data API → Exposed schemas).';
  if(codigo === "42501" || codigo === "PGRST301")
    return "Não tens permissão para esta operação.";
  if(codigo === "23505") return "Já existe um registo com estes dados.";
  if(codigo === "23503") return "Este registo está ligado a outro e não pode ficar assim.";
  return erro && erro.message ? erro.message : "Não foi possível guardar.";
}
