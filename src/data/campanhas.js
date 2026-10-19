// Campanhas push para os atletas, geradas a partir dos calendários das etapas.
// Uma campanha avulsa por etapa, rodada e momento (no backoffice: Programada, repetir a cada 1 dia, início = fim).
import { CALENDARIOS } from './calendarios';

// Etapa(s) no campo "Etapa" do backoffice, com o nome da lista. Duplas e beach de Maringá são duas
// etapas lá (masculina e feminina): cada campanha vira duas. Nomes conferidos na lista do backoffice em 19/10.
export const ETAPA_BACKOFFICE = {
  'mga-tenis-duplas': ['ETAPA LOEDE · TENIS DUPLAS · TENIS DUPLA MASCULINA - 19/07 a 20/12', 'ETAPA LOEDE · TENIS DUPLAS · TENIS DUPLA FEMININA - 19/07 a 20/12'],
  'mga-tenis-simples-masc': ['ETAPA LOEDE · TENIS MARINGA · TENIS SIMPLES MASCULINO'],
  'mga-tenis-simples-fem': ['ETAPA LOEDE · TENIS MARINGA · TENIS SIMPLES FEMININO'],
  'mga-beach': ['BEACH FEMININO - ETAPA 01 · BEACH TENIS MARINGA · BEACH FEMININO - ETAPA 01', 'BEACH MASCULINO - ETAPA 01 · BEACH TENIS MARINGA · BEACH MASCULINO - ETAPA 01'],
  'sfe-beach': ['ETAPA 01 · BEACH TENNIS SANTA FE · FEMININO B/C'],
  'sfe-beach-masc': ['ETAPA 01 · BEACH TENNIS SANTA FE · MASCULINO B/C'],
  'cnt-tenis-simples-masc': ['ETAPA 01 · TENIS CIANORTE · MASCULINO CIANORTE'],
  'lda-tenis-simples-masc': ['ETAPA GEUM · ETAPA GEUM - RANKEN LONDRINA · TENIS SIMPLES MASCULINO'],
};

const add = (s, n) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const TIPOS = {
  inicio: { nome: 'Rodada nova', icone: '🎾' },
  meio: { nome: 'Já marcou?', icone: '📅' },
  fim: { nome: 'Último dia', icone: '⏰' },
};

function textos(c, rd, tipo) {
  const ultima = rd.n === c.rodadas[c.rodadas.length - 1].n;
  const entraReta = c.retaFinal && rd.n === c.retaFinal;
  const prox = c.rodadas.find((x) => x.n === rd.n + 1);
  const rod = rd.nome ? `rodadas ${rd.nome}` : `rodada ${rd.n}`; // rodadas sorteadas juntas (ex.: 1 e 2)
  const Rod = rod[0].toUpperCase() + rod.slice(1);

  if (tipo === 'inicio') {
    if (ultima)
      return {
        titulo: `🏁 Última rodada da etapa!`,
        mensagem: `Seus jogos da ${rod} já estão no app. É a última chance de somar pontos: chame seu adversário em até 48h.`,
      };
    if (entraReta)
      return {
        titulo: `🔥 Começou a reta final!`,
        mensagem: `${Rod} no app. Daqui até o fim da etapa cada vitória pesa na classificação: chame seu adversário em até 48h.`,
      };
    return {
      titulo: `🎾 ${Rod} no ar!`,
      mensagem: `Seus jogos da ${rod} já estão no app. Chame seu adversário em até 48h e combinem dia e horário.`,
    };
  }

  if (tipo === 'meio')
    return {
      titulo: `📅 Já marcou os jogos da ${rod}?`,
      mensagem: `Se ainda não combinou, chame seu adversário hoje. Sem resposta em 24h? Manda o print pra gente que a gente ajuda.`,
    };

  // fim
  if (ultima)
    return {
      titulo: `⏰ Último dia da etapa!`,
      mensagem: `Lance hoje no app os resultados que faltam: depois do prazo, jogo sem resultado não conta na classificação final.`,
    };
  return {
    titulo: `⏰ Último dia da ${rod}`,
    mensagem: `Jogou? Lance o resultado no app. Não vai poder jogar a próxima? Licencie-se até 19h59. Sorteio da rodada ${prox ? prox.n : rd.n + 1} às 20h.${
      rd.n === 9 ? ' Hoje também é o último dia para encaixes.' : ''
    }`,
  };
}

// Textos das campanhas que se repetem (servem para qualquer rodada, sem o número)
const GENERICO = {
  inicio: { titulo: '🎾 Rodada nova no ar!', mensagem: 'Seus jogos da nova rodada já estão no app. Chame seu adversário em até 48h e combinem dia e horário.' },
  meio: { titulo: '📅 Já marcou o jogo da rodada?', mensagem: 'Se ainda não combinou, chame seu adversário hoje. Sem resposta em 24h? Manda o print pra gente que a gente ajuda.' },
  fim: { titulo: '⏰ Último dia da rodada', mensagem: 'Jogou? Lance o resultado no app. Não vai poder jogar a próxima? Licencie-se até 19h59. Sorteio da próxima rodada às 20h.' },
};
const HORA = { inicio: '09:00', meio: '18:00', fim: '10:00' };
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 864e5);

// Divide as datas em sequências que se repetem no mesmo intervalo, com o MENOR número de campanhas.
// Testa todas as combinações (são poucas datas por etapa): ex.: inícios 19/10, 26/10, 09/11, 16/11,
// 23/11, 30/11 viram 2 campanhas semanais (19→26/10 e 09→30/11), e não 3 de 21 em 21 dias.
// Empate: prefere intervalos de 7 dias (mais fáceis de conferir) e depois os menores.
function sequencias(itens) {
  const custo = (gs) => gs.length * 1000 + gs.filter((g) => g.itens.length > 1 && g.passo % 7).length * 10 + gs.reduce((s, g) => s + (g.itens.length > 1 ? g.passo : 0), 0) / 100;
  let melhor = null;
  const busca = (livres, grupos) => {
    if (melhor && grupos.length * 1000 >= custo(melhor)) return; // já não ganha
    if (!livres.length) {
      if (!melhor || custo(grupos) < custo(melhor)) melhor = grupos;
      return;
    }
    const [primeiro, ...resto] = livres;
    const opcoes = [{ itens: [primeiro], passo: 1 }];
    for (const x of resto) {
      const passo = diasEntre(primeiro.data, x.data);
      if (passo <= 0 || passo % 7 || passo > 21) continue; // só de 7, 14 ou 21 dias: fácil de conferir
      const seq = [primeiro];
      for (let d = add(primeiro.data, passo); ; d = add(d, passo)) {
        const prox = resto.find((y) => y.data === d);
        if (!prox) break;
        seq.push(prox);
        opcoes.push({ itens: [...seq], passo }); // cada trecho da sequência é uma opção
      }
    }
    opcoes.sort((a, b) => b.itens.length - a.itens.length); // as mais longas primeiro: acha cedo uma boa solução
    for (const g of opcoes) busca(livres.filter((y) => !g.itens.includes(y)), [...grupos, g]);
  };
  busca(itens, []);
  return melhor || [];
}

// Campanhas para criar no backoffice a partir de uma data. Cada aviso vira o menor número possível de
// campanhas "Programada · Repetir a cada N dias · Início → Fim"; a última rodada (texto próprio) sai à parte.
// O "criada" é guardado por rodada (instancias), então nada se perde se o agrupamento mudar com os dias.
export function gerarCampanhas(desde) {
  const out = [];
  for (const c of CALENDARIOS) {
    const ultimaN = c.rodadas[c.rodadas.length - 1].n;
    for (const tipo of ['inicio', 'meio', 'fim']) { // rodada nova, já marcou? (meio da rodada) e último dia
      const itens = c.rodadas
        .map((rd) => ({ rd, data: tipo === 'inicio' ? rd.inicio : tipo === 'meio' ? add(rd.inicio, Math.ceil(diasEntre(rd.inicio, rd.fim) / 2)) /* metade da rodada */ : rd.fim }))
        .filter(({ rd, data }) => data >= desde && !(tipo === 'meio' && data >= rd.fim)); // rodada de 1 semana: o "já marcou?" cairia no último dia
      // só a última rodada tem texto próprio
      const especiais = itens.filter((x) => tipo !== 'meio' && x.rd.n === ultimaN).map((x) => ({ itens: [x], passo: 1, especial: true }));
      const grupos = [...sequencias(itens.filter((x) => !(tipo !== 'meio' && x.rd.n === ultimaN))), ...especiais];

      for (const g of grupos) {
        const rds = g.itens.map((x) => x.rd);
        const texto = g.especial ? textos(c, rds[0], tipo) : GENERICO[tipo];
        const inicio = g.itens[0].data;
        const fim = g.itens.at(-1).data;
        (ETAPA_BACKOFFICE[c.id] || [c.nome]).forEach((etapa, k) => {
          out.push({
            id: `${c.id}:${k}:${tipo}:${inicio}:${g.passo}`,
            instancias: rds.map((rd) => `${c.id}:${k}:${tipo}:R${rd.n}`),
            calId: c.id,
            cidade: c.cidade,
            categoria: c.nome,
            etapa,
            rodadas: rds.length === 1 ? `R${rds[0].nome || rds[0].n}` : rds.map((rd) => `R${rd.nome || rd.n}`).join(', '),
            envios: g.itens.length,
            tipo,
            data: inicio, // primeiro envio (para saber o que está para vencer)
            inicio,
            fim,
            repetir: g.itens.length > 1 ? g.passo : 1,
            hora: HORA[tipo],
            ...texto,
          });
        });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.cidade.localeCompare(b.cidade) || a.categoria.localeCompare(b.categoria) || a.hora.localeCompare(b.hora));
}

// Situação de uma campanha a partir do que foi marcado em cada rodada dela
export function statusCampanha(ov, c) {
  const st = c.instancias.map((i) => ov[i]?.status || 'pendente');
  if (st.some((s) => s === 'pendente')) return 'pendente';
  return st.every((s) => s === 'pulada') ? 'pulada' : 'agendada';
}
// textos, horário e ID ajustados: guardados na primeira rodada da campanha
export const ajustesCampanha = (ov, c) => ov[c.instancias[0]] || {};
