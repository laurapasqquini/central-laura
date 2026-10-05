import { useEffect, useMemo, useState } from 'react';
import { useStore, STAGES } from '../lib/store';
import { brl, priceFor, search, searchMany, detalhe, totals, mensagem, mensagemTabela, faixasLabel, isMaringa } from '../lib/gralha';
import { fmtCurto, relativo, today } from '../lib/dates';
import { inputCls, Empty, Pill, Segmented } from '../components/ui';

// O catálogo (242 produtos) só carrega quando a aba é aberta.
function useCatalogo() {
  const [cat, setCat] = useState(null);
  useEffect(() => {
    import('../data/gralha.json').then((m) => setCat(m.default));
  }, []);
  return cat;
}

export default function Gralha() {
  const cat = useCatalogo();
  const [view, setView] = useState('novo');
  const { state } = useStore();
  const abertos = (state.pedidos || []).filter((p) => !['contrato', 'perdido'].includes(p.stage)).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">🐦 Gralha Azul</h1>
          <p className="text-sm text-slate-500">
            Orçamento em segundos e cada pedido acompanhado até o contrato.
            {cat && <span className="text-slate-400"> · {cat.produtos.length} produtos da planilha</span>}
          </p>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            ['novo', '+ Novo orçamento', 'bg-sky-500 text-white ring-transparent'],
            ['pedidos', `Pedidos${abertos ? ` (${abertos})` : ''}`, 'bg-sky-500 text-white ring-transparent'],
          ]}
        />
      </header>
      {!cat ? <Empty>Carregando catálogo…</Empty> : view === 'novo' ? <Novo cat={cat} onSaved={() => setView('pedidos')} /> : <Pedidos cat={cat} />}
    </div>
  );
}

function Novo({ cat, onSaved }) {
  const { addPedido } = useStore();
  const [q, setQ] = useState('');
  const [aba, setAba] = useState('');
  const [modo, setModo] = useState('qtd'); // qtd | tabela
  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState('');
  const [cidade, setCidade] = useState('');
  const [frete, setFrete] = useState('');
  const [copied, setCopied] = useState(false);
  const abas = useMemo(() => [...new Set(cat.produtos.map((p) => p.aba))], [cat]);
  const groups = useMemo(() => {
    if (q.trim()) return searchMany(cat.produtos, q, aba).map((g) => ({ ...g, results: g.results.slice(0, 12) }));
    return aba ? [{ termo: '', results: search(cat.produtos, '', aba) }] : [];
  }, [cat, q, aba]);
  const added = new Set(itens.map((i) => i.prodId));

  const freteNum = isMaringa(cidade) ? 0 : parseFloat(String(frete).replace(',', '.')) || 0;
  const { linhas, produtosTotal, total, aVista } = totals(itens, cat.produtos, freteNum);
  const tabela = modo === 'tabela';
  const msg = !itens.length ? '' : tabela ? mensagemTabela({ cliente, cidade, itens, produtos: cat.produtos }) : mensagem({ cliente, cidade, itens, produtos: cat.produtos, frete: freteNum });

  const add = (p) => {
    setItens((xs) => [...xs, { key: crypto.randomUUID().slice(0, 6), prodId: p.id, qtd: Math.max(p.minimo || 1, 1) }]);
  };
  const setQtd = (key, qtd) => setItens((xs) => xs.map((x) => (x.key === key ? { ...x, qtd: Math.max(1, qtd || 1) } : x)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copie a mensagem:', msg);
    }
  };

  const salvar = () => {
    addPedido({ cliente: cliente.trim() || 'Cliente sem nome', cidade, tipo: modo, itens: itens.map(({ prodId, qtd }) => ({ prodId, qtd })), frete: freteNum, total: tabela ? null : total, mensagem: msg });
    onSaved();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <Segmented
          value={modo}
          onChange={setModo}
          options={[
            ['qtd', 'Com quantidade', 'bg-ink text-white ring-ink'],
            ['tabela', 'Só tabela de preços', 'bg-ink text-white ring-ink'],
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} placeholder="Cliente (ex.: Medicina UEM 2027)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input className={inputCls} placeholder="Cidade de entrega" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </div>

        <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <input autoFocus className={inputCls} placeholder="Buscar… vários de uma vez com vírgula: camiseta algodão, samba, body" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {abas.map((a) => (
              <button
                key={a}
                onClick={() => setAba(aba === a ? '' : a)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${aba === a ? 'bg-sky-500 text-white ring-transparent' : 'bg-white text-slate-500 ring-slate-200'}`}
              >
                {a.replace(/\s+/g, ' ').toLowerCase()}
              </button>
            ))}
          </div>
          {groups.length > 0 && (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {groups.map((g) => (
                <div key={g.termo} className="space-y-1">
                  {groups.length > 1 && <div className="px-2 text-xs font-bold uppercase tracking-wide text-sky-600">{g.termo}</div>}
                  {!g.results.length && <p className="px-2 text-sm text-slate-400">Nada encontrado.</p>}
                  {g.results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => !added.has(p.id) && add(p)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ${added.has(p.id) ? 'bg-sky-50' : 'hover:bg-sky-50'}`}
                    >
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-semibold text-slate-800">{added.has(p.id) && '✓ '}{p.nome}</div>
                        <div className="truncate text-xs text-slate-500">{detalhe(p) || p.aba}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        a partir de <b className="text-slate-700">{brl(Math.min(...p.faixas.map((f) => f.preco)))}</b>
                        <div>mín. {p.minimo}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

        </div>

        {linhas.map((l) => {
          const { proxima, abaixoMinimo } = priceFor(l.p, l.qtd);
          return (
            <div key={l.key} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800">{l.p.nome}</div>
                  <div className="text-xs text-slate-500">{detalhe(l.p)}{l.p.prazo && ` · prazo ${l.p.prazo}`}</div>
                </div>
                <button onClick={() => setItens((xs) => xs.filter((x) => x.key !== l.key))} className="text-xl leading-none text-slate-300 hover:text-red-500">×</button>
              </div>
              {tabela ? (
                <div className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                  {faixasLabel(l.p).map((f) => (
                    <div key={f.label} className="flex justify-between"><span className="text-slate-500">{f.label}</span><b className="text-slate-700">{brl(f.preco)}</b></div>
                  ))}
                </div>
              ) : (
              <>
              <div className="flex items-center gap-3">
                <input type="number" min="1" className={`${inputCls} w-24`} value={l.qtd} onChange={(e) => setQtd(l.key, parseInt(e.target.value, 10))} />
                <span className="text-sm text-slate-500">× {brl(l.unit)}</span>
                <span className="ml-auto font-extrabold text-ink">{brl(l.subtotal)}</span>
              </div>
              {abaixoMinimo && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">Abaixo do pedido mínimo ({l.p.minimo} peças).</p>}
              {proxima && !abaixoMinimo && (
                <p className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  💡 Com <b>{proxima.min - l.qtd}</b> peças a mais ({proxima.min}), cai para <b>{brl(proxima.preco)}</b> cada.
                </p>
              )}
              </>
              )}
            </div>
          );
        })}

        {itens.length > 0 && !tabela && (
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Frete</span>
              {isMaringa(cidade) ? (
                <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">grátis (Maringá)</Pill>
              ) : (
                <input className={`${inputCls} w-36 text-right`} placeholder="R$ (opcional)" value={frete} onChange={(e) => setFrete(e.target.value)} />
              )}
            </div>
            <Row label="Produtos" value={brl(produtosTotal)} />
            <Row label="Total" value={brl(total)} strong />
            <Row label="À vista (5% off nos produtos)" value={brl(aVista)} />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">Mensagem pro WhatsApp</h2>
        {msg ? (
          <>
            <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#e7ffdb] p-4 font-sans text-sm text-slate-800 shadow-sm ring-1 ring-emerald-100">{msg}</pre>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copy} className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white">{copied ? 'Copiado ✓' : 'Copiar mensagem'}</button>
              <button onClick={salvar} className="rounded-xl bg-ink py-3 text-sm font-bold text-white">Salvar e acompanhar</button>
            </div>
            <p className="px-1 text-xs text-slate-400">"Salvar e acompanhar" coloca o pedido no funil e cria o follow-up em 2 dias.</p>
          </>
        ) : (
          <Empty>Busque e adicione produtos. A mensagem aparece aqui, pronta para colar.</Empty>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value, strong }) => (
  <div className={`flex justify-between text-sm ${strong ? 'text-base font-extrabold text-ink' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

function Pedidos() {
  const { state, moveStage, deletePedido } = useStore();
  const [open, setOpen] = useState(null);
  const pedidos = state.pedidos || [];
  if (!pedidos.length) return <Empty>Nenhum pedido ainda. Faça um orçamento e clique em "Salvar e acompanhar".</Empty>;

  return (
    <div className="space-y-6">
      {STAGES.map((st) => {
        const list = pedidos.filter((p) => p.stage === st.id);
        if (!list.length) return null;
        return (
          <section key={st.id} className="space-y-2">
            <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">
              {st.label} <span className="text-slate-400">{list.length}</span>
            </h2>
            {list.map((p) => {
              const since = p.history?.at(-1)?.date || p.createdAt;
              const idx = STAGES.findIndex((x) => x.id === p.stage);
              const next = STAGES[idx + 1];
              return (
                <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setOpen(open === p.id ? null : p.id)} className="min-w-0 text-left">
                      <div className="font-bold text-slate-800">{p.cliente}</div>
                      <div className="text-xs text-slate-500">
                        {p.total == null ? 'tabela de preços' : brl(p.total)} · {p.itens.length} {p.itens.length > 1 ? 'itens' : 'item'}
                        {p.cidade && ` · ${p.cidade}`} · nesta etapa desde {since === today() ? 'hoje' : relativo(since)}
                      </div>
                    </button>
                    <span className="shrink-0 text-xs text-slate-400">{fmtCurto(p.createdAt)}</span>
                  </div>
                  {!['contrato', 'perdido'].includes(p.stage) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {next && next.id !== 'perdido' && (
                        <button onClick={() => moveStage(p.id, next.id)} className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white">
                          → {next.label}
                        </button>
                      )}
                      <button onClick={() => moveStage(p.id, 'perdido')} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
                        Perdido
                      </button>
                    </div>
                  )}
                  {['contrato', 'perdido'].includes(p.stage) && (
                    <div className="mt-3">
                      {/* volta para a etapa anterior (ex.: clicou em "Perdido" sem querer) */}
                      <button
                        onClick={() => moveStage(p.id, [...(p.history || [])].reverse().find((h) => h.stage !== p.stage)?.stage || 'enviado')}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-600 ring-1 ring-sky-200"
                      >
                        ↩ Reabrir
                      </button>
                    </div>
                  )}
                  {open === p.id && (
                    <div className="mt-3 space-y-2">
                      <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-xs text-slate-700">{p.mensagem}</pre>
                      <button onClick={() => confirm(`Excluir o pedido de ${p.cliente}?`) && deletePedido(p.id)} className="text-xs font-semibold text-red-500">
                        Excluir pedido
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
