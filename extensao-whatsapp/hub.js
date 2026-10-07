// RANKEN Hub › Beach Tênis: lê os números da tela (só os totais, nenhum nome de atleta)
// e manda para a Central sozinho, uma vez por dia ou quando mudarem. Não altera nada no Hub.

const linhasDaTela = () => (document.querySelector('main') || document.body).innerText.split('\n').map((s) => s.trim()).filter(Boolean);
const numero = (s) => {
  const m = String(s || '').match(/-?[\d.]+(,\d+)?/);
  return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : null;
};

function lerBeach() {
  const L = linhasDaTela();
  const depois = (re) => {
    const i = L.findIndex((l) => re.test(l));
    return i >= 0 ? numero(L[i + 1]) : null;
  };
  const total = depois(/^TODAS AS CIDADES$/i);
  // só lê com o filtro "todas as cidades / todas" (senão os números são de um recorte)
  const chipTodas = numero((L.find((l) => /^Todas \d+$/.test(l)) || '').slice(6));
  if (total == null || chipTodas !== total) return null;
  const receita = numero((L.find((l) => /R\$\s*[\d.,]+\s*\/\s*m[eê]s/i.test(l)) || '').replace(/^[^R]*R\$/, ''));
  const kits = L.find((l) => /a retirar$/.test(l));
  const n = {
    'Beach · atletas': total,
    'Beach · Maringá': depois(/MARING[AÁ]$/i),
    'Beach · Santa Fé': depois(/SANTA F[EÉ]$/i),
    'Beach · pagantes': depois(/PAGANTES$/i),
    'Beach · receita/mês (R$)': receita,
    'Beach · assinatura': depois(/ASSINATURA$/i),
    'Beach · Pix': depois(/^\S*\s*PIX$/i),
    'Beach · cortesias': depois(/CORTESIAS$/i),
    'Beach · desistiram': depois(/DESISTIRAM$/i),
    'Beach · precisa decidir': depois(/PRECISA DECIDIR$/i),
    'Beach · aguardando aprovação': depois(/AGUARDANDO APROVA/i),
    'Beach · kits a retirar': kits ? numero(kits) : null,
  };
  for (const k of Object.keys(n)) if (n[k] == null) delete n[k];
  return Object.keys(n).length >= 4 ? n : null;
}

function aviso(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  d.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;padding:10px 16px;border-radius:12px;background:#1e1b4b;color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2500);
}

// Sorteio Diário › Ganhadores do dia: nome, data, cidade/esporte e prêmio dos últimos 12 dias
// (para a Lolis lembrar o prazo de 7 dias e conferir se deu certo). O telefone fica no Hub.
function lerGanhadores() {
  const L = linhasDaTela();
  const limite = new Date(Date.now() - 12 * 864e5).toLocaleDateString('sv-SE');
  const out = [];
  L.forEach((l, k) => {
    const m = l.match(/^🗓\s*(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return;
    const data = `${m[3]}-${m[2]}-${m[1]}`;
    if (data < limite) return;
    const seguintes = L.slice(k + 1, k + 4);
    const local = seguintes[0] && !/^🎁|^⏳|^✅/.test(seguintes[0]) ? seguintes[0] : '';
    const premio = (seguintes.find((x) => /^🎁/.test(x)) || '').replace(/^🎁\s*/, '');
    const [patrocinador, item] = premio.split('→').map((s) => (s || '').trim());
    // "· +1" = o ganhador levou mais um prêmio (de outro patrocinador, que só aparece abrindo no Hub)
    const extra = Number(((item || '').match(/·\s*\+(\d+)$/) || [])[1] || 0);
    out.push({ nome: L[k - 1], data, local, patrocinador: patrocinador || '', premio: (item || '').replace(/\s*·\s*\+\d+$/, ''), extra });
  });
  return out.length ? out : null;
}

let enviando = false;
async function mandar(tipo, dados, chave, texto) {
  const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD
  const assinatura = hoje + JSON.stringify(dados);
  const salvo = (await chrome.storage.local.get(chave))[chave];
  if (salvo === assinatura) return; // já mandou isso hoje
  enviando = true;
  chrome.runtime.sendMessage({ tipo, dados }, async (r) => {
    enviando = false;
    if (r?.ok) {
      await chrome.storage.local.set({ [chave]: assinatura });
      aviso(texto);
    }
  });
}

async function tentar() {
  if (enviando) return;
  if (/^\/beach/.test(location.pathname)) {
    const n = lerBeach();
    if (n) mandar('numeros', n, 'ultimoHub', '✓ Números do Beach na Central');
  } else if (/^\/sorteio/.test(location.pathname)) {
    const g = lerGanhadores();
    if (g) mandar('ganhadores', g, 'ultimoGanhadores', `✓ ${g.length} ganhadores recentes na Central`);
  }
}

let t = null;
new MutationObserver(() => {
  clearTimeout(t);
  t = setTimeout(tentar, 1500); // espera a tela terminar de carregar
}).observe(document.body, { childList: true, subtree: true, characterData: true });
setTimeout(tentar, 2000);
