// Anexos das tarefas: imagens coladas (Ctrl+V), arrastadas ou escolhidas.
// Viram JPEG (até 1600 px) e vão para o Storage privado do Supabase (bucket "anexos", ver supabase/anexos.sql),
// na pasta da dona: user_id/tarefa/arquivo.jpg. Para mostrar, usa links assinados (temporários).
import { supabase } from './supabase';
import { arquivoParaImagem } from './imagens';

const BUCKET = 'anexos';
const VALIDADE = 7 * 24 * 3600; // link assinado vale 7 dias
const cache = new Map(); // path → { url, ate }

export async function subirAnexo(userId, taskId, file) {
  const img = await arquivoParaImagem(file);
  const blob = await (await fetch(img.dataUrl)).blob();
  const path = `${userId}/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'Falta ligar os anexos no Supabase (supabase/anexos.sql).' : error.message);
  return { path, w: img.w, h: img.h };
}

export async function apagarAnexos(anexos = []) {
  const paths = anexos.map((a) => a.path).filter(Boolean);
  if (!paths.length) return;
  for (const p of paths) cache.delete(p);
  await supabase.storage.from(BUCKET).remove(paths).then(() => {}, () => {});
}

// links para mostrar: reaproveita os que ainda valem mais de 2 dias (assim a página da Lolis não muda à toa)
export async function linksAnexos(paths) {
  const agora = Date.now();
  const faltam = [...new Set(paths)].filter((p) => !(cache.get(p)?.ate > agora + 2 * 864e5));
  if (faltam.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(faltam, VALIDADE);
    for (const d of data || []) if (d.signedUrl) cache.set(d.path, { url: d.signedUrl, ate: agora + VALIDADE * 1000 });
  }
  return Object.fromEntries(paths.map((p) => [p, cache.get(p)?.url]).filter(([, u]) => u));
}
