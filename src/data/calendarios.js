// Calendários oficiais das etapas (tirados do backoffice do app).
// Rodada: [nº, sorteio, início, fim] em 'AAAA-MM-DD'. Sorteio às 20h, salvo indicação.
// retaFinal: a partir de qual rodada é "Reta final".

const r = (n, sorteio, inicio, fim, hora = '20:00') => ({ n, sorteio, inicio, fim, hora });

export const CALENDARIOS = [
  {
    id: 'mga-tenis-duplas',
    cidade: 'Maringá',
    nome: 'Tênis Duplas (masc e fem)',
    curto: 'Duplas tênis',
    esporte: 'tenis',
    etapa: 'LOEDE',
    retaFinal: 8,
    rodadas: [
      r(5, '2026-09-20', '2026-09-21', '2026-10-04'),
      r(6, '2026-10-04', '2026-10-05', '2026-10-18'),
      r(7, '2026-10-18', '2026-10-19', '2026-11-01'),
      r(8, '2026-11-01', '2026-11-02', '2026-11-15'),
      r(9, '2026-11-15', '2026-11-16', '2026-11-29'),
      r(10, '2026-11-29', '2026-11-30', '2026-12-20'),
    ],
  },
  {
    id: 'mga-tenis-simples-masc',
    cidade: 'Maringá',
    nome: 'Tênis Simples Masculino',
    curto: 'Simples Masc',
    esporte: 'tenis',
    etapa: 'LOEDE',
    retaFinal: 8,
    rodadas: [
      r(1, '2026-08-23', '2026-08-24', '2026-08-30'),
      r(2, '2026-08-30', '2026-08-31', '2026-09-13'),
      r(3, '2026-09-13', '2026-09-14', '2026-09-20'),
      r(4, '2026-09-20', '2026-09-21', '2026-10-04'),
      r(5, '2026-10-04', '2026-10-05', '2026-10-18'),
      r(6, '2026-10-18', '2026-10-19', '2026-10-25'),
      r(7, '2026-10-25', '2026-10-26', '2026-11-08'),
      r(8, '2026-11-08', '2026-11-09', '2026-11-15'),
      r(9, '2026-11-15', '2026-11-16', '2026-11-29'),
      r(10, '2026-11-29', '2026-11-30', '2026-12-20'),
    ],
  },
  {
    id: 'mga-tenis-simples-fem',
    cidade: 'Maringá',
    nome: 'Tênis Simples Feminino (classes 1 a 5)',
    curto: 'Simples Fem',
    esporte: 'tenis',
    etapa: 'LOEDE',
    retaFinal: null,
    rodadas: [
      r(1, '2026-09-27', '2026-09-28', '2026-10-11'),
      r(2, '2026-10-11', '2026-10-12', '2026-10-25'),
      r(3, '2026-10-25', '2026-10-26', '2026-11-08'),
      r(4, '2026-11-08', '2026-11-09', '2026-11-22'),
      r(5, '2026-11-22', '2026-11-23', '2026-12-06'),
      r(6, '2026-12-06', '2026-12-07', '2026-12-20'),
    ],
  },
  {
    id: 'mga-beach',
    cidade: 'Maringá',
    nome: 'Beach Tennis',
    curto: 'Beach',
    esporte: 'beach',
    etapa: 'LOEDE',
    retaFinal: 8,
    rodadas: [
      r(5, '2026-09-20', '2026-09-21', '2026-10-04'),
      r(6, '2026-10-04', '2026-10-05', '2026-10-18'),
      r(7, '2026-10-18', '2026-10-19', '2026-11-01'),
      r(8, '2026-11-01', '2026-11-02', '2026-11-15'),
      r(9, '2026-11-15', '2026-11-16', '2026-11-29'),
      r(10, '2026-11-29', '2026-11-30', '2026-12-13'),
    ],
  },
  {
    id: 'sfe-beach',
    cidade: 'Santa Fé',
    nome: 'Beach Tennis (1ª etapa)',
    curto: 'Beach Santa Fé',
    esporte: 'beach',
    etapa: '1ª etapa',
    retaFinal: 4,
    rodadas: [
      r(1, '2026-09-20', '2026-09-21', '2026-10-04', '21:00'),
      r(2, '2026-10-04', '2026-10-05', '2026-10-18'),
      r(3, '2026-10-18', '2026-10-19', '2026-11-01'),
      r(4, '2026-11-01', '2026-11-02', '2026-11-15'),
      r(5, '2026-11-15', '2026-11-16', '2026-11-29'),
      r(6, '2026-11-29', '2026-11-30', '2026-12-13'),
    ],
  },
];

const ultima = (c) => c.rodadas[c.rodadas.length - 1];
export const fimEtapa = (c) => ultima(c).fim;

// Rodada em andamento numa data (o dia do fim ainda conta: é o domingo do próximo sorteio).
export function rodadaAtual(c, date) {
  return c.rodadas.find((x) => date >= x.inicio && date <= x.fim) || null;
}

export const proximoSorteio = (c, date) => c.rodadas.find((x) => x.sorteio >= date) || null;

// Lembretes (📌) de um dia: sorteios agrupados por cidade e fins de etapa.
export function marcosDoDia(date) {
  const out = [];
  const porCidade = {};
  for (const c of CALENDARIOS) {
    const rd = c.rodadas.find((x) => x.sorteio === date);
    if (rd) (porCidade[c.cidade] ||= []).push({ c, rd });
  }
  for (const [cidade, list] of Object.entries(porCidade)) {
    const hora = [...new Set(list.map((x) => x.rd.hora))].join('/');
    const quem = list.map(({ c, rd }) => `${c.curto} R${rd.n}${c.retaFinal && rd.n >= c.retaFinal ? ' (reta final)' : ''}`).join(' · ');
    out.push({ key: `cal:s:${cidade}:${date}`, title: `Sorteio ${cidade} ${hora}: ${quem}`, area: 'ranken', date });
  }
  for (const c of CALENDARIOS) {
    if (fimEtapa(c) === date) out.push({ key: `cal:f:${c.id}`, title: `Fim da etapa ${c.etapa}: ${c.cidade} · ${c.nome}`, area: 'ranken', date });
  }
  return out;
}

// Postagem dos melhores da rodada (Hub > Ranking > Histórico de rodadas):
// tênis na segunda e beach na terça depois do domingo em que a rodada terminou.
const POSTAGEM = [
  { esporte: 'tenis', depois: 1, insta: 'Instagram do tênis' },
  { esporte: 'beach', depois: 2, insta: 'Instagram do beach' },
];

export function rotinasDoDia(date, addDays) {
  const out = [];
  for (const p of POSTAGEM) {
    const domingo = addDays(date, -p.depois);
    const terminaram = CALENDARIOS.filter((c) => c.esporte === p.esporte)
      .map((c) => ({ c, rd: c.rodadas.find((x) => x.fim === domingo) }))
      .filter((x) => x.rd);
    if (!terminaram.length) continue;
    const quais = terminaram.map(({ c, rd }) => `${c.curto} R${rd.n}`).join(' · ');
    out.push({ id: `melhores-${p.esporte}`, title: `Postar os melhores da rodada no ${p.insta}: ${quais}`, hubPath: 'ranking' });
  }
  return out;
}
