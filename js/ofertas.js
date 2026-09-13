/* ============================================================
   Ofertas — só de leitura
   O que se vende passou a editar-se no Payflow, que é onde o
   dinheiro entra. Aqui ficou apenas o que a área de membros
   precisa de saber: qual a oferta a propor a quem encontra um
   curso que ainda não pode abrir.
   ============================================================ */

function ofertasAtivas(){ return (DB.ofertas||[]).filter(o=>o.ativa!==false); }

/* A oferta que desbloqueia um curso, através do plano que concede. */
function ofertaParaCurso(cursoId){
  return ofertasAtivas().find(o => {
    const plano = planoPorId(o.planoId);
    return plano && (plano.acessoTotal || (plano.cursos||[]).includes(cursoId));
  }) || ofertasAtivas().find(o => o.destaque) || ofertasAtivas()[0];
}

/* Cursos publicados que este aluno ainda não pode abrir. */
function cursosBloqueados(){
  const abertos = new Set(cursosVisiveis().map(c=>c.id));
  return DB.cursos.filter(c => c.publicado !== false && c.vitrine !== false && !abertos.has(c.id));
}
