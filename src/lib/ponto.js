import { supabase } from './supabase';

// Ponto da Lolis (estagiária): chega às 13h30 ou às 14h e trabalha no máximo 4 horas por dia.
export const CHEGADA_MAX = '14:00';
export const TOLERANCIA = 5; // minutos
export const JORNADA_MAX = 4 * 60; // minutos
export const INICIO = '2026-10-16'; // o ponto começou aqui: antes disso, dia sem registro não é falta

const minutosDoDia = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
export const duracao = (min) => (min == null ? '' : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`);
// até que horas ela pode ficar, pela hora em que chegou
export const limiteSaida = (entradaIso) => new Date(new Date(entradaIso).getTime() + JORNADA_MAX * 60000).toISOString();

// linhas do banco → { 'AAAA-MM-DD': { entrada, saida, falta, folga } }
export const porDia = (rows) => {
  const out = {};
  for (const r of rows || []) (out[r.dia] ||= {})[r.tipo] = { em: r.em, obs: r.obs || '', origem: r.origem };
  return out;
};

// Situação de um dia. util = é dia de trabalho dela; agora = Date (para o dia de hoje)
export function resumoDia(reg = {}, dia, hoje, util, agora = new Date()) {
  if (reg.folga) return { status: 'folga', obs: reg.folga.obs };
  if (reg.falta) return { status: 'falta', obs: reg.falta.obs };
  if (!reg.entrada) {
    if (!util || dia > hoje || dia < INICIO) return { status: 'livre' };
    const passou = dia < hoje || agora.getHours() * 60 + agora.getMinutes() > minutosDoDia(CHEGADA_MAX) + 15;
    return { status: passou ? (dia < hoje ? 'sem-registro' : 'nao-chegou') : 'aguardando' };
  }
  const ent = new Date(reg.entrada.em);
  const atraso = Math.max(0, ent.getHours() * 60 + ent.getMinutes() - minutosDoDia(CHEGADA_MAX));
  const fim = reg.saida ? new Date(reg.saida.em) : dia === hoje ? agora : null;
  const minutos = fim ? Math.max(0, (fim - ent) / 60000) : null;
  return {
    status: reg.saida ? 'saiu' : dia === hoje ? 'trabalhando' : 'sem-saida',
    entrada: reg.entrada.em,
    saida: reg.saida?.em || null,
    minutos,
    atraso: atraso > TOLERANCIA ? atraso : 0,
    passou: minutos != null && minutos > JORNADA_MAX + TOLERANCIA ? minutos - JORNADA_MAX : 0,
    limite: limiteSaida(reg.entrada.em),
    obs: [reg.entrada.obs, reg.saida?.obs].filter(Boolean).join(' · '),
  };
}

// ── Acesso ao banco (com dados de exemplo no modo de teste do computador de desenvolvimento) ──
const demo = () => import.meta.env.DEV && (localStorage.getItem('paginaDemo') || location.hash.includes('demo'));
const lerDemo = () => {
  try {
    return JSON.parse(localStorage.getItem('pontoDemo') || '[]');
  } catch {
    return [];
  }
};
const salvarDemo = (rows) => localStorage.setItem('pontoDemo', JSON.stringify(rows));
const diaSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// Página da Lolis (pelo link)
export async function pontoHoje(token) {
  if (demo()) return porDia(lerDemo())[diaSP()] || {};
  const { data, error } = await supabase.rpc('lolis_ponto_hoje', { p_token: token });
  if (error) return null; // banco ainda sem o ponto
  return porDia((data || []).map((x) => ({ ...x, dia: diaSP() })))[diaSP()] || {};
}
export async function baterPonto(token, tipo) {
  if (demo()) {
    const rows = lerDemo().filter((r) => !(r.dia === diaSP() && r.tipo === tipo && tipo === 'saida'));
    if (!rows.some((r) => r.dia === diaSP() && r.tipo === tipo)) rows.push({ dia: diaSP(), tipo, em: new Date().toISOString(), origem: 'lolis' });
    salvarDemo(rows);
    return true;
  }
  const { error } = await supabase.rpc('lolis_ponto_bater', { p_token: token, p_tipo: tipo });
  return !error;
}

// Central da Laura
export async function pontoDesde(desde) {
  if (demo()) return { rows: lerDemo().filter((r) => r.dia >= desde) };
  const { data, error } = await supabase.from('lolis_ponto').select('dia, tipo, em, origem, obs').gte('dia', desde);
  return error ? { erro: error.message } : { rows: data };
}
// corrigir: em = ISO ou null (apaga); tipo falta/folga: em = null e obs
export async function salvarPonto(dia, tipo, em, obs = '') {
  if (demo()) {
    const rows = lerDemo().filter((r) => !(r.dia === dia && r.tipo === tipo));
    if (em !== undefined && (em || tipo === 'falta' || tipo === 'folga')) rows.push({ dia, tipo, em, obs, origem: 'laura' });
    salvarDemo(rows);
    return true;
  }
  if (em === undefined) {
    const { error } = await supabase.from('lolis_ponto').delete().eq('dia', dia).eq('tipo', tipo);
    return !error;
  }
  const { error } = await supabase.from('lolis_ponto').upsert({ dia, tipo, em, obs: obs || null, origem: 'laura' }, { onConflict: 'user_id,dia,tipo' });
  return !error;
}
