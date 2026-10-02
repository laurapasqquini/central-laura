import { createClient } from '@supabase/supabase-js';

// A chave "publishable" é pública por natureza: quem protege os dados é o RLS
// (cada linha só pode ser lida e escrita pela dona).
const URL = 'https://qkjqngddavxoqhnhbame.supabase.co';
const KEY = 'sb_publishable_FHjECY55Hpu0apsz2y-PHw_aBm6O4FJ';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
