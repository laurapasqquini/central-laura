// Campanhas push para os atletas, geradas a partir dos calendários das etapas.
// Uma campanha avulsa por etapa, rodada e momento (no backoffice: Programada, repetir a cada 1 dia, início = fim).
import { CALENDARIOS } from './calendarios';

// Nome da etapa no backoffice (sugestão; a Laura confere/edita na hora de agendar)
export const ETAPA_BACKOFFICE = {
  'mga-tenis-duplas': 'ETAPA LOEDE - TENIS DUPLAS',
  'mga-tenis-simples-masc': 'ETAPA LOEDE - TENIS MARINGA',
  'mga-tenis-simples-fem': 'ETAPA LOEDE - TENIS MARINGA',
  'mga-beach': 'BEACH MASCULINO / BEACH FEMININO - ETAPA 01 - BEACH TENIS MARINGA',
  'sfe-beach': 'ETAPA 01 - BEACH TENNIS SANTA FE',
  'lda-tenis-simples-masc': 'ETAPA GEUM - RANKEN LONDRINA',
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

  if (tipo === 'inicio') {
    if (ultima)
      return {
        titulo: `🏁 Última rodada da etapa!`,
        mensagem: `Seus jogos da rodada ${rd.n} já estão no app. É a última chance de somar pontos: chame seu adversário em até 48h.`,
      };
    if (entraReta)
      return {
        titulo: `🔥 Começou a reta final!`,
        mensagem: `Rodada ${rd.n} no app. Daqui até o fim da etapa cada vitória pesa na classificação: chame seu adversário em até 48h.`,
      };
    return {
      titulo: `🎾 Rodada ${rd.n} no ar!`,
      mensagem: `Seus jogos da rodada ${rd.n} já estão no app. Chame seu adversário em até 48h e combinem dia e horário.`,
    };
  }

  if (tipo === 'meio')
    return {
      titulo: `📅 Já marcou o jogo da rodada ${rd.n}?`,
      mensagem: `Se ainda não combinou, chame seu adversário hoje. Sem resposta em 24h? Manda o print pra gente que a gente ajuda.`,
    };

  // fim
  if (ultima)
    return {
      titulo: `⏰ Último dia da etapa!`,
      mensagem: `Lance hoje no app os resultados que faltam: depois do prazo, jogo sem resultado não conta na classificação final.`,
    };
  return {
    titulo: `⏰ Último dia da rodada ${rd.n}`,
    mensagem: `Jogou? Lance o resultado no app. Não vai poder jogar a próxima? Licencie-se até 19h59. Sorteio da rodada ${prox ? prox.n : rd.n + 1} às 20h.${
      rd.n === 9 ? ' Hoje também é o último dia para encaixes.' : ''
    }`,
  };
}

// Todas as campanhas a partir de uma data (inclusive)
export function gerarCampanhas(desde) {
  const out = [];
  for (const c of CALENDARIOS) {
    for (const rd of c.rodadas) {
      const momentos = [
        ['inicio', rd.inicio, '09:00'],
        ['meio', add(rd.inicio, 3), '18:00'],
        ['fim', rd.fim, '10:00'],
      ];
      for (const [tipo, data, hora] of momentos) {
        if (data < desde) continue;
        // rodada de 1 semana: "já marcou?" no 3º dia ainda faz sentido; se cair no último dia, pula
        if (tipo === 'meio' && data >= rd.fim) continue;
        out.push({
          id: `${c.id}:R${rd.n}:${tipo}`,
          calId: c.id,
          cidade: c.cidade,
          categoria: c.nome,
          etapa: ETAPA_BACKOFFICE[c.id] || c.nome,
          rodada: rd.n,
          tipo,
          data,
          hora,
          ...textos(c, rd, tipo),
        });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora) || a.cidade.localeCompare(b.cidade));
}
