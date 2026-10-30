import { useState } from 'react';
import { useStore } from '../lib/store';
import { fmtCurto } from '../lib/dates';
import { Empty, inputCls } from './ui';

// Lista "Acabou? Puxa daqui": o que a Lolis pega quando termina o do dia, em ordem de prioridade.
// Contínua (🔁) fica sempre; as de uma vez saem quando ela marca como feita (e vão para Concluídas).
export default function BancoLolis() {
  const { state, setLolisBanco } = useStore();
  const [novo, setNovo] = useState({ titulo: '', detalhe: '', continua: false });
  const [editando, setEditando] = useState(null);
  const [verFeitas, setVerFeitas] = useState(false);
  const lista = state.lolisBanco || [];
  const abertas = lista.filter((b) => !b.feitoEm);
  const feitas = lista.filter((b) => b.feitoEm);
  // o que ela escreveu ao marcar (últimos 7 dias)
  const registros = (id) =>
    Object.entries(state.lolisNotas || {})
      .filter(([, n]) => n[`b:${id}`])
      .map(([dia, n]) => ({ dia, ...n[`b:${id}`] }))
      .sort((a, b) => b.dia.localeCompare(a.dia));
  const mudar = (id, patch) => setLolisBanco((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const mover = (id, d) =>
    setLolisBanco((l) => {
      const ab = l.filter((b) => !b.feitoEm);
      const i = ab.findIndex((b) => b.id === id);
      const j = i + d;
      if (j < 0 || j >= ab.length) return l;
      [ab[i], ab[j]] = [ab[j], ab[i]];
      return [...ab, ...l.filter((b) => b.feitoEm)];
    });
  const adicionar = () => {
    if (!novo.titulo.trim()) return;
    setLolisBanco((l) => [...l, { id: crypto.randomUUID().slice(0, 8), titulo: novo.titulo.trim(), detalhe: novo.detalhe.trim(), continua: novo.continua, ativo: true }]);
    setNovo({ titulo: '', detalhe: '', continua: false });
  };
  const botao = 'rounded px-1.5 py-0.5 text-slate-400 ring-1 ring-slate-200';

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Tarefas extras que ela pode puxar pra hoje na aba <b>Acabou? Puxa daqui</b> da página dela (grupo Outras). As cidades novas entram sozinhas, vindas do Hub. <b>🔁 Contínua</b> volta todo dia; as outras saem quando ela marca como feita.
      </p>
      <section className="space-y-2">
        {abertas.map((b, i) => {
          const regs = registros(b.id);
          return (
            <div key={b.id} className={`rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 ${b.ativo === false ? 'opacity-50' : ''}`}>
              {editando === b.id ? (
                <div className="space-y-2">
                  <input className={inputCls} value={b.titulo} onChange={(e) => mudar(b.id, { titulo: e.target.value })} />
                  <textarea rows={2} className={inputCls} value={b.detalhe || ''} placeholder="Como fazer (opcional)" onChange={(e) => mudar(b.id, { detalhe: e.target.value })} />
                  <button onClick={() => setEditando(null)} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white">
                    Pronto
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-start gap-2">
                  <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-bold text-amber-600">{i + 1}</span>
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="text-[15px] font-semibold text-slate-800">
                      {b.titulo} {b.continua && <span title="Contínua: fica sempre na lista">🔁</span>}
                      {b.ativo === false && <span className="ml-1 text-xs font-normal text-slate-400">(pausada: ela não vê)</span>}
                    </div>
                    {b.detalhe && <div className="text-xs text-slate-500">{b.detalhe}</div>}
                    {regs.map((r) => (
                      <div key={r.dia} className={`mt-1 text-xs ${r.status === 'nao' ? 'text-red-600' : 'text-emerald-700'}`}>
                        {r.status === 'nao' ? '✕' : '✓'} {fmtCurto(r.dia)}
                        {r.nota ? `: ${r.nota}` : ''}
                      </div>
                    ))}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1 text-xs">
                    <button onClick={() => mover(b.id, -1)} className={botao} aria-label="Subir">
                      ▲
                    </button>
                    <button onClick={() => mover(b.id, 1)} className={botao} aria-label="Descer">
                      ▼
                    </button>
                    <button
                      onClick={() => mudar(b.id, { continua: !b.continua })}
                      className={b.continua ? 'rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-amber-200' : botao}
                      title="Contínua: fica sempre na lista"
                    >
                      🔁
                    </button>
                    <button onClick={() => mudar(b.id, { ativo: b.ativo === false })} className={botao}>
                      {b.ativo === false ? 'retomar' : 'pausar'}
                    </button>
                    <button onClick={() => setEditando(b.id)} className={botao} aria-label="Editar">
                      ✏️
                    </button>
                    <button onClick={() => confirm(`Apagar "${b.titulo}"?`) && setLolisBanco((l) => l.filter((x) => x.id !== b.id))} className={`${botao} hover:text-red-500`} aria-label="Apagar">
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!abertas.length && <Empty>A lista está vazia: adicione abaixo o que ela pode puxar quando acabar o do dia.</Empty>}
      </section>

      <section className="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">+ Adicionar</h2>
        <input
          className={inputCls}
          placeholder="O que ela pode fazer (ex.: Cascavel: listar as academias com quadra)"
          value={novo.titulo}
          onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        />
        <textarea rows={2} className={inputCls} placeholder="Como fazer / onde anotar (opcional)" value={novo.detalhe} onChange={(e) => setNovo({ ...novo, detalhe: e.target.value })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={novo.continua} onChange={(e) => setNovo({ ...novo, continua: e.target.checked })} />
            🔁 Contínua (fica sempre na lista)
          </label>
          <button onClick={adicionar} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">
            Adicionar
          </button>
        </div>
      </section>

      {feitas.length > 0 && (
        <section className="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <button onClick={() => setVerFeitas(!verFeitas)} className="flex w-full items-center justify-between text-left">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">
              ✓ Concluídas <span className="text-slate-400">{feitas.length}</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">{verFeitas ? 'esconder' : 'ver'}</span>
          </button>
          {verFeitas &&
            feitas.map((b) => (
              <div key={b.id} className="flex items-start gap-2 text-sm">
                <span className="w-14 shrink-0 text-xs text-slate-400">{fmtCurto(b.feitoEm).replace(/^\w+, /, '')}</span>
                <span className="min-w-0 flex-1 text-slate-700">
                  {b.titulo}
                  {registros(b.id)[0]?.nota && <span className="block text-xs text-slate-500">📝 {registros(b.id)[0].nota}</span>}
                </span>
                <button onClick={() => mudar(b.id, { feitoEm: undefined })} className="shrink-0 text-xs font-semibold text-amber-700">
                  ↩ voltar pra lista
                </button>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
