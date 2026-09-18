/* ============================================================
   Ofertas — só de leitura
   O que se vende edita-se no Payflow, que é onde o dinheiro entra.
   O que se MOSTRA na Vitrine decide-se na Academia, na aba Vitrine.
   Aqui ficou só a leitura de que os ecrãs do aluno precisam.
   ============================================================ */

function ofertasAtivas(){ return (DB.ofertas||[]).filter(o=>o.ativa!==false); }

/* A oferta da Vitrine que abre este curso — o cartão já veio decidido pelo
   servidor, com as cinco guardas passadas. Se não estiver aqui, é porque não
   se pode vender: ou não foi mandada mostrar, ou não tem aulas, ou a pessoa
   já a tem. Não se inventa um caminho alternativo a partir do browser. */
function ofertaNaVitrinePara(cursoId){
  return (DB.vitrine||[]).find(o => o.cursos.some(c => c.id === cursoId)) || null;
}
