const $ = (id) => document.getElementById(id);

async function mostrar() {
  const { sessao, conta = 'ranken', lolisToken } = await chrome.storage.local.get(['sessao', 'conta', 'lolisToken']);
  $('login').hidden = !!sessao || !!lolisToken;
  $('modoLolis').hidden = !!sessao || !!lolisToken;
  $('lolisOk').hidden = !lolisToken || !!sessao;
  $('logada').hidden = !sessao;
  if (sessao) $('quem').textContent = sessao.email || '';
  $('conta').value = conta;
}

$('login').addEventListener('submit', (e) => {
  e.preventDefault();
  $('erro').textContent = '';
  chrome.runtime.sendMessage({ tipo: 'entrar', email: $('email').value.trim(), senha: $('senha').value }, (r) => {
    if (!r?.ok) $('erro').textContent = r?.erro || 'Não deu para entrar';
    $('senha').value = '';
    mostrar();
  });
});
$('conta').addEventListener('change', () => chrome.storage.local.set({ conta: $('conta').value }));
$('sair').addEventListener('click', () => chrome.runtime.sendMessage({ tipo: 'sair' }, mostrar));
mostrar();

// Computador da Lolis: guarda só o código do link da página dela (sem a senha da Laura)
$('salvarLolis').addEventListener('click', async () => {
  const m = $('linkLolis').value.match(/#lolis=([a-f0-9]{20,})/);
  if (!m) return ($('linkLolis').style.borderColor = '#dc2626');
  await chrome.storage.local.set({ lolisToken: m[1] });
  mostrar();
});
$('sairLolis').addEventListener('click', async () => {
  await chrome.storage.local.remove('lolisToken');
  mostrar();
});
