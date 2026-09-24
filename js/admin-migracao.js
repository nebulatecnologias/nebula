/* ============================================================
   Administração › Migração
   O que aconteceria se as pessoas que já pagaram entrassem hoje.

   ESTE ECRÃ NÃO TEM BOTÃO, e isso é de propósito. A migração acontece de uma
   vez, quando a plataforma estiver funcional e testada — não a conta-gotas
   por causa de um teste. Já aconteceu o contrário uma vez: uma aluna recebeu
   um convite para uma plataforma em obras, com um curso de uma aula, meses
   antes da migração planeada. O que falta para essa decisão se poder tomar
   não é um botão, é ver o que ela faria.

   Os motivos que aqui aparecem são os mesmos da ponte que já corre em
   produção. Não é uma segunda opinião sobre as mesmas regras — é a mesma
   pergunta, feita antes em vez de depois.
   ============================================================ */

let ensaioDaMigracao = null;

async function renderAdminMigracao(){
  const alvo = document.getElementById("content-admin");

  if(!ensaioDaMigracao && modoDemonstracao()){
    alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Migração" })}
      <div class="card"><div class="empty-note">Este ecrã lê a base de dados a sério — não há nada para mostrar em modo de demonstração.</div></div>`;
    return;
  }

  if(!ensaioDaMigracao){
    alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Migração" })}
      <div class="card"><div class="empty-note">A contar quem já pagou…</div></div>`;
    try { ensaioDaMigracao = await API.ensaioDaMigracao(); }
    catch(e){
      alvo.innerHTML = `${cabecalhoAdmin({ titulo:"Migração" })}
        <div class="card"><div class="empty-note">Não consegui ler: ${e.message}</div></div>`;
      return;
    }
  }

  const { resumo, porOferta } = ensaioDaMigracao;
  const entregam = porOferta.filter(o => !o.motivo);
  const retidas  = porOferta.filter(o => o.motivo);

  /* Um curso pago com duas aulas ou menos é a forma exacta do incidente que
     está escrito nas regras. Se existe, é a primeira coisa que se lê.

     Com um mínimo de dez pessoas, porque o aviso do topo é sobre o que trava
     a migração — e uma oferta de teste com quatro linhas não trava nada. As
     pequenas ficam na tabela, com a linha marcada na mesma. */
  const magras = entregam.filter(o => o.aulas <= 2 && o.pessoas >= 10);

  alvo.innerHTML = `
    ${cabecalhoAdmin({
      titulo: "Migração",
      descricao: "O que aconteceria se quem já pagou entrasse hoje. Este ecrã só lê — "
               + "a migração faz-se de uma vez, e ainda não há botão nenhum."
    })}

    <div class="stat-row tres">
      <div class="card stat-card"><div class="stat-icon accent">${ICONS.people}</div>
        <div class="stat-label">Pessoas que já pagaram</div>
        <div class="stat-value">${resumo.pessoas}<span>${resumo.inscricoes} inscrições</span></div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.book}</div>
        <div class="stat-label">Receberiam acesso</div>
        <div class="stat-value">${resumo.receberiam}</div></div>
      <div class="card stat-card"><div class="stat-icon">${ICONS.gear}</div>
        <div class="stat-label">Ficariam de fora</div>
        <div class="stat-value">${resumo.ficariamFora}</div></div>
    </div>

    ${magras.length ? `
      <div class="card" style="margin-bottom:24px;background:var(--red-soft);border-color:transparent;box-shadow:none;">
        <div style="padding:18px 20px">
          <h3 style="margin:0 0 8px">Isto é o que trava a migração hoje</h3>
          ${magras.map(o => `<p style="margin:0 0 6px">
            <b>${o.pessoas} ${o.pessoas === 1 ? "pessoa pagou" : "pessoas pagaram"} ${formatarPreco(Number(o.preco)||0, o.moeda)}</b>
            pelo ${o.nome}, e o que ela entrega tem
            <b>${o.aulas} ${o.aulas === 1 ? "aula" : "aulas"}</b>.
          </p>`).join("")}
          <p style="margin:10px 0 0;color:var(--muted)">
            Abrir o acesso agora é mandar essa gente para uma porta que se abre
            para uma sala vazia. O que falta não é código — é conteúdo.
          </p>
        </div>
      </div>` : ""}

    ${resumo.semEmail ? `
      <div class="card" style="margin-bottom:24px">
        <div style="padding:18px 20px">
          <h3 style="margin:0 0 6px">${resumo.semEmail} sem endereço de email</h3>
          <p style="margin:0;color:var(--muted)">Sem email não há conta nem convite. Estas
             pessoas têm de ser contactadas por outro caminho antes da migração.</p>
        </div>
      </div>` : ""}

    <div class="card table-card">
      <div class="table-card-head">
        <h3>O que cada oferta daria</h3>
        <span class="count">${porOferta.length} ofertas com pagamentos confirmados · ${resumo.comConta} ${resumo.comConta === 1 ? "pessoa já tem" : "pessoas já têm"} conta</span>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Oferta</th><th>Pessoas</th><th>O que entregaria</th><th>Estado</th></tr></thead>
          <tbody>
            ${porOferta.length ? porOferta.map(linhaDaMigracao).join("")
              : `<tr><td colspan="4"><div class="empty-note">Ainda não há pagamentos confirmados.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div style="padding:18px 20px">
        <h3 style="margin:0 0 8px">Porque é que não há botão</h3>
        <p style="margin:0;color:var(--muted)">
          A migração faz-se de uma vez, quando a plataforma estiver funcional e testada.
          Abrir acessos a conta-gotas — para experimentar, para provar que funciona — manda
          gente a sério para uma plataforma em obras, e essa gente já tem acesso na plataforma
          anterior. Quando as ${retidas.length ? "ofertas aqui em baixo estiverem resolvidas e os cursos tiverem conteúdo" : "contas estiverem certas"},
          o botão faz-se numa tarde.
        </p>
      </div>
    </div>
  `;
}

function linhaDaMigracao(o){
  const cursos = o.cursos || [];
  const entrega = o.motivo
    ? `<span class="sub-celula">${o.motivo}</span>`
    : cursos.map(c => `<div>${c.titulo} <span class="sub-celula">· ${c.aulas} ${c.aulas === 1 ? "aula" : "aulas"}</span></div>`).join("");

  return `<tr class="${o.motivo ? "" : (o.aulas <= 2 ? "tint-risco" : "")}">
    <td>
      <div class="nome" style="font-weight:500;">${o.nome}</div>
      <div class="sub-celula">${formatarPreco(Number(o.preco)||0, o.moeda)}${o.cobranca === "Recorrente mensal" ? " por mês" : ""}</div>
    </td>
    <td class="num">${o.pessoas}${o.semEmail ? `<div class="sub-celula">${o.semEmail} sem email</div>` : ""}</td>
    <td>${entrega}</td>
    <td>
      <span class="pill ${o.motivo ? "pill-inativo" : "pill-ativo"}">${o.motivo ? "Não entregaria" : "Entregaria"}</span>
      <div class="sub-celula" style="margin-top:4px">oferta ${o.estado.toLowerCase()}</div>
    </td>
  </tr>`;
}

registarViews({ "admin-migracao": renderAdminMigracao });
