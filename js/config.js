/* ============================================================
   Ligação ao Supabase
   A chave publicável é pública por desenho — quem protege os dados
   é o RLS na base de dados, não o segredo desta linha.
   ============================================================ */
const SUPABASE_URL   = "https://epqfotzxrcyligwpauwk.supabase.co";
const SUPABASE_CHAVE = "sb_publishable_Ye3ZkJ8RoqMJuWgfdNclZQ_zdnal69h";
const ESQUEMA        = "academia";

/* Onde se paga. O atalho da oferta é o caminho: payflow.../founders.
   É o mesmo endereço que o Payflow partilha ao cliente — não há um segundo
   checkout para a Academia, porque dois caminhos para o mesmo pagamento
   acabam sempre a divergir num deles. */
const URL_PAYFLOW = "https://payflow.kingdomcompny.com";
const linkCheckout = atalho => atalho ? `${URL_PAYFLOW}/${encodeURIComponent(atalho)}` : "";

/* O modo normal é o Supabase. O modo de demonstração serve os testes
   automáticos e permite ver a aplicação sem ligação — abre-se com
   ?demo=1 no endereço. */
function modoDemonstracao(){
  try { return new URLSearchParams(location.search).has("demo"); }
  catch(e){ return false; }
}
