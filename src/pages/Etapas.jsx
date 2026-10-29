import { CALENDARIOS, rodadaAtual, proximoSorteio, fimEtapa, marcosDoDia, rotuloRodada } from '../data/calendarios';
import { today, fmtCurto, relativo, diffDays, addDays } from '../lib/dates';
import { useState } from 'react';
import { Pill, Segmented } from '../components/ui';
import Campanhas from './Campanhas';
import { useStore } from '../lib/store';
import { gerarCampanhas, statusCampanha } from '../data/campanhas';

export default function Etapas() {
  const { state } = useStore();
  const [aba, setAba] = useState('rodadas');
  const ref = today();
  const pend = gerarCampanhas(ref).filter((c) => statusCampanha(state.campanhas || {}, c) === 'pendente').length; // mesma conta de "Para criar"

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Etapas</h1>
        <p className="text-sm text-slate-500">Onde cada categoria está agora e as campanhas push de cada rodada.</p>
      </header>

      <Segmented
        value={aba}
        onChange={setAba}
        options={[
          ['rodadas', 'Rodadas'],
          ['campanhas', `📣 Campanhas${pend ? ` (${pend} para criar)` : ' ✓'}`],
        ]}
      />

      {aba === 'campanhas' ? <Campanhas /> : <EtapasRodadas />}
    </div>
  );
}

// Rodadas de todas as categorias + próximos sorteios. Só lê o calendário (sem dados da Laura):
// também aparece na página da Lolis (aba 🏆 Etapas).
export function EtapasRodadas() {
  const ref = today();
  const cidades = [...new Set(CALENDARIOS.map((c) => c.cidade))];
  // Próximos domingos com sorteio (todas as cidades)
  const domingos = [];
  for (let d = ref; domingos.length < 8 && d <= addDays(ref, 120); d = addDays(d, 1)) {
    const ms = marcosDoDia(d).filter((m) => m.key.startsWith('cal:s:'));
    if (ms.length) domingos.push({ d, ms });
  }
  return (
    <div className="space-y-8">
      {cidades.map((cidade) => (
        <section key={cidade} className="space-y-3">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">{cidade}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CALENDARIOS.filter((c) => c.cidade === cidade).map((c) => (
              <Card key={c.id} c={c} ref0={ref} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-indigo-700">Próximos sorteios</h2>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          {domingos.map(({ d, ms }) => (
            <div key={d} className="flex gap-4 px-4 py-3">
              <div className="w-20 shrink-0">
                <div className="text-sm font-bold capitalize text-slate-800">{relativo(d, ref)}</div>
                <div className="text-xs text-slate-400">{fmtCurto(d)}</div>
              </div>
              <div className="space-y-1 text-sm text-slate-700">
                {ms.map((m) => (
                  <div key={m.key}>{m.title.replace(/^Sorteio /, '')}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ c, ref0 }) {
  const atual = rodadaAtual(c, ref0);
  const prox = proximoSorteio(c, ref0);
  const total = c.rodadas[c.rodadas.length - 1].n;
  const fim = fimEtapa(c);
  const acabou = ref0 >= fim;
  const reta = atual && c.retaFinal && atual.n >= c.retaFinal;
  const durRodada = atual ? diffDays(atual.fim, atual.inicio) : 1;
  const passou = atual ? diffDays(ref0, atual.inicio) : 0;
  const pct = Math.min(100, Math.round((passou / durRodada) * 100));
  const faltam = atual ? diffDays(atual.fim, ref0) : null;
  const [aberto, setAberto] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setAberto(!aberto)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setAberto(!aberto))}
      className={`cursor-pointer space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 transition hover:ring-slate-300 ${aberto ? 'ring-indigo-300 sm:col-span-2' : 'ring-slate-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-ink">{c.nome}</div>
          <div className="text-xs text-slate-500">
            Etapa {c.etapa} · {total} rodadas · termina {fmtCurto(fim)}
          </div>
        </div>
        {reta && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">reta final</Pill>}
        {acabou && <Pill className="bg-slate-50 text-slate-500 ring-slate-200">encerrada</Pill>}
      </div>

      {atual && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-ink">
              Rodada {rotuloRodada(atual)}
              <span className="text-sm font-semibold text-slate-400"> de {total}</span>
            </span>
            <span className={`text-sm font-semibold ${faltam <= 2 ? 'text-red-500' : 'text-slate-500'}`}>
              {faltam <= 0 ? 'termina hoje' : `faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${faltam <= 2 ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-slate-400">
            {fmtCurto(atual.inicio)} → {fmtCurto(atual.fim)}
          </div>
        </div>
      )}

      {prox && (
        <div className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          📌 Próximo sorteio: <b>R{rotuloRodada(prox)}</b> · {fmtCurto(prox.sorteio)} às {prox.hora}
          {['hoje', 'amanhã'].includes(relativo(prox.sorteio, ref0)) || relativo(prox.sorteio, ref0).startsWith('em ') ? ` (${relativo(prox.sorteio, ref0)})` : ''}
        </div>
      )}

      {/* calendário completo da categoria (abre e fecha clicando no cartão) */}
      {aberto ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1 pr-3 font-semibold">Rodada</th>
                <th className="py-1 pr-3 font-semibold">Sorteio</th>
                <th className="py-1 pr-3 font-semibold">Jogos</th>
                <th className="py-1 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {c.rodadas.map((rd) => {
                const agora = atual && rd.n === atual.n;
                const passou = rd.fim < ref0;
                const proxima = prox && rd.n === prox.n && !agora;
                return (
                  <tr key={rd.n} className={`border-t border-slate-100 ${agora ? 'bg-emerald-50 font-semibold text-ink' : passou ? 'text-slate-400' : 'text-slate-700'}`}>
                    <td className="py-1.5 pr-3">R{rotuloRodada(rd)}</td>
                    <td className="py-1.5 pr-3">{fmtCurto(rd.sorteio)} · {rd.hora}</td>
                    <td className="py-1.5 pr-3">{fmtCurto(rd.inicio)} → {fmtCurto(rd.fim)}</td>
                    <td className="py-1.5 text-right text-xs">
                      {agora ? <span className="text-emerald-700">em andamento</span> : proxima ? <span className="text-indigo-600">próximo sorteio</span> : passou ? 'feita' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pt-2 text-xs text-slate-400">Clique no cartão para fechar.</p>
        </div>
      ) : (
        <p className="text-xs font-semibold text-indigo-500">Ver calendário da etapa</p>
      )}
    </div>
  );
}
