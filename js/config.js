/* ============================================================
   Ligação ao Supabase
   A chave publicável é pública por desenho — quem protege os dados
   é o RLS na base de dados, não o segredo desta linha.
   ============================================================ */
const SUPABASE_URL   = "https://epqfotzxrcyligwpauwk.supabase.co";
const SUPABASE_CHAVE = "sb_publishable_Ye3ZkJ8RoqMJuWgfdNclZQ_zdnal69h";
const ESQUEMA        = "academia";

/* O modo normal é o Supabase. O modo de demonstração serve os testes
   automáticos e permite ver a aplicação sem ligação — abre-se com
   ?demo=1 no endereço. */
function modoDemonstracao(){
  try { return new URLSearchParams(location.search).has("demo"); }
  catch(e){ return false; }
}
