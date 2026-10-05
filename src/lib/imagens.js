// Fotos de produto para o contrato: colar (Ctrl+V), arrastar ou escolher arquivo.
// Viram JPEG (fundo branco, até 1600 px) e ficam guardadas neste aparelho (IndexedDB), por pedido.

export async function arquivoParaImagem(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('não consegui ler a imagem'));
      i.src = url;
    });
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { dataUrl: cv.toDataURL('image/jpeg', 0.9), w, h, nome: file.name || 'imagem colada' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const imagensDoEvento = (e) =>
  [...(e.clipboardData?.files || e.dataTransfer?.files || e.target?.files || [])].filter((f) => f.type.startsWith('image/'));

// --- IndexedDB (uma "gaveta" por pedido) ---
const abrir = () =>
  new Promise((ok, erro) => {
    const r = indexedDB.open('central-contratos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('imagens');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });

export async function salvarImagens(pedidoId, porItem) {
  try {
    const db = await abrir();
    await new Promise((ok, erro) => {
      const tx = db.transaction('imagens', 'readwrite');
      tx.objectStore('imagens').put(porItem, pedidoId);
      tx.oncomplete = ok;
      tx.onerror = () => erro(tx.error);
    });
  } catch {
    /* sem armazenamento: as fotos valem só enquanto a página estiver aberta */
  }
}

export async function carregarImagens(pedidoId) {
  try {
    const db = await abrir();
    return await new Promise((ok) => {
      const r = db.transaction('imagens').objectStore('imagens').get(pedidoId);
      r.onsuccess = () => ok(r.result || {});
      r.onerror = () => ok({});
    });
  } catch {
    return {};
  }
}
