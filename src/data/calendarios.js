// Calendários oficiais das etapas (tirados do backoffice do app).
// Rodada: [nº, sorteio, início, fim] em 'AAAA-MM-DD'. Sorteio às 20h, salvo indicação.
// retaFinal: a partir de qual rodada é "Reta final".

const r = (n, sorteio, inicio, fim, hora = '20:00') => ({ n, sorteio, inicio, fim, hora });

export const CALENDARIOS = [
  {
    id: 'mga-tenis-duplas',
    grupo: 'tenis-mga',
    rotulo: 'DUPLAS (MASC E FEM)',
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
    grupo: 'tenis-mga',
    rotulo: 'SIMPLES MASCULINO',
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
    grupo: 'tenis-mga',
    rotulo: 'SIMPLES FEMININO',
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
    id: 'lda-tenis-simples-masc',
    grupo: 'tenis-lda',
    rotulo: 'SIMPLES MASCULINO',
    cidade: 'Londrina',
    nome: 'Tênis Simples Masculino',
    curto: 'Simples Masc',
    esporte: 'tenis',
    etapa: 'atual',
    retaFinal: 8,
    rodadas: [
      r(4, '2026-09-13', '2026-09-14', '2026-09-20'),
      r(5, '2026-09-21', '2026-09-21', '2026-10-04', '11:48'),
      r(6, '2026-10-04', '2026-10-05', '2026-10-18'),
      r(7, '2026-10-18', '2026-10-19', '2026-11-01'),
      r(8, '2026-11-01', '2026-11-02', '2026-11-15'),
      r(9, '2026-11-15', '2026-11-16', '2026-11-29'),
      r(10, '2026-11-29', '2026-11-30', '2026-12-20'),
    ],
  },
  {
    id: 'mga-beach',
    grupo: 'beach-mga',
    rotulo: 'BEACH TENNIS',
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
    grupo: 'beach-sfe',
    rotulo: 'BEACH TENNIS',
    cidade: 'Santa Fé',
    nome: 'Beach Tennis (1ª etapa)',
    curto: 'Beach',
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
  // Regulamento: encaixes de jogos só até a 9ª rodada (etapas de 10 rodadas)
  const encaixe = CALENDARIOS.filter((c) => c.rodadas.some((x) => x.n === 9 && x.fim === date));
  if (encaixe.length)
    out.push({ key: `cal:e:${date}`, title: `Último dia de encaixes: ${encaixe.map((c) => `${c.cidade} ${c.curto}`).join(' · ')}`, area: 'ranken', date });
  for (const c of CALENDARIOS) {
    if (fimEtapa(c) === date) out.push({ key: `cal:f:${c.id}`, title: `Fim da etapa ${c.etapa}: ${c.cidade} · ${c.nome}`, area: 'ranken', date });
  }
  return out;
}

// Postagem dos melhores da rodada (Hub > Ranking > Histórico de rodadas):
// tênis e beach na segunda depois do domingo de sorteio (cada um no seu Instagram).
const POSTAGEM = [
  { esporte: 'tenis', depois: 1, insta: 'Instagram do tênis' },
  { esporte: 'beach', depois: 1, insta: 'Instagram do beach' },
];

// Grupos de WhatsApp: categorias do mesmo grupo saem numa mensagem só.
const GRUPOS = {
  'tenis-mga': { nome: 'Tênis Maringá', topo: '🎾 *RANKEN TÊNIS MARINGÁ*' },
  'tenis-lda': { nome: 'Tênis Londrina', topo: '🎾 *RANKEN TÊNIS LONDRINA*' },
  'beach-mga': { nome: 'Beach Maringá', topo: '🏖️ *RANKEN BEACH TENNIS MARINGÁ*' },
  'beach-sfe': { nome: 'Beach Santa Fé', topo: '🏖️ *RANKEN BEACH TENNIS SANTA FÉ*' },
};

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const diaSemana = (s) => DIAS_SEMANA[new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)).getDay()];
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Mensagem "rodada aberta" de um grupo (formato do WhatsApp: *negrito*).
export function mensagemRodada(grupo, lista) {
  const blocos = lista.map(({ c, rd }) => {
    const ultima = c.rodadas[c.rodadas.length - 1];
    const linhas = [`*RODADA ${rd.n} ABERTA - ${c.rotulo}*`];
    if (c.retaFinal && rd.n >= c.retaFinal) linhas.push('⚠️ *RETA FINAL*');
    linhas.push(`📅 *PRAZO:* ${ddmm(rd.inicio)} a ${ddmm(rd.fim)}${dias(rd.inicio, rd.fim) <= 7 ? ' *(rodada de 1 semana!)*' : ''}`);
    linhas.push(`⏰ *DATA LIMITE:* ${diaSemana(rd.fim)}, ${ddmm(rd.fim)}`);
    if (rd.n === 9 && ultima.n === 10) linhas.push('🔁 *Última rodada para encaixar jogos atrasados!*');
    return linhas.join('\n');
  });
  const so = (f) => lista.every(f);
  const adv = so(({ c }) => c.esporte === 'beach') ? 'sua dupla adversária' : so(({ c }) => c.id.endsWith('-fem')) ? 'sua adversária' : 'seu adversário';
  return [GRUPOS[grupo].topo, ...blocos, `*Os jogos já estão no app!* Combine com ${adv} e lance o resultado até a *data limite*.`].join('\n\n');
}

export function rotinasDoDia(date, addDays) {
  const out = [];
  // Aviso de rodada aberta: segunda depois do sorteio, uma tarefa por grupo
  const domingo = addDays(date, -1);
  const porGrupo = {};
  for (const c of CALENDARIOS) {
    const rd = c.rodadas.find((x) => x.sorteio === domingo);
    if (rd) (porGrupo[c.grupo] ||= []).push({ c, rd });
  }
  for (const [g, lista] of Object.entries(porGrupo)) {
    const quais = lista.map(({ c, rd }) => `${c.curto} R${rd.n}`).join(' + ');
    out.push({ id: `aviso-${g}`, title: `Avisar no grupo · ${GRUPOS[g].nome}: rodada aberta (${quais})`, mensagem: mensagemRodada(g, lista), who: 'laura' });
  }
  for (const p of POSTAGEM) {
    const domingo = addDays(date, -p.depois);
    const terminaram = CALENDARIOS.filter((c) => c.esporte === p.esporte)
      .map((c) => ({ c, rd: c.rodadas.find((x) => x.fim === domingo) }))
      .filter((x) => x.rd);
    // uma tarefa por categoria, para marcar cada post separado
    for (const { c, rd } of terminaram) {
      out.push({ id: `melhores-${c.id}`, title: `Melhores da rodada · ${c.curto} ${c.cidade} · R${rd.n} (${p.insta})`, hubPath: 'ranking' });
    }
  }
  return out;
}
