import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate, mensagemLolis } from '../lib/engine';
import { today, addDays, fmtCurto, relativo } from '../lib/dates';
import { ItemRow, Section, Empty, TaskModal, inputCls } from '../components/ui';

export default function Lolis() {
  const { state } = useStore();
  const [editing, setEditing] = useState(null);
  const [copied, setCopied] = useState(false);
  const f = { area: 'all', who: 'lolis' };
  const ref = today();
  const late = buildOverdue(state, f, ref);
  const hoje = buildDay(state, ref, f).filter((x) => x.kind !== 'marco');
  const semData = noDate(state, f);
  const semana = Array.from({ length: 6 }, (_, i) => addDays(ref, i + 1)).flatMap((d) => buildDay(state, d, f).filter((x) => x.kind === 'task'));
  const msg = mensagemLolis(state, ref);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copie a mensagem:', msg);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">🙋 Lolis</h1>
          <p className="text-sm text-slate-500">Tudo o que está delegado. Para delegar, escreva <b>@lolis</b> na anotação rápida.</p>
        </div>
        <button onClick={copy} className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm">
          {copied ? 'Copiado ✓' : 'Copiar lista pro WhatsApp'}
        </button>
      </header>

      <Relatos />

      {late.length > 0 && (
        <Section title="Atrasadas: cobrar retorno" count={late.length} tone="red">
          <div className="space-y-1.5 rounded-2xl bg-red-50/60 p-2 ring-1 ring-red-100">{late.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}</div>
        </Section>
      )}
      <Section title="Hoje" count={hoje.filter((x) => !x.done).length}>
        <div className="space-y-1.5">{hoje.length ? hoje.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />) : <Empty>Nada delegado para hoje.</Empty>}</div>
      </Section>
      <Section title="Próximos dias" count={semana.length} tone="indigo">
        <div className="space-y-1.5">{semana.length ? semana.map((x) => <ItemRow key={x.key} item={x} showDate onEdit={setEditing} />) : <Empty>Sem tarefas avulsas nos próximos dias.</Empty>}</div>
      </Section>

      {semData.length > 0 && (
        <Section title="Em andamento (sem data)" count={semData.length}>
          <div className="space-y-1.5">{semData.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}</div>
        </Section>
      )}

      {editing && <TaskModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// O que a Lolis fez: ela manda no WhatsApp, a Laura cola aqui e fica o histórico por dia.
function Relatos() {
  const { state, setRelatoLolis } = useStore();
  const ref = today();
  const relatos = state.relatosLolis || {};
  const [data, setData] = useState(ref);
  const [texto, setTexto] = useState(relatos[ref] || '');
  const [salvo, setSalvo] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const dias = Object.keys(relatos).sort().reverse();

  const trocarData = (d) => {
    setData(d);
    setTexto(relatos[d] || '');
  };
  const salvar = () => {
    setRelatoLolis(data, texto);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  };

  return (
    <Section title="📋 O que a Lolis fez" count={dias.length || null}>
      <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Relatório de
          <input type="date" className={`${inputCls} w-40`} value={data} onChange={(e) => trocarData(e.target.value || ref)} />
          {relatos[data] && <span className="text-xs font-semibold text-emerald-600">✓ já tem relatório neste dia</span>}
        </div>
        <textarea rows={5} className={inputCls} placeholder="Cole aqui o que a Lolis mandou no WhatsApp…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button onClick={salvar} disabled={texto.trim() === (relatos[data] || '')} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {salvo ? 'Salvo ✓' : 'Salvar relatório'}
        </button>
      </div>
      {dias.length > 0 && (
        <div className="space-y-2">
          {(verTodos ? dias : dias.slice(0, 3)).map((d) => (
            <details key={d} className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70" open={d === dias[0]}>
              <summary className="cursor-pointer text-sm font-semibold capitalize text-slate-700">
                {relativo(d, ref)} <span className="font-normal normal-case text-slate-400">· {fmtCurto(d)}</span>
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">{relatos[d]}</pre>
              <button onClick={() => trocarData(d)} className="mt-1 text-xs font-semibold text-amber-600">editar</button>
            </details>
          ))}
          {dias.length > 3 && (
            <button onClick={() => setVerTodos((v) => !v)} className="px-1 text-xs font-semibold text-slate-500">
              {verTodos ? 'Ver menos' : `Ver todos (${dias.length})`}
            </button>
          )}
        </div>
      )}
    </Section>
  );
}
