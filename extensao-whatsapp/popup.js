const $ = (id) => document.getElementById(id);

async function mostrar() {
  const { sessao, conta = 'ranken' } = await chrome.storage.local.get(['sessao', 'conta']);
  $('login').hidden = !!sessao;
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
