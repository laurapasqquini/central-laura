import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate } from '../lib/engine';
import { today, addDays, fmtCurto, relativo } from '../lib/dates';
import { ItemRow, Section, Empty, TaskModal } from '../components/ui';

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

  // Texto pronto para mandar no WhatsApp da Lolis
  const msg = [
    `Oi Lolis! Lista de hoje (${fmtCurto(ref)}):`,
    ...late.map((x) => `⚠️ ${x.title} (era ${relativo(x.date, ref)})`),
    ...hoje.filter((x) => !x.done).map((x) => `• ${x.title}`),
    semana.length ? `\nPróximos dias:` : '',
    ...semana.map((x) => `• ${fmtCurto(x.date)}: ${x.title}`),
    semData.length ? `\nEm andamento:` : '',
    ...semData.map((x) => `• ${x.title}`),
    `\nQualquer dúvida me chama 💚`,
  ]
    .filter(Boolean)
    .join('\n');

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
