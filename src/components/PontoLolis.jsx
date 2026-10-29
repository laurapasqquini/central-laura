import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { isWorkday } from '../lib/engine';
import { today, addDays, weekday, fmtCurto } from '../lib/dates';
import { supabase } from '../lib/supabase';
import { pontoDesde, salvarPonto, porDia, resumoDia, hora, duracao, JORNADA_MAX } from '../lib/ponto';

// Ponto da Lolis lido do banco (atualiza a cada minuto e quando ela marca)
function usePonto(desde) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let vivo = true;
    const ler = () => pontoDesde(desde).then((r) => vivo && setRes(r));
    ler();
    const t = setInterval(ler, 60 * 1000);
    const canal = supabase
      .channel(`ponto-${desde}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lolis_ponto' }, ler)
      .subscribe();
    return () => {
      vivo = false;
      clearInterval(t);
      supabase.removeChannel(canal);
    };
  }, [desde]);
  return [res, () => pontoDesde(desde).then(setRes)];
}

const CHIP = {
  saiu: ['Ok', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  trabalhando: ['Trabalhando', 'bg-sky-50 text-sky-700 ring-sky-200'],
  aguardando: ['Ainda não é hora', 'bg-slate-50 text-slate-500 ring-slate-200'],
  'nao-chegou': ['Não chegou', 'bg-red-50 text-red-700 ring-red-200'],
  'sem-registro': ['Faltou?', 'bg-red-50 text-red-700 ring-red-200'],
  'sem-saida': ['Sem saída', 'bg-amber-50 text-amber-800 ring-amber-200'],
  falta: ['Falta', 'bg-red-100 text-red-700 ring-red-300'],
  folga: ['Folga combinada', 'bg-violet-50 text-violet-700 ring-violet-200'],
  livre: ['', ''],
};
const segundaDe = (d) => addDays(d, -((weekday(d) + 6) % 7));

export default function PontoLolis() {
  const { state } = useStore();
  const hoje = today();
  const [semana, setSemana] = useState(() => segundaDe(hoje));
  const inicioMes = hoje.slice(0, 8) + '01';
  const desde = [semana, inicioMes].sort()[0];
  const [res, recarregar] = usePonto(desde);
  const [editando, setEditando] = useState(null);

  if (!res) return <div className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Carregando o ponto…</div>;
  if (res.erro)
    return (
      <section className="space-y-2 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        <div className="font-bold">Falta ligar o ponto no banco (uma vez só)</div>
        <p>
          No Supabase, abra <b>SQL Editor</b>, cole o conteúdo do arquivo <code>supabase/lolis-ponto.sql</code> e clique em <b>Run</b>. Depois disso, os botões "Cheguei" e "Saí" aparecem na página da Lolis.
        </p>
      </section>
    );

  const reg = porDia(res.rows);
  const agora = new Date();
  const util = (d) => isWorkday(state, d);
  const dias = Array.from({ length: 5 }, (_, i) => addDays(semana, i));

  // resumo do mês (até hoje)
  const doMes = [];
  for (let d = inicioMes; d <= hoje && d.slice(0, 7) === hoje.slice(0, 7); d = addDays(d, 1)) {
    if (util(d) || reg[d]) doMes.push(resumoDia(reg[d], d, hoje, util(d), agora));
  }
  const veio = doMes.filter((r) => r.entrada);
  const faltas = doMes.filter((r) => r.status === 'falta' || r.status === 'sem-registro').length;
  const atrasos = veio.filter((r) => r.atraso).length;
  const passou = veio.filter((r) => r.passou).length;
  const horas = veio.reduce((s, r) => s + (r.minutos || 0), 0);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Numero rotulo="Dias que veio" valor={veio.length} />
        <Numero rotulo="Faltas" valor={faltas} tom={faltas ? 'red' : ''} />
        <Numero rotulo="Chegou depois das 14h" valor={atrasos} tom={atrasos ? 'amber' : ''} />
        <Numero rotulo="Passou das 4h" valor={passou} tom={passou ? 'red' : ''} />
        <Numero rotulo="Horas no mês" valor={duracao(horas)} />
      </section>

      <section className="space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setSemana(addDays(semana, -7))} className="rounded-lg px-2 py-1 text-slate-500 ring-1 ring-slate-200">◀</button>
          <h2 className="text-sm font-bold text-ink">
            Semana de {fmtCurto(semana).replace(/^\w+, /, '')} a {fmtCurto(addDays(semana, 4)).replace(/^\w+, /, '')}
          </h2>
          <button disabled={semana >= segundaDe(hoje)} onClick={() => setSemana(addDays(semana, 7))} className="rounded-lg px-2 py-1 text-slate-500 ring-1 ring-slate-200 disabled:opacity-30">▶</button>
        </div>
        <p className="text-xs text-slate-500">Chegada às 13h30 ou 14h (tolerância de 5 min) · no máximo {JORNADA_MAX / 60} horas por dia.</p>
        <div className="divide-y divide-slate-100">
          {dias.map((d) => {
            const r = resumoDia(reg[d], d, hoje, util(d), agora);
            const [nome, cor] = r.passou ? ['', ''] : CHIP[r.status] || ['', ''];
            const feriado = !util(d) && !reg[d];
            return (
              <div key={d} className="py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className={`w-24 shrink-0 font-semibold ${d === hoje ? 'text-amber-700' : 'text-slate-700'}`}>{fmtCurto(d)}</span>
                  {feriado ? (
                    <span className="text-xs text-slate-400">feriado / folga</span>
                  ) : r.entrada ? (
                    <span className="text-slate-700">
                      {hora(r.entrada)} → {r.saida ? hora(r.saida) : r.status === 'trabalhando' ? <span className="text-slate-400">até {hora(r.limite)}</span> : '?'}
                      {r.minutos != null && <b className="ml-2">{duracao(r.minutos)}</b>}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {nome && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${cor}`}>{nome}</span>}
                  {r.atraso > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">+{r.atraso} min</span>}
                  {r.passou > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">passou {duracao(r.passou)}</span>}
                  {r.obs && <span className="text-xs text-slate-500">📝 {r.obs}</span>}
                  {d <= hoje && (
                    <button onClick={() => setEditando(editando === d ? null : d)} className="ml-auto text-xs font-semibold text-slate-400 hover:text-indigo-600">
                      {editando === d ? 'fechar' : '✏️ corrigir'}
                    </button>
                  )}
                </div>
                {editando === d && <Corrigir dia={d} reg={reg[d] || {}} onPronto={() => recarregar()} />}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// Corrigir um dia: horário de chegada/saída (ela esqueceu de marcar), falta ou folga combinada
function Corrigir({ dia, reg, onPronto }) {
  const hh = (x) => (x?.em ? hora(x.em) : '');
  const [ent, setEnt] = useState(hh(reg.entrada));
  const [sai, setSai] = useState(hh(reg.saida));
  const [obs, setObs] = useState(reg.falta?.obs || reg.folga?.obs || reg.entrada?.obs || '');
  const [salvando, setSalvando] = useState(false);
  const iso = (hhmm) => new Date(`${dia}T${hhmm}:00`).toISOString();
  const rodar = async (passos) => {
    setSalvando(true);
    for (const p of passos) if (!(await p())) {
      setSalvando(false);
      return alert('Não consegui salvar. Tente de novo.');
    }
    setSalvando(false);
    onPronto();
  };
  const horarios = () =>
    rodar([
      () => salvarPonto(dia, 'falta'),
      () => salvarPonto(dia, 'folga'),
      () => (ent ? salvarPonto(dia, 'entrada', iso(ent), obs) : salvarPonto(dia, 'entrada')),
      () => (sai ? salvarPonto(dia, 'saida', iso(sai)) : salvarPonto(dia, 'saida')),
    ]);
  const marcar = (tipo) =>
    rodar([() => salvarPonto(dia, 'entrada'), () => salvarPonto(dia, 'saida'), () => salvarPonto(dia, tipo === 'falta' ? 'folga' : 'falta'), () => salvarPonto(dia, tipo, null, obs)]);
  const campo = 'rounded-lg border border-slate-200 px-2 py-1 text-sm';
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
      <label className="text-xs text-slate-500">
        Chegou
        <input type="time" value={ent} onChange={(e) => setEnt(e.target.value)} className={`block ${campo}`} />
      </label>
      <label className="text-xs text-slate-500">
        Saiu
        <input type="time" value={sai} onChange={(e) => setSai(e.target.value)} className={`block ${campo}`} />
      </label>
      <label className="min-w-40 flex-1 text-xs text-slate-500">
        Observação
        <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: médico, prova da faculdade" className={`block w-full ${campo}`} />
      </label>
      <button disabled={salvando} onClick={horarios} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
        Salvar horários
      </button>
      <button disabled={salvando} onClick={() => marcar('falta')} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
        Faltou
      </button>
      <button disabled={salvando} onClick={() => marcar('folga')} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
        Folga combinada
      </button>
    </div>
  );
}

const Numero = ({ rotulo, valor, tom }) => (
  <div className={`rounded-lg p-3 shadow-sm ring-1 ${tom === 'red' ? 'bg-red-50 ring-red-200' : tom === 'amber' ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200'}`}>
    <div className="text-xs text-slate-500">{rotulo}</div>
    <div className={`text-xl font-bold ${tom === 'red' ? 'text-red-700' : tom === 'amber' ? 'text-amber-800' : 'text-ink'}`}>{valor}</div>
  </div>
);

// Aviso no Início: a Lolis não marcou a chegada, ou já passou das 4 horas sem marcar a saída
export function AvisoPontoLolis() {
  const { state } = useStore();
  const hoje = today();
  const [res] = usePonto(hoje);
  if (!res?.rows || !isWorkday(state, hoje)) return null;
  const r = resumoDia(porDia(res.rows)[hoje], hoje, hoje, true, new Date());
  const msg =
    r.status === 'nao-chegou'
      ? '⏰ A Lolis ainda não marcou a chegada hoje.'
      : r.status === 'trabalhando' && r.minutos > JORNADA_MAX + 5
        ? `⏰ A Lolis já passou das 4 horas (chegou às ${hora(r.entrada)}) e não marcou a saída.`
        : '';
  if (!msg) return null;
  return <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">{msg} <span className="font-normal">Veja em Ranken › Lolis › Ponto.</span></div>;
}

// Linha curta para o cartão "Lolis hoje" do Início
export function LinhaPontoLolis() {
  const { state } = useStore();
  const hoje = today();
  const [res] = usePonto(hoje);
  if (!res?.rows || !isWorkday(state, hoje)) return null;
  const r = resumoDia(porDia(res.rows)[hoje], hoje, hoje, true, new Date());
  if (r.status === 'aguardando' || r.status === 'livre') return null;
  const txt = {
    'nao-chegou': ['⏰ Não marcou a chegada', 'text-red-600'],
    trabalhando: [`⏰ Chegou às ${hora(r.entrada)} · até ${hora(r.limite)}`, 'text-slate-600'],
    saiu: [`⏰ ${hora(r.entrada)} → ${hora(r.saida)} (${duracao(r.minutos)})`, r.passou ? 'text-red-600' : 'text-slate-600'],
    falta: ['⏰ Falta hoje', 'text-red-600'],
    folga: ['⏰ Folga combinada hoje', 'text-violet-600'],
  }[r.status];
  return txt ? <div className={`text-xs font-semibold ${txt[1]}`}>{txt[0]}</div> : null;
}
