/* ============================================================
   Ofertas — só de leitura
   O que se vende passou a editar-se no Payflow, que é onde o
   dinheiro entra. Aqui ficou apenas o que a área de membros
   precisa de saber: qual a oferta a propor a quem encontra um
   curso que ainda não pode abrir.
   ============================================================ */

function ofertasAtivas(){ return (DB.ofertas||[]).filter(o=>o.ativa!==false); }

/* A oferta que desbloqueia um curso. Há dois caminhos, e o directo vem
   primeiro: a oferta que entrega este curso sozinho. Só depois se procura um
   plano que o leve dentro. No fim, se nada apontar para ele, propõe-se o que
   houver — melhor do que um cartão sem saída. */
function ofertaParaCurso(cursoId){
  const curso = DB.cursos.find(c => c.id === cursoId);
  const directa = curso && curso.ofertaId != null
    ? ofertasAtivas().find(o => String(o.id) === String(curso.ofertaId))
    : null;
  if(directa) return directa;

  const plano = (DB.planos||[]).find(p => (p.cursos||[]).includes(cursoId) && p.ofertaId);
  const doPlano = plano && ofertasAtivas().find(o => String(o.id) === String(plano.ofertaId));
  if(doPlano) return doPlano;

  return ofertasAtivas().find(o => o.destaque) || ofertasAtivas()[0];
}

/* Cursos publicados que este aluno ainda não pode abrir. */
function cursosBloqueados(){
  const abertos = new Set(cursosVisiveis().map(c=>c.id));
  return DB.cursos.filter(c => c.publicado !== false && c.vitrine !== false && !abertos.has(c.id));
}
