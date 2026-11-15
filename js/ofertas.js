/* ============================================================
   Ofertas, do lado do aluno: só leitura
   O que se vende monta-se em Administração › Ofertas, e a Vitrine vem
   decidida do servidor. Aqui ficou só a leitura de que os ecrãs do aluno
   precisam.
   ============================================================ */

function ofertasAtivas(){ return (DB.ofertas||[]).filter(o=>o.ativa!==false); }

/* A oferta da Vitrine que abre este curso: o cartão já veio decidido pelo
   servidor, com as guardas passadas. Se não estiver aqui, é porque não se
   pode vender: ou não foi mandada mostrar, ou não tem aulas, ou a pessoa
   já a tem. Não se inventa um caminho alternativo a partir do browser. */
function ofertaNaVitrinePara(cursoId){
  return (DB.vitrine||[]).find(o => o.cursos.some(c => c.id === cursoId)) || null;
}

/* O que se lê ao lado do preço de uma oferta que se renova. */
function periodoDaOferta(o){
  return o.mensal ? t("/mês") : o.anual ? t("/ano") : "";
}
