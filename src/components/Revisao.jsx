import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, campanhasPendentes, pedidosParados, contasDoDia, proximoDiaUtil, isWorkday, AREAS } from '../lib/engine';
import { today, addDays, weekday, fmtCurto } from '../lib/dates';
import { periodo, montarRelatorio, textoRelatorio } from '../lib/relatorio';
import { Modal } from './ui';
import { RelatorioChefes } from '../pages/Plano';

// Revisão de sexta: 5 minutos para fechar a semana e preparar a próxima.
export function Revisao({ item, go, onClose }) {
  const { state, toggleTask, toggleRoutine, updateTask, deleteTask } = useStore();
  const [copiado, setCopiado] = useState(false);
  const ref = today();
  const eu = { area: 'all', who: 'laura' };
  const segNominal = addDays(ref, 8 - (weekday(ref) || 7)); // próxima segunda-feira
  const segunda = proximoDiaUtil(state, segNominal);
  const sexta = addDays(segNominal, 4);

  const pendentes = [...buildOverdue(state, eu, ref), ...buildDay(state, ref, eu).filter((x) => x.kind === 'task' && !x.done)];
  const unicos = [...new Map(pendentes.map((x) => [x.key, x])).values()];

  const dias = [];
  for (let d = segunda; d <= sexta; d = addDays(d, 1)) {
    if (!isWorkday(state, d)) continue;
    const its = buildDay(state, d, { area: 'all', who: 'all' });
    dias.push({ d, marcos: its.filter((x) => x.kind === 'marco'), tarefas: its.filter((x) => x.kind === 'task' || x.freq === 'calendario') });
  }
  const camp = campanhasPendentes(state, ref, 10).filter((c) => c.data <= sexta);
  const parados = pedidosParados(state, ref);
  const contas = Array.from({ length: 10 }, (_, i) => addDays(ref, i + 1)).flatMap((d) => contasDoDia(state, d)).filter((x) => !x.done);

  const copiar = async () => {
    const per = periodo('semana', ref);
    const texto = textoRelatorio(montarRelatorio(state, per, 'ranken'), per, 'ranken', { eu: true, lolis: true });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      prompt('Copie o relatório:', texto);
    }
  };
  const ir = (aba) => {
    onClose();
    go?.(aba);
  };
  const concluir = () => {
    if (item && !item.done) toggleRoutine(item.id, item.date);
    onClose();
  };

  const Bloco = ({ n, titulo, children }) => (
    <section className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <h4 className="text-sm font-bold text-slate-700">
        <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] text-white">{n}</span>
        {titulo}
      </h4>
      {children}
    </section>
  );
  const Btn = ({ onClick, children, cls = 'text-slate-600 ring-slate-200 hover:bg-slate-50' }) => (
    <button onClick={onClick} className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {children}
    </button>
  );

  return (
    <Modal title="🧭 Revisão da semana" onClose={onClose}>
      <div className="space-y-3">
        <Bloco n="1" titulo={`O que ficou para trás (${unicos.length})`}>
          {!unicos.length && <p className="text-sm text-emerald-600">Nada pendente. Semana limpa! 🎉</p>}
          {unicos.map((x) => (
            <div key={x.key} className="flex items-center gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
              <span className={`h-2 w-2 shrink-0 rounded-full ${AREAS[x.area].dot}`} />
              <span className="min-w-0 flex-1 text-sm text-slate-700">{x.title}</span>
              <Btn onClick={() => (x.kind === 'task' ? toggleTask(x.id) : toggleRoutine(x.id, x.date, x.doneValue))} cls="text-emerald-700 ring-emerald-200 hover:bg-emerald-50">
                ✓ Feito
              </Btn>
              {x.kind === 'task' ? (
                <>
                  <Btn onClick={() => updateTask(x.id, { due: segunda, postponed: (x.postponed || 0) + 1 })}>→ {fmtCurto(segunda).slice(0, 3)}</Btn>
                  <Btn onClick={() => confirm(`Apagar "${x.title}"?`) && deleteTask(x.id)} cls="text-red-500 ring-red-100 hover:bg-red-50">
                    ✕
                  </Btn>
                </>
              ) : (
                <Btn onClick={() => toggleRoutine(x.id, x.date, x.doneValue)}>Pular</Btn>
              )}
            </div>
          ))}
        </Bloco>

        <Bloco n="2" titulo="Próxima semana">
          {dias.map(({ d, marcos, tarefas }) => (
            <div key={d} className="text-sm">
              <span className="font-semibold capitalize text-slate-700">{fmtCurto(d)}</span>
              <span className="text-slate-500"> · {tarefas.length} {tarefas.length === 1 ? 'tarefa' : 'tarefas'}</span>
              {marcos.map((m) => (
                <div key={m.key} className="text-xs text-indigo-700">📌 {m.title}</div>
              ))}
            </div>
          ))}
        </Bloco>

        <Bloco n="3" titulo="Antes de sair">
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li className="flex items-center justify-between gap-2">
              <span>{camp.length ? `📣 ${camp.length} campanhas até ${fmtCurto(sexta)} sem agendar` : '📣 Campanhas da próxima semana: tudo agendado ✓'}</span>
              {camp.length > 0 && <Btn onClick={() => ir('etapas')}>Abrir</Btn>}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>{parados.length ? `🐦 ${parados.length} ${parados.length === 1 ? 'pedido parado' : 'pedidos parados'} na Gralha: ${parados.map((p) => p.cliente).join(', ')}` : '🐦 Gralha: nenhum pedido parado ✓'}</span>
              {parados.length > 0 && <Btn onClick={() => ir('gralha')}>Abrir</Btn>}
            </li>
            <li>{contas.length ? `💸 Contas chegando: ${contas.map((c) => `${c.title.replace('💸 Pagar ', '')} (${fmtCurto(c.date)})`).join(' · ')}` : '💸 Nenhuma conta nos próximos 10 dias'}</li>
          </ul>
        </Bloco>

        <Bloco n="4" titulo="Plano e números">
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li className="flex items-center justify-between gap-2">
              <span>🎯 Atualize o status das iniciativas e os números do Beach da semana</span>
              <Btn onClick={() => ir('plano')}>Abrir</Btn>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>📋 Relatório detalhado (você + Lolis)</span>
              <Btn onClick={copiar} cls="text-emerald-700 ring-emerald-200 hover:bg-emerald-50">
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </Btn>
            </li>
          </ul>
        </Bloco>

        <RelatorioChefes compacto />

        <button onClick={concluir} className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-white">
          Concluir revisão ✓
        </button>
      </div>
    </Modal>
  );
}
