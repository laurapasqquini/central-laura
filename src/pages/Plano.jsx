// Plano RANKEN nov/2026 → 2027: a meta, a linha do tempo, as praças e as frentes.
// Os números (meta, receita, praças) vêm de state.plano27.previsao: ficam só na conta da Laura.
// A execução de cada praça mora na Expansão do Hub: aqui só se lê o andamento de lá (pela extensão).
import { useState } from 'react';
import { useStore } from '../lib/store';
import { FASES, MARCOS, ESTREIA, DIA_MENOS_48, FOCO_SUGERIDO } from '../data/plano2027';
import { planoInicial, passosDoPlano, lerColagem, numero } from '../lib/plano';
import { today, addDays, diffDays, fmtCurto, relativo } from '../lib/dates';
import { Section, Check, inputBase, Segmented, HUB_URL } from '../components/ui';

const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m) => `${MES_CURTO[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const sem = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ESPORTE_HUB = { tenis: 'Tênis', beach_tennis: 'Beach Tennis', padel: 'Padel' };
const QUEM = ['Laura', 'Thales', 'Yorran'];

export default function Plano() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Plano 2027</h1>
        <p className="text-sm text-slate-500">A meta, o caminho até ela e o que fazer agora. Cada praça é tocada na Expansão do Hub; aqui você acompanha.</p>
      </header>
      <Norte />
      <LinhaDoTempo />
      <FocoDoMes />
      <Pracas />
      <Frentes />
      <NumerosPrevisao />
    </div>
  );
}

// ───────────── Previsão (números): só na conta da Laura, nunca no código ─────────────
// { titulo, meses: { 'AAAA-MM': { pagantes, receita } }, pracas: [{ id, cidade, esporte, operando, metas: { 'AAAA-MM': n } }] }
export const previsaoDe = (state) => ({ titulo: '', meses: {}, pracas: [], ...(state.plano27?.previsao || {}) });

// ───────────── Norte: a meta e o placar ─────────────
function Norte() {
  const { state } = useStore();
  const ref = today();
  const prev = previsaoDe(state);
  const meses = Object.keys(prev.meses).sort();
  if (!meses.length) {
    return (
      <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Meta</h2>
        <p className="text-sm text-slate-600">Os números da previsão ainda não estão aqui. Preencha ou cole do Excel em <b>Números da previsão</b>, no fim da página. Eles ficam só na sua conta.</p>
      </section>
    );
  }
  const mes = ref.slice(0, 7);
  const mesMeta = meses.find((m) => m >= mes) || meses.at(-1);
  const metaMes = prev.meses[mesMeta];
  const primeiro = meses[0];
  const ultimo = meses.at(-1);
  const real = state.pagantesHub?.total ?? (state.pagantesHub ? Object.values(state.pagantesHub.pracas).reduce((a, b) => a + b, 0) : null);
  const de = prev.meses[primeiro].pagantes || 0;
  const ate = prev.meses[ultimo].pagantes || 0;
  const pct = (v) => (ate > de ? Math.max(0, Math.min(100, ((v - de) / (ate - de)) * 100)) : 0);
  const fimUltimo = `${ultimo}-${String(new Date(Number(ultimo.slice(0, 4)), Number(ultimo.slice(5, 7)), 0).getDate())}`;
  const proximoSalto = meses.find((m) => m > mes && prev.meses[m].pagantes > (real ?? de));

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Meta{prev.titulo ? ` · ${prev.titulo}` : ''}</h2>
        <span className="text-xs text-slate-500">faltam {diffDays(fimUltimo, ref)} dias para o fim de {nomeMes(ultimo)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Numero rotulo="Pagantes hoje (Hub)" valor={num(real)} detalhe={state.pagantesHub ? `lido ${relativo(state.pagantesHub.em.slice(0, 10), ref)}` : 'abra o Hub para ler'} destaque />
        <Numero rotulo={`Meta de ${nomeMes(mesMeta)}`} valor={num(metaMes?.pagantes)} detalhe={real != null && metaMes?.pagantes != null ? diferenca(real - metaMes.pagantes) : ''} />
        <Numero rotulo={`Meta de ${nomeMes(ultimo)}`} valor={num(ate)} detalhe={real != null ? `faltam ${num(ate - real)}` : ''} />
        <Numero rotulo={`Receita/mês prevista ${nomeMes(ultimo)}`} valor={prev.meses[ultimo].receita ? brl(prev.meses[ultimo].receita) : '—'} detalhe={prev.meses[primeiro].receita ? `${nomeMes(primeiro)}: ${brl(prev.meses[primeiro].receita)}` : ''} />
      </div>
      <div className="space-y-1.5">
        <div className="relative h-3 rounded-sm bg-slate-100">
          <div className="absolute inset-y-0 left-0 rounded-sm bg-emerald-700" style={{ width: `${real != null ? pct(real) : 0}%` }} />
          {meses.map((m) => (
            <span key={m} title={`Meta ${nomeMes(m)}: ${num(prev.meses[m].pagantes)}`} className="absolute top-[-3px] h-[18px] w-px bg-slate-400" style={{ left: `${pct(prev.meses[m].pagantes)}%` }} />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>{num(de)} ({nomeMes(primeiro)}, base da previsão)</span>
          <span>{num(ate)} ({nomeMes(ultimo)})</span>
        </div>
      </div>
      <TabelaMeses prev={prev} real={state.pagantesMes || {}} />
      {real != null && real < de && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
          Hoje o Hub conta {num(real)} pagantes, {num(de - real)} a menos que a base da previsão ({num(de)} em {nomeMes(primeiro)}). Ou houve cancelamentos, ou a contagem é diferente.
          {proximoSalto && ` Até a meta de ${nomeMes(proximoSalto)} faltam ${num(prev.meses[proximoSalto].pagantes - real)} atletas, e não ${num(prev.meses[proximoSalto].pagantes - de)}.`}
        </p>
      )}
    </section>
  );
}

const diferenca = (d) => (d === 0 ? 'no alvo' : d > 0 ? `+${num(d)} acima` : `${num(d)} abaixo`);

function Numero({ rotulo, valor, detalhe, destaque }) {
  return (
    <div className={`rounded-lg p-3 ${destaque ? 'bg-emerald-50 ring-1 ring-emerald-100' : 'bg-slate-50'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</div>
      <div className="text-2xl font-semibold tracking-tight text-ink">{valor}</div>
      {detalhe && <div className="text-xs text-slate-500">{detalhe}</div>}
    </div>
  );
}

function TabelaMeses({ prev, real }) {
  const meses = Object.keys(prev.meses).sort();
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="py-1 font-semibold" />
            {meses.map((m) => (
              <th key={m} className="py-1 text-right font-semibold">{nomeMes(m)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-100">
            <td className="py-1.5 text-slate-500">Meta</td>
            {meses.map((m) => (
              <td key={m} className="py-1.5 text-right font-medium text-slate-700">{num(prev.meses[m].pagantes)}</td>
            ))}
          </tr>
          <tr className="border-t border-slate-100">
            <td className="py-1.5 text-slate-500">Real</td>
            {meses.map((m) => {
              const r = real[m]?.total;
              const ok = r != null && r >= prev.meses[m].pagantes;
              return (
                <td key={m} className={`py-1.5 text-right font-semibold ${r == null ? 'text-slate-300' : ok ? 'text-emerald-700' : 'text-red-600'}`}>{r == null ? '—' : num(r)}</td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ───────────── Números da previsão: digitar ou colar do Excel ─────────────
const ESPORTES = ['Tênis', 'Beach Tennis', 'Padel'];

function NumerosPrevisao() {
  const { state, setPlano27 } = useStore();
  const prev = previsaoDe(state);
  const vazia = !Object.keys(prev.meses).length && !prev.pracas.length;
  const [aberto, setAberto] = useState(vazia);
  const [colagem, setColagem] = useState('');
  const [aviso, setAviso] = useState('');
  const [nova, setNova] = useState({ cidade: '', esporte: 'Beach Tennis' });
  const salvar = (fn) => setPlano27((pl) => ({ ...pl, previsao: fn(previsaoDe({ plano27: pl })) }));
  const meses = Object.keys(prev.meses).sort();
  const mesesPracas = [...new Set(prev.pracas.flatMap((p) => Object.keys(p.metas || {})))].sort();

  const aplicarColagem = () => {
    const r = lerColagem(colagem);
    if (!Object.keys(r.meses).length && !r.pracas.length) return setAviso('Não reconheci nada. Copie as linhas da planilha junto com a linha dos meses (Out/26, Nov/26…).');
    salvar((pv) => {
      const pracas = [...pv.pracas];
      for (const p of r.pracas) {
        const i = pracas.findIndex((x) => x.id === p.id);
        if (i >= 0) pracas[i] = { ...pracas[i], ...p, metas: { ...pracas[i].metas, ...p.metas } };
        else pracas.push(p);
      }
      const ms = { ...pv.meses };
      for (const [m, v] of Object.entries(r.meses)) ms[m] = { ...(ms[m] || {}), ...v };
      return { ...pv, meses: ms, pracas };
    });
    setColagem('');
    setAviso(`✓ ${Object.keys(r.meses).length} meses e ${r.pracas.length} praças atualizados`);
  };
  const setMes = (m, campo, v) => salvar((pv) => ({ ...pv, meses: { ...pv.meses, [m]: { ...(pv.meses[m] || {}), [campo]: numero(v) } } }));
  const setPraca = (id, patch) => salvar((pv) => ({ ...pv, pracas: pv.pracas.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const addMes = () => {
    const ult = meses.at(-1);
    const d = ult ? new Date(Number(ult.slice(0, 4)), Number(ult.slice(5, 7)), 1) : new Date();
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    salvar((pv) => ({ ...pv, meses: { ...pv.meses, [m]: { pagantes: null, receita: null } } }));
  };

  return (
    <Section title="Números da previsão" right={<button onClick={() => setAberto(!aberto)} className="text-xs font-semibold text-slate-500 hover:text-ink">{aberto ? 'fechar' : 'abrir'}</button>}>
      {!aberto ? (
        <p className="px-1 text-xs text-slate-500">
          {meses.length} meses e {prev.pracas.length} praças. Ficam só na sua conta (não vão para o código do site).
        </p>
      ) : (
        <div className="space-y-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">Esses números ficam só na sua conta da central (privada), não no código do site. Dá para colar do Excel ou digitar.</p>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-800">Colar do Excel</div>
            <p className="text-xs text-slate-500">
              Na planilha, selecione a linha dos meses (Out/26, Nov/26…) junto com as linhas que quiser: "Atletas pagantes — TOTAL", "Receita mensal" e as praças ("Maringá | Tênis | …"). Copie (Ctrl+C) e cole aqui. Pode colar as tabelas separadas, uma de cada vez.
            </p>
            <textarea rows={4} value={colagem} onChange={(e) => setColagem(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2 font-mono text-xs outline-none focus:border-slate-400" placeholder="Cole aqui o que copiou da planilha" />
            <div className="flex items-center gap-3">
              <button onClick={aplicarColagem} disabled={!colagem.trim()} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:bg-slate-100 disabled:text-slate-400">Usar estes números</button>
              {aviso && <span className="text-xs text-slate-600">{aviso}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-800">Nome da meta</span>
              <input value={prev.titulo} onChange={(e) => salvar((pv) => ({ ...pv, titulo: e.target.value }))} placeholder="Ex.: crescer a base de pagantes até o fim da Etapa 01" className={`${inputBase} w-full`} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-800">Meta por mês</span>
              <button onClick={addMes} className="text-xs font-semibold text-slate-500 hover:text-ink">+ mês</button>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pr-3 text-left font-semibold" />
                    {meses.map((m) => (
                      <th key={m} className="px-1 font-semibold">{nomeMes(m)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['pagantes', 'Pagantes'], ['receita', 'Receita (R$)']].map(([campo, rot]) => (
                    <tr key={campo}>
                      <td className="pr-3 text-slate-500">{rot}</td>
                      {meses.map((m) => (
                        <td key={m} className="px-1 py-0.5">
                          <input defaultValue={prev.meses[m]?.[campo] ?? ''} onBlur={(e) => setMes(m, campo, e.target.value)} className="w-20 rounded-md border border-slate-200 px-1.5 py-0.5 text-right text-sm" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Praças ({prev.pracas.length})</span>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pr-3 text-left font-semibold">Praça</th>
                    <th className="px-1 font-semibold">Opera</th>
                    {mesesPracas.map((m) => (
                      <th key={m} className="px-1 font-semibold">{nomeMes(m)}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {prev.pracas.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap pr-3 text-slate-700">{p.cidade} · {p.esporte}</td>
                      <td className="px-1 text-center">
                        <input type="checkbox" checked={!!p.operando} onChange={(e) => setPraca(p.id, { operando: e.target.checked })} title="Já está em operação" />
                      </td>
                      {mesesPracas.map((m) => (
                        <td key={m} className="px-1 py-0.5">
                          <input defaultValue={p.metas?.[m] ?? ''} onBlur={(e) => setPraca(p.id, { metas: { ...(p.metas || {}), [m]: numero(e.target.value) } })} className="w-14 rounded-md border border-slate-200 px-1 py-0.5 text-right text-sm" />
                        </td>
                      ))}
                      <td className="pl-1">
                        <button onClick={() => confirm(`Tirar ${p.cidade} · ${p.esporte} do Plano?`) && salvar((pv) => ({ ...pv, pracas: pv.pracas.filter((x) => x.id !== p.id) }))} className="text-xs text-slate-300 hover:text-red-500">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cidade = nova.cidade.trim();
                if (!cidade) return;
                const id = `${cidade}|${nova.esporte}`;
                salvar((pv) => (pv.pracas.some((p) => p.id === id) ? pv : { ...pv, pracas: [...pv.pracas, { id, cidade, esporte: nova.esporte, operando: false, metas: {} }] }));
                setNova({ ...nova, cidade: '' });
              }}
              className="flex flex-wrap gap-2"
            >
              <input value={nova.cidade} onChange={(e) => setNova({ ...nova, cidade: e.target.value })} placeholder="+ praça (cidade)" className={`${inputBase} w-48 py-1 text-sm`} />
              <select value={nova.esporte} onChange={(e) => setNova({ ...nova, esporte: e.target.value })} className={`${inputBase} py-1 text-sm`}>
                {ESPORTES.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <button className="rounded-lg px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Adicionar</button>
            </form>
          </div>
        </div>
      )}
    </Section>
  );
}

// ───────────── Linha do tempo: fases e marcos ─────────────
function LinhaDoTempo() {
  const ref = today();
  const [todos, setTodos] = useState(false);
  const fase = FASES.find((f) => ref >= f.de && ref <= f.ate) || FASES[0];
  const proximos = MARCOS.filter((m) => m.data >= ref);
  const lista = todos ? MARCOS : proximos.slice(0, 6);
  const COR = { prazo: 'bg-amber-500', etapa: 'bg-emerald-700', evento: 'bg-violet-600', marco: 'bg-sky-600', meta: 'bg-red-600' };

  return (
    <Section title="Linha do tempo">
      <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {FASES.map((f) => (
            <div key={f.id} className={`rounded-lg px-3 py-2 ${f.id === fase.id ? 'bg-ink text-white' : 'bg-slate-50 text-slate-600'}`}>
              <div className="text-sm font-semibold">{f.nome}</div>
              <div className={`text-[11px] ${f.id === fase.id ? 'text-slate-300' : 'text-slate-400'}`}>{fmtCurto(f.de).slice(5)} → {fmtCurto(f.ate).slice(5)}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-600"><b className="text-ink">Agora: {fase.nome}.</b> {fase.resumo}</p>
        <ul className="space-y-1.5">
          {lista.map((m) => {
            const d = diffDays(m.data, ref);
            return (
              <li key={m.data + m.titulo} className={`flex items-baseline gap-3 text-sm ${d < 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-sm ${COR[m.tipo]}`} />
                <span className="w-24 shrink-0 tabular-nums text-slate-500">{m.data.split('-').reverse().join('/')}</span>
                <span className="min-w-0 flex-1">{m.titulo}</span>
                <span className="shrink-0 text-xs text-slate-400">{d === 0 ? 'hoje' : d > 0 ? `em ${d} dias` : ''}</span>
              </li>
            );
          })}
        </ul>
        <button onClick={() => setTodos(!todos)} className="text-xs font-semibold text-slate-500 hover:text-ink">
          {todos ? 'só os próximos' : `ver todos os marcos (${MARCOS.length})`}
        </button>
      </div>
    </Section>
  );
}

// ───────────── Foco do mês (até 3) ─────────────
function FocoDoMes() {
  const { state, setPlano27 } = useStore();
  const mes = today().slice(0, 7);
  const pl = state.plano27 || planoInicial();
  const metas = pl.foco?.[mes] || [];
  const sugestao = FOCO_SUGERIDO[mes];
  const set = (lista) => setPlano27((p) => ({ ...p, foco: { ...(p.foco || {}), [mes]: lista } }));
  const linhas = [...metas, ...Array.from({ length: Math.max(0, 3 - metas.length) }, () => ({ texto: '', feita: false }))].slice(0, 3);
  const editar = (n, patch) => set(linhas.map((m, i) => (i === n ? { ...m, ...patch } : m)));

  return (
    <Section title={`Foco de ${nomeMes(mes)}`} right={!metas.some((m) => m.texto) && sugestao ? <button onClick={() => set(sugestao.map((texto) => ({ texto, feita: false })))} className="text-xs font-semibold text-emerald-700">usar a sugestão da fase</button> : null}>
      <div className="grid gap-2 sm:grid-cols-3">
        {linhas.map((m, n) => (
          <div key={n} className={`flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ${m.feita ? 'ring-emerald-200' : 'ring-slate-200'}`}>
            <Check done={m.feita} onClick={() => m.texto && editar(n, { feita: !m.feita })} area="ranken" />
            <input className={`min-w-0 flex-1 bg-transparent text-sm font-medium outline-none ${m.feita ? 'text-slate-400 line-through' : 'text-slate-800'}`} placeholder={sugestao?.[n] || 'Meta do mês'} value={m.texto} onChange={(e) => editar(n, { texto: e.target.value })} />
          </div>
        ))}
      </div>
    </Section>
  );
}

// ───────────── Praças: situação de cada uma (Hub › Expansão) ─────────────
function situacaoPracas(state, ref) {
  const projetos = state.expansaoHub?.projetos || [];
  const reais = state.pagantesHub?.pracas || {};
  const pl = state.plano27 || planoInicial();
  // quanto do checklist já devia estar feito hoje (do Dia −48 até a estreia)
  const esperado = Math.max(0, Math.min(1, diffDays(ref, DIA_MENOS_48) / diffDays(ESTREIA, DIA_MENOS_48)));
  return previsaoDe(state).pracas.map((p) => {
    const proj = projetos.find((x) => sem(x.cidade) === sem(p.cidade) && (ESPORTE_HUB[x.esporte] || x.esporte) === p.esporte);
    const feito = proj && proj.total ? proj.feitos / proj.total : null;
    const quem = pl.pracas?.[p.id]?.quem || '';
    let sinal = 'ok';
    let motivo = '';
    if (p.operando) motivo = 'em operação';
    else if (!proj) (sinal = 'vermelho'), (motivo = 'sem projeto no Hub');
    else if (feito < esperado - 0.15) (sinal = 'vermelho'), (motivo = `checklist atrasado (devia estar em ~${Math.round(esperado * 100)}%)`);
    else if (feito < esperado - 0.05) (sinal = 'amarelo'), (motivo = 'checklist um pouco atrás');
    else motivo = esperado ? 'checklist em dia' : 'começa no Dia −48 (30/11)';
    return { ...p, proj, feito, real: reais[`${p.cidade}|${p.esporte}`] ?? (p.operando ? null : 0), quem, sinal, motivo };
  });
}

// meta da praça: o primeiro e o último mês com número (ex.: jan 25 · abr 72)
function metaResumo(p) {
  const ms = Object.keys(p.metas || {}).filter((m) => p.metas[m] != null && m >= today().slice(0, 7) && p.metas[m] > 0).sort();
  if (!ms.length) return 'sem meta';
  const ini = ms[0];
  const fim = ms.at(-1);
  return ini === fim ? `meta ${nomeMes(ini)}: ${num(p.metas[ini])}` : `meta ${nomeMes(ini)} ${num(p.metas[ini])} · ${nomeMes(fim)} ${num(p.metas[fim])}`;
}

function Pracas() {
  const { state, setPlano27 } = useStore();
  const ref = today();
  const [filtro, setFiltro] = useState('atencao');
  const lista = situacaoPracas(state, ref);
  const semProjeto = lista.filter((p) => !p.operando && !p.proj).length;
  const atrasadas = lista.filter((p) => p.proj && !p.operando && p.sinal === 'vermelho').length;
  const semQuem = lista.filter((p) => !p.operando && !p.quem).length;
  const mostrar = lista.filter((p) => (filtro === 'atencao' ? !p.operando && (p.sinal !== 'ok' || !p.quem) : filtro === 'novas' ? !p.operando : filtro === 'operando' ? p.operando : true));
  const setQuem = (id, quem) => setPlano27((pl) => ({ ...pl, pracas: { ...(pl.pracas || {}), [id]: { ...(pl.pracas?.[id] || {}), quem } } }));
  // projetos da Expansão que não estão no Plano (ex.: acabou de criar no Hub): aparecem para incluir ou ignorar
  const ignorados = state.plano27?.ignorarHub || [];
  const foraDoPlano = (state.expansaoHub?.projetos || []).filter((x) => !ignorados.includes(x.id) && !lista.some((p) => p.proj?.id === x.id));
  const incluir = (x) =>
    setPlano27((pl) => {
      const pv = previsaoDe({ plano27: pl });
      // "FOZ DO IGUAÇU" → "Foz do Iguaçu"
      const cidade = x.cidade.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()).replace(/ (Do|Da|De|Dos|Das) /g, (m) => m.toLowerCase());
      const esporte = ESPORTE_HUB[x.esporte] || x.esporte;
      return { ...pl, previsao: { ...pv, pracas: [...pv.pracas, { id: `${cidade}|${esporte}`, cidade, esporte, operando: x.status === 'em_jogo', metas: {} }] } };
    });
  const ignorar = (x) => setPlano27((pl) => ({ ...pl, ignorarHub: [...(pl.ignorarHub || []), x.id] }));
  const lidoEm = state.expansaoHub ? new Date(state.expansaoHub.em) : null;
  // telefones dos responsáveis (aba Locais do Hub) nas praças novas: o trabalho de agora
  const novasComLocais = lista.filter((p) => !p.operando && p.proj?.locais != null);
  const totLocais = novasComLocais.reduce((a, p) => a + p.proj.locais, 0);
  const totTel = novasComLocais.reduce((a, p) => a + (p.proj.comResponsavel || 0), 0);

  return (
    <Section title={`Praças (${lista.length})`} right={<span className="text-xs text-slate-500">{lidoEm ? `Hub lido ${relativo(lidoEm.toLocaleDateString('sv-SE'), ref)} às ${lidoEm.toTimeString().slice(0, 5)}` : 'abra o Hub para ler a Expansão'}</span>}>
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className={semProjeto ? 'font-semibold text-red-600' : 'text-emerald-700'}>{semProjeto} sem projeto no Hub</span>
          <span className={atrasadas ? 'font-semibold text-red-600' : 'text-emerald-700'}>{atrasadas} com checklist atrasado</span>
          <span className={semQuem ? 'font-semibold text-amber-700' : 'text-emerald-700'}>{semQuem} sem quem toca</span>
          <span className="text-slate-500">estreia {ESTREIA.split('-').reverse().join('/')} · Dia −48 em {DIA_MENOS_48.split('-').reverse().join('/')}</span>
        </div>
        {totLocais > 0 && (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-slate-800">Telefones dos responsáveis nas praças novas</span>
              <span className="text-slate-600">
                <b className="text-ink">{num(totTel)}</b> de {num(totLocais)} locais
              </span>
            </div>
            <div className="h-2 rounded-sm bg-slate-100">
              <div className="h-full rounded-sm bg-emerald-700" style={{ width: `${Math.round((totTel / totLocais) * 100)}%` }} />
            </div>
          </div>
        )}
        {foraDoPlano.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-sky-50 px-3 py-2.5 ring-1 ring-sky-100">
            <div className="text-sm font-semibold text-sky-900">No Hub, mas fora do Plano ({foraDoPlano.length})</div>
            {foraDoPlano.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span className="min-w-0 flex-1">{x.cidade} · {ESPORTE_HUB[x.esporte] || x.esporte} <span className="text-xs text-slate-500">({x.feitos}/{x.total} do checklist)</span></span>
                <button onClick={() => incluir(x)} className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100">Incluir no Plano</button>
                <button onClick={() => ignorar(x)} className="px-1 text-xs text-slate-400 hover:text-slate-600">ignorar</button>
              </div>
            ))}
          </div>
        )}
        <Segmented value={filtro} onChange={setFiltro} options={[['atencao', 'Precisam de atenção'], ['novas', 'Novas'], ['operando', 'Em operação'], ['todas', 'Todas']]} />
        {!mostrar.length && <p className="py-3 text-sm text-emerald-700">Nada pedindo atenção aqui.</p>}
        <div className="divide-y divide-slate-100">
          {mostrar.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${p.operando ? 'bg-emerald-700' : p.sinal === 'vermelho' ? 'bg-red-500' : p.sinal === 'amarelo' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <div className="min-w-[180px] flex-1">
                <div className="text-sm font-semibold text-ink">{p.cidade} · {p.esporte}</div>
                <div className="text-xs text-slate-500">{p.motivo}</div>
              </div>
              {!p.operando && (
                <div className="w-28 text-xs text-slate-500">
                  {p.proj ? (
                    <>
                      <div className="h-1.5 rounded-sm bg-slate-100"><div className="h-full rounded-sm bg-emerald-700" style={{ width: `${Math.round((p.feito || 0) * 100)}%` }} /></div>
                      <span>{p.proj.feitos}/{p.proj.total} do checklist</span>
                      {p.proj.locais != null && (
                        <div className={p.proj.locais && p.proj.comResponsavel >= p.proj.locais ? 'text-emerald-700' : 'text-slate-600'}>
                          telefones {p.proj.comResponsavel || 0}/{p.proj.locais}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-red-600">criar no Hub</span>
                  )}
                </div>
              )}
              <div className="w-36 text-xs text-slate-500">
                {metaResumo(p)}
                <div className="font-medium text-slate-700">real hoje: {num(p.real)}</div>
              </div>
              {!p.operando && (
                <select value={p.quem} onChange={(e) => setQuem(p.id, e.target.value)} className={`${inputBase} w-32 py-1 text-sm ${p.quem ? '' : 'text-amber-700'}`}>
                  <option value="">a definir</option>
                  {QUEM.map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              )}
              <a href={`${HUB_URL}match-admin/expansao${p.proj ? `/projetos/${p.proj.id}` : ''}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
                Hub ↗
              </a>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ───────────── Frentes → iniciativas → passos ─────────────
function Frentes() {
  const { state } = useStore();
  const pl = state.plano27 || planoInicial();
  const [aberta, setAberta] = useState(null);
  return (
    <Section title="Frentes">
      <div className="space-y-2">
        {pl.frentes.map((f) => (
          <Frente key={f.id} f={f} aberta={aberta === f.id} onToggle={() => setAberta(aberta === f.id ? null : f.id)} />
        ))}
      </div>
    </Section>
  );
}

function Frente({ f, aberta, onToggle }) {
  const { state, setPlano27, addTask } = useStore();
  const ref = today();
  const tarefas = new Map(state.tasks.map((t) => [t.id, t]));
  const feitoDe = (ps) => ps.feito || !!tarefas.get(ps.taskId)?.done;
  const passos = f.iniciativas.flatMap((i) => i.passos);
  const feitos = passos.filter(feitoDe).length;
  const vencidos = passos.filter((ps) => !feitoDe(ps) && ps.prazo && ps.prazo < ref).length;
  const proximo = passos.filter((ps) => !feitoDe(ps) && ps.prazo).sort((a, b) => a.prazo.localeCompare(b.prazo))[0];

  const mudar = (fn) => setPlano27((pl) => ({ ...pl, frentes: pl.frentes.map((x) => (x.id === f.id ? fn(x) : x)) }));
  const mudarIni = (iid, fn) => mudar((x) => ({ ...x, iniciativas: x.iniciativas.map((i) => (i.id === iid ? fn(i) : i)) }));
  const mudarPasso = (iid, pid, patch) => mudarIni(iid, (i) => ({ ...i, passos: i.passos.map((ps) => (ps.id === pid ? { ...ps, ...patch } : ps)) }));
  const virarTarefa = (ini, ps) => {
    const id = crypto.randomUUID().slice(0, 8);
    // iniciativa de outra pessoa: a tarefa da Laura é conferir com ela se o passo saiu
    const outro = ini.dono && ini.dono !== 'Laura' ? ini.dono : null;
    const title = outro ? `Conferir com o ${outro}: ${ps.texto}` : ps.texto;
    const notas = [outro && `Quem faz é o ${outro}; você acompanha e destrava.`, ps.porque, `Plano › ${f.nome} › ${ini.titulo}`];
    addTask({ id, title, area: 'ranken', due: ps.prazo || null, notes: notas.filter(Boolean).join('\n\n') });
    mudarPasso(ini.id, ps.id, { taskId: id });
  };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left">
        <div className="min-w-[200px] flex-1">
          <div className="text-[15px] font-semibold text-ink">{f.nome}</div>
          <div className="text-xs text-slate-500">{f.objetivo}</div>
        </div>
        <div className="w-28">
          <div className="h-1.5 rounded-sm bg-slate-100"><div className="h-full rounded-sm bg-emerald-700" style={{ width: `${passos.length ? (feitos / passos.length) * 100 : 0}%` }} /></div>
          <div className="text-xs text-slate-500">{feitos}/{passos.length} passos</div>
        </div>
        <div className="w-56 text-xs text-slate-500">
          {vencidos > 0 && <div className="font-semibold text-red-600">{vencidos} passo{vencidos > 1 ? 's' : ''} vencido{vencidos > 1 ? 's' : ''}</div>}
          {proximo && <div className="truncate">próximo: {proximo.texto} · {fmtCurto(proximo.prazo)}</div>}
        </div>
        <span className="text-xs font-semibold text-slate-400">{aberta ? 'fechar' : 'abrir'}</span>
      </button>
      {aberta && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-3">
          {f.iniciativas.map((ini) => (
            <div key={ini.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-slate-800">
                  {ini.titulo}
                  <select
                    value={ini.dono || ''}
                    onChange={(e) => mudarIni(ini.id, (i) => ({ ...i, dono: e.target.value }))}
                    title="Quem toca esta iniciativa (se não for você, o passo vira tarefa de conferir com a pessoa)"
                    className={`rounded-md border-0 bg-slate-50 px-1.5 py-0.5 text-xs font-medium ring-1 ring-slate-200 ${ini.dono && ini.dono !== 'Laura' ? 'text-violet-700' : 'text-slate-500'}`}
                  >
                    <option value="">com você</option>
                    {QUEM.filter((q) => q !== 'Laura').map((q) => (
                      <option key={q} value={q}>com o {q}</option>
                    ))}
                  </select>
                </div>
                {ini.prazo && <span className="text-xs text-slate-500">até {fmtCurto(ini.prazo)}</span>}
              </div>
              {ini.passos.map((ps) => {
                const feito = feitoDe(ps);
                const tarefa = tarefas.get(ps.taskId);
                const late = !feito && ps.prazo && ps.prazo < ref;
                return (
                  <div key={ps.id} className="flex items-start gap-2.5 py-1">
                    <Check done={feito} onClick={() => mudarPasso(ini.id, ps.id, { feito: !ps.feito })} area="ranken" />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${feito ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{ps.texto}</div>
                      {ps.porque && !feito && <div className="text-xs text-slate-500">{ps.porque}</div>}
                    </div>
                    <input type="date" value={ps.prazo || ''} onChange={(e) => mudarPasso(ini.id, ps.id, { prazo: e.target.value || null })} className={`w-[130px] shrink-0 rounded-md border px-1.5 py-0.5 text-xs ${late ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-600'}`} />
                    {!feito &&
                      (tarefa ? (
                        <span className="w-20 shrink-0 text-right text-xs text-emerald-700">na lista ✓</span>
                      ) : (
                        <button onClick={() => virarTarefa(ini, ps)} title="Criar a tarefa na sua lista, com o porquê nas notas" className="w-20 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                          → tarefa
                        </button>
                      ))}
                    <button onClick={() => confirm(`Apagar o passo "${ps.texto}"?`) && mudarIni(ini.id, (i) => ({ ...i, passos: i.passos.filter((x) => x.id !== ps.id) }))} className="shrink-0 px-1 text-xs text-slate-300 hover:text-red-500" title="Apagar o passo">
                      ✕
                    </button>
                  </div>
                );
              })}
              <NovoPasso onAdd={(texto, prazo) => mudarIni(ini.id, (i) => ({ ...i, passos: [...i.passos, { id: crypto.randomUUID().slice(0, 8), texto, prazo, porque: '' }] }))} />
            </div>
          ))}
          <NovaIniciativa onAdd={(titulo) => mudar((x) => ({ ...x, iniciativas: [...x.iniciativas, { id: crypto.randomUUID().slice(0, 8), titulo, prazo: null, passos: [] }] }))} />
        </div>
      )}
    </div>
  );
}

function NovoPasso({ onAdd }) {
  const [texto, setTexto] = useState('');
  const [prazo, setPrazo] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        onAdd(texto.trim(), prazo || null);
        setTexto('');
        setPrazo('');
      }}
      className="flex gap-2 pl-7"
    >
      <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="+ passo" className="min-w-0 flex-1 rounded-md border border-dashed border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400" />
      <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="w-[130px] rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600" />
    </form>
  );
}

function NovaIniciativa({ onAdd }) {
  const [titulo, setTitulo] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim()) return;
        onAdd(titulo.trim());
        setTitulo('');
      }}
    >
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="+ nova iniciativa nesta frente" className="w-full rounded-md border border-dashed border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400" />
    </form>
  );
}

// para a revisão de sexta: o que o Plano pede nesta e na próxima semana
export function resumoPlano(state, ref = today()) {
  const pracas = situacaoPracas(state, ref).filter((p) => !p.operando);
  const passos = passosDoPlano(state).filter((x) => !x.feito && x.prazo && x.prazo <= addDays(ref, 10)).sort((a, b) => a.prazo.localeCompare(b.prazo));
  return {
    semProjeto: pracas.filter((p) => !p.proj).length,
    atrasadas: pracas.filter((p) => p.proj && p.sinal === 'vermelho').length,
    semQuem: pracas.filter((p) => !p.quem).length,
    passos,
  };
}
