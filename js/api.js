/* ============================================================
   Camada de dados
   O resto da aplicação continua a ler o objeto DB em memória.
   Este ficheiro é o único que sabe que por trás está o Supabase:
   carrega o DB à entrada e escreve registo a registo.
   ============================================================ */

const API = {
  cliente: null,
  utilizador: null,          // { id, nome, email, perfil }
  organizacao: null,         // { id, slug, nome } — a do endereço

  iniciar(){
    if(this.cliente) return this.cliente;
    if(typeof supabase === "undefined")
      throw new Error("A biblioteca do Supabase não carregou.");
    /* O cabeçalho da organização só vai para a base (/rest/v1/). As Edge
       Functions declaram uma a uma os cabeçalhos que aceitam, e um a mais
       fazia o browser recusar o pedido. */
    const organizacao = organizacaoDoEndereco();
    const comOrganizacao = (url, opcoes = {}) => {
      if(!String(url).includes("/rest/v1/")) return fetch(url, opcoes);
      const cabecalhos = new Headers(opcoes.headers || {});
      cabecalhos.set("x-organizacao", organizacao);
      return fetch(url, Object.assign({}, opcoes, { headers: cabecalhos }));
    };
    this.cliente = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      db: { schema: ESQUEMA },
      auth: { persistSession: true, autoRefreshToken: true },
      global: { fetch: comOrganizacao }
    });
    return this.cliente;
  },

  /* O schema academia é o predefinido; para as tabelas do CRM
     (ofertas, turmas) é preciso pedir o schema public. */
  pub(){ return this.cliente.schema("public"); },

  /* A marca da escola deste endereço, para o ecrã de entrada: nome,
     logótipo, cor, textos. Lê-se antes de alguém entrar. */
  async marca(){
    const { data, error } = await this.pub().rpc("marca_da_academia", { p_endereco: organizacaoDoEndereco() });
    if(error) throw error;
    return data;
  },

  /* ---------------- Autenticação ---------------- */
  /* Quem foi convidado entra pela primeira vez sem password nenhuma.
     Essa marca fica na conta, não no endereço: assim não se perde num
     redireccionamento nem se apaga ao recarregar a página. */
  precisaDePassword: false,

  async sessao(){
    const { data } = await this.cliente.auth.getSession();
    if(!data.session) return null;
    this.precisaDePassword = !!(data.session.user.user_metadata || {}).precisa_password;
    this.idiomaDaCompra = (data.session.user.user_metadata || {}).idioma || null;
    return this.carregarUtilizador(data.session.user.id);
  },

  async carregarUtilizador(id){
    const { data, error } = await this.pub()
      .from("utilizadores")
      .select("id, nome, email, perfil, estado, foto_url")
      .eq("id", id)
      .maybeSingle();
    if(error) throw error;
    if(!data) throw new Error(t("A sua conta ainda não está ligada à academia. Fale com a mentoria."));
    if(data.estado !== "Ativo") throw new Error(t("Este acesso está suspenso. Fale com a sua mentoria."));
    /* O papel é o desta organização (nucleo.membros), não o perfil geral da
       conta: quem administra uma Academia pode ser aluno noutra. Sem papel,
       a pessoa não é membro desta. Antes de perguntar, aceitam-se os convites
       à espera: é o convite que faz da pessoa membro (o dono de uma escola
       nova não é membro de nada até o aceitar). Não tem efeito em quem não
       tem convite, e um erro aqui não trava a entrada. */
    try { await this.cliente.rpc("aceitar_convite"); } catch(e){ /* segue-se na mesma */ }
    const { data: papel, error: semPapel } = await this.cliente.rpc("meu_papel");
    if(semPapel) throw semPapel;
    if(!papel) throw new Error(t("A sua conta ainda não está ligada à academia. Fale com a mentoria."));
    data.perfil = papel;
    /* Os ficheiros novos vão para a pasta da organização (o/<id>/…). */
    const { data: organizacao, error: semOrganizacao } = await this.cliente.rpc("organizacao_atual");
    if(semOrganizacao) throw semOrganizacao;
    this.organizacao = organizacao;
    this.utilizador = data;
    return data;
  },

  async entrar(email, password){
    const { data, error } = await this.cliente.auth.signInWithPassword({ email, password });
    if(error) throw new Error(traduzirErroAuth(error));
    /* A língua com que a pessoa comprou vem na conta desde o convite. */
    this.idiomaDaCompra = (data.user.user_metadata || {}).idioma || null;
    return this.carregarUtilizador(data.user.id);
  },

  async sair(){
    await this.cliente.auth.signOut();
    this.utilizador = null;
  },

  /* O email sai pelo Resend, pela função recuperar-password, e não pelo
     Supabase: o mesmo remetente e o mesmo desenho dos outros emails. A
     resposta é igual com ou sem conta — nunca se diz quem tem acesso. */
  async pedirNovaPassword(email){
    /* O link volta a esta escola: no domínio dela, ou aqui com ?org= (sem
       ele, o email abria num separador novo já sem saber da escola). A carta
       sai com a marca da escola. */
    const enderecoDeVolta = () => {
      const u = new URL(location.origin + location.pathname);
      const escola = organizacaoDoEndereco();
      if(escola && escola !== location.hostname) u.searchParams.set("org", escola);
      if(idioma() === "en") u.searchParams.set("lang", "en");
      return u.toString() + "#nova-password";
    };
    const { data, error } = await this.cliente.functions.invoke("recuperar-password", {
      /* O email sai na língua de quem pediu, e o link volta com ela. */
      body:{ email, onde:"academia", idioma: idioma(), volta: enderecoDeVolta() }
    });
    if(error){
      let detalhe = "";
      try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* resposta sem corpo */ }
      throw new Error(t(detalhe || "Não foi possível enviar agora. Tente daqui a pouco."));
    }
    if(data && data.error) throw new Error(t(data.error));
  },

  /* O código que vem por email (convite ou recuperação), confirmado aqui com
     verifyOtp, como faz a Kingdom Library. Não passa pelos redireccionamentos
     do Supabase, que só voltam para as moradas da lista do Auth e, fora dela,
     mandavam as pessoas para localhost:3000. */
  async entrarComCodigo(tokenHash, tipo){
    const { data, error } = await this.cliente.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if(error || !data?.session) throw new Error(t("Este link já foi usado ou expirou. Peça um novo."));
    this.precisaDePassword = true;
    return data.session;
  },

  /* O link do email do convite: `?convite=<token>`. O servidor diz se o
     convite ainda vale e, se valer, devolve o link de entrada. */
  async abrirConvite(token){
    const { data, error } = await this.cliente.functions.invoke("convite-entrar", { body:{ token } });
    if(error){
      let detalhe = "";
      try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* resposta sem corpo */ }
      throw new Error(t(detalhe || "Não foi possível abrir o convite agora. Tente daqui a pouco."));
    }
    return data || { estado:"inexistente" };
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

    /* Os certificados gravam-se na base quando o aluno conclui o curso. Isto
       grava os que faltarem a quem entra (a regra pode ter baixado desde a
       última aula) antes de se lerem. Tal como o convite, nunca trava a entrada. */
    try { await c.rpc("verificar_certificados"); } catch(e){ /* segue-se na mesma */ }

    const [
      categorias, cursos, espacos, mensagens, reacoes, eventos, banners,
      conquistas, config, avaliacoes, notificacoes, lidas,
      progresso, presencas, onboarding, perfil, certificados,
      ofertas, turmas, planos, salas, comunidades
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
      lista(this.pub().from("ofertas").select("id, nome, preco, moeda, cobranca, link_vendas, estado, atalho").is("removido_em", null)),
      lista(this.pub().from("turmas").select("id, oferta_id, nome, estado, inicio, fim").is("removido_em", null)),
      lista(c.from("planos").select("*, plano_cursos ( curso_id, ordem )").is("removido_em", null).order("ordem")),
      /* Só voltam as salas em que esta pessoa pode entrar: num evento pago,
         o link é o que se compra, e o servidor não o dá a quem não pagou. */
      lista(c.from("salas").select("evento_id, link")),
      /* Os grupos: a base só devolve os das ofertas desta pessoa, e só a
         eles o link. */
      lista(c.from("comunidades").select("*").is("removido_em", null).order("ordem"))
    ]);

    /* Quem decide a que cursos esta pessoa tem acesso é o servidor.
       Antes o browser adivinhava pelo plano — e adivinhava mal: dava
       cartões de cursos que depois abriam sem uma única aula. */
    const { data: meus } = await c.rpc("meus_cursos");
    DB.meusCursos = (meus || []).map(r => (typeof r === "string" ? r : r.meus_cursos));

    /* A Vitrine vem decidida de lá: o que mostrar, a que preço e para onde
       mandar quem carregar. O browser não escolhe nada disto. */
    const { data: montra } = await c.rpc("vitrine_do_aluno");
    DB.vitrine = (montra || []).map(deVitrine);

    /* Os cursos que esta pessoa comprou em pré-venda: entra e vê quando as
       aulas abrem, em vez de um curso vazio. */
    const { data: preVenda } = await c.rpc("pre_venda_dos_meus_cursos");
    DB.preVenda = preVenda || [];

    DB.categorias  = Object.fromEntries(categorias.map(r => [r.id, { nome:r.nome, cor:r.cor }]));
    DB.cursos      = cursos.map(deCurso);
    DB.espacos     = espacos.map(deEspaco);
    DB.comunidades = comunidades.map(deComunidade);
    DB.posts       = mensagens.map(deMensagem);
    aplicarReacoes(DB.posts, reacoes, eu);
    const linkDaSala = Object.fromEntries(salas.map(s => [s.evento_id, s.link]));
    DB.eventos     = eventos.map(r => deEvento(r, linkDaSala[r.id]));
    DB.banners     = banners.map(deBanner);
    DB.conquistas  = conquistas.map(deConquista);
    DB.avaliacoes  = avaliacoes.map(deAvaliacao);
    DB.ofertas     = ofertas.map(deOferta);
    DB.planos      = planos.map(dePlano);
    DB.turmas      = turmas.map(t => deTurma(t, cursos));
    DB.certificados = certificados.map(deCertificado);

    const idsLidas = new Set(lidas.map(l => l.notificacao_id));
    DB.notificacoes = notificacoes.map(n => ({
      id:n.id, titulo:n.titulo, desc:n.descricao||"", tempo:tempoRelativo(n.criado_em),
      tipo:n.tipo || "geral", link:n.link || "", lida: idsLidas.has(n.id)
    }));

    aplicarConfig(config);
    aplicarEstadoDoAluno({ progresso, presencas, onboarding, perfil });

    /* Quem é da equipa vê também os rascunhos, os membros e os convites. */
    if(ehEquipa()){
      const [membros, convites, emitidos] = await Promise.all([
        lista(c.rpc("membros_da_organizacao")),
        lista(c.from("convites").select("*").order("criado_em", { ascending:false })),
        lista(c.from("certificados").select("*").order("emitido_em", { ascending:false }))
      ]);
      DB.membros  = membros.map(deMembro);
      DB.convites = convites.map(deConvite);
      DB.certificadosEmitidos = emitidos.map(deCertificado);

      /* Quantas pessoas confirmaram presença em cada encontro. */
      const todas = await lista(c.from("presencas").select("evento_id"));
      const porEvento = {};
      todas.forEach(p => { porEvento[p.evento_id] = (porEvento[p.evento_id] || 0) + 1; });
      DB.eventos.forEach(e => { e.confirmados = porEvento[e.id] || 0; });
    } else {
      DB.membros  = [deMembro(this.utilizador)];
      DB.convites = [];
      DB.certificadosEmitidos = [];
    }
  },

  /* Relê só os convites: o estado deles muda quando a pessoa entra,
     e isso acontece longe deste ecrã. */
  async recarregarConvites(){
    const linhas = await lista(this.cliente.from("convites").select("*").order("criado_em", { ascending:false }));
    DB.convites = linhas.map(deConvite);
  },

  /* Revogar não apaga: o convite fica, parado, e deixa de dar entrada. */
  async revogarConvite(id){
    const { error } = await this.cliente.from("convites")
      .update({ revogado_em: new Date().toISOString() }).eq("id", id);
    if(error) throw new Error(error.message);
  },

  /* Convidar grava o convite com o prazo e manda o email pelo Resend.
     Corre no servidor: o browser não tem (nem pode ter) essa chave. */
  async convidar(pedido){
    /* O convite é para a escola deste endereço. */
    const corpo = Object.assign({ organizacao: this.organizacao ? this.organizacao.slug : undefined }, pedido);
    const { data, error } = await this.cliente.functions.invoke("convidar-aluno", { body:corpo });
    if(error){
      let detalhe = "";
      try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* resposta sem corpo */ }
      throw new Error(detalhe || traduzirErroAuth(error));
    }
    if(data && data.error) throw new Error(data.error);
    return data;
  },


  /* O domínio próprio da escola (Configurações). Lê-se na base; ligar,
     verificar e remover passam pelo servidor, que confere o DNS e fala com a
     Vercel. */
  async dominioProprio(){
    const { data, error } = await this.cliente.rpc("dominio_proprio");
    if(error) throw new Error(error.message);
    return data;
  },
  async gerirDominio(accao, dominio){
    const { data, error } = await this.cliente.functions.invoke("dominio-proprio", {
      body:{ accao, dominio: dominio || null, organizacao: this.organizacao ? this.organizacao.id : null }
    });
    if(error){
      let detalhe = "";
      try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* resposta sem corpo */ }
      throw new Error(detalhe || traduzirErroAuth(error));
    }
    if(data && data.error) throw new Error(data.error);
    return data;
  },

  /* A mensalidade da escola (Configurações › Cobrança, W4). O que se lê e os
     dados de faturação, o plano e o cancelamento vão à base; o cartão e o
     «Pagar agora» passam pelo servidor, que fala com a Paystack. */
  async cobrancaDaEscola(){
    const { data, error } = await this.cliente.rpc("cobranca_da_escola");
    if(error) throw new Error(error.message);
    return data;
  },
  async guardarFaturacao(dados){
    const { error } = await this.cliente.rpc("guardar_faturacao", { p_dados: dados });
    if(error) throw new Error(error.message);
  },
  async mudarPlano(plano, ciclo){
    const { error } = await this.cliente.rpc("mudar_plano", { p_plano: plano, p_ciclo: ciclo });
    if(error) throw new Error(error.message);
  },
  async cancelarAssinatura(cancelar){
    const { error } = await this.cliente.rpc("cancelar_assinatura", { p_cancelar: !!cancelar });
    if(error) throw new Error(error.message);
  },
  async pedirAoServidorDaCobranca(funcao, corpo){
    const { data, error } = await this.cliente.functions.invoke(funcao, {
      body: Object.assign({ organizacao: this.organizacao ? this.organizacao.id : null }, corpo || {})
    });
    if(error){
      let detalhe = "";
      try { detalhe = (await error.context.json()).error || ""; } catch(e){ /* resposta sem corpo */ }
      throw new Error(detalhe || traduzirErroAuth(error));
    }
    if(data && data.error) throw new Error(data.error);
    return data;
  },
  cartaoIniciar(){ return this.pedirAoServidorDaCobranca("plataforma-cartao", { accao:"iniciar" }); },
  cartaoConfirmar(referencia){ return this.pedirAoServidorDaCobranca("plataforma-cartao", { accao:"confirmar", referencia }); },
  pagarAgora(){ return this.pedirAoServidorDaCobranca("plataforma-cobrar", {}); },

  /* Os acessos da própria pessoa. Quem paga faz isso NOUTRO separador -- o
     checkout abre-se ao lado -- e por isso a Academia fica parada num ecrã
     que já não corresponde ao que ela tem. Isto trata do caso em que o
     acesso é escrito enquanto ela está a olhar. */
  canalAcessos: null,

  ouvirAcessos(aoMudar){
    if(this.canalAcessos || !this.utilizador) return this.canalAcessos;
    this.canalAcessos = this.cliente
      .channel("os-meus-acessos")
      .on("postgres_changes", {
        event: "*", schema: ESQUEMA, table: "acessos",
        filter: `utilizador_id=eq.${this.utilizador.id}`
      }, aoMudar)
      .subscribe();
    return this.canalAcessos;
  },

  /* Reconfirmar quem tem acesso a quê. Devolve true se alguma coisa mudou,
     para o ecrã só se redesenhar quando há razão. */
  async relerAcesso(){
    const c = this.cliente;
    const [{ data: meus }, { data: montra }, { data: preVenda }] = await Promise.all([
      c.rpc("meus_cursos"),
      c.rpc("vitrine_do_aluno"),
      c.rpc("pre_venda_dos_meus_cursos")
    ]);
    DB.preVenda = preVenda || [];
    const cursos = (meus || []).map(r => (typeof r === "string" ? r : r.meus_cursos));
    const vitrine = (montra || []).map(deVitrine);

    const mudou = cursos.slice().sort().join("|") !== (DB.meusCursos || []).slice().sort().join("|")
               || vitrine.map(v => v.ofertaId).join("|") !== (DB.vitrine || []).map(v => v.ofertaId).join("|");

    DB.meusCursos = cursos;
    DB.vitrine = vitrine;
    return mudou;
  },

  /* ---------------- A montra, do lado da equipa ---------------- */
  async vitrineDaEquipa(){
    const { data, error } = await this.cliente.rpc("vitrine_para_equipa");
    if(error) throw new Error(traduzirErroDados(error));
    return data || [];
  },

  /* O ensaio da migração. Só lê — não há nada do outro lado que escreva. */
  async ensaioDaMigracao(){
    const { data, error } = await this.cliente.rpc("ensaio_da_migracao");
    if(error) throw new Error(traduzirErroDados(error));
    return data || { resumo:{}, porOferta:[] };
  },

  async mostrarNaVitrine(ofertaId, mostrar, extra){
    const { data, error } = await this.cliente.rpc("vitrine_mostrar", {
      p_oferta: Number(ofertaId),
      p_mostrar: !!mostrar,
      p_destaque: extra && "destaque" in extra ? !!extra.destaque : null,
      p_chamada: extra && "chamada" in extra ? (extra.chamada || null) : null
    });
    if(error) throw new Error(traduzirErroDados(error));
    return data;
  },

  /* Pré-venda de uma oferta: só a equipa. Ligá-la não a põe à vista -- isso
     é o interruptor «Na Vitrine». */
  async preVendaNaVitrine(ofertaId, emBreve, abreEm){
    const { data, error } = await this.cliente.rpc("vitrine_pre_venda", {
      p_oferta: Number(ofertaId), p_em_breve: !!emBreve, p_abre_em: emBreve && abreEm ? abreEm : null
    });
    if(error) throw new Error(traduzirErroDados(error));
    return data;
  },

  pararDeOuvir(){
    if(this.canalAcessos){
      this.cliente.removeChannel(this.canalAcessos);
      this.canalAcessos = null;
    }
  },

  /* O link da sala vive à parte do evento: num evento pago é o que se compra,
     e tem a sua própria regra de leitura. Sem link, a linha sai. */
  async guardarSala(eventoId, link){
    const limpo = linkExterno(link);
    const { error } = limpo
      ? await this.cliente.from("salas").upsert({ evento_id:eventoId, link:limpo })
      : await this.cliente.from("salas").delete().eq("evento_id", eventoId);
    if(error) throw new Error(traduzirErroDados(error));
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

  /* Os meus certificados, relidos depois de concluir uma aula: quem os
     grava é a base, e o browser só precisa de saber o que ficou gravado. */
  async lerCertificados(){
    const eu = this.utilizador.id;
    const linhas = await lista(this.cliente.from("certificados").select("*").eq("utilizador_id", eu));
    return linhas.map(deCertificado);
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

  /* O plano é o registo e a lista de cursos que vão dentro dele. A lista é
     substituída por inteiro — é o que o editor mostra — e a ordem em que ficam
     é a ordem por que o aluno os vê. */
  async guardarPlano(plano){
    const linha = MAPAS.plano.para(plano);
    if(!linha.id) delete linha.id;          /* plano novo: o id nasce na base */
    const { data, error } = await this.cliente
      .from("planos").upsert(linha).select("id").maybeSingle();
    if(error) throw new Error(traduzirErroDados(error));

    const id = data?.id || plano.id;
    const { error: erroApagar } = await this.cliente
      .from("plano_cursos").delete().eq("plano_id", id);
    if(erroApagar) throw new Error(traduzirErroDados(erroApagar));

    const cursos = plano.cursos || [];
    if(cursos.length){
      const { error: erroPor } = await this.cliente.from("plano_cursos")
        .insert(cursos.map((cursoId, i) => ({ plano_id:id, curso_id:cursoId, ordem:i + 1 })));
      if(erroPor) throw new Error(traduzirErroDados(erroPor));
    }
    return id;
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
    abertoATodos: r.aberto_a_todos === true,
    facilitador: r.facilitador || "", facilitadorFoto: r.facilitador_foto_url || "",
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

function deEvento(r, linkDaSala){
  return { id:r.id, titulo:r.titulo, descricao:r.descricao||"", data:r.data,
           hora:(r.hora||"19:00").slice(0,5), tipo:r.tipo,
           categoria:r.categoria_id, link:linkDaSala||"",
           local:r.local||"", acesso:r.acesso||"gratuito",
           ofertaId:r.oferta_id, cursos:r.cursos||[], confirmados:0 };
}

function deBanner(r){
  return { id:r.id, eyebrow:r.eyebrow||"", titulo:r.titulo, cta:r.cta,
           link:r.link||"", imagem:r.imagem_url||"", gradiente:r.gradiente||"", ativo:r.ativo, ordem:r.ordem,
           destinoTipo:r.destino_tipo||"pagina", destinoId:r.destino_id||"", resumo:r.resumo||"" };
}

function deConquista(r){
  return { id:r.id, titulo:r.titulo, desc:r.descricao||"", regra:r.regra, ordem:r.ordem };
}

function deAvaliacao(r){
  return { id:r.id, membroId:r.utilizador_id, aulaId:r.aula_id, cursoId:r.curso_id,
           nome:r.autor_nome||"Aluno", estrelas:r.estrelas, comentario:r.comentario||"",
           oculto:r.oculto, data:(r.criado_em||"").slice(0,10) };
}

function deComunidade(r){
  return { id:r.id, nome:r.nome, descricao:r.descricao||"", canal:r.canal||"whatsapp", link:r.link||"",
           imagem:r.imagem_url||"", ofertas:(r.ofertas||[]).map(String), todos:!!r.todos,
           ativa:r.ativa!==false, ordem:r.ordem||0 };
}

/* A oferta do CRM é a oferta que a Vitrine mostra. */
function deOferta(r){
  return { id:String(r.id), nome:r.nome, preco:Number(r.preco)||0, moeda:r.moeda||"MZN",
           periodo: r.cobranca === "Recorrente mensal" ? "mês" : "único",
           link:r.link_vendas||"", atalho:r.atalho||"",
           ativa:r.estado === "Ativa", descricao:"" };
}

/* Um cartão da Vitrine, já decidido pelo servidor: se chegou aqui é porque
   passou nas cinco guardas. O destino é o checkout da oferta; a página de
   vendas só entra quando não há atalho nenhum. */
function deVitrine(r){
  const destino = linkCheckout(r.atalho) || linkExterno(r.linkVendas || "") || "";
  return {
    ofertaId: String(r.ofertaId), nome: r.nome,
    preco: Number(r.preco) || 0, moeda: r.moeda || "MZN",
    mensal: r.cobranca === "Recorrente mensal",
    entrega: r.entrega, destaque: !!r.destaque, chamada: r.chamada || "",
    ordem: r.ordem || 0, aulas: Number(r.aulas) || 0, segundos: Number(r.segundos) || 0,
    emBreve: !!r.emBreve, abreEm: r.abreEm || null,
    checkout: !!linkCheckout(r.atalho), destino,
    cursos: (r.cursos || []).map(c => ({
      id: c.id, titulo: c.titulo, subtitulo: c.subtitulo || "", sigla: c.sigla || "",
      capa: c.capa || "", categoria: c.categoria,
      facilitador: c.facilitador || "", facilitadorFoto: c.facilitadorFoto || "",
      nota: Number(c.nota) || 0, avaliacoes: Number(c.avaliacoes) || 0,
      aulas: Number(c.aulas) || 0, segundos: Number(c.segundos) || 0, modulos: Number(c.modulos) || 0
    }))
  };
}

/* Um plano é um nome e os cursos que vão dentro dele. O preço não está aqui:
   está na oferta que o vende, no Payflow. Guardar o preço nos dois sítios era
   garantir que um dia diziam valores diferentes. */
function dePlano(r){
  return {
    id: r.id, nome: r.nome, descricao: r.descricao || "",
    ofertaId: r.oferta_id != null ? String(r.oferta_id) : null,
    cursos: (r.plano_cursos || [])
              .slice().sort((a,b) => (a.ordem||0) - (b.ordem||0))
              .map(pc => pc.curso_id),
    ordem: r.ordem || 0
  };
}

function deTurma(t, cursos){
  const curso = cursos.find(c => c.oferta_id === t.oferta_id);
  return { id:String(t.id), nome:t.nome, cursoId:curso ? curso.id : null,
           inicio:t.inicio, fim:t.fim, ativa:t.estado !== "Concluída", membros:[] };
}

/* Um certificado gravado: o nome e o título ficam como estavam no dia. */
function deCertificado(r){
  return { id:r.id, utilizadorId:r.utilizador_id, cursoId:r.curso_id, codigo:r.codigo,
           emitidoEm:r.emitido_em, nome:r.nome || "", cursoTitulo:r.curso_titulo || "" };
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
    idioma: c.idioma || "pt",
    origem: c.origem || "manual",
    estado: estadoDaLinhaDoConvite(c),
    criadoEm: c.criado_em || "",
    expiraEm: c.expira_em || ""
  };
}

/* Um estado só, pela ordem do que pesa mais: aceite, revogado, expirado,
   aberto, enviado. Um convite aceite não «expira» depois. */
function estadoDaLinhaDoConvite(c){
  if(c.aceite_em) return "aceite";
  if(c.revogado_em) return "revogado";
  if(c.expira_em && new Date(c.expira_em) < new Date()) return "expirado";
  if(c.aberto_em) return "aberto";
  return "enviado";
}

/* A marca que chegou da base, antes de entrar: fica guardada no browser
   (por endereço) para a próxima abertura já começar com ela. */
const MARCA_CHAVE = "academia.marca:";
function aplicarMarcaPublica(m){
  if(!m) return;
  DB.aparencia = Object.assign({}, APARENCIA_PADRAO, m);
  if(!DB.aparencia.nomeEscola) DB.aparencia.nomeEscola = m.nome || "";
  try { localStorage.setItem(MARCA_CHAVE + organizacaoDoEndereco(), JSON.stringify(m)); } catch(e){}
}
function marcaGuardada(){
  try { return JSON.parse(localStorage.getItem(MARCA_CHAVE + organizacaoDoEndereco()) || "null"); }
  catch(e){ return null; }
}

function aplicarConfig(linhas){
  const porChave = Object.fromEntries(linhas.map(l => [l.chave, l.valor]));
  DB.aparencia = Object.assign({}, APARENCIA_PADRAO, porChave.aparencia || {});
  if(!DB.aparencia.nomeEscola) DB.aparencia.nomeEscola = (API.organizacao && API.organizacao.nome) || "";
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
  aplicarIdiomaDaConta({ perfil: perfil && perfil.idioma, compra: API.idiomaDaCompra });
  estado.idioma = perfil && perfil.idioma || null;
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
  if(!iso) return t("agora");
  const seg = Math.floor((Date.now() - new Date(iso)) / 1000);
  if(seg < 60) return t("agora");
  if(seg < 3600) return t("há {n} min", { n:Math.floor(seg/60) });
  if(seg < 86400) return t("há {n}h", { n:Math.floor(seg/3600) });
  const dias = Math.floor(seg/86400);
  return dias === 1 ? t("ontem") : t("há {n} dias", { n:dias });
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
                  aberto_a_todos: c.abertoATodos === true,
                  facilitador: (c.facilitador || "").trim() || null, facilitador_foto_url: c.facilitadorFoto || null,
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
  comunidade: { tabela:"comunidades", suave:true,
                para: c => ({ id:c.id, nome:c.nome, descricao:c.descricao||null, canal:c.canal||"whatsapp",
                              link:linkExterno(c.link)||c.link, imagem_url:c.imagem||null,
                              ofertas:(c.ofertas||[]).map(Number).filter(Boolean), todos:!!c.todos,
                              ativa:c.ativa!==false, ordem:c.ordem||0 }) },
  espaco:   { tabela:"espacos", para: e => ({ id:e.id, nome:e.nome, descricao:e.descricao, cor:e.cor, ativo:e.ativo, so_admin_publica:e.soAdminPublica, ordem:e.ordem||0 }) },
  mensagem: { tabela:"mensagens", para: m => ({ id:m.id, espaco_id:m.espacoId, autor_id:m.autorId || API.utilizador.id,
                  texto:m.texto||null, resposta_a:m.respostaA||null, ficheiro:m.ficheiro||null,
                  categoria_id:m.categoria||null, fixado:!!m.fixado, oculto:!!m.oculto }) },
  evento:   { tabela:"eventos", para: e => ({ id:e.id, titulo:e.titulo, descricao:e.descricao||null, data:e.data,
                  hora:e.hora, tipo:e.tipo, categoria_id:e.categoria,
                  local:e.local||null, acesso:e.acesso||"gratuito",
                  oferta_id:e.ofertaId ? Number(e.ofertaId) : null, cursos:e.cursos||[] }) },
  banner:   { tabela:"banners", para: b => ({ id:b.id, eyebrow:b.eyebrow, titulo:b.titulo, cta:b.cta, link:linkExterno(b.link) || null, imagem_url:b.imagem||null, gradiente:b.gradiente||null, ativo:b.ativo, ordem:b.ordem||0,
                  destino_tipo:b.destinoTipo||"pagina", destino_id:b.destinoTipo && b.destinoTipo !== "pagina" ? String(b.destinoId||"") || null : null,
                  resumo:b.resumo||null }) },
  conquista:{ tabela:"conquistas", para: c => ({ id:c.id, titulo:c.titulo, descricao:c.desc, regra:c.regra, ordem:c.ordem||0 }) },
  avaliacao:{ tabela:"avaliacoes", para: a => ({ id:a.id, utilizador_id:a.membroId || API.utilizador.id, aula_id:a.aulaId, curso_id:a.cursoId, estrelas:a.estrelas, comentario:a.comentario, oculto:!!a.oculto }) },
  acesso:   { tabela:"acessos", para: a => ({ id:a.id, utilizador_id:a.utilizadorId, curso_id:a.cursoId, origem:a.origem||"manual", expira_em:a.expiraEm||null, nota:a.nota||null }) },
  convite:  { tabela:"convites", para: c => ({ id:c.id, email:c.email, nome:c.nome, oferta_id:c.ofertaId||null, cursos:c.cursos||[] }) },
  /* Repara na ausência: oferta_id não vai aqui. Quem liga um plano a uma oferta
     é o Payflow, e uma escrita daqui apagava essa ligação sem ninguém dar por
     ela — o upsert só toca nas colunas que lhe damos. */
  plano:    { tabela:"planos", suave:true,
              para: p => ({ id:p.id, nome:p.nome, descricao:p.descricao||null, ordem:p.ordem||0 }) },
  onboarding:{ tabela:"onboarding", para: o => ({ utilizador_id:API.utilizador.id, objetivos:o.objetivos||[], ritmo:o.ritmo, momento:o.momento, saltado:!!o.saltado }) },
  perfil:   { tabela:"perfis", para: p => ({ utilizador_id:API.utilizador.id, foto_url:p.fotoUrl||null, tema:p.tema||null, streak_dias:p.streakDias||0, notificacoes:p.notificacoes||{}, idioma:p.idioma||null }) }
};

/* ============================================================
   Erros em português, com o que fazer a seguir
   ============================================================ */
function traduzirErroFicheiro(erro){
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("exceeded the maximum allowed size") || m.includes("payload too large"))
    return t("O ficheiro é grande de mais para este tipo de conteúdo.");
  if(m.includes("mime type") || m.includes("invalid_mime"))
    return t("Este tipo de ficheiro não é aceite aqui.");
  if(m.includes("row-level security") || m.includes("unauthorized"))
    return t("Não tem permissão para enviar este ficheiro.");
  if(m.includes("failed to fetch")) return t("Perdemos a ligação ao enviar o ficheiro.");
  return erro && erro.message ? t(erro.message) : t("Não foi possível enviar o ficheiro.");
}

function traduzirErroAuth(erro){
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return t("Não conseguimos falar com o servidor. Verifique a sua ligação à internet e tente de novo.");
  if(m.includes("invalid login")) return t("Email ou password errados.");
  if(m.includes("email not confirmed")) return t("Confirme o email antes de entrar. Procure a mensagem que lhe enviámos.");
  if(m.includes("rate limit") || m.includes("too many")) return t("Demasiadas tentativas. Espere um minuto e tente de novo.");
  if(m.includes("easy to guess") || m.includes("weak password") || m.includes("pwned"))
    return t("Essa password aparece em fugas de dados conhecidas. Escolha outra que não use noutro sítio.");
  if(m.includes("password should be") || m.includes("password should contain"))
    return t("Essa password não cumpre as regras da academia: {regra}.", { regra:erro.message || "" });
  return erro && erro.message ? t(erro.message) : t("Não foi possível entrar.");
}

function traduzirErroDados(erro){
  const codigo = erro && erro.code;
  const m = (erro && erro.message || "").toLowerCase();
  if(m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return t("Perdemos a ligação ao servidor. Verifique a internet e recarregue a página.");
  if(codigo === "42P01" || (erro.message||"").includes("schema must be one of"))
    return 'O schema "academia" ainda não está exposto na API do Supabase (Settings → Data API → Exposed schemas).';
  if(codigo === "42501" || codigo === "PGRST301")
    return t("Não tem permissão para esta operação.");
  if(codigo === "23505") return t("Já existe um registo com estes dados.");
  if(codigo === "23503") return t("Este registo está ligado a outro e não pode ficar assim.");
  return erro && erro.message ? t(erro.message) : t("Não foi possível guardar.");
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
  banner: [["imagem", "banners"]],
  comunidade: [["imagem", "comunidades"]]
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

/* O plano guarda-se inteiro: o nome e os cursos que leva dentro. Devolve o id
   porque um plano novo só o recebe aqui. */
async function salvarPlano(plano){
  if(modoDemonstracao()){ guardarDB(); return plano.id; }
  try { return await API.guardarPlano(plano); }
  catch(erro){ avisarQueNaoGuardou(erro); return plano.id; }
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
  mostrarToast(t("Não ficou guardado: {motivo}", { motivo }));
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
    <span>${t("Uma alteração não chegou ao servidor — o que vê pode não estar gravado.")}
    <strong>${motivo}</strong></span>
    <button class="btn btn-secondary btn-sm" id="btn-recarregar-falha">${t("Recarregar")}</button>
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
function salvarEmail(){ return guardarChaveDeConfig("email", DB.config.email || {}); }
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
/* O evento e a sua sala guardam-se juntos, pela ordem: a sala aponta para o
   evento, e um evento novo ainda não existe na base quando a sala chega. */
async function salvarEvento(evento){
  if(modoDemonstracao()){ guardarDB(); return; }
  try {
    await API.guardar("evento", evento);
    await API.guardarSala(evento.id, evento.link);
  } catch(erro){ avisarQueNaoGuardou(erro); }
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
    fotoUrl: estado.fotoUrl, tema: estado.tema, idioma: estado.idioma,
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
   Membros, planos, turmas e ofertas sao do painel de gestão. A
   academia le-os, nao os escreve: duas listas do mesmo acabam sempre
   a divergir. Estes ecras mostram o que la esta e mandam editar la.
   ============================================================ */
const URL_CRM = "https://kingdom-dashboard.vercel.app";

function soNoCRM(oQue){
  if(modoDemonstracao()) return false;
  confirmarAcao({
    titulo: oQue + " vivem no painel de gestão",
    mensagem: `Para a academia e o painel de gestão não ficarem com duas listas diferentes, ${oQue.toLowerCase()} são geridos num só lugar. Crie ou altere lá, e aqui aparece no próximo carregamento.`,
    textoConfirmar: "Abrir o painel de gestão",
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
/* ============================================================
   O acesso que muda enquanto a pessoa está a olhar
   Quem compra paga no checkout, que abre NOUTRO separador. Sem isto, a
   Academia ficava a mostrar o curso na Vitrine, com botão de comprar, a
   alguém que acabou de o comprar — e só se corrigia ao recarregar.

   São duas redes, porque nenhuma delas chega sozinha:

   - O Realtime avisa quando a linha do acesso é escrita. É instantâneo, mas
     só vê linhas a mudar.
   - Voltar ao separador reconfirma. É o que apanha um acesso que CADUCOU por
     data — nessa não muda linha nenhuma, e o Realtime nunca dispara — e
     também o que apanha um aviso perdido por a ligação ter caído.
   ============================================================ */
/* Só as listas. Uma aula NÃO se redesenha: quem está a ver um vídeo perdia o
   sítio a meio por causa de uma compra feita ao lado. E não é preciso — quem
   guarda o conteúdo é o RLS na base, não este ecrã. */
const VISTAS_DE_ACESSO = ["vitrine", "catalogo", "dashboard"];

async function reverAcesso(){
  if(modoDemonstracao() || !API.utilizador) return;
  try {
    if(await API.relerAcesso() && VISTAS_DE_ACESSO.includes(estado.viewAtual)){
      irPara(estado.viewAtual);
    }
  } catch(e){ /* sem rede: fica como está, e tenta-se outra vez à próxima */ }
}

function ligarAcessoEmDireto(){
  if(modoDemonstracao()) return;

  API.ouvirAcessos(() => reverAcesso());

  /* Um atraso curto porque quem volta do checkout chega muitas vezes à frente
     da confirmação: o pagamento foi aceite, a ponte ainda está a escrever. */
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible") setTimeout(reverAcesso, 1200);
  });
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

/* Cada organização tem a sua pasta nos dois baldes; as regras do Storage
   lêem a organização neste prefixo. Os ficheiros de antes (sem prefixo)
   são da Kingdom e continuam a abrir. */
function pastaDaOrganizacao(pasta){
  if(!API.organizacao || !API.organizacao.id) throw new Error(t("Não foi possível enviar o ficheiro. Recarregue a página e tente de novo."));
  return `o/${API.organizacao.id}/${pasta}`;
}

/* Envia e devolve o endereço a guardar na linha. Em modo de
   demonstração devolve o data: URL de sempre, para os testes
   continuarem a correr sem servidor. */
async function enviarImagem(ficheiro, pasta){
  if(modoDemonstracao()) return lerComoDataURL(ficheiro);
  const caminho = `${pastaDaOrganizacao(pasta)}/${novoId("img")}-${nomeSeguro(ficheiro.name)}`;
  return API.enviarFicheiro(BALDE_PUBLICO, caminho, ficheiro);
}

async function enviarAnexo(ficheiro, pasta){
  if(modoDemonstracao()) return lerComoDataURL(ficheiro);
  const caminho = `${pastaDaOrganizacao(pasta)}/${novoId("anx")}-${nomeSeguro(ficheiro.name)}`;
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
