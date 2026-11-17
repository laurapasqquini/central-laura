import { supabase } from './supabase';
import { addDays } from './dates';

// Tira a marca de "feito" que a Lolis fez na página dela (em qualquer dia da última semana),
// senão a central lê de novo e marca a tarefa como feita outra vez.
export async function desfazerMarcaLolis(token, chaves, ref) {
  if (!token) return;
  const { data } = await supabase.from('lolis_feitos').select('dia, chave').eq('token', token).in('chave', chaves).gte('dia', addDays(ref, -8));
  for (const r of data || []) await supabase.rpc('lolis_marcar', { p_token: token, p_dia: r.dia, p_chave: r.chave, p_feito: false });
}
