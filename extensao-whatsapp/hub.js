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

// Sorteio Diário › Programação: por dia, a marca do dia e os patrocinadores (prêmio, retirada, Instagram).
// Lê a cidade/esporte que estiver selecionada na tela. Telefones não são lidos.
function lerProgramacao() {
  const main = document.querySelector('main');
  if (!main || !/MARCA DO DIA/.test(main.innerText)) return null;
  const sels = [...main.querySelectorAll('select')];
  const escolhido = sels.map((s) => (s.options[s.selectedIndex]?.text || '').trim());
  const [cidade, esporte] = escolhido;
  if (!cidade || !esporte) return null;
  // copia a tela trocando cada lista suspensa pelo item escolhido (senão aparecem todas as opções)
  const copia = main.cloneNode(true);
  [...copia.querySelectorAll('select')].forEach((s, i) => s.replaceWith(document.createTextNode(`\n§${escolhido[i]}\n`)));
  copia.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px';
  document.body.appendChild(copia);
  const L = copia.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  copia.remove();

  const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const dias = {};
  let dia = null;
  let pat = null;
  L.forEach((l, k) => {
    if (DIAS.includes(l)) {
      dia = dias[l] = { titulo: '', patrocinadores: [] };
      pat = null;
      return;
    }
    if (!dia || l.startsWith('§') || /^🎨/.test(l) || l === 'Add') return;
    if (!dia.titulo && /^(SEGUNDA|TERÇA|QUARTA|QUINTA|SEXTA|SÁBADO|DOMINGO)\b/i.test(l)) return (dia.titulo = l);
    if (L[k + 1] === '✕') {
      pat = { nome: l, premio: '', local: '', insta: '' };
      dia.patrocinadores.push(pat);
      return;
    }
    if (!pat) return;
    if (/^🎁/.test(l)) pat.premio ||= l.replace(/^🎁\s*/, '').replace(/\s*·\s*principal$/, '');
    else if (/^📍/.test(l)) pat.local = l.replace(/^📍\s*/, '');
    else if (/^📷/.test(l)) pat.insta = l.replace(/^📷\s*@?/, '');
  });
  // o prêmio escolhido numa lista suspensa vem marcado com §🎁
  L.forEach((l, k) => {
    if (!/^§🎁/.test(l)) return;
    for (let j = k; j >= 0; j--)
      if (L[j + 1] === '✕' && L[j] !== '✕') {
        for (const d of Object.values(dias)) for (const p of d.patrocinadores) if (p.nome === L[j]) p.premio = l.replace(/^§🎁\s*/, '').replace(/\s*·\s*principal$/, '');
        break;
      }
  });
  return Object.keys(dias).length ? { cidade, esporte, dias } : null;
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

// Atualização automática dos ganhadores, uma vez por dia: ao usar qualquer página do Hub,
// a extensão abre Sorteio Diário numa aba em segundo plano, lê "Ganhadores do dia" e fecha a aba.
// (O Hub não deixa abrir páginas dele escondidas dentro de outra, por segurança.)
const AUTO = new URLSearchParams(location.search).get('central') === 'auto';
const hojeISO = () => new Date().toLocaleDateString('sv-SE');

async function agendarAuto() {
  if (AUTO || /^\/sorteio/.test(location.pathname)) return;
  const { autoGanhadores } = await chrome.storage.local.get('autoGanhadores');
  if (autoGanhadores === hojeISO()) return;
  await chrome.storage.local.set({ autoGanhadores: hojeISO() });
  chrome.runtime.sendMessage({ tipo: 'abrir-aba', url: `${location.origin}/sorteio?central=auto` });
}

async function rodarAuto() {
  for (let i = 0; i < 40; i++) {
    const aba = [...document.querySelectorAll('main button, main [role=tab], main a')].find((x) => x.textContent.trim() === 'Ganhadores do dia');
    if (aba) {
      aba.click(); // só troca a aba da tela, não altera nada
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const g = lerGanhadores();
    if (g) {
      chrome.runtime.sendMessage({ tipo: 'ganhadores', dados: g }, () => chrome.runtime.sendMessage({ tipo: 'fechar-aba' }));
      return;
    }
  }
  chrome.runtime.sendMessage({ tipo: 'fechar-aba' });
}

if (AUTO) rodarAuto();
else setTimeout(agendarAuto, 3000);

async function tentar() {
  if (enviando || AUTO) return;
  if (/^\/beach/.test(location.pathname)) {
    const n = lerBeach();
    if (n) mandar('numeros', n, 'ultimoHub', '✓ Números do Beach na Central');
  } else if (/^\/sorteio/.test(location.pathname)) {
    const g = lerGanhadores();
    if (g) mandar('ganhadores', g, 'ultimoGanhadores', `✓ ${g.length} ganhadores recentes na Central`);
    const p = lerProgramacao();
    if (p) mandar('programacao', p, `ultimoProg-${p.cidade}-${p.esporte}`, `✓ Programação ${p.cidade} · ${p.esporte} na Central`);
  }
}

let t = null;
new MutationObserver(() => {
  clearTimeout(t);
  t = setTimeout(tentar, 1500); // espera a tela terminar de carregar
}).observe(document.body, { childList: true, subtree: true, characterData: true });
setTimeout(tentar, 2000);
