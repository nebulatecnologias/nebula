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
  /* Quem foi convidado entra pela primeira vez sem password nenhuma.
     Essa marca fica na conta, não no endereço: assim não se perde num
     redireccionamento nem se apaga ao recarregar a página. */
  precisaDePassword: false,

  async sessao(){
    const { data } = await this.cliente.auth.getSession();
    if(!data.session) return null;
    this.precisaDePassword = !!(data.session.user.user_metadata || {}).precisa_password;
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
    const { error } = await this.cliente.auth.updateUser({
      password: nova,
      data: { precisa_password: false }        // já tem: deixa de ser pedida
    });
    if(error) throw new Error(traduzirErroAuth(error));
    this.precisaDePassword = false;
  },

  /* ---------------- Leitura ---------------- */
  async carregarTudo(){
    const c = this.cliente;
    const eu = this.utilizador.id;

    /* Se esta pessoa foi convidada, é aqui que o convite vira acesso.
       Corre no servidor e não tem efeito nenhum para quem não tem
       convite à espera, por isso pode correr sempre. Um erro aqui não
       pode impedir a entrada de quem já tem acesso. */
    try { await c.rpc("aceitar_convite"); } catch(e){ /* segue-se na mesma */ }

    const [
      categorias, cursos, espacos, mensagens, reacoes, eventos, banners,
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
      lista(c.from("reacoes").select("mensagem_id, utilizador_id")),
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
    aplicarReacoes(DB.posts, reacoes, eu);
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
      tipo:n.tipo || "geral", link:n.link || "", lida: idsLidas.has(n.id)
    }));

    aplicarConfig(config);
    aplicarEstadoDoAluno({ progresso, presencas, onboarding, perfil });

    /* Quem é da equipa vê também os rascunhos, os membros e os convites. */
    if(ehEquipa()){
      const [membros, convites] = await Promise.all([
        lista(this.pub()
          .from("utilizadores")
          .select("id, nome, email, perfil, estado, criado_em, lead_id")
          .is("removido_em", null)),
        lista(c.from("convites").select("*").order("criado_em", { ascending:false }))
      ]);
      DB.membros  = membros.map(deMembro);
      DB.convites = convites.map(deConvite);
    } else {
      DB.membros  = [deMembro(this.utilizador)];
      DB.convites = [];
    }
  },

  /* Relê só os convites: o estado deles muda quando a pessoa entra,
     e isso acontece longe deste ecrã. */
  async recarregarConvites(){
    const linhas = await lista(this.cliente.from("convites").select("*").order("criado_em", { ascending:false }));
    DB.convites = linhas.map(deConvite);
  },

  /* Convidar cria a conta, gera o link de entrada e manda o email.
     Corre no servidor: o browser não tem (nem pode ter) essa chave. */
  async convidar(pedido){
    const { data, error } = await this.cliente.functions.invoke("convidar-aluno", { body:pedido });
    if(error){
      let detalhe = "";
      try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* resposta sem corpo */ }
      throw new Error(detalhe || traduzirErroAuth(error));
    }
    if(data && data.error) throw new Error(data.error);
    return data;
  },

  /* ---------------- Tempo real ----------------
     A conversa da comunidade chega sozinha. O Realtime usa as mesmas
     políticas de leitura da tabela, por isso ninguém recebe o que não
     podia ler numa consulta normal. */
  canalComunidade: null,

  ouvirComunidade(aoMudar){
    if(this.canalComunidade) return this.canalComunidade;
    this.canalComunidade = this.cliente
      .channel("comunidade")
      .on("postgres_changes", { event:"*", schema:ESQUEMA, table:"mensagens" }, c => aoMudar("mensagem", c))
      .on("postgres_changes", { event:"*", schema:ESQUEMA, table:"reacoes" },   c => aoMudar("reacao", c))
      .subscribe();
    return this.canalComunidade;
  },

  pararDeOuvir(){
    if(!this.canalComunidade) return;
    this.cliente.removeChannel(this.canalComunidade);
    this.canalComunidade = null;
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

  /* O sino só fica limpo se o servidor souber disso: a marca de lida
     é uma linha por pessoa e por notificação. */
  async marcarLidas(ids){
    if(!ids.length) return;
    const eu = this.utilizador.id;
    const { error } = await this.cliente.from("notificacoes_lidas")
      .upsert(ids.map(id => ({ notificacao_id:id, utilizador_id:eu })), { onConflict:"notificacao_id,utilizador_id" });
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

  /* Substitui a lista de filhos de um registo: apaga o que saiu e
     grava o que ficou. Usado pelos materiais e pelo quiz da aula. */
  async substituirFilhos(tabela, entidade, paiId, filhos){
    const { error: erroApagar } = await this.cliente.from(tabela).delete().eq("aula_id", paiId);
    if(erroApagar) throw new Error(traduzirErroDados(erroApagar));
    if(!filhos.length) return;
    const linhas = filhos.map(f => MAPAS[entidade].para(f));
    const { error } = await this.cliente.from(tabela).insert(linhas);
    if(error) throw new Error(traduzirErroDados(error));
  },

  /* Um gosto é uma linha que existe ou não existe. */
  async reagir(mensagemId, gostou){
    const eu = this.utilizador.id;
    const { error } = gostou
      ? await this.cliente.from("reacoes").upsert({ mensagem_id:mensagemId, utilizador_id:eu })
      : await this.cliente.from("reacoes").delete().eq("mensagem_id", mensagemId).eq("utilizador_id", eu);
    if(error) throw new Error(traduzirErroDados(error));
  },

  /* O aluno pode mudar o próprio nome; o email é do administrador. */
  async atualizarNome(nome){
    const { error } = await this.pub().from("utilizadores").update({ nome }).eq("id", this.utilizador.id);
    if(error) throw new Error(traduzirErroDados(error));
    this.utilizador.nome = nome;
  },

  /* ---------------- Ficheiros ----------------
     Imagens e anexos vao para o Storage, nao para dentro de uma
     coluna de texto. O que fica gravado na linha e' o endereco. */
  async enviarFicheiro(balde, caminho, ficheiro){
    const { error } = await this.cliente.storage.from(balde)
      .upload(caminho, ficheiro, { upsert:true, contentType:ficheiro.type || undefined });
    if(error) throw new Error(traduzirErroFicheiro(error));
    if(balde === BALDE_PUBLICO){
      const { data } = this.cliente.storage.from(balde).getPublicUrl(caminho);
      return data.publicUrl;
    }
    return "storage:" + caminho;      // privado: assina-se na hora de abrir
  },

  /* Um endereco assinado dura o suficiente para abrir o ficheiro. */
  async assinar(caminho, segundos){
    const { data, error } = await this.cliente.storage.from(BALDE_PRIVADO)
      .createSignedUrl(caminho, segundos || 3600);
    if(error) throw new Error(traduzirErroFicheiro(error));
    return data.signedUrl;
  },

  async apagarFicheiro(balde, caminho){
    await this.cliente.storage.from(balde).remove([caminho]);
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

/* O ecrã de convites fala em "código" e "estado"; a tabela fala em
   token e data de aceitação. É aqui que as duas linguagens se juntam. */
function deConvite(c){
  return {
    id: c.id,
    codigo: c.token,
    email: c.email,
    nome: c.nome || "",
    ofertaId: c.oferta_id,
    cursos: c.cursos || [],
    estado: c.aceite_em ? "aceite" : (new Date(c.expira_em) < new Date() ? "expirado" : "pendente"),
    criadoEm: (c.criado_em || "").slice(0, 10),
    expiraEm: (c.expira_em || "").slice(0, 10)
  };
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

function aplicarReacoes(posts, reacoes, eu){
  const contagem = {};
  const minhas = new Set();
  reacoes.forEach(r => {
    contagem[r.mensagem_id] = (contagem[r.mensagem_id] || 0) + 1;
    if(r.utilizador_id === eu) minhas.add(r.mensagem_id);
  });
  posts.forEach(p => { p.likes = contagem[p.id] || 0; p.curtido = minhas.has(p.id); });
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
                  url_vendas:linkExterno(c.urlVendas) || null, vitrine:c.vitrine, moderacao:c.moderacao,
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
  evento:   { tabela:"eventos", para: e => ({ id:e.id, titulo:e.titulo, descricao:e.descricao, data:e.data, hora:e.hora, tipo:e.tipo, categoria_id:e.categoria, link:linkExterno(e.link) || null }) },
  banner:   { tabela:"banners", para: b => ({ id:b.id, eyebrow:b.eyebrow, titulo:b.titulo, cta:b.cta, link:linkExterno(b.link) || null, imagem_url:b.imagem||null, gradiente:b.gradiente||null, ativo:b.ativo, ordem:b.ordem||0 }) },
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
function traduzirErroFicheiro(erro){
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("exceeded the maximum allowed size") || m.includes("payload too large"))
    return "O ficheiro é grande de mais para este tipo de conteúdo.";
  if(m.includes("mime type") || m.includes("invalid_mime"))
    return "Este tipo de ficheiro não é aceite aqui.";
  if(m.includes("row-level security") || m.includes("unauthorized"))
    return "Não tens permissão para enviar este ficheiro.";
  if(m.includes("failed to fetch")) return "Perdemos a ligação ao enviar o ficheiro.";
  return erro && erro.message ? erro.message : "Não foi possível enviar o ficheiro.";
}

function traduzirErroAuth(erro){
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "Não conseguimos falar com o servidor. Verifica a tua ligação à internet e tenta de novo.";
  if(m.includes("invalid login")) return "Email ou password errados.";
  if(m.includes("email not confirmed")) return "Confirma o email antes de entrares. Procura a mensagem que te enviámos.";
  if(m.includes("rate limit") || m.includes("too many")) return "Demasiadas tentativas. Espera um minuto e tenta de novo.";
  if(m.includes("easy to guess") || m.includes("weak password") || m.includes("pwned"))
    return "Essa password aparece em fugas de dados conhecidas. Escolhe outra que não uses noutro sítio.";
  if(m.includes("password should be") || m.includes("password should contain"))
    return "Essa password não cumpre as regras da academia: " + (erro.message || "") + ".";
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


/* ============================================================
   Guardar a partir dos ecrãs
   A interface já mostrou a alteração — estas funções levam-na ao
   servidor. Se o servidor recusar, o ecrã não pode ficar a mostrar
   uma coisa que não ficou gravada: avisamos e oferecemos recarregar.
   ============================================================ */
/* Imagens que ficaram gravadas como texto dentro da linha sobem para
   o Storage na primeira vez que o registo voltar a ser guardado. */
const IMAGENS_DA_ENTIDADE = {
  curso:  [["capa",   "capas/cursos"]],
  aula:   [["capa",   "capas/aulas"]],
  banner: [["imagem", "banners"]]
};

async function curarImagens(entidade, registo){
  const campos = IMAGENS_DA_ENTIDADE[entidade];
  if(!campos || !registo) return;
  for(const [campo, pasta] of campos){
    const valor = registo[campo];
    if(!valor || !String(valor).startsWith("data:")) continue;
    registo[campo] = await passarParaStorage(valor, pasta);
  }
}

async function salvar(entidade, registo){
  if(modoDemonstracao()){ guardarDB(); return; }
  try {
    await curarImagens(entidade, registo);
    await API.guardar(entidade, registo);
  } catch(erro){ avisarQueNaoGuardou(erro); }
}

function remover(entidade, id){
  if(modoDemonstracao()){ guardarDB(); return Promise.resolve(); }
  return API.apagar(entidade, id).catch(erro => avisarQueNaoGuardou(erro));
}

/* Reordenar mexe em várias linhas de uma vez. */
function salvarOrdem(entidade, lista, extra){
  if(modoDemonstracao()){ guardarDB(); return Promise.resolve(); }
  const linhas = lista.map((item, i) => Object.assign({}, item, extra, { ordem:i + 1 }));
  return Promise.all(linhas.map(l => API.guardar(entidade, l)))
    .catch(erro => avisarQueNaoGuardou(erro));
}

/* A aula é um conjunto: a aula, os materiais e as perguntas do quiz.
   Os filhos são substituídos por inteiro, que é o que o editor faz. */
async function salvarAula(aula, moduloId){
  if(modoDemonstracao()){ guardarDB(); return; }
  try {
    await curarImagens("aula", aula);
    await API.guardar("aula", Object.assign({}, aula, { moduloId }));
    await API.substituirFilhos("aula_ficheiros", "ficheiro", aula.id,
      (aula.ficheiros || []).map((f, i) => Object.assign({}, f, { aulaId:aula.id, ordem:i + 1, id:f.id || novoId("fich") })));
    await API.substituirFilhos("aula_quiz", "pergunta", aula.id,
      (aula.quiz || []).map((q, i) => Object.assign({}, q, { aulaId:aula.id, ordem:i + 1, id:q.id || novoId("perg") })));
  } catch(erro){ avisarQueNaoGuardou(erro); }
}

function avisarQueNaoGuardou(erro){
  const motivo = erro && erro.message ? erro.message : String(erro);
  mostrarToast("Não ficou guardado: " + motivo);
  mostrarBarraDeFalha(motivo);
  console.error("Falha ao guardar:", erro);
}

/* Uma barra que não desaparece sozinha: enquanto houver diferença
   entre o ecrã e o servidor, quem está a usar tem de saber. */
function mostrarBarraDeFalha(motivo){
  if(document.getElementById("barra-falha")) return;
  const barra = document.createElement("div");
  barra.id = "barra-falha";
  barra.className = "barra-falha";
  barra.innerHTML = `
    <span>Uma alteração não chegou ao servidor — o que vês pode não estar gravado.
    <strong>${motivo}</strong></span>
    <button class="btn btn-secondary btn-sm" id="btn-recarregar-falha">Recarregar</button>
  `;
  document.body.appendChild(barra);
  document.getElementById("btn-recarregar-falha").addEventListener("click", () => location.reload());
}


/* ============================================================
   Configuração
   Está repartida por chaves para cada área poder ser gravada
   sozinha, sem arrastar o resto.
   ============================================================ */
function salvarConfigGeral(){
  return guardarChaveDeConfig("geral", {
    bannerIntervalo: DB.config.bannerIntervalo,
    mostrarCursosBloqueados: DB.config.mostrarCursosBloqueados,
    alunosPublicam: DB.config.alunosPublicam,
    abasAluno: DB.config.abasAluno
  });
}
async function salvarAparencia(){
  if(!modoDemonstracao() && String(DB.aparencia.logoUrl||"").startsWith("data:"))
    DB.aparencia.logoUrl = await passarParaStorage(DB.aparencia.logoUrl, "marca");
  return guardarChaveDeConfig("aparencia", DB.aparencia);
}
function salvarGamificacao(){ return guardarChaveDeConfig("gamificacao", DB.config.gamificacao); }
function salvarCertificado(){ return guardarChaveDeConfig("certificado", DB.config.certificado); }
function salvarIntegracoes(){
  DB.config.integracoes.suporteUrl = linkExterno(DB.config.integracoes.suporteUrl);
  return guardarChaveDeConfig("integracoes", DB.config.integracoes);
}

function guardarChaveDeConfig(chave, valor){
  if(modoDemonstracao()){ guardarDB(); return Promise.resolve(); }
  return API.guardarConfig(chave, valor).catch(erro => avisarQueNaoGuardou(erro));
}

/* ============================================================
   O que o aluno faz enquanto estuda
   ============================================================ */
function salvarProgresso(aulaId, concluida){
  if(modoDemonstracao()){ guardarEstado(); return Promise.resolve(); }
  return API.marcarAula(aulaId, concluida).catch(erro => avisarQueNaoGuardou(erro));
}
function salvarPresenca(eventoId, confirmada){
  if(modoDemonstracao()){ guardarEstado(); return Promise.resolve(); }
  return API.marcarPresenca(eventoId, confirmada).catch(erro => avisarQueNaoGuardou(erro));
}
function salvarOnboarding(){
  if(modoDemonstracao()){ guardarEstado(); return Promise.resolve(); }
  return API.guardar("onboarding", estado.onboarding || {}).catch(erro => avisarQueNaoGuardou(erro));
}
async function salvarPerfil(){
  if(modoDemonstracao()){ guardarEstado(); return; }
  if(String(estado.fotoUrl||"").startsWith("data:"))
    estado.fotoUrl = await passarParaStorage(estado.fotoUrl, "perfis/" + API.utilizador.id);
  return API.guardar("perfil", {
    fotoUrl: estado.fotoUrl, tema: estado.tema,
    streakDias: estado.streakDias, notificacoes: estado.notificacoes
  }).catch(erro => avisarQueNaoGuardou(erro));
}

function salvarNotificacoesLidas(ids){
  if(modoDemonstracao()){ guardarDB(); return Promise.resolve(); }
  return API.marcarLidas(ids).catch(erro => avisarQueNaoGuardou(erro));
}

function salvarReacao(mensagemId, gostou){
  if(modoDemonstracao()){ guardarDB(); return Promise.resolve(); }
  return API.reagir(mensagemId, gostou).catch(erro => avisarQueNaoGuardou(erro));
}
function salvarNome(nome){
  if(modoDemonstracao()){ guardarDB(); return Promise.resolve(); }
  return API.atualizarNome(nome).catch(erro => avisarQueNaoGuardou(erro));
}


/* ============================================================
   O que pertence ao CRM
   Membros, planos, turmas e ofertas sao do Kingdom Dashboard. A
   academia le-os, nao os escreve: duas listas do mesmo acabam sempre
   a divergir. Estes ecras mostram o que la esta e mandam editar la.
   ============================================================ */
const URL_CRM = "https://kingdom-dashboard.vercel.app";

function soNoCRM(oQue){
  if(modoDemonstracao()) return false;
  confirmarAcao({
    titulo: oQue + " vivem no Kingdom Dashboard",
    mensagem: `Para a academia e o teu CRM não ficarem com duas listas diferentes, ${oQue.toLowerCase()} são geridos num só lugar. Cria ou altera lá, e aqui aparece no próximo carregamento.`,
    textoConfirmar: "Abrir o Dashboard",
    aoConfirmar: () => window.open(URL_CRM, "_blank", "noopener")
  });
  return true;
}


/* ============================================================
   A conversa em direto
   Chega uma alteração, arrumamos o DB em memória e, se a comunidade
   estiver aberta, o ecrã acompanha. O que já fizemos nós não conta
   duas vezes: a nossa mensagem e o nosso gosto já estão no ecrã.
   ============================================================ */
function ligarComunidadeEmDireto(){
  if(modoDemonstracao()) return;
  API.ouvirComunidade((tipo, carga) => {
    const mudou = tipo === "mensagem"
      ? aplicarMensagemEmDireto(carga)
      : aplicarReacaoEmDireto(carga);
    if(mudou && estado.viewAtual === "comunidade") renderComunidade();
  });
}

function aplicarMensagemEmDireto(carga){
  const eu = API.utilizador ? API.utilizador.id : null;

  if(carga.eventType === "DELETE"){
    const id = (carga.old || {}).id;
    if(!id) return false;
    const antes = DB.posts.length;
    DB.posts = DB.posts.filter(p => String(p.id) !== String(id));
    return DB.posts.length !== antes;
  }

  const nova = deMensagem(carga.new);
  const existente = DB.posts.find(p => String(p.id) === String(nova.id));

  if(existente){
    /* Os gostos vivem noutra tabela: não os deitamos fora ao atualizar. */
    Object.assign(existente, nova, { likes:existente.likes, curtido:existente.curtido });
    return true;
  }
  if(carga.eventType !== "INSERT") return false;

  DB.posts.unshift(nova);
  if(nova.autorId !== eu) notificarMensagemNova(nova);
  return true;
}

function aplicarReacaoEmDireto(carga){
  const eu = API.utilizador ? API.utilizador.id : null;
  const linha = carga.new && carga.new.mensagem_id ? carga.new : carga.old;
  if(!linha) return false;
  if(linha.utilizador_id === eu) return false;   // o nosso gosto já está contado

  const post = DB.posts.find(p => String(p.id) === String(linha.mensagem_id));
  if(!post) return false;
  post.likes = Math.max(0, post.likes + (carga.eventType === "INSERT" ? 1 : -1));
  return true;
}

/* Uma mensagem nova noutro espaço não deve passar despercebida. */
function notificarMensagemNova(mensagem){
  if(estado.viewAtual === "comunidade" && (estado.espacoComunidade || "geral") === (mensagem.espacoId || "geral")) return;
  const espaco = (DB.espacos || []).find(e => e.id === mensagem.espacoId);
  mostrarToast(`${mensagem.autor} escreveu em ${espaco ? espaco.nome : "Comunidade"}`);
}

/* ============================================================
   Enviar ficheiros
   ============================================================ */
const BALDE_PUBLICO = "academia-publico";
const BALDE_PRIVADO = "academia-privado";

function nomeSeguro(nome){
  return String(nome || "ficheiro")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // tira acentos
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-60);
}

/* Envia e devolve o endereço a guardar na linha. Em modo de
   demonstração devolve o data: URL de sempre, para os testes
   continuarem a correr sem servidor. */
async function enviarImagem(ficheiro, pasta){
  if(modoDemonstracao()) return lerComoDataURL(ficheiro);
  const caminho = `${pasta}/${novoId("img")}-${nomeSeguro(ficheiro.name)}`;
  return API.enviarFicheiro(BALDE_PUBLICO, caminho, ficheiro);
}

async function enviarAnexo(ficheiro, pasta){
  if(modoDemonstracao()) return lerComoDataURL(ficheiro);
  const caminho = `${pasta}/${novoId("anx")}-${nomeSeguro(ficheiro.name)}`;
  return API.enviarFicheiro(BALDE_PRIVADO, caminho, ficheiro);
}

function lerComoDataURL(ficheiro){
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = ev => resolve(ev.target.result);
    leitor.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
    leitor.readAsDataURL(ficheiro);
  });
}

/* Um endereço do balde privado só serve depois de assinado. */
async function abrirFicheiroPrivado(endereco, nome){
  try {
    const url = String(endereco || "").startsWith("storage:")
      ? await API.assinar(endereco.slice(8))
      : endereco;
    const a = document.createElement("a");
    a.href = url; a.download = nome || ""; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  } catch(erro){
    mostrarToast(erro.message || "Não foi possível abrir o ficheiro.");
  }
}

/* Imagens antigas ficaram guardadas como texto dentro da base de
   dados. Na próxima vez que o registo for gravado, passam para o
   Storage sem ninguém ter de fazer nada. */
async function passarParaStorage(valor, pasta){
  if(modoDemonstracao()) return valor;
  if(!valor || !String(valor).startsWith("data:")) return valor;
  try {
    const resposta = await fetch(valor);
    const blob = await resposta.blob();
    const extensao = (blob.type.split("/")[1] || "jpg").replace("+xml", "");
    const ficheiro = new File([blob], "imagem." + extensao, { type:blob.type });
    return await enviarImagem(ficheiro, pasta);
  } catch(e){
    return valor;         // não conseguiu: fica como estava, sem perder nada
  }
}
