import { today, addDays, weekday, toStr } from './dates';

// Entende frases como "pedir pra Lolis contar estoque sexta #ranken !urgente"
// e devolve { title, due, who, area, urgent }.

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DIAS = {
  domingo: 0, dom: 0,
  segunda: 1, 'segunda-feira': 1, seg: 1,
  terca: 2, 'terca-feira': 2, ter: 2,
  quarta: 3, 'quarta-feira': 3, qua: 3,
  quinta: 4, 'quinta-feira': 4, qui: 4,
  sexta: 5, 'sexta-feira': 5, sex: 5,
  sabado: 6, sab: 6,
};

const AREAS = { ranken: 'ranken', gralha: 'gralha', pessoal: 'pessoal', eu: 'pessoal' };

export function parseQuick(text, defaults = {}) {
  const ref = today();
  let rest = ` ${text.trim()} `;
  const out = { due: null, who: 'laura', area: defaults.area || 'ranken', urgent: false };

  const take = (re, fn) => {
    rest = rest.replace(re, (...m) => {
      fn(...m);
      return ' ';
    });
  };

  take(/\s!(urgente|!)?(?=\s)/i, () => (out.urgent = true));
  take(/\s@(\p{L}+)(?=\s)/iu, (_, nome) => {
    const n = norm(nome);
    out.who = n === 'eu' || n === 'laura' ? 'laura' : n === 'lolis' || n === 'isabela' ? 'lolis' : n;
  });
  take(/\s#(\p{L}+)(?=\s)/iu, (_, a) => {
    if (AREAS[norm(a)]) out.area = AREAS[norm(a)];
  });

  // Datas: dd/mm(/aaaa)
  take(/\s(?:dia\s)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (_, d, m, y) => {
    const ano = y ? (y.length === 2 ? 2000 + +y : +y) : new Date().getFullYear();
    let dt = toStr(new Date(ano, +m - 1, +d));
    if (!y && dt < ref) dt = toStr(new Date(ano + 1, +m - 1, +d));
    out.due = dt;
  });
  if (!out.due) {
    const n = norm(rest);
    const tests = [
      [/\sdepois de amanha(?=\s)/, () => addDays(ref, 2)],
      [/\samanha(?=\s)/, () => addDays(ref, 1)],
      [/\shoje(?=\s)/, () => ref],
      [/\sem (\d+) dias?(?=\s)/, (m) => addDays(ref, +m[1])],
      [/\s(?:semana que vem|proxima semana)(?=\s)/, () => addDays(ref, ((8 - weekday(ref)) % 7) || 7)],
      [/\s(?:na |no |ate |até )?(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)(?=\s)/, (m) => {
        const alvo = DIAS[m[1]];
        const delta = (alvo - weekday(ref) + 7) % 7 || 7;
        return addDays(ref, delta);
      }],
    ];
    for (const [re, fn] of tests) {
      const m = n.match(re);
      if (m) {
        out.due = fn(m);
        // remove o mesmo trecho do texto original (mesmo tamanho após normalizar)
        rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
        break;
      }
    }
  }

  out.title = rest.replace(/\s+/g, ' ').trim();
  if (out.title) out.title = out.title[0].toUpperCase() + out.title.slice(1);
  return out;
}
