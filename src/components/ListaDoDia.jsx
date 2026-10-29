// Lista completa de uma frente (RANKEN, Gralha ou Pessoal): hoje, atrasadas, rotinas, sem data e próximos dias.
import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate, AREAS, folgaDe, isWorkday, ehPix, PIX_URGENTE_DIAS } from '../lib/engine';
import { today, addDays, fmtCurto, relativo } from '../lib/dates';
import { ItemRow, Empty, QuickAdd, TaskModal, Segmented } from './ui';

// de qual frente é cada aviso (pelo ícone); sem frente = aviso geral
const FRENTE_AVISO = { '💸': 'pessoal', '💜': 'pessoal', '🐦': 'gralha', '📣': 'ranken', '🙋': 'ranken', '🎉': 'ranken', '📅': 'ranken', '🚧': 'ranken' };
export const frenteDoAviso = (t) => FRENTE_AVISO[t.icon] || null;

// Um grupo dentro do bloco "Hoje"
function Grupo({ icone, titulo, conta, cor = 'text-slate-700', children }) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-wide ${cor}`}>
        {titulo}
        {conta != null && <span className="font-semibold text-slate-400">{conta}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function ListaDoDia({ area }) {
  const { state } = useStore();
  const [filter, setFilter] = useState({ area, who: 'laura' }); // começa no que é seu; Todos e Lolis ficam a um clique
  const [editing, setEditing] = useState(null);
  const [verFeitos, setVerFeitos] = useState(false);
  const [verPix, setVerPix] = useState(false);
  const ref = today();

  const overdue = buildOverdue(state, filter, ref);
  const hoje = buildDay(state, ref, filter);
  const marcos = hoje.filter((x) => x.kind === 'marco');
  // "melhores da rodada" e afins (vêm do calendário) contam como tarefa, não como rotina
  const ehTarefa = (x) => x.kind === 'task' || x.freq === 'calendario' || !!x.hora || !!x.mensagem; // compromissos com horário também
  // cobranças Pix ficam juntas num bloco só (uma linha por atleta, com a mensagem pronta)
  const pix = [...overdue, ...hoje].filter((x) => ehPix(x) && !x.done);
  const prioridades = [...overdue, ...hoje.filter((x) => ehTarefa(x) && x.urgent && !x.done)].filter((x) => !ehPix(x));
  const idsPrioridade = new Set([...prioridades, ...pix].map((x) => x.key));
  const tarefas = hoje.filter((x) => ehTarefa(x) && !idsPrioridade.has(x.key) && !(ehPix(x) && !x.done));
  const rotinas = hoje.filter((x) => x.kind === 'routine' && !ehTarefa(x));
  const paraFazer = [...tarefas, ...rotinas];
  const feitosLista = paraFazer.filter((x) => x.done);

  const doable = hoje.filter((x) => x.kind !== 'marco');
  const feitos = doable.filter((x) => x.done).length;
  const pct = doable.length ? Math.round((feitos / doable.length) * 100) : 0;

  const next = Array.from({ length: 7 }, (_, i) => addDays(ref, i + 1)).map((d) => ({ d, items: buildDay(state, d, filter) }));
  const semData = noDate(state, filter);
  const folgaHoje = !isWorkday(state, ref);

  return (
    <div className="space-y-5">
      <QuickAdd defaultArea={area} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ---------------- HOJE ---------------- */}
        <section className="space-y-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold text-ink">Hoje</h2>
              <p className="text-sm font-medium text-slate-500">{folgaHoje ? `Folga: ${folgaDe(state, ref) || 'fim de semana'} 🌴` : `${feitos} de ${doable.length} feitos`}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-700 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {/* a Gralha é só da Laura: sem filtro de Lolis */}
            {area !== 'gralha' && (
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  value={filter.who}
                  onChange={(who) => setFilter((f) => ({ ...f, who }))}
                  options={[['all', 'Todos'], ['laura', 'Só eu'], ['lolis', 'Lolis', 'bg-amber-500 text-white ring-transparent']]}
                />
              </div>
            )}
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
              <div className="space-y-1.5 rounded-lg bg-red-50/70 p-1.5 ring-1 ring-red-100">
                {prioridades.map((x) => (
                  <ItemRow key={x.key} item={x} onEdit={setEditing} />
                ))}
              </div>
            </Grupo>
          )}

          {pix.length > 0 && (
            <Grupo icone="💰" titulo="Cobranças Pix" conta={pix.length} cor="text-emerald-700">
              <button onClick={() => setVerPix(!verPix)} className="flex w-full items-center justify-between rounded-xl bg-emerald-50/70 px-3 py-2.5 text-left text-sm ring-1 ring-emerald-100 hover:ring-emerald-200">
                <span className="text-slate-700">
                  {pix.length} {pix.length === 1 ? 'atleta' : 'atletas'} para cobrar
                  {pix.some((x) => x.urgent) && <span className="font-semibold text-red-600"> · {pix.filter((x) => x.urgent).length} vencida{pix.filter((x) => x.urgent).length > 1 ? 's' : ''} há mais de {PIX_URGENTE_DIAS} dias</span>}
                </span>
                <span className="text-xs font-semibold text-emerald-700">{verPix ? 'esconder' : 'abrir e cobrar'}</span>
              </button>
              {verPix && pix.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}
            </Grupo>
          )}

          {/* uma lista só: tarefas avulsas, depois rotinas (com a etiqueta ↻ rotina); as feitas descem pro fim */}
          <Grupo icone="📝" titulo="Para fazer" conta={paraFazer.filter((x) => !x.done).length}>
            {paraFazer.length ? (
              <>
                {paraFazer.filter((x) => !x.done).map((x) => (
                  <ItemRow key={x.key} item={x} onEdit={setEditing} />
                ))}
                {feitosLista.length > 0 && (
                  <button onClick={() => setVerFeitos(!verFeitos)} className="w-full rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-emerald-600 hover:bg-slate-50">
                    ✓ {feitosLista.length} {feitosLista.length === 1 ? 'feita' : 'feitas'} hoje {verFeitos ? '· esconder' : '· ver'}
                  </button>
                )}
                {verFeitos && feitosLista.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}
              </>
            ) : (
              <Empty>{folgaHoje ? 'Dia de folga. Aproveite! 🌴' : 'Nada para hoje.'}</Empty>
            )}
          </Grupo>

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
          {/* os avisos (Atenção) ficam só no Início, para não repetir */}
          <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
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
                    <div key={m.key} className="text-sm font-medium text-indigo-700">{m.title}</div>
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
