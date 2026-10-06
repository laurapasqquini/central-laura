import { useState } from 'react';
import { useStore } from '../lib/store';
import { radar, FRENTES } from '../data/radar';
import { plano, STATUS, progresso, montarChefes, textoChefes, pdfChefes, numerosAte } from '../lib/chefes';
import { periodo } from '../lib/relatorio';
import { parseQuick } from '../lib/parse';
import { today, fmtCurto, relativo, diffDays } from '../lib/dates';
import { Section, Empty, Segmented, inputCls, Check } from '../components/ui';

const uid = () => Math.random().toString(36).slice(2, 10);
const frente = (id) => FRENTES.find((f) => f.id === id) || { nome: 'Geral', icone: '•' };

export default function Plano() {
  const { state, setPlano } = useStore();
  const p = plano(state);
  const ref = today();
  const [filtro, setFiltro] = useState('all');
  const [aberta, setAberta] = useState(null);
  const [nova, setNova] = useState('');

  const aceitas = new Set(p.iniciativas.map((i) => i.radarId).filter(Boolean));
  const sugestoes = radar(ref).filter((r) => !p.ocultos.includes(r.id) && !aceitas.has(r.id));
  const inis = p.iniciativas.filter((i) => filtro === 'all' || i.frente === filtro);

  const criar = (dados) => {
    const id = uid();
    setPlano((pl) => ({ ...pl, iniciativas: [{ id, status: 'ideia', frente: filtro === 'all' ? 'gestao' : filtro, criadaEm: ref, ...dados }, ...pl.iniciativas] }));
    setAberta(id);
  };
  const puxar = (r) => criar({ titulo: r.titulo, frente: r.frente, prazo: r.prazo, notas: r.porque, radarId: r.id });

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">🎯 Plano</h1>
        <p className="text-sm text-slate-500">O que você está fazendo acontecer, por frente. Ideias viram propostas, propostas viram passos na sua lista.</p>
      </header>

      <Metas />

      {sugestoes.length > 0 && (
        <Section title="📡 Radar: o que você poderia estar puxando" count={sugestoes.length}>
          <div className="grid gap-2 lg:grid-cols-2">
            {sugestoes.map((r) => {
              const dias = r.prazo ? diffDays(r.prazo, ref) : null;
              return (
                <div key={r.id} className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none">{frente(r.frente).icone}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-slate-800">{r.titulo}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{r.porque}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.prazo && (
                      <span className={`text-xs font-semibold ${dias < 0 ? 'text-red-600' : dias <= 14 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {dias < 0 ? `prazo ideal passou (${fmtCurto(r.prazo)})` : `ideal até ${fmtCurto(r.prazo)}`}
                      </span>
                    )}
                    <span className="flex-1" />
                    <button onClick={() => setPlano((pl) => ({ ...pl, ocultos: [...pl.ocultos, r.id] }))} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-50">
                      Descartar
                    </button>
                    <button onClick={() => puxar(r)} className="rounded-lg bg-ink px-3 py-1 text-xs font-bold text-white">
                      ＋ Puxar pro plano
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Iniciativas" count={p.iniciativas.filter((i) => i.status !== 'feito').length || null}>
        <div className="space-y-3">
          <Segmented value={filtro} onChange={setFiltro} options={[['all', 'Todas'], ...FRENTES.map((f) => [f.id, `${f.icone} ${f.nome}`])]} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nova.trim()) criar({ titulo: nova.trim() });
              setNova('');
            }}
            className="flex gap-2"
          >
            <input className={inputCls} placeholder="Nova ideia ou iniciativa (ex.: parceria com loja de raquetes no Beach)" value={nova} onChange={(e) => setNova(e.target.value)} />
            <button className="shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white">+ Criar</button>
          </form>
          <div className="grid gap-3 lg:grid-cols-4">
            {STATUS.map((st) => {
              const lista = inis.filter((i) => i.status === st.id && (st.id !== 'feito' || diffDays(ref, i.feitoEm || ref) <= 30));
              return (
                <div key={st.id} className="space-y-2 rounded-2xl bg-slate-100/70 p-2">
                  <div className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {st.icone} {st.nome} <span className="text-slate-400">{lista.length}</span>
                  </div>
                  {lista.map((i) => (
                    <Iniciativa key={i.id} i={i} aberta={aberta === i.id} onToggle={() => setAberta(aberta === i.id ? null : i.id)} />
                  ))}
                  {!lista.length && <div className="px-1 pb-1 text-xs text-slate-400">—</div>}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Numeros />
      <RelatorioChefes />
    </div>
  );
}

function Iniciativa({ i, aberta, onToggle }) {
  const { state, setPlano, addTask, toggleTask } = useStore();
  const [passo, setPasso] = useState('');
  const pr = progresso(state, i);
  const ref = today();
  const set = (patch) => setPlano((pl) => ({ ...pl, iniciativas: pl.iniciativas.map((x) => (x.id === i.id ? { ...x, ...patch } : x)) }));
  const mudarStatus = (status) => set({ status, ...(status === 'feito' ? { feitoEm: ref } : {}), ...(status === 'propus' ? { propostaEm: ref } : {}) });
  const passos = state.tasks.filter((t) => t.iniciativaId === i.id);

  const addPasso = (e) => {
    e.preventDefault();
    if (!passo.trim()) return;
    const q = parseQuick(passo, { area: 'ranken' });
    addTask({ ...q, area: 'ranken', iniciativaId: i.id });
    if (i.status === 'ideia' || i.status === 'propus') set({ status: 'andamento' });
    setPasso('');
  };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <button onClick={onToggle} className="w-full px-3 py-2 text-left">
        <div className="text-sm font-semibold leading-snug text-slate-800">
          {frente(i.frente).icone} {i.titulo}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
          {i.prazo && <span className={i.prazo < ref && i.status !== 'feito' ? 'font-semibold text-red-500' : ''}>até {fmtCurto(i.prazo)}</span>}
          {pr.total > 0 && <span>{pr.feitas}/{pr.total} passos</span>}
        </div>
      </button>
      {aberta && (
        <div className="space-y-2 border-t border-slate-100 p-3">
          <input className={inputCls} value={i.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} w-auto`} value={i.frente} onChange={(e) => set({ frente: e.target.value })}>
              {FRENTES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icone} {f.nome}
                </option>
              ))}
            </select>
            <input type="date" className={`${inputCls} w-40`} value={i.prazo || ''} onChange={(e) => set({ prazo: e.target.value || null })} title="Prazo" />
          </div>
          <textarea rows={3} className={inputCls} placeholder="Notas: objetivo, ideia, o que os chefes disseram…" value={i.notas || ''} onChange={(e) => set({ notas: e.target.value })} />
          <div className="flex flex-wrap gap-1.5">
            {STATUS.map((st) => (
              <button
                key={st.id}
                onClick={() => mudarStatus(st.id)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${i.status === st.id ? 'bg-ink text-white ring-ink' : 'text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
              >
                {st.icone} {st.nome}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Passos (viram tarefas na sua lista)</div>
            {passos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Check done={t.done} onClick={() => toggleTask(t.id)} area={t.area} />
                <span className={`min-w-0 flex-1 ${t.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.title}</span>
                {t.due && !t.done && <span className="text-[11px] text-slate-400">{relativo(t.due, ref)}</span>}
              </div>
            ))}
            <form onSubmit={addPasso}>
              <input className={inputCls} placeholder="Novo passo (ex.: levantar patrocinadores atuais sexta @lolis)" value={passo} onChange={(e) => setPasso(e.target.value)} />
            </form>
          </div>
          <button onClick={() => confirm(`Apagar a iniciativa "${i.titulo}"? Os passos continuam na lista.`) && setPlano((pl) => ({ ...pl, iniciativas: pl.iniciativas.filter((x) => x.id !== i.id) }))} className="text-xs font-semibold text-red-500">
            Apagar iniciativa
          </button>
        </div>
      )}
    </div>
  );
}

function Metas() {
  const { state, setPlano } = useStore();
  const mes = today().slice(0, 7);
  const metas = plano(state).metas[mes] || [];
  const lista = [...metas, ...Array.from({ length: Math.max(0, 3 - metas.length) }, () => ({ texto: '', feita: false }))].slice(0, 3);
  const set = (n, patch) =>
    setPlano((pl) => {
      const atual = [...(pl.metas[mes] || [])];
      while (atual.length <= n) atual.push({ texto: '', feita: false });
      atual[n] = { ...atual[n], ...patch };
      return { ...pl, metas: { ...pl.metas, [mes]: atual } };
    });
  const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <Section title={`🏁 Metas de ${nomeMes} (até 3)`}>
      <div className="grid gap-2 sm:grid-cols-3">
        {lista.map((m, n) => (
          <div key={n} className={`flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ${m.feita ? 'ring-emerald-200' : 'ring-slate-200'}`}>
            <Check done={m.feita} onClick={() => m.texto && set(n, { feita: !m.feita })} area="ranken" />
            <input className={`min-w-0 flex-1 bg-transparent text-sm font-medium outline-none ${m.feita ? 'text-slate-400 line-through' : 'text-slate-800'}`} placeholder={['Ex.: fechar a reunião de alinhamento', 'Ex.: proposta de patrocínio 2027', 'Ex.: plano de reinscrição do Beach'][n]} value={m.texto} onChange={(e) => set(n, { texto: e.target.value })} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Numeros() {
  const { state, setPlano } = useStore();
  const p = plano(state);
  const [data, setData] = useState(today());
  const [novoInd, setNovoInd] = useState('');
  const datas = Object.keys(p.numeros).sort().slice(-5);
  const atual = numerosAte(state, today());

  const setValor = (nome, v) => setPlano((pl) => ({ ...pl, numeros: { ...pl.numeros, [data]: { ...(pl.numeros[data] || {}), [nome]: v } } }));

  return (
    <Section title="📊 Números da semana">
      <div className="space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">Copie do Hub ou do backoffice uma vez por semana (sexta, na revisão). Eles entram no relatório para os chefes com a variação.</p>
        {atual.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {atual.map((n) => (
              <div key={n.nome} className="rounded-xl bg-slate-50 p-2.5">
                <div className="text-[11px] font-semibold text-slate-500">{n.nome}</div>
                <div className="text-lg font-extrabold text-ink">
                  {n.valor.toLocaleString('pt-BR')}
                  {n.dif ? <span className={`ml-1.5 text-xs font-bold ${n.dif > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{n.dif > 0 ? '+' : ''}{n.dif.toLocaleString('pt-BR')}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Registrar em <input type="date" className={`${inputCls} w-40`} value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {p.indicadores.map((nome) => (
            <label key={nome} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="min-w-0 flex-1">{nome}</span>
              <input className={`${inputCls} w-32`} inputMode="decimal" value={p.numeros[data]?.[nome] ?? ''} onChange={(e) => setValor(nome, e.target.value)} />
              <button type="button" title="Tirar este indicador" onClick={() => confirm(`Tirar "${nome}"?`) && setPlano((pl) => ({ ...pl, indicadores: plano({ plano: pl }).indicadores.filter((x) => x !== nome) }))} className="text-slate-300 hover:text-red-500">
                ✕
              </button>
            </label>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (novoInd.trim()) setPlano((pl) => ({ ...pl, indicadores: [...plano({ plano: pl }).indicadores, novoInd.trim()] }));
            setNovoInd('');
          }}
          className="flex gap-2"
        >
          <input className={inputCls} placeholder="Outro número (ex.: Tênis Maringá · pagantes)" value={novoInd} onChange={(e) => setNovoInd(e.target.value)} />
          <button className="shrink-0 rounded-xl px-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">+ Indicador</button>
        </form>
        {datas.length > 1 && <p className="text-[11px] text-slate-400">Registros: {datas.map((d) => fmtCurto(d)).join(' · ')}</p>}
      </div>
    </Section>
  );
}

export function RelatorioChefes({ compacto = false }) {
  const { state } = useStore();
  const [tipo, setTipo] = useState('semana');
  const [msg, setMsg] = useState('');
  const r = montarChefes(state, periodo(tipo, today()));
  const texto = textoChefes(r);
  const aviso = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2000);
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      aviso('Copiado ✓');
    } catch {
      prompt('Copie o relatório:', texto);
    }
  };

  return (
    <Section title="📣 Relatório para os chefes">
      <div className="space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <Segmented value={tipo} onChange={setTipo} options={[['semana', 'Esta semana'], ['semana-passada', 'Semana passada']]} />
        {!compacto && <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-700">{texto}</pre>}
        {r.entregue.length + r.andamento.length + r.propostas.length === 0 && <Empty>Ainda vazio: puxe iniciativas do Radar e marque o que entregou.</Empty>}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={copiar} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">📋 Copiar texto</button>
          <button onClick={() => pdfChefes(r).then(() => aviso('PDF baixado ✓'))} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">⬇ Baixar PDF</button>
          {msg && <span className="text-sm font-medium text-slate-600">{msg}</span>}
        </div>
      </div>
    </Section>
  );
}
