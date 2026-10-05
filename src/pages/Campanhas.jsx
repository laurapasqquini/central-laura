import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { gerarCampanhas, TIPOS } from '../data/campanhas';
import { today, addDays, fmtCurto, relativo } from '../lib/dates';
import { limiteDiasUteis } from '../lib/engine';
import { Empty, Pill, Segmented, inputCls } from '../components/ui';

const brData = (s) => s.split('-').reverse().join('/');

export default function Campanhas() {
  const { state, setCampanha } = useStore();
  const ref = today();
  const [ver, setVer] = useState('pendentes'); // pendentes | todas
  const [cidade, setCidade] = useState('all');
  const [aberta, setAberta] = useState(null);

  const todas = useMemo(() => gerarCampanhas(ref), [ref]);
  const cidades = [...new Set(todas.map((c) => c.cidade))];
  const ov = state.campanhas || {};
  const status = (c) => ov[c.id]?.status || 'pendente';

  const lista = todas
    .filter((c) => cidade === 'all' || c.cidade === cidade)
    .filter((c) => (ver === 'pendentes' ? status(c) === 'pendente' && c.data <= addDays(ref, 14) : true));
  const urgentes = todas.filter((c) => status(c) === 'pendente' && c.data <= limiteDiasUteis(state, ref, 3)).length;

  const porDia = lista.reduce((acc, c) => ((acc[c.data] ||= []).push(c), acc), {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={ver}
          onChange={setVer}
          options={[
            ['pendentes', 'Para agendar (14 dias)'],
            ['todas', 'Todas'],
          ]}
        />
        <Segmented value={cidade} onChange={setCidade} options={[['all', 'Todas as cidades'], ...cidades.map((c) => [c, c])]} />
      </div>

      {urgentes > 0 && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800 ring-1 ring-red-100">
          📣 {urgentes} {urgentes === 1 ? 'campanha dos próximos 3 dias úteis ainda não foi agendada' : 'campanhas dos próximos 3 dias úteis ainda não foram agendadas'}.
        </div>
      )}

      {!lista.length && <Empty>Nada para agendar nos próximos 14 dias. 🎉</Empty>}

      {Object.entries(porDia).map(([data, cs]) => (
        <section key={data} className="space-y-2">
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-sm font-bold capitalize text-slate-700">{relativo(data, ref)}</span>
            <span className="text-xs text-slate-400">{fmtCurto(data)}</span>
          </div>
          {cs.map((c) => (
            <Card key={c.id} c={c} st={status(c)} ov={ov[c.id] || {}} aberta={aberta === c.id} onToggle={() => setAberta(aberta === c.id ? null : c.id)} set={(p) => setCampanha(c.id, p)} />
          ))}
        </section>
      ))}

      <p className="px-1 text-xs text-slate-400">
        No backoffice: Alcance <b>Jogadores de uma etapa</b> · Gatilho <b>Programada</b> · Repetir a cada <b>1</b> · Início e Fim no <b>mesmo dia</b> · o horário indicado.
      </p>
    </div>
  );
}

function Copiar({ texto, rotulo }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          prompt('Copie:', texto);
        }
      }}
      className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
    >
      {ok ? '✓ copiado' : rotulo}
    </button>
  );
}

function Campo({ nome, valor, copiar = true }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{nome}</div>
        <div className="text-sm text-slate-800">{valor}</div>
      </div>
      {copiar && <Copiar texto={valor} rotulo="copiar" />}
    </div>
  );
}

function Card({ c, st, ov, aberta, onToggle, set }) {
  const titulo = ov.titulo ?? c.titulo;
  const mensagem = ov.mensagem ?? c.mensagem;
  const etapa = ov.etapa ?? c.etapa;
  const hora = ov.hora ?? c.hora;
  const agora = new Date();
  const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const passou = c.data === today() && hora <= hhmm && st === 'pendente';
  const feito = st !== 'pendente';

  return (
    <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-60' : ''}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3.5 text-left">
        <span className="text-xl">{TIPOS[c.tipo].icone}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-800">{c.cidade} · {c.categoria}</span>
            <Pill className="bg-slate-50 text-slate-500 ring-slate-200">R{c.rodada} · {TIPOS[c.tipo].nome}</Pill>
            {st === 'agendada' && <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">✓ agendada</Pill>}
            {st === 'pulada' && <Pill className="bg-slate-50 text-slate-400 ring-slate-200">pulada</Pill>}
            {passou && <Pill className="bg-red-50 text-red-600 ring-red-200">horário já passou</Pill>}
          </div>
          <div className="mt-0.5 truncate text-sm text-slate-500">
            {hora.replace(':00', 'h')} · {titulo}
          </div>
        </div>
      </button>

      {aberta && (
        <div className="space-y-3 border-t border-slate-100 px-3.5 pb-3.5 pt-2">
          <div className="divide-y divide-slate-100">
            <Campo nome="Etapa (confira no backoffice)" valor={etapa} />
            <Campo nome="Início e fim" valor={brData(c.data)} />
            <div className="flex items-center justify-between gap-3 py-1.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Horário</div>
                <input type="time" step="900" value={hora} onChange={(e) => set({ hora: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                {passou && <div className="mt-1 text-xs font-semibold text-red-600">Esse horário já passou hoje: escolha um mais tarde.</div>}
              </div>
              <Copiar texto={hora} rotulo="copiar" />
            </div>
          </div>
          <label className="block space-y-1">
            <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Título <Copiar texto={titulo} rotulo="copiar" />
            </span>
            <input className={inputCls} value={titulo} onChange={(e) => set({ titulo: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Mensagem <Copiar texto={mensagem} rotulo="copiar" />
            </span>
            <textarea rows={3} className={inputCls} value={mensagem} onChange={(e) => set({ mensagem: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {st !== 'agendada' && (
              <button onClick={() => set({ status: 'agendada' })} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                ✓ Agendei no backoffice
              </button>
            )}
            {st === 'pendente' && (
              <button onClick={() => set({ status: 'pulada' })} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                Pular
              </button>
            )}
            {st !== 'pendente' && (
              <button onClick={() => set({ status: 'pendente' })} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                Voltar para pendente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
