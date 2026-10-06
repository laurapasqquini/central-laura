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

async function enviar(item) {
  const { conta = 'ranken' } = await chrome.storage.local.get('conta');
  const r = await fetch(`${URL}/rest/v1/entrada`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ conta, contato: item.contato || null, texto: item.texto, hora: item.hora || null }),
  });
  if (!r.ok) throw new Error(`Não foi para a Central (${r.status})`);
}

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  const run =
    msg.tipo === 'entrar' ? auth('password', { email: msg.email, password: msg.senha }).then((s) => ({ email: s.email }))
    : msg.tipo === 'sair' ? chrome.storage.local.remove('sessao')
    : msg.tipo === 'enviar' ? enviar(msg.item)
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
