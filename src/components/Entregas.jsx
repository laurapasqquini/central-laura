import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today } from '../lib/dates';

// Entregas na casa dos atletas (ex.: troféus): a Lolis preenche endereço e bairro na página dela;
// a Laura acompanha na central e baixa a lista organizada por bairro. Os dados ficam no Supabase
// (tabela lolis_entregas, ver supabase/lolis-entregas.sql), nunca no código.

const telBonito = (t = '') => {
  const d = String(t).replace(/\D/g, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : t;
};
const completo = (e) => !!(e.endereco || '').trim() && !!(e.bairro || '').trim();

// ── Página da Lolis (pelo link) ──
export function EntregasLolis({ token }) {
  const [lista, setLista] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [so, setSo] = useState('faltam');
  useEffect(() => {
    supabase.rpc('lolis_entregas_ler', { p_token: token }).then(({ data, error }) => setLista(error ? null : data || []));
  }, [token]);
  if (!lista?.length) return null;
  const listas = [...new Set(lista.map((e) => e.lista))];
  const feitos = lista.filter(completo).length;
  const salvar = (e, patch) => {
    const novo = { ...e, ...patch };
    setLista((l) => l.map((x) => (x.id === e.id ? novo : x)));
    supabase.rpc('lolis_entregas_salvar', { p_token: token, p_id: e.id, p_endereco: novo.endereco || null, p_bairro: novo.bairro || null, p_obs: novo.obs || null, p_entregue: novo.entregue || null }).then(({ error }) => {
      if (error) alert('Não consegui salvar. Confira a internet e tente de novo.');
    });
  };
  const mostrar = lista.filter((e) => so === 'todos' || !completo(e));
  return (
    <section className="space-y-2">
      <button
        onClick={() => setAberto(!aberto)}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-sm ring-1 ${feitos === lista.length ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-300'}`}
      >
        <span className="text-xl">🏆</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-ink">Endereços para entrega · {listas.join(' · ')}</span>
          <span className="block text-xs text-slate-600">Chame cada atleta no WhatsApp, pergunte o endereço completo e preencha aqui. Salva sozinho.</span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
          {feitos} de {lista.length}
        </span>
        <span className="text-sm text-slate-400">{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div className="space-y-2">
          <div className="flex gap-1.5 text-xs">
            {[
              ['faltam', `Faltam (${lista.length - feitos})`],
              ['todos', `Todos (${lista.length})`],
            ].map(([v, r]) => (
              <button key={v} onClick={() => setSo(v)} className={`rounded-full px-3 py-1 font-semibold ring-1 ${so === v ? 'bg-ink text-white ring-ink' : 'bg-white text-slate-600 ring-slate-200'}`}>
                {r}
              </button>
            ))}
          </div>
          {!mostrar.length && <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">✓ Todos os endereços preenchidos!</p>}
          {mostrar.map((e) => (
            <LinhaEntrega key={e.id} e={e} salvar={salvar} />
          ))}
        </div>
      )}
    </section>
  );
}

function LinhaEntrega({ e, salvar }) {
  const [f, setF] = useState({ endereco: e.endereco || '', bairro: e.bairro || '', obs: e.obs || '' });
  const [copiado, setCopiado] = useState(false);
  const mudou = (k) => (f[k] || '') !== (e[k] || '');
  const sai = (k) => mudou(k) && salvar(e, { [k]: f[k].trim() });
  const ok = completo({ ...e, ...f });
  const d = String(e.telefone || '').replace(/\D/g, '');
  return (
    <div className={`space-y-2 rounded-xl bg-white p-3 shadow-sm ring-1 ${ok ? 'ring-emerald-200' : 'ring-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white ${ok ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>{ok ? '✓' : ''}</span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-800">
          {e.nome}
          <span className="block text-xs font-normal text-slate-500">
            {e.colocacao}º · {e.grupo} · Classe {e.classe}
          </span>
        </span>
        {d && (
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(d);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              } catch {
                prompt('Copie o número:', d);
              }
            }}
            className={`rounded-lg px-3 py-1 text-xs font-bold ring-1 ${copiado ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-emerald-700 ring-emerald-300'}`}
          >
            📱 {telBonito(e.telefone)} {copiado ? '✓' : '· copiar'}
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          placeholder="Rua, número, complemento (apto, casa, bloco)"
          value={f.endereco}
          onChange={(x) => setF({ ...f, endereco: x.target.value })}
          onBlur={() => sai('endereco')}
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          placeholder="Bairro"
          value={f.bairro}
          onChange={(x) => setF({ ...f, bairro: x.target.value })}
          onBlur={() => sai('bairro')}
        />
      </div>
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400"
        placeholder="Observação (melhor horário, ponto de referência, deixar na portaria…)"
        value={f.obs}
        onChange={(x) => setF({ ...f, obs: x.target.value })}
        onBlur={() => sai('obs')}
      />
    </div>
  );
}

// ── Central da Laura: andamento e lista por bairro ──
export function EntregasResumo() {
  const [lista, setLista] = useState(null);
  const [aberto, setAberto] = useState(false);
  const ler = () => supabase.from('lolis_entregas').select('*').order('ordem').then(({ data, error }) => setLista(error ? null : data || []));
  useEffect(() => {
    ler();
    const ch = supabase
      .channel(`entregas-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lolis_entregas' }, ler)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  if (!lista?.length) return null;
  const feitos = lista.filter(completo).length;
  const entregues = lista.filter((e) => e.entregue).length;
  const porBairro = {};
  for (const e of lista) (porBairro[completo(e) ? e.bairro.trim() : '— sem endereço ainda'] ||= []).push(e);
  const bairros = Object.keys(porBairro).sort((a, b) => (a.startsWith('—') ? 1 : b.startsWith('—') ? -1 : a.localeCompare(b)));
  const marcar = async (e) => {
    const entregue = e.entregue ? null : today();
    setLista((l) => l.map((x) => (x.id === e.id ? { ...x, entregue } : x)));
    await supabase.from('lolis_entregas').update({ entregue, atualizado_em: new Date().toISOString() }).eq('id', e.id);
  };
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <button onClick={() => setAberto(!aberto)} className="flex w-full items-center justify-between gap-2 text-left">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">
          🏆 Entregas <span className="normal-case text-slate-500">· {feitos} de {lista.length} com endereço · {entregues} entregues</span>
        </h2>
        <span className="text-xs font-semibold text-slate-500">{aberto ? 'fechar' : 'ver'}</span>
      </button>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${(feitos / lista.length) * 100}%` }} />
      </div>
      {aberto && (
        <div className="space-y-3">
          <button onClick={() => baixarPdf(lista, porBairro, bairros)} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">
            📄 Baixar a lista de entrega por bairro (PDF)
          </button>
          {bairros.map((b) => (
            <div key={b} className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {b} <span className="text-slate-400">{porBairro[b].length}</span>
              </div>
              {porBairro[b].map((e) => (
                <div key={e.id} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <button
                    onClick={() => marcar(e)}
                    title="Marcar como entregue"
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white ${e.entregue ? 'bg-emerald-500' : 'border-2 border-slate-300 bg-white'}`}
                  >
                    {e.entregue ? '✓' : ''}
                  </button>
                  <span className="min-w-0 flex-1">
                    <b className="text-slate-800">{e.nome}</b> <span className="text-xs text-slate-500">· {telBonito(e.telefone)}</span>
                    {e.endereco && <span className="block text-xs text-slate-600">{e.endereco}</span>}
                    {e.obs && <span className="block text-xs text-slate-400">📝 {e.obs}</span>}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function baixarPdf(lista, porBairro, bairros) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 36, azul = rgb(0.0745, 0.1608, 0.2039), cinza = rgb(0.45, 0.45, 0.45), linha = rgb(0.85, 0.87, 0.9);
  // Helvetica padrão não tem alguns caracteres: troca o que não der para escrever
  const txt = (s = '') => String(s).replace(/[^ -ÿ]/g, '');
  let page, y;
  const nova = () => {
    page = doc.addPage([W, H]);
    y = H - 44;
  };
  nova();
  page.drawText(txt(`Lista de entrega · ${[...new Set(lista.map((e) => e.lista))].join(' · ')}`), { x: M, y, size: 15, font: bold, color: azul });
  y -= 16;
  page.drawText(txt(`${lista.length} atletas · organizado por bairro · gerado em ${new Date().toLocaleDateString('pt-BR')}`), { x: M, y, size: 8.5, font: reg, color: cinza });
  y -= 22;
  for (const b of bairros) {
    if (y < 90) nova();
    page.drawText(txt(b.toUpperCase()), { x: M, y, size: 10.5, font: bold, color: azul });
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.8, color: azul });
    y -= 18;
    for (const e of porBairro[b]) {
      if (y < 60) nova();
      page.drawRectangle({ x: M, y: y - 9, width: 10, height: 10, borderColor: azul, borderWidth: 0.8 });
      page.drawText(txt(e.nome), { x: M + 18, y: y - 7, size: 9.5, font: bold, color: rgb(0.1, 0.1, 0.1) });
      page.drawText(txt(`${telBonito(e.telefone)} · ${e.colocacao}º ${e.grupo} · Classe ${e.classe}`), { x: M + 260, y: y - 7, size: 8, font: reg, color: cinza });
      y -= 13;
      if (e.endereco) {
        page.drawText(txt(e.endereco), { x: M + 18, y: y - 7, size: 9, font: reg, color: rgb(0.15, 0.15, 0.15) });
        y -= 12;
      }
      if (e.obs) {
        page.drawText(txt(`Obs.: ${e.obs}`), { x: M + 18, y: y - 7, size: 8, font: reg, color: cinza });
        y -= 12;
      }
      page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.4, color: linha });
      y -= 12;
    }
    y -= 6;
  }
  const blob = new Blob([await doc.save()], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Lista de entrega por bairro.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
