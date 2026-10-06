// Relatório semanal para os chefes: entregas, andamento, propostas, números e próxima semana.
import { buildDay, isWorkday } from './engine';
import { feitosDoDia } from './relatorio';
import { addDays, fmtCurto } from './dates';
import { FRENTES } from '../data/radar';

// Números que a extensão lê da tela Beach Tênis do Hub (na ordem da tela)
export const INDICADORES_PADRAO = ['Beach · atletas', 'Beach · Maringá', 'Beach · Santa Fé', 'Beach · pagantes', 'Beach · receita/mês (R$)', 'Beach · assinatura', 'Beach · Pix', 'Beach · cortesias', 'Beach · desistiram', 'Beach · precisa decidir', 'Beach · aguardando aprovação', 'Beach · kits a retirar'];
// No relatório dos chefes vão só os principais (mais os que a Laura criar à mão)
const DESTAQUE = ['Beach · atletas', 'Beach · pagantes', 'Beach · receita/mês (R$)', 'Beach · cortesias', 'Beach · desistiram'];
export const STATUS = [
  { id: 'ideia', nome: 'Ideia', icone: '💡' },
  { id: 'propus', nome: 'Propus', icone: '📤' },
  { id: 'andamento', nome: 'Em andamento', icone: '🚧' },
  { id: 'feito', nome: 'Feito', icone: '✅' },
];

const br = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const frente = (id) => FRENTES.find((f) => f.id === id) || { nome: 'Geral', icone: '•' };
const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(/\./g, '').replace(',', '.')));
const fmtNum = (n) => n.toLocaleString('pt-BR');

export function plano(state) {
  return { iniciativas: [], ocultos: [], metas: {}, numeros: {}, indicadores: INDICADORES_PADRAO, ...(state.plano || {}) };
}

export const progresso = (state, ini) => {
  const ts = state.tasks.filter((t) => t.iniciativaId === ini.id);
  return { total: ts.length, feitas: ts.filter((t) => t.done).length };
};

// Últimos dois registros de cada indicador até a data (para mostrar a variação)
export function numerosAte(state, ate) {
  const p = plano(state);
  const datas = Object.keys(p.numeros).filter((d) => d <= ate).sort();
  return p.indicadores
    .map((nome) => {
      const vals = datas.map((d) => ({ d, v: num(p.numeros[d]?.[nome]) })).filter((x) => x.v != null);
      const ult = vals.at(-1);
      const ant = vals.at(-2);
      if (!ult) return null;
      const dif = ant ? ult.v - ant.v : null;
      return { nome, valor: ult.v, data: ult.d, dif };
    })
    .filter(Boolean);
}

export function montarChefes(state, [de, ate]) {
  const p = plano(state);
  const dentro = (d) => d && d >= de && d <= ate;
  const ranken = (t) => t.area === 'ranken';

  const iniFeitas = p.iniciativas.filter((i) => i.status === 'feito' && dentro(i.feitoEm));
  const tarefas = state.tasks.filter((t) => t.done && t.who === 'laura' && ranken(t) && dentro(t.doneAt)).map((t) => t.title.replace(/^💬 /, ''));
  let rotinas = 0;
  let lolis = 0;
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    rotinas += buildDay(state, d, { area: 'ranken', who: 'laura' }).filter((x) => x.kind === 'routine' && x.done).length;
    lolis += feitosDoDia(state, d, 'lolis', 'all').length + ((state.relatosLolis || {})[d] ? 1 : 0);
  }
  const campanhas = Object.values(state.campanhas || {}).filter((c) => c.status === 'agendada' && dentro(c.em)).length;

  const prox0 = addDays(ate, 1);
  const prox1 = addDays(ate, 7);
  const marcos = [];
  const proxTarefas = [];
  for (let d = prox0; d <= prox1; d = addDays(d, 1)) {
    for (const x of buildDay(state, d, { area: 'ranken', who: 'all' })) {
      if (x.kind === 'marco' && !/^Último dia de encaixes/.test(x.title)) marcos.push(`${fmtCurto(d)}: ${x.title}`);
      if (x.kind === 'task' && x.who === 'laura' && !x.done && isWorkday(state, d)) proxTarefas.push(x.title);
    }
  }
  const prazos = p.iniciativas.filter((i) => i.status !== 'feito' && i.prazo && i.prazo >= prox0 && i.prazo <= addDays(ate, 14));

  return {
    titulo: `RANKEN · Semana ${br(de)} a ${br(ate)} · Laura`,
    entregue: [
      ...iniFeitas.map((i) => `${frente(i.frente).icone} ${i.titulo}`),
      ...tarefas.slice(0, 8),
      ...(tarefas.length > 8 ? [`+ ${tarefas.length - 8} outras tarefas`] : []),
      ...(campanhas ? [`${campanhas} ${campanhas === 1 ? 'campanha push agendada' : 'campanhas push agendadas'}`] : []),
      ...(rotinas ? [`${rotinas} rotinas e avisos da semana em dia`] : []),
    ],
    andamento: p.iniciativas
      .filter((i) => i.status === 'andamento')
      .map((i) => {
        const pr = progresso(state, i);
        return `${frente(i.frente).icone} ${i.titulo}${i.prazo ? ` (até ${br(i.prazo)})` : ''}${pr.total ? ` · ${pr.feitas}/${pr.total} passos` : ''}`;
      }),
    propostas: p.iniciativas.filter((i) => i.status === 'propus').map((i) => `${frente(i.frente).icone} ${i.titulo}`),
    numeros: numerosAte(state, ate).filter((n) => DESTAQUE.includes(n.nome) || !INDICADORES_PADRAO.includes(n.nome)).map((n) => `${n.nome}: ${fmtNum(n.valor)}${n.dif ? ` (${n.dif > 0 ? '+' : ''}${fmtNum(n.dif)})` : ''}`),
    equipe: lolis ? [`Lolis: ${lolis} ${lolis === 1 ? 'atividade registrada' : 'atividades registradas'} na semana`] : [],
    proxima: [...marcos, ...prazos.map((i) => `Prazo ${br(i.prazo)}: ${i.titulo}`), ...proxTarefas.slice(0, 5)],
  };
}

const SECOES = [
  ['entregue', '✅ ENTREGUE'],
  ['andamento', '🚧 EM ANDAMENTO'],
  ['propostas', '💡 PROPOSTAS PARA DECIDIR'],
  ['numeros', '📊 NÚMEROS'],
  ['equipe', '🙋 EQUIPE'],
  ['proxima', '➡️ PRÓXIMA SEMANA'],
];

export function textoChefes(r) {
  const out = [`*${r.titulo}*`];
  for (const [k, nome] of SECOES) if (r[k].length) out.push('', `*${nome}*`, ...r[k].map((x) => `• ${x}`));
  return out.join('\n');
}

export async function pdfChefes(r) {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setUrlAccessPolicy(() => false);
  // emojis não existem na fonte do PDF: tira dos textos
  const limpa = (s) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').trim();
  const content = [{ text: r.titulo, fontSize: 16, bold: true, color: '#1e1b4b', margin: [0, 0, 0, 10] }];
  for (const [k, nome] of SECOES) {
    if (!r[k].length) continue;
    content.push({ text: limpa(nome), fontSize: 11, bold: true, color: '#4f46e5', margin: [0, 10, 0, 4] }, { ul: r[k].map(limpa) });
  }
  const blob = await pdfMake.createPdf({ content, defaultStyle: { fontSize: 10, lineHeight: 1.25 }, pageMargins: [40, 40, 40, 40] }).getBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${r.titulo.replace(/[^\wÀ-ú]+/g, '_')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
