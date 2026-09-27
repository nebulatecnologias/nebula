import { abrirPagina } from '../util.mjs';

export const nome = 'Convidado não entra sem escolher password';

/* A marca precisa_password vive na conta, não no endereço: um redireccionamento
   pelo caminho não a pode fazer desaparecer. Aqui o endereço está limpo de
   propósito, e mesmo assim a password tem de ser pedida. */
export default async function ({ navegador, base, verdade, falso, contem, igual }){
  const pg = await abrirPagina(navegador, `${base}/index.html`, { esperar: 600 });
  await pg.evaluate(async () => {
    window.__entrou = false;
    let porEscolher = true;
    API.sessao = async () => { API.precisaDePassword = porEscolher; return { id:'x', nome:'Convidada Teste', perfil:'aluno' }; };
    API.carregarTudo = async () => { window.__entrou = true; };
    API.definirPassword = async () => { porEscolher = false; API.precisaDePassword = false; };
    history.replaceState(null, '', location.pathname);
    await arrancar();
  });
  falso(await pg.evaluate(() => window.__entrou), 'Sem password escolhida a área não pode carregar — a pessoa ficava sem forma de voltar a entrar');
  verdade(await pg.isVisible('#pass-nova'), 'O ecrã de escolher password tem de aparecer');
  contem(await pg.textContent('.login-card'), 'Boas-vindas', 'É uma primeira entrada, e diz-se assim');

  await pg.fill('#pass-nova', '1234'); await pg.fill('#pass-repete', '1234');
  await pg.click('#btn-definir-pass'); await pg.waitForTimeout(150);
  contem(await pg.textContent('#login-aviso'), '8 caracteres', 'Uma password curta é recusada com o motivo');

  await pg.fill('#pass-nova', 'umapasswordboa'); await pg.fill('#pass-repete', 'outrapassword');
  await pg.click('#btn-definir-pass'); await pg.waitForTimeout(150);
  contem(await pg.textContent('#login-aviso'), 'não são iguais', 'Duas passwords diferentes são recusadas');

  await pg.fill('#pass-nova', 'umapasswordboa'); await pg.fill('#pass-repete', 'umapasswordboa');
  await pg.click('#btn-definir-pass'); await pg.waitForTimeout(400);
  verdade(await pg.evaluate(() => window.__entrou), 'Com a password escolhida, entra');
  igual(pg.errosDeJs.length, 0, `Sem erros: ${pg.errosDeJs.join(' | ')}`);
  await pg.close();
}
