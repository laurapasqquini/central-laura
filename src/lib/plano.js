// Estado do Plano 2027 (state.plano27): frentes com iniciativas e passos, quem toca cada praça e o foco do mês.
// Começa das frentes sugeridas em data/plano2027.js; depois tudo é editado na aba Plano.
import { FRENTES_INICIAIS } from '../data/plano2027.js';

let seq = 0;
const novoId = (pre) => `${pre}${(++seq).toString(36)}`;

export function planoInicial() {
  seq = 0;
  return {
    versao: 1,
    frentes: FRENTES_INICIAIS.map((f) => ({
      ...f,
      iniciativas: f.iniciativas.map((i) => ({ id: novoId('i'), status: 'andamento', ...i, passos: i.passos.map((p) => ({ id: novoId('p'), feito: false, ...p })) })),
    })),
    pracas: {},
    foco: {},
  };
}

// todos os passos, com o nome da frente e da iniciativa (feito = marcado aqui ou tarefa já feita na lista)
export function passosDoPlano(state) {
  const pl = state.plano27 || planoInicial();
  const feitas = new Set(state.tasks.filter((t) => t.done).map((t) => t.id));
  return pl.frentes.flatMap((f) => f.iniciativas.flatMap((i) => i.passos.map((p) => ({ ...p, feito: p.feito || feitas.has(p.taskId), frente: f.nome, iniciativa: i.titulo }))));
}

// ── Números da previsão colados do Excel ──
const sem = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ESPORTES = ['Tênis', 'Beach Tennis', 'Padel'];
const MES_NUM = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
export const numero = (t) => {
  let x = String(t ?? '').replace(/[R$\s]/g, '');
  if (!x || x === '-' || x === '—' || x === '–') return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) x = x.replace(/,/g, ''); // 1,234 / 12,345.67 (Excel em inglês)
  else if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); // 12.345,67
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, ''); // 1.234 (ponto de milhar)
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : null;
};

// Lê o que foi copiado da planilha (Ctrl+C no Excel = colunas separadas por tab):
// - uma linha de cabeçalho com os meses (Out/26, Nov/26…) diz qual coluna é qual mês;
// - "… TOTAL" = pagantes do mês; "Receita mensal" = receita do mês;
// - "Cidade | Tênis/Beach Tennis/Padel | números…" = meta de pagantes daquela praça em cada mês.
export function lerColagem(texto, mesInicial = '2026-10') {
  const linhas = texto.split(/\r?\n/).map((l) => l.split('\t').map((c) => c.trim()));
  let cols = null; // [{ i, mes }]
  const meses = {};
  const pracas = [];
  const semCab = (cel) => {
    // sem cabeçalho: os números contam a partir do mês inicial
    const idx = cel.map((c, i) => (numero(c) != null ? i : -1)).filter((i) => i >= 0);
    return idx.map((i, k) => {
      const d = new Date(Number(mesInicial.slice(0, 4)), Number(mesInicial.slice(5, 7)) - 1 + k, 1);
      return { i, mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    });
  };
  let tabelaReceita = false; // dentro de "Receita mensal por cidade": as linhas de praça são R$, não atletas
  for (const cel of linhas) {
    const titulo = cel.filter(Boolean).join(' ');
    if (/receita.*por cidade/i.test(titulo)) tabelaReceita = true;
    else if (/atletas.*por cidade|^resumo$/i.test(titulo)) tabelaReceita = false;
    if (tabelaReceita && !/receita mensal\*?$/i.test(cel[0] || '')) continue;
    const cab = cel.map((c, i) => {
      const m = c.toLowerCase().match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/);
      return m ? { i, mes: `20${m[2]}-${String(MES_NUM[m[1]]).padStart(2, '0')}` } : null;
    }).filter(Boolean);
    if (cab.length >= 2) {
      cols = cab;
      continue;
    }
    const rotulo = cel[0] || '';
    const esporte = ESPORTES.find((e) => sem(e) === sem(cel[1] || ''));
    const usar = cols || semCab(cel);
    if (!usar.length) continue;
    const valores = Object.fromEntries(usar.map(({ i, mes }) => [mes, numero(cel[i])]).filter(([, v]) => v != null));
    if (!Object.keys(valores).length) continue;
    if (esporte && rotulo && !/subtotal|total/i.test(rotulo)) {
      // opera = já tem atleta no primeiro mês da tabela (vazio ou "–" conta como zero)
      const primeiro = usar.map((u) => u.mes).sort()[0];
      pracas.push({ id: `${rotulo}|${esporte}`, cidade: rotulo, esporte, operando: (valores[primeiro] || 0) > 0, metas: valores });
    } else if (/^(atletas pagantes\s*[—–-]\s*)?total$/i.test(rotulo)) {
      for (const [m, v] of Object.entries(valores)) meses[m] = { ...(meses[m] || {}), pagantes: v };
    } else if (/^receita mensal\*?$/i.test(rotulo)) {
      for (const [m, v] of Object.entries(valores)) meses[m] = { ...(meses[m] || {}), receita: v };
    }
  }
  return { meses, pracas };
}

