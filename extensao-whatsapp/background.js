// Fala com o Supabase: login, renovação do acesso e gravação na caixa de entrada.
// A chave "publishable" é pública; quem protege os dados é o RLS (cada uma só vê o que é seu).
const URL = 'https://qkjqngddavxoqhnhbame.supabase.co';
const KEY = 'sb_publishable_FHjECY55Hpu0apsz2y-PHw_aBm6O4FJ';

const auth = async (tipo, corpo) => {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=${tipo}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || 'Não deu para entrar');
  const sessao = { access: j.access_token, refresh: j.refresh_token, expira: Date.now() + (j.expires_in - 60) * 1000, email: j.user?.email };
  await chrome.storage.local.set({ sessao });
  return sessao;
};

async function token() {
  const { sessao } = await chrome.storage.local.get('sessao');
  if (!sessao) throw new Error('Entre na extensão primeiro (clique no ícone dela).');
  if (Date.now() < sessao.expira) return sessao.access;
  return (await auth('refresh_token', { refresh_token: sessao.refresh })).access;
}

async function enviar(item, contaFixa) {
  const { conta: contaSalva = 'ranken', sessao, lolisToken } = await chrome.storage.local.get(['conta', 'sessao', 'lolisToken']);
  const conta = contaFixa || contaSalva; // 'numeros' = números do Hub, não vira tarefa
  // computador da Lolis: sem login, manda só ganhadores e programação pelo link da página dela
  if (!sessao && lolisToken) {
    if (!['ganhadores', 'programacao'].includes(conta)) throw new Error('No computador da Lolis a extensão só manda ganhadores e programação do Hub.');
    const r = await fetch(`${URL}/rest/v1/rpc/lolis_enviar`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: lolisToken, p_conta: conta, p_texto: item.texto }),
    });
    if (!r.ok) throw new Error(`Não foi para a Central (${r.status})`);
    return;
  }
  const r = await fetch(`${URL}/rest/v1/entrada`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ conta, contato: item.contato || null, texto: item.texto, hora: item.hora || null }),
  });
  if (!r.ok) throw new Error(`Não foi para a Central (${r.status})`);
}

chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  // aba do Hub aberta em segundo plano para ler os ganhadores (e fechada logo depois)
  if (msg.tipo === 'abrir-aba') return void chrome.tabs.create({ url: msg.url, active: false });
  if (msg.tipo === 'fechar-aba') return void (sender.tab && chrome.tabs.remove(sender.tab.id));
  const run =
    msg.tipo === 'entrar' ? auth('password', { email: msg.email, password: msg.senha }).then((s) => ({ email: s.email }))
    : msg.tipo === 'sair' ? chrome.storage.local.remove('sessao')
    : msg.tipo === 'enviar' ? enviar(msg.item)
    : msg.tipo === 'numeros' ? enviar({ texto: JSON.stringify(msg.dados), contato: 'RANKEN Hub · Beach Tênis' }, 'numeros')
    : msg.tipo === 'ganhadores' ? enviar({ texto: JSON.stringify(msg.dados), contato: 'RANKEN Hub · Sorteio Diário' }, 'ganhadores')
    : msg.tipo === 'programacao' ? enviar({ texto: JSON.stringify(msg.dados), contato: 'RANKEN Hub · Programação' }, 'programacao')
    : msg.tipo === 'hub-lolis' ? enviar({ texto: JSON.stringify(msg.dados), contato: 'RANKEN Hub · Equipe (Lolis)' }, 'hub-lolis')
    : Promise.resolve();
  run.then((r) => responder({ ok: true, ...r }), (e) => responder({ ok: false, erro: e.message }));
  return true; // resposta assíncrona
});

// Clique direito num texto selecionado: "Mandar para a Central"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'central', title: '➕ Mandar para a Central', contexts: ['selection'], documentUrlPatterns: ['https://web.whatsapp.com/*'] });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let contato = null;
  try {
    contato = (await chrome.tabs.sendMessage(tab.id, { tipo: 'contato' }))?.contato;
  } catch {
    /* sem contato, tudo bem */
  }
  try {
    await enviar({ texto: info.selectionText, contato });
    chrome.tabs.sendMessage(tab.id, { tipo: 'aviso', texto: '✓ Foi para a Central' });
  } catch (e) {
    chrome.tabs.sendMessage(tab.id, { tipo: 'aviso', texto: '⚠️ ' + e.message });
  }
});

// Todo dia útil, a partir das 13h25 (a Lolis entra 13h30): abre Atividades › Minha equipe › Lolis
// numa aba em segundo plano, lê o que está em aberto com ela e fecha. Só no computador da Laura (logada).
const HUB = 'https://ranken-financeiro.vercel.app';
const garantirAlarme = () => chrome.alarms.create('equipeLolis', { periodInMinutes: 10, delayInMinutes: 1 });
chrome.runtime.onInstalled.addListener(garantirAlarme);
chrome.runtime.onStartup.addListener(garantirAlarme);
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'equipeLolis') return;
  const agora = new Date();
  const dia = agora.toLocaleDateString('sv-SE');
  if ([0, 6].includes(agora.getDay()) || agora.getHours() * 60 + agora.getMinutes() < 13 * 60 + 25) return;
  const { sessao, autoEquipe } = await chrome.storage.local.get(['sessao', 'autoEquipe']);
  if (!sessao || autoEquipe === dia) return;
  await chrome.storage.local.set({ autoEquipe: dia });
  chrome.tabs.create({ url: `${HUB}/atividades/equipe?pessoa=lolis&central=equipe`, active: false });
});
