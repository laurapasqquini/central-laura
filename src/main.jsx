import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Versão nova da central: confere a cada 10 min. Se a aba estiver em segundo plano, atualiza sozinha;
// se estiver aberta na frente, mostra um aviso para atualizar com um clique (nada se perde: tudo fica salvo).
if (!import.meta.env.DEV) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const atualizar = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (document.hidden) return atualizar(true);
        document.addEventListener('visibilitychange', () => document.hidden && atualizar(true));
        const aviso = document.createElement('button');
        aviso.textContent = '🔄 Tem versão nova da central: clique para atualizar';
        aviso.style.cssText =
          'position:fixed;bottom:20px;right:20px;z-index:9999;padding:12px 18px;border:0;border-radius:14px;background:#1e1b4b;color:#fff;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:pointer';
        aviso.onclick = () => atualizar(true);
        document.body.appendChild(aviso);
      },
      onRegisteredSW(_url, reg) {
        if (reg) setInterval(() => reg.update(), 10 * 60 * 1000);
      },
    });
  });
}
