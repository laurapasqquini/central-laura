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

let enviando = false;
async function tentar() {
  if (enviando || !/^\/beach/.test(location.pathname)) return;
  const n = lerBeach();
  if (!n) return;
  const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD
  const assinatura = hoje + JSON.stringify(n);
  const { ultimoHub } = await chrome.storage.local.get('ultimoHub');
  if (ultimoHub === assinatura) return; // já mandou estes números hoje
  enviando = true;
  chrome.runtime.sendMessage({ tipo: 'numeros', dados: n }, async (r) => {
    enviando = false;
    if (r?.ok) {
      await chrome.storage.local.set({ ultimoHub: assinatura });
      aviso('✓ Números do Beach na Central');
    }
  });
}

let t = null;
new MutationObserver(() => {
  clearTimeout(t);
  t = setTimeout(tentar, 1500); // espera a tela terminar de carregar
}).observe(document.body, { childList: true, subtree: true, characterData: true });
setTimeout(tentar, 2000);
