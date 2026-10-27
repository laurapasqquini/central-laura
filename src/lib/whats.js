// Pendências do WhatsApp do RANKEN (aba 💬 WhatsApp): a extensão lê a LISTA de conversas do WhatsApp Web
// (sem abrir nenhuma) e manda para cá a última mensagem de cada uma, quem mandou e quando.
// Aqui vira três listas: o que a Laura prometeu e não voltou, o que espera resposta dela e o que espera o outro lado.
import { today, diffDays } from './dates';

// a última mensagem fecha o assunto (não precisa responder): curta, sem pergunta e com palavra de fechamento
const PALAVRA_FECHA = /(obrigad|\bobg\b|brigad|valeu|\bvlw\b|\bblz\b|beleza|\bbele\b|\bok\b|\bokk|okay|\bcerto\b|\bshow\b|\btop\b|perfeito|combinado|massa|de nada|\btmj\b|👍|🙏|❤|😘|😍|🥰|kkk|fechou|maravilha|[oó]timo|tranquilo|\bobri\b|uhu|amei|\bfeito\b|\bpronto\b|fica em paz|magina|entendi|de boa|retirei|aguardo|estou indo|t[oô] indo|^sim\b|^isso\b|t[aá] bom|pode ser)/i;
const fecha = (t) => t.length <= 80 && !t.includes('?') && PALAVRA_FECHA.test(t);
// promessa: "vou ver", "já te falo", "deixa comigo"…
const PROMESSA = /(vou (ver|verificar|resolver|conferir|olhar|checar|falar|mandar|te mandar|passar|confirmar|arrumar|ajustar|lan[cç]ar|corrigir|pedir|perguntar|levar|dar um jeito|dar uma olhada)|j[aá] te (falo|aviso|mando|retorno|chamo|envio)|deixa comigo|te retorno|te aviso|\baviso\b|me avisa|assim que|daqui a pouco|mais tarde|amanh[aã] te|j[aá] vejo|vou ver pra)/i;
// avisos automáticos e conversas que não são de gente
const SISTEMA = /^(WhatsApp( Business)?|Meta AI)$/i;
// reação a uma mensagem aparece na prévia como o texto entre aspas ("…"): também fecha
const AUTOMATICA = /^Novidade no RANKEN|^🏆|^Reagiu|^Figurinha|^Liga[cç][aã]o (de voz|de v[ií]deo|perdida)|"$|est(á|a|ão|ao) no grupo$/i; // "Fulano está no grupo" = tela de busca

export const leituraDeBusca = (itens = []) =>
  itens.some((c) => /est(á|a|ão|ao) no grupo$/i.test((c.prev || '').trim())) || itens.filter((c) => !c.dia).length > itens.length / 2;

export function pendenciasWhats(state, ref = today()) {
  const w = state.whats;
  const vazio = { prometi: [], responder: [], aguardando: [], em: w?.em || null };
  if (!Array.isArray(w?.itens)) return vazio;
  // leitura feita com uma busca aberta no WhatsApp (resultados, não as conversas de verdade): descarta tudo
  // para não mostrar pendência que já foi resolvida
  if (leituraDeBusca(w.itens)) return { ...vazio, invalida: true };
  const resolvidos = state.whatsResolvidos || {};
  const ignorados = state.whatsIgnorados || {};
  for (const c of w.itens) {
    if (c.grupo || /\(voc[eê]\)/.test(c.nome) || SISTEMA.test(c.nome) || ignorados[c.nome]) continue;
    if (resolvidos[c.nome] === c.prev) continue; // resolvido; volta se chegar mensagem nova
    const prev = (c.prev || '').trim();
    if (!prev || c.reacao || AUTOMATICA.test(prev)) continue;
    let tipo = null;
    if (c.eu) tipo = PROMESSA.test(prev) ? 'prometi' : null;
    else if (PROMESSA.test(prev)) tipo = 'aguardando';
    else if (!fecha(prev)) tipo = 'responder';
    if (!tipo) continue;
    const parado = c.dia ? Math.max(0, diffDays(ref, c.dia)) : 0;
    vazio[tipo].push({ ...c, tipo, parado });
  }
  for (const k of ['prometi', 'responder', 'aguardando']) vazio[k].sort((a, b) => b.parado - a.parado || (b.dia || '').localeCompare(a.dia || ''));
  return vazio;
}

export const totalWhats = (state) => {
  const p = pendenciasWhats(state);
  return p.prometi.length + p.responder.length;
};

// número no nome da conversa (contato não salvo): link que abre a conversa no WhatsApp Web
export const linkConversa = (nome = '') => {
  const d = nome.replace(/\D/g, '');
  return /^\+?\d[\d\s-]{9,}$/.test(nome.trim()) && d.length >= 12 ? `https://web.whatsapp.com/send?phone=${d}` : null;
};
