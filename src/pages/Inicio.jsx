// Início: painel curto do dia. O foco de agora (3 coisas), um cartão por frente, a Lolis e os próximos marcos.
// A lista completa de cada frente fica na aba dela (RANKEN, Gralha, Pessoal).
import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, suggestions, pedidosParados, contasDoDia, isWorkday, folgaDe, ehPix } from '../lib/engine';
import { cfgComissao, comissaoDe, dataFechamento } from '../lib/gralha';
import { today, addDays, fmtLongo, fmtCurto, relativo } from '../lib/dates';
import { ItemRow, QuickAdd, TaskModal } from '../components/ui';
import { NotifBanner } from '../components/Notif';
import { frenteDoAviso } from '../components/ListaDoDia';
import { AvisoPontoLolis, LinhaPontoLolis } from '../components/PontoLolis';

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const TONE_DOT = { red: 'bg-red-500', amber: 'bg-amber-500', violet: 'bg-violet-500', sky: 'bg-sky-500' };
// "melhores da rodada", compromissos com horário e mensagens prontas contam como tarefa
const ehTarefa = (x) => x.kind === 'task' || x.freq === 'calendario' || !!x.hora || !!x.mensagem;

export default function Inicio({ go }) {
  const { state, addTask } = useStore();
  const [editing, setEditing] = useState(null);
  const [verDicas, setVerDicas] = useState(false);
  const ref = today();
  const todos = { area: 'all', who: 'all' };
  const minha = (x) => x.who !== 'lolis';

  const atrasadas = buildOverdue(state, todos, ref).filter(minha);
  const hoje = buildDay(state, ref, todos).filter((x) => x.kind !== 'marco');
  const meusHoje = hoje.filter(minha);
  const parados = pedidosParados(state, ref);

  // Foco de agora: atrasadas (mais antigas primeiro), depois urgentes de hoje, depois pedido parado da Gralha
  // as cobranças Pix entram como uma linha só ("4 cobranças Pix"), para não tomarem o foco inteiro
  const urgentesHoje = meusHoje.filter((x) => ehTarefa(x) && x.urgent && !x.done && !ehPix(x));
  const pixAbertos = [...atrasadas, ...meusHoje].filter((x) => ehPix(x) && !x.done);
  const foco = [...atrasadas.filter((x) => !ehPix(x)), ...urgentesHoje].slice(0, pixAbertos.length ? 2 : 3);
  const focoParados = parados.slice(0, Math.max(0, 3 - foco.length - (pixAbertos.length ? 1 : 0)));
  const resto = atrasadas.filter((x) => !ehPix(x)).length + urgentesHoje.length - foco.length;

  // um cartão por frente
  const frente = (area) => {
    const abertas = meusHoje.filter((x) => x.area === area && ehTarefa(x) && !x.done).length;
    const atr = atrasadas.filter((x) => x.area === area).length;
    const urg = meusHoje.filter((x) => x.area === area && x.urgent && !x.done).length;
    return { abertas, atr, urg };
  };
  const rk = frente('ranken');
  const gr = frente('gralha');
  const ps = frente('pessoal');

  const pedidos = state.pedidos || [];
  const cfg = cfgComissao(state);
  const mes = ref.slice(0, 7);
  const comissaoMes = pedidos.filter((p) => p.stage !== 'perdido' && (dataFechamento(p) || '').startsWith(mes)).reduce((s, p) => s + comissaoDe(p, cfg), 0);
  const pedidosAbertos = pedidos.filter((p) => !['contrato', 'perdido'].includes(p.stage)).length;
  const contasSemana = Array.from({ length: 7 }, (_, i) => addDays(ref, i)).flatMap((d) => contasDoDia(state, d)).filter((x) => !x.done);

  // Lolis hoje
  const lolis = buildDay(state, ref, { area: 'all', who: 'lolis' }).filter((x) => x.kind !== 'marco');
  const lolisFeitos = lolis.filter((x) => x.done).length;

  // próximos marcos (7 dias)
  const proximos = Array.from({ length: 7 }, (_, i) => addDays(ref, i + 1))
    .map((d) => ({ d, ms: buildDay(state, d, todos).filter((x) => x.kind === 'marco'), folga: !isWorkday(state, d) && folgaDe(state, d) }))
    .filter((x) => x.ms.length || x.folga);

  const dicas = suggestions(state, ref).sort((a, b) => Number(!!frenteDoAviso(a)) - Number(!!frenteDoAviso(b)));
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const feitosHoje = meusHoje.filter((x) => x.done).length;
  const pct = meusHoje.length ? Math.round((feitosHoje / meusHoje.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 first-letter:uppercase">{fmtLongo(ref)}</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{saud}, Laura</h1>
        </div>
        {meusHoje.length > 0 && (
          <div className="w-40 space-y-1 text-right">
            <div className="text-xs font-medium text-slate-500">{feitosHoje} de {meusHoje.length} feitos hoje</div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </header>

      <NotifBanner onOpen={() => go?.('routines')} />
      <QuickAdd defaultArea="ranken" />
      <AvisoPontoLolis />

      {/* ---------- Foco de agora ---------- */}
      <section className="space-y-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">🎯 Foco de agora</h2>
          {resto > 0 && (
            <button onClick={() => go?.('ranken')} className="text-xs font-semibold text-slate-500 hover:text-ink">
              + {resto} na lista →
            </button>
          )}
        </div>
        {foco.length || focoParados.length || pixAbertos.length ? (
          <div className="space-y-1.5">
            {foco.map((x) => (
              <ItemRow key={x.key} item={x} showDate onEdit={setEditing} />
            ))}
            {pixAbertos.length > 0 && (
              <button onClick={() => go?.('ranken')} className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-slate-200/70 hover:ring-slate-300">
                <span className="h-6 w-1 shrink-0 rounded-full bg-emerald-500" />
                <span className="min-w-0 flex-1 text-[15px] font-medium text-slate-800">
                  💰 {pixAbertos.length} {pixAbertos.length === 1 ? 'cobrança Pix' : 'cobranças Pix'} para fazer
                  {pixAbertos.some((x) => x.urgent) && <span className="text-sm font-semibold text-red-600"> · {pixAbertos.filter((x) => x.urgent).length} há mais de uma semana</span>}
                </span>
                <span className="text-xs font-semibold text-emerald-700">cobrar →</span>
              </button>
            )}
            {focoParados.map((p) => (
              <button key={p.id} onClick={() => go?.('gralha')} className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-slate-200/70 hover:ring-slate-300">
                <span className="h-6 w-1 shrink-0 rounded-full bg-sky-500" />
                <span className="min-w-0 flex-1 text-[15px] font-medium text-slate-800">🐦 {p.cliente}: orçamento parado há {p.dias} dias</span>
                <span className="text-xs font-semibold text-sky-600">{p.etapa} →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700">Nada atrasado nem urgente. Bom momento para adiantar algo do Plano. 🌱</p>
        )}
      </section>

      {/* ---------- Frentes ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao cor="bg-emerald-500" titulo="RANKEN" onClick={() => go?.('ranken')} numero={rk.abertas} rotulo={rk.abertas === 1 ? 'tarefa hoje' : 'tarefas hoje'}>
          {rk.atr > 0 && <span className="text-red-600">{rk.atr} atrasada{rk.atr > 1 ? 's' : ''}</span>}
          {rk.urg > 0 && <span className="text-red-600">{rk.urg} urgente{rk.urg > 1 ? 's' : ''}</span>}
          {!rk.atr && !rk.urg && <span className="text-emerald-600">em dia ✓</span>}
        </Cartao>
        <Cartao cor="bg-sky-500" titulo="Gralha" onClick={() => go?.('gralha')} numero={pedidosAbertos} rotulo={pedidosAbertos === 1 ? 'pedido em aberto' : 'pedidos em aberto'}>
          {parados.length > 0 && <span className="text-amber-600">{parados.length} parado{parados.length > 1 ? 's' : ''}</span>}
          <span className="text-emerald-600">{brl(comissaoMes)} de comissão no mês</span>
          {gr.atr > 0 && <span className="text-red-600">{gr.atr} atrasada{gr.atr > 1 ? 's' : ''}</span>}
        </Cartao>
        <Cartao cor="bg-violet-500" titulo="Pessoal" onClick={() => go?.('pessoal')} numero={ps.abertas} rotulo={ps.abertas === 1 ? 'coisa hoje' : 'coisas hoje'}>
          {contasSemana.length > 0 && <span className="text-amber-600">{contasSemana.length} conta{contasSemana.length > 1 ? 's' : ''} na semana</span>}
          {ps.atr > 0 && <span className="text-red-600">{ps.atr} atrasada{ps.atr > 1 ? 's' : ''}</span>}
          {!contasSemana.length && !ps.atr && <span className="text-slate-400">nada pendente</span>}
        </Cartao>
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2">
        {/* ---------- Lolis ---------- */}
        <button onClick={() => go?.('lolis')} className="space-y-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-slate-300">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">🙋 Lolis hoje</h2>
            <span className="text-xs font-semibold text-slate-400">→</span>
          </div>
          {lolis.length ? (
            <>
              <div className="text-sm text-slate-700">
                <b className="text-ink">{lolisFeitos}</b> de {lolis.length} feitas
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round((lolisFeitos / lolis.length) * 100)}%` }} />
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">Nada com ela hoje.</div>
          )}
          <LinhaPontoLolis />
        </button>

        {/* ---------- Próximos dias ---------- */}
        <section className="space-y-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">📅 Próximos dias</h2>
          {proximos.length ? (
            proximos.map(({ d, ms, folga }) => (
              <div key={d} className="flex gap-2 text-sm">
                <span className="w-24 shrink-0 font-semibold capitalize text-slate-700">
                  {relativo(d, ref)} <span className="text-xs font-normal text-slate-400">{fmtCurto(d)}</span>
                </span>
                <span className="min-w-0 space-y-0.5 text-slate-600">
                  {[...ms.map((m) => m.title), ...(folga ? [`🌴 ${folga}`] : [])].map((t, i) => (
                    <span key={i} className="block">{t}</span>
                  ))}
                </span>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">Nenhum marco nos próximos 7 dias.</div>
          )}
        </section>
      </div>

      {/* ---------- Atenção ---------- */}
      {dicas.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">💡 Atenção</h2>
          {(verDicas ? dicas : dicas.slice(0, 3)).map((t, i) => (
            <div key={i} className="flex gap-2.5 text-sm leading-snug text-slate-700">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} />
              <span className="min-w-0 flex-1">{t.text}</span>
              {t.tarefa && (
                <button onClick={() => addTask(t.tarefa)} className="h-fit shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50">
                  + Criar tarefa
                </button>
              )}
            </div>
          ))}
          {dicas.length > 3 && (
            <button onClick={() => setVerDicas(!verDicas)} className="text-xs font-semibold text-slate-500">
              {verDicas ? 'mostrar menos' : `+ ${dicas.length - 3} avisos`}
            </button>
          )}
        </section>
      )}

      {editing && <TaskModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Cartao({ cor, titulo, numero, rotulo, onClick, children }) {
  return (
    <button onClick={onClick} className="space-y-1 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${cor}`} />
        <span className="text-sm font-bold text-slate-700">{titulo}</span>
        <span className="ml-auto text-xs font-semibold text-slate-400">→</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-ink">{numero}</span>
        <span className="text-sm text-slate-500">{rotulo}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold">{children}</div>
    </button>
  );
}
