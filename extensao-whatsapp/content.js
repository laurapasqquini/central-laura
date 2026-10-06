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

if (globalThis.chrome?.runtime?.onMessage)
  chrome.runtime.onMessage.addListener((msg, _s, responder) => {
    if (msg.tipo === 'contato') responder({ contato: nomeDaConversa() });
    if (msg.tipo === 'aviso') aviso(msg.texto);
  });
