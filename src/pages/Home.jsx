import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate, suggestions, AREAS, folgaDe, isWorkday } from '../lib/engine';
import { today, addDays, fmtLongo, fmtCurto, relativo } from '../lib/dates';
import { ItemRow, Empty, QuickAdd, TaskModal, Segmented } from '../components/ui';
import { NotifBanner } from '../components/Notif';

const TONE_DOT = { red: 'bg-red-500', amber: 'bg-amber-500', violet: 'bg-violet-500', sky: 'bg-sky-500' };

// Um grupo dentro do bloco "Hoje"
function Grupo({ icone, titulo, conta, cor = 'text-slate-700', children }) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-wide ${cor}`}>
        <span className="text-base">{icone}</span>
        {titulo}
        {conta != null && <span className="font-semibold text-slate-400">{conta}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function Home({ go }) {
  const { state } = useStore();
  const [filter, setFilter] = useState({ area: 'all', who: 'all' });
  const [editing, setEditing] = useState(null);
  const [verRotinas, setVerRotinas] = useState(false);
  const [verDicas, setVerDicas] = useState(false);
  const ref = today();

  const overdue = buildOverdue(state, filter, ref);
  const hoje = buildDay(state, ref, filter);
  const marcos = hoje.filter((x) => x.kind === 'marco');
  // "melhores da rodada" e afins (vêm do calendário) contam como tarefa, não como rotina
  const ehTarefa = (x) => x.kind === 'task' || x.freq === 'calendario' || !!x.hora; // compromissos com horário também
  const prioridades = [...overdue, ...hoje.filter((x) => ehTarefa(x) && x.urgent && !x.done)];
  const idsPrioridade = new Set(prioridades.map((x) => x.key));
  const tarefas = hoje.filter((x) => ehTarefa(x) && !idsPrioridade.has(x.key));
  const rotinas = hoje.filter((x) => x.kind === 'routine' && !ehTarefa(x));
  const rotinasAbertas = rotinas.filter((x) => !x.done);
  const rotinasFeitas = rotinas.length - rotinasAbertas.length;

  const doable = hoje.filter((x) => x.kind !== 'marco');
  const feitos = doable.filter((x) => x.done).length;
  const pct = doable.length ? Math.round((feitos / doable.length) * 100) : 0;

  const next = Array.from({ length: 7 }, (_, i) => addDays(ref, i + 1)).map((d) => ({ d, items: buildDay(state, d, filter) }));
  const semData = noDate(state, filter);
  const dicas = suggestions(state, ref);
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const folgaHoje = !isWorkday(state, ref);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-slate-500 first-letter:uppercase">{fmtLongo(ref)}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{saud}, Laura</h1>
      </header>

      <NotifBanner onOpen={() => go?.('routines')} />
      <QuickAdd defaultArea={filter.area === 'all' ? 'ranken' : filter.area} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ---------------- HOJE ---------------- */}
        <section className="space-y-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-extrabold text-ink">Hoje</h2>
              <p className="text-sm font-medium text-slate-500">{folgaHoje ? `Folga: ${folgaDe(state, ref) || 'fim de semana'} 🌴` : `${feitos} de ${doable.length} feitos`}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={filter.area}
                onChange={(area) => setFilter((f) => ({ ...f, area }))}
                options={[['all', 'Tudo'], ...Object.entries(AREAS).map(([k, a]) => [k, a.label, `${a.bar} text-white ring-transparent`])]}
              />
              <span className="hidden h-5 w-px bg-slate-200 sm:block" />
              <Segmented
                value={filter.who}
                onChange={(who) => setFilter((f) => ({ ...f, who }))}
                options={[['all', 'Todos'], ['laura', 'Só eu'], ['lolis', '🙋 Lolis', 'bg-amber-500 text-white ring-transparent']]}
              />
            </div>
          </div>

          {marcos.length > 0 && (
            <Grupo icone="📌" titulo="Acontece hoje" cor="text-indigo-700">
              {marcos.map((x) => (
                <ItemRow key={x.key} item={x} />
              ))}
            </Grupo>
          )}

          {prioridades.length > 0 && (
            <Grupo icone="🔥" titulo="Resolver primeiro" conta={prioridades.length} cor="text-red-600">
              <div className="space-y-1.5 rounded-2xl bg-red-50/70 p-1.5 ring-1 ring-red-100">
                {prioridades.map((x) => (
                  <ItemRow key={x.key} item={x} onEdit={setEditing} />
                ))}
              </div>
            </Grupo>
          )}

          <Grupo icone="📝" titulo="Tarefas de hoje" conta={tarefas.filter((x) => !x.done).length}>
            {tarefas.length ? tarefas.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />) : <Empty>{folgaHoje ? 'Dia de folga. Aproveite! 🌴' : 'Nenhuma tarefa avulsa para hoje.'}</Empty>}
          </Grupo>

          {rotinas.length > 0 && (
            <Grupo icone="↻" titulo="Rotinas do dia" conta={`${rotinasFeitas}/${rotinas.length}`} cor="text-slate-500">
              {(verRotinas ? rotinasAbertas : rotinasAbertas.slice(0, 4)).map((x) => (
                <ItemRow key={x.key} item={x} onEdit={setEditing} />
              ))}
              {rotinasAbertas.length > 4 && (
                <button onClick={() => setVerRotinas(!verRotinas)} className="w-full rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-slate-500 hover:bg-slate-50">
                  {verRotinas ? 'mostrar menos' : `+ ${rotinasAbertas.length - 4} rotinas`}
                </button>
              )}
              {rotinasAbertas.length === 0 && <p className="px-1 text-sm font-medium text-emerald-600">Todas as rotinas de hoje feitas ✓</p>}
            </Grupo>
          )}

          {semData.length > 0 && (
            <Grupo icone="🗂️" titulo="Sem data" conta={semData.length} cor="text-slate-500">
              {semData.map((x) => (
                <ItemRow key={x.key} item={x} onEdit={setEditing} />
              ))}
            </Grupo>
          )}
        </section>

        {/* ---------------- DEPOIS ---------------- */}
        <aside className="space-y-5">
          {dicas.length > 0 && (
            <section className="space-y-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">💡 Atenção</h2>
              {(verDicas ? dicas : dicas.slice(0, 3)).map((t, i) => (
                <div key={i} className="flex gap-2.5 text-sm leading-snug text-slate-700">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} />
                  <span>{t.text}</span>
                </div>
              ))}
              {dicas.length > 3 && (
                <button onClick={() => setVerDicas(!verDicas)} className="text-xs font-semibold text-slate-500">
                  {verDicas ? 'mostrar menos' : `+ ${dicas.length - 3} avisos`}
                </button>
              )}
            </section>
          )}

          <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">Próximos dias</h2>
            {next.map(({ d, items }) => {
              const folga = !isWorkday(state, d);
              const ms = items.filter((x) => x.kind === 'marco');
              const ts = items.filter((x) => x.kind !== 'marco' && (x.kind === 'task' || x.freq === 'calendario' || x.hora) && !x.done);
              const nRot = items.filter((x) => x.kind === 'routine' && x.freq !== 'calendario' && !x.hora).length;
              return (
                <div key={d} className="space-y-1 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-bold capitalize ${folga ? 'text-slate-400' : 'text-slate-800'}`}>{relativo(d, ref)}</span>
                    <span className="text-xs text-slate-400">{fmtCurto(d)}</span>
                    {folga ? (
                      <span className="ml-auto rounded-full bg-violet-50 px-2 text-[11px] font-semibold text-violet-600">{folgaDe(state, d) || 'folga'}</span>
                    ) : (
                      nRot > 0 && <span className="ml-auto text-[11px] text-slate-400">↻ {nRot} rotinas</span>
                    )}
                  </div>
                  {ms.map((m) => (
                    <div key={m.key} className="text-xs font-medium text-indigo-700">📌 {m.title}</div>
                  ))}
                  {ts.map((x) => (
                    <button key={x.key} onClick={() => x.kind === 'task' && setEditing(x.id)} className="flex w-full items-start gap-2 text-left text-sm text-slate-700 hover:text-ink">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${AREAS[x.area].dot}`} />
                      <span className="min-w-0">
                        {x.title}
                        {x.who === 'lolis' && <span className="text-amber-600"> · 🙋 Lolis</span>}
                        {x.urgent && <span className="text-red-500"> · urgente</span>}
                      </span>
                    </button>
                  ))}
                  {!folga && !ms.length && !ts.length && <div className="text-xs text-slate-300">sem tarefas avulsas</div>}
                </div>
              );
            })}
          </section>
        </aside>
      </div>

      {editing && <TaskModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
