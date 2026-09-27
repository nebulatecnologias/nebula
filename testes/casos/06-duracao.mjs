import { entrarDemo, ALUNA } from '../util.mjs';

export const nome = 'Duração da aula: vem do leitor, e o que não é duração não se mostra';

export default async function ({ navegador, base, igual }){
  const pg = await entrarDemo(navegador, base, ALUNA);
  const d = await pg.evaluate(() => ({
    curta: formatarDuracao(754), longa: formatarDuracao(3925), zero: formatarDuracao(0),
    yt: duracaoNaMensagem(JSON.stringify({ event:'infoDelivery', info:{ duration:754 } })),
    vimeo: duracaoNaMensagem({ method:'getDuration', value:212 }),
    panda: duracaoNaMensagem({ message:'panda_allData', duration:95 }),
    lixo: duracaoNaMensagem('isto não é json'), absurdo: duracaoNaMensagem({ duration: 999999 }),
    vazia: duracaoLegivel({ duracao:'00:00' })
  }));
  igual(d.curta, '12:34', 'Minutos e segundos');
  igual(d.longa, '1:05:25', 'Uma aula longa leva as horas');
  igual(d.zero + d.vazia, '', 'Zero não é uma duração: fica em branco em vez de mentir');
  igual(d.yt, 754, 'O YouTube responde assim');
  igual(d.vimeo, 212, 'O Vimeo responde assim');
  igual(d.panda, 95, 'O Panda responde assim');
  igual(d.lixo + d.absurdo, 0, 'Uma mensagem que não é duração é ignorada');
  await pg.close();
}
