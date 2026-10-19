/* A biblioteca do Panda Video de cada escola (pedido do Shelton a 19/10/2026).

   A Academia chama isto com { accao, escola, … }:
   - estado    se a escola tem o Panda ligado, e o que quem chama pode fazer;
   - ligar     { chave } experimenta a chave no Panda e, se ele a aceitar,
               guarda-a cifrada (public.escola_panda_guardar);
   - desligar  larga a chave;
   - pastas    as pastas da conta Panda (todas: a app monta a árvore);
   - videos    { pasta | raiz, titulo, pagina } uma página de vídeos.

   A escola do pedido é a da base: o `escola` (slug ou domínio, o mesmo que a
   app manda à base em x-organizacao) segue para academia.panda_quem_sou() com
   a sessão de quem chama, e a base decide — como decide quem pode editar as
   aulas. Ver a biblioteca é para a equipa da escola; ligar e desligar, para a
   administração dela.

   A chave da API do Panda dá controlo total da conta, por isso nunca sai
   daqui: o browser recebe só a lista, com os campos que precisa.

   API do Panda (docs.pandavideo.com, lida a 19/10/2026): base
   https://api-v2.pandavideo.com.br, chave no cabeçalho Authorization sem
   «Bearer». GET /videos (page, limit, title, folder_id ou root_folder=1)
   devolve { videos: [...] } sem totais; GET /folders devolve uma lista ou
   { folders: [...] } — aceitam-se as duas. */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
function json(corpo: unknown, estado = 200) {
  return new Response(JSON.stringify(corpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const PANDA = 'https://api-v2.pandavideo.com.br';
const POR_PAGINA = 48;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Resposta = { ok: boolean; estado: number; j: unknown };
async function panda(chave: string, caminho: string, params: Record<string, string | number | undefined> = {}): Promise<Resposta> {
  const u = new URL(PANDA + caminho);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  try {
    const r = await fetch(u, { headers: { Authorization: chave, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    let j: unknown = null;
    try { j = await r.json(); } catch { /* sem corpo */ }
    return { ok: r.ok, estado: r.status, j };
  } catch (e) {
    console.error('panda nao respondeu:', caminho, (e as Error).message);
    return { ok: false, estado: 0, j: null };
  }
}

function erroDoPanda(r: Resposta) {
  if (r.estado === 401 || r.estado === 403) {
    return json({ error: 'O Panda não aceitou a chave. Copie-a outra vez em Configurações › Avançado › Chave da API, no Panda.' }, 400);
  }
  if (r.estado === 429) return json({ error: 'O Panda pediu para abrandar. Tente daqui a um minuto.' }, 429);
  return json({ error: 'O Panda não respondeu agora. Tente daqui a pouco.' }, 502);
}

/* Só endereços https do próprio Panda (ou do CDN dele) seguem para a página. */
function https(u: unknown) {
  try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : null; } catch { return null; }
}

function video(v: Record<string, unknown>) {
  return {
    id: String(v.id ?? ''),
    titulo: String(v.title ?? '').trim() || 'Sem título',
    estado: String(v.status ?? ''),
    duracao: Math.max(0, Math.round(Number(v.length) || 0)),
    miniatura: https(v.thumbnail),
    player: https(v.video_player),
    pasta: v.folder_id ? String(v.folder_id) : null,
    criado: v.created_at ? String(v.created_at) : null,
  };
}

function pasta(p: Record<string, unknown>) {
  return {
    id: String(p.id ?? ''),
    nome: String(p.name ?? '').trim() || 'Sem nome',
    pai: p.parent_folder_id ? String(p.parent_folder_id) : null,
    videos: Number(p.videos_count) || 0,
  };
}

interface QuemSou { organizacao: string; podeVer: boolean; podeLigar: boolean; ligada: boolean; chaveFim: string | null; ligadaEm: string | null }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
  const accao = String(corpo.accao || '');
  const escola = String(corpo.escola || '').trim().toLowerCase();
  if (!['estado', 'ligar', 'desligar', 'pastas', 'videos'].includes(accao) || (escola && !/^[a-z0-9.-]{2,253}$/.test(escola))) {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const cabecalhos: Record<string, string> = { Authorization: req.headers.get('Authorization') || '' };
  if (escola) cabecalhos['x-organizacao'] = escola;
  const deQuemChama = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: cabecalhos } });
  const { data: sessao } = await deQuemChama.auth.getUser();
  if (!sessao?.user) return json({ error: 'Sessão inválida.' }, 401);

  const { data: lido, error: erroQuem } = await deQuemChama.schema('academia').rpc('panda_quem_sou');
  if (erroQuem || !lido) return json({ error: 'Não foi possível confirmar a sua escola.' }, 403);
  const quem = lido as QuemSou;
  if (!quem.podeVer) return json({ error: 'Só a equipa da escola vê a biblioteca de vídeos.' }, 403);

  const estado = () => ({ ligada: !!quem.ligada, chaveFim: quem.chaveFim ?? null, ligadaEm: quem.ligadaEm ?? null, podeLigar: !!quem.podeLigar });
  if (accao === 'estado') return json(estado());

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    if (accao === 'ligar' || accao === 'desligar') {
      if (!quem.podeLigar) return json({ error: 'Só a administração da escola liga ou desliga o Panda.' }, 403);
      const chave = accao === 'ligar' ? String(corpo.chave || '').trim() : '';
      if (accao === 'ligar') {
        if (!chave) return json({ error: 'Cole a chave da API do Panda.' }, 400);
        /* Antes de guardar, o Panda tem de a aceitar. */
        const prova = await panda(chave, '/videos', { page: 1, limit: 1 });
        if (!prova.ok) return erroDoPanda(prova);
      }
      const { data, error } = await admin.rpc('escola_panda_guardar', { p_org: quem.organizacao, p_chave: chave, p_por: sessao.user.id });
      if (error) return json({ error: error.message }, 400);
      console.log('panda', accao, JSON.stringify({ organizacao: quem.organizacao }));
      const r = data as { ligada: boolean; chaveFim?: string };
      return json({ ligada: r.ligada, chaveFim: r.chaveFim ?? null, ligadaEm: r.ligada ? new Date().toISOString() : null, podeLigar: true });
    }

    if (!quem.ligada) return json({ error: 'O Panda ainda não está ligado nesta escola. Ligue-o em Integrações.', porLigar: true }, 409);
    const { data: chave, error: erroChave } = await admin.rpc('escola_panda_chave', { p_org: quem.organizacao });
    if (erroChave || !chave) return json({ error: 'O Panda ainda não está ligado nesta escola. Ligue-o em Integrações.', porLigar: true }, 409);

    if (accao === 'pastas') {
      const r = await panda(String(chave), '/folders');
      if (!r.ok) return erroDoPanda(r);
      const lista = Array.isArray(r.j) ? r.j : ((r.j as { folders?: unknown[] } | null)?.folders ?? []);
      return json({ pastas: (lista as Record<string, unknown>[]).map(pasta).filter(p => p.id) });
    }

    const pagina = Math.min(Math.max(1, Math.floor(Number(corpo.pagina) || 1)), 1000);
    const titulo = String(corpo.titulo || '').trim().slice(0, 120);
    const daPasta = String(corpo.pasta || '');
    const params: Record<string, string | number | undefined> = { page: pagina, limit: POR_PAGINA, title: titulo || undefined };
    if (UUID.test(daPasta)) params.folder_id = daPasta;
    else if (corpo.raiz === true && !titulo) params.root_folder = 1;
    const r = await panda(String(chave), '/videos', params);
    if (!r.ok) return erroDoPanda(r);
    const lista = ((r.j as { videos?: unknown[] } | null)?.videos ?? []) as Record<string, unknown>[];
    /* O Panda não diz quantas páginas há: uma página cheia quer dizer que pode haver mais. */
    return json({ videos: lista.map(video).filter(v => v.id), pagina, porPagina: POR_PAGINA, mais: lista.length >= POR_PAGINA });
  } catch (e) {
    console.error('panda-video:', (e as Error).message);
    return json({ error: 'Não foi possível falar com o Panda agora. Tente daqui a pouco.' }, 500);
  }
});
