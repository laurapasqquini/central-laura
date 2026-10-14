// Campanhas push para os atletas, geradas a partir dos calendários das etapas.
// Uma campanha avulsa por etapa, rodada e momento (no backoffice: Programada, repetir a cada 1 dia, início = fim).
import { CALENDARIOS } from './calendarios';

// Etapa(s) no campo "Etapa" do backoffice, com o nome da lista. Duplas e beach de Maringá são duas
// etapas lá (masculina e feminina): cada campanha vira duas. "(confira)" = nome ainda não visto na lista.
export const ETAPA_BACKOFFICE = {
  'mga-tenis-duplas': ['ETAPA LOEDE · TENIS DUPLAS · TENIS DUPLA MASCULINA - 19/07 a 20/12', 'ETAPA LOEDE · TENIS DUPLAS · TENIS DUPLA FEMININA - 19/07 a 20/12'],
  'mga-tenis-simples-masc': ['ETAPA LOEDE · TENIS MARINGA · TENIS SIMPLES MASCULINO'],
  'mga-tenis-simples-fem': ['ETAPA LOEDE · TENIS MARINGA · TENIS SIMPLES FEMININO (confira)'],
  'mga-beach': ['BEACH FEMININO - ETAPA 01 · BEACH TENIS MARINGA · BEACH FEMININO - ETAPA 01', 'BEACH MASCULINO - ETAPA 01 · BEACH TENIS MARINGA · BEACH MASCULINO - ETAPA 01'],
  'sfe-beach': ['ETAPA 01 · BEACH TENNIS SANTA FE · FEMININO B/C'],
  'sfe-beach-masc': ['Beach Masculino Santa Fé (confira o nome da etapa na lista)'],
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
const rotulo = (rds) => (rds.length === 1 ? `R${rds[0].nome || rds[0].n}` : `R${rds[0].nome || rds[0].n} a R${rds.at(-1).n}`);

// Campanhas para criar no backoffice a partir de uma data. Cada tipo de aviso vira UMA campanha
// "Programada · Repetir a cada N dias · Início → Fim" enquanto as rodadas mantêm o mesmo intervalo;
// a última rodada (texto próprio) sai como campanha de um dia.
export function gerarCampanhas(desde) {
  const out = [];
  for (const c of CALENDARIOS) {
    const ultimaN = c.rodadas[c.rodadas.length - 1].n;
    for (const tipo of ['inicio', 'meio', 'fim']) {
      const itens = c.rodadas
        .map((rd) => ({ rd, data: tipo === 'inicio' ? rd.inicio : tipo === 'meio' ? add(rd.inicio, 3) : rd.fim }))
        .filter(({ rd, data }) => !(tipo === 'meio' && data >= rd.fim)) // rodada de 1 semana: o "já marcou?" cairia no último dia
        .map((x) => ({
          ...x,
          // só a última rodada tem texto próprio (fica no fim, não quebra a repetição das outras)
          especial: tipo !== 'meio' && x.rd.n === ultimaN,
        }));

      const grupos = [];
      for (const x of itens) {
        const g = grupos.at(-1);
        if (x.especial) grupos.push({ itens: [x], especial: true });
        else if (g && !g.especial && (g.itens.length === 1 || diasEntre(g.itens.at(-1).data, x.data) === g.passo) && diasEntre(g.itens.at(-1).data, x.data) > 0) {
          g.passo = diasEntre(g.itens.at(-1).data, x.data);
          g.itens.push(x);
        } else grupos.push({ itens: [x], especial: false });
      }

      for (const g of grupos) {
        // grupo montado com a etapa inteira (o id não muda com os dias); mostra só o que ainda vai ser enviado
        const futuros = g.itens.filter((x) => x.data >= desde);
        if (!futuros.length) continue;
        const rds = futuros.map((x) => x.rd);
        const texto = g.especial ? textos(c, rds[0], tipo) : GENERICO[tipo];
        const inicio = futuros[0].data;
        const fim = futuros.at(-1).data;
        const original = g.itens[0].data;
        (ETAPA_BACKOFFICE[c.id] || [c.nome]).forEach((etapa, k) => {
          out.push({
            id: `${c.id}:${k}:${tipo}:${original}`,
            calId: c.id,
            cidade: c.cidade,
            categoria: c.nome,
            etapa,
            rodadas: rotulo(rds),
            envios: futuros.length,
            tipo,
            data: inicio, // primeiro envio (para saber o que está para vencer)
            inicio,
            fim,
            repetir: futuros.length > 1 ? g.passo : 1,
            hora: HORA[tipo],
            ...texto,
          });
        });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.cidade.localeCompare(b.cidade) || a.categoria.localeCompare(b.categoria) || a.hora.localeCompare(b.hora));
}
