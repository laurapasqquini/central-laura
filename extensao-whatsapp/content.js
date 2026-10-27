// Põe o botão "➕ Central" em cada mensagem do WhatsApp Web.
// Só lê o que já está na tela: não manda nada no WhatsApp nem abre outra conexão.

const nomeDaConversa = () => {
  const h = document.querySelector('#main header');
  if (!h) return null;
  const t = h.querySelector('span[title], span[dir="auto"]');
  return (t?.getAttribute('title') || t?.textContent || '').trim() || null;
};

// data-pre-plain-text vem assim: "[10:32, 06/10/2026] Fulano: "
const lerCabecalho = (s = '') => {
  const m = s.match(/^\[([^\]]+)\]\s*(.*?):\s*$/);
  return m ? { hora: m[1], autor: m[2] } : {};
};

function aviso(texto) {
  const d = document.createElement('div');
  d.className = 'central-aviso';
  d.textContent = texto;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2500);
}

function botao(msg) {
  const b = document.createElement('button');
  b.className = 'central-btn';
  b.textContent = '➕ Central';
  b.title = 'Virar tarefa na Central da Laura';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { hora, autor } = lerCabecalho(msg.getAttribute('data-pre-plain-text'));
    const conversa = nomeDaConversa();
    const texto = (msg.innerText || '').trim();
    if (!texto) return aviso('⚠️ Essa mensagem não tem texto');
    // em grupo, mostra quem escreveu; no privado, o nome da conversa basta
    const contato = autor && conversa && autor !== conversa ? `${autor} (${conversa})` : conversa || autor || null;
    b.textContent = '…';
    // extensão atualizada com esta aba aberta: ela perde a ligação até dar F5
    if (!chrome.runtime?.id) {
      b.textContent = '➕ Central';
      return aviso('⚠️ A extensão foi atualizada: aperte F5 nesta aba');
    }
    chrome.runtime.sendMessage({ tipo: 'enviar', item: { texto, contato, hora } }, (r) => {
      if (r?.ok) {
        b.textContent = '✓ na Central';
        b.classList.add('ok');
      } else {
        b.textContent = '➕ Central';
        aviso('⚠️ ' + (r?.erro || 'Não deu certo'));
      }
    });
  });
  return b;
}

function marcar() {
  for (const msg of document.querySelectorAll('[data-pre-plain-text]')) {
    if (msg.dataset.central) continue;
    msg.dataset.central = '1';
    const balao = msg.parentElement;
    if (!balao) continue;
    balao.classList.add('central-balao');
    balao.appendChild(botao(msg));
  }
}

let agendado = false;
new MutationObserver(() => {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(() => {
    agendado = false;
    marcar();
  });
}).observe(document.body, { childList: true, subtree: true });
marcar();

// ── Pendências (aba 💬 WhatsApp da Central): a cada 30 min lê a LISTA de conversas, sem abrir nenhuma
// (nada fica como lido): nome, última mensagem, se foi a Laura que mandou e quando. Só no Chrome da Laura
// (extensão logada) e com este WhatsApp marcado como RANKEN. Não mexe na lista enquanto ela está usando.
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const iso = (d) => d.toLocaleDateString('sv-SE');
function diaDaHora(h = '') {
  if (!h) return null;
  const hoje = new Date();
  if (/^\d{1,2}:\d{2}$/.test(h)) return iso(hoje);
  if (/^ontem$/i.test(h)) return iso(new Date(hoje - 864e5));
  const w = DIAS_SEMANA.findIndex((d) => d.startsWith(h.toLowerCase().split('-')[0]));
  if (w >= 0) return iso(new Date(hoje - (((hoje.getDay() - w + 7) % 7) || 7) * 864e5));
  const m = h.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function lerConversa(it) {
  const tits = [...it.querySelectorAll('span[title]')].map((s) => s.getAttribute('title'));
  if (!tits.length) return null;
  // textContent das folhas (o innerText vem vazio com a aba em segundo plano)
  const linhas = [...it.querySelectorAll('span, div')].filter((e) => !e.childElementCount).map((e) => e.textContent.trim()).filter(Boolean);
  const hora = linhas.find((l) => /^(\d{1,2}:\d{2}|Ontem|domingo|segunda|terça|quarta|quinta|sexta|sábado|\d{2}\/\d{2}\/\d{4})/i.test(l)) || '';
  return {
    nome: tits[0],
    prev: (tits[1] || '').replace(/[‪-‮]/g, '').slice(0, 200),
    hora,
    dia: diaDaHora(hora),
    // ✓✓ na prévia = a última mensagem é da Laura
    eu: [...it.querySelectorAll('svg title')].some((t) => /wds-ic-(read|delivered|sent|pending|msg)/.test(t.textContent)),
    // reação da pessoa a uma mensagem: a prévia mostra o texto reagido entre aspas (o assunto está fechado)
    reacao: !!tits[1] && linhas.some((l) => l.endsWith('"') && l.startsWith(tits[1].replace(/[‪-‮]/g, '').slice(0, 15))),
    // em grupo a prévia vem com o nome de quem escreveu ("Fulano" + ":" separado) ou com ~apelido
    grupo: !!it.querySelector('[data-icon*="group"]') || linhas.some((l) => /^~/.test(l) || l === ':'),
  };
}
async function lerListaConversas() {
  const p = document.querySelector('#pane-side');
  if (!p) return null;
  // com uma busca aberta a lista mostra resultados ("Grupos em comum", "Fulano está no grupo"), não as conversas
  if (/Grupos em comum|Mensagens\b/.test(p.textContent) && [...p.querySelectorAll('div, span')].some((e) => !e.childElementCount && /^(Conversas|Grupos em comum)$/.test(e.textContent.trim()))) return null;
  const topo = p.scrollTop;
  const limite = iso(new Date(Date.now() - 7 * 864e5)); // só a última semana
  const vistos = new Map();
  p.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 500));
  for (let i = 0; i < 60; i++) {
    for (const it of p.querySelectorAll('[role="listitem"], [role="row"]')) {
      const c = lerConversa(it);
      if (c && !vistos.has(c.nome)) vistos.set(c.nome, c);
    }
    const ultimos = [...vistos.values()].slice(-3);
    if (ultimos.length === 3 && ultimos.every((c) => c.dia && c.dia < limite)) break;
    const antes = p.scrollTop;
    p.scrollTop += 500;
    await new Promise((r) => setTimeout(r, 350));
    if (p.scrollTop === antes) break;
  }
  p.scrollTop = topo;
  return [...vistos.values()].filter((c) => !c.dia || c.dia >= limite);
}
let ultimaLeitura = 0;
let ultimoUso = Date.now();
for (const ev of ['keydown', 'wheel', 'mousedown']) addEventListener(ev, () => (ultimoUso = Date.now()), true);
async function lerPendencias() {
  if (!chrome.runtime?.id || Date.now() - ultimaLeitura < 30 * 60e3) return;
  if (!document.hidden && Date.now() - ultimoUso < 60e3) return; // ela está mexendo: tenta de novo depois
  const { sessao, conta = 'ranken' } = await chrome.storage.local.get(['sessao', 'conta']);
  if (!sessao || conta !== 'ranken') return;
  ultimaLeitura = Date.now();
  const itens = await lerListaConversas();
  if (itens?.length) chrome.runtime.sendMessage({ tipo: 'whatsapp', dados: { em: new Date().toISOString(), itens } });
}
setTimeout(lerPendencias, 20e3);
setInterval(lerPendencias, 60e3);

if (globalThis.chrome?.runtime?.onMessage)
  chrome.runtime.onMessage.addListener((msg, _s, responder) => {
    if (msg.tipo === 'contato') responder({ contato: nomeDaConversa() });
    if (msg.tipo === 'aviso') aviso(msg.texto);
  });
