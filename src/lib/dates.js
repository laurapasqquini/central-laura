// Datas sempre como texto 'AAAA-MM-DD' no fuso local, para não ter erro de fuso.

const pad = (n) => String(n).padStart(2, '0');

export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromStr = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = () => toStr(new Date());

export const addDays = (s, n) => {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};

export const diffDays = (a, b) => Math.round((fromStr(a) - fromStr(b)) / 86400000);

export const weekday = (s) => fromStr(s).getDay(); // 0 = domingo

export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const fmtCurto = (s) => {
  const d = fromStr(s);
  return `${DIAS_CURTO[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

export const fmtLongo = (s) => {
  const d = fromStr(s);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

// "hoje", "amanhã", "sexta", "em 5 dias", "há 3 dias"
export const relativo = (s, ref = today()) => {
  const n = diffDays(s, ref);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1 && n < 7) return DIAS[weekday(s)];
  if (n < 0) return `há ${-n} dias`;
  return `em ${n} dias`;
};

export const lastDayOfMonth = (s) => {
  const d = fromStr(s);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

// Próximo dia útil (pula sábado e domingo).
export const nextWorkday = (s) => {
  let d = addDays(s, 1);
  while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1);
  return d;
};
