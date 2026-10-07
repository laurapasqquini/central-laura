import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate, mensagemLolis } from '../lib/engine';
import { today, addDays } from '../lib/dates';
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
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Lolis</h1>
          <p className="text-sm text-slate-500">Tudo o que está delegado. Para delegar, escreva <b>@lolis</b> na anotação rápida. O que ela fez vai em <b>📊 Relatórios</b>.</p>
        </div>
        <button onClick={copy} className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm">
          {copied ? 'Copiado ✓' : 'Copiar lista pro WhatsApp'}
        </button>
      </header>

      <LinkLolis />

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

// Link da Página da Lolis (sem login): ela vê só o dia dela, com um Copiar em cada mensagem
function LinkLolis() {
  const { state, novoLinkLolis } = useStore();
  const [ok, setOk] = useState(false);
  const link = state.lolisToken ? `${location.origin}${import.meta.env.BASE_URL}#lolis=${state.lolisToken}` : '';
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      prompt('Copie o link:', link);
    }
  };
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">🔗 Página da Lolis</h2>
      <p className="text-sm text-slate-500">Um link só dela, sem login: as tarefas do dia, os lembretes de brinde e os posts do sorteio, cada mensagem com o seu botão Copiar. Atualiza sozinho quando a central salva.</p>
      {link ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{link}</code>
          <button onClick={copiar} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">{ok ? 'Copiado ✓' : 'Copiar link'}</button>
          <a href={link} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Abrir</a>
          <button onClick={() => confirm('Criar um link novo? O link atual para de funcionar.') && novoLinkLolis()} className="text-xs font-semibold text-slate-400 hover:text-red-500">
            trocar link
          </button>
        </div>
      ) : (
        <button onClick={novoLinkLolis} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Criar o link da Lolis</button>
      )}
    </section>
  );
}
