// Financeiro pessoal em 4 abas: Mês (resumo), Ano, Guardado e Movimentações.
// Os extratos (Nubank: CSV da conta, CSV do cartão, PDF da conta, extrato de custódia; PicPay: CSV)
// são lidos aqui no navegador: só as movimentações e os saldos ficam guardados (o arquivo não).
import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { CATEGORIAS, lerArquivo, resumoMes, jaExiste, avisosMes } from '../lib/financas';
import { today } from '../lib/dates';
import { Empty, Segmented, inputCls } from '../components/ui';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m) => {
  const n = MESES[Number(m.slice(5, 7)) - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} de ${m.slice(0, 4)}`;
};
const somaMes = (m, d) => {
  const [y, mm] = m.split('-').map(Number);
  const t = y * 12 + (mm - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const CORES = ['bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-sky-500', 'bg-amber-500'];

// valores escondidos (👁) ficam lembrados neste aparelho
const lerOculto = () => {
  try {
    return localStorage.getItem('fin-oculto') === '1';
  } catch {
    return false;
  }
};

export default function Financeiro() {
  const store = useStore();
  const { state, importarFinancas, setMeuNome, setSaldoGuardado } = store;
  const fin = { transacoes: {}, regras: {}, meuNome: '', saldos: {}, metas: {}, ...(state.financas || {}) };
  const meses = useMemo(() => [...new Set(Object.values(fin.transacoes).map((t) => t.data.slice(0, 7)))].sort(), [fin.transacoes]);
  const [aba, setAba] = useState('mes');
  const [mes, setMes] = useState(() => meses.at(-1) || today().slice(0, 7));
  const [oculto, setOculto] = useState(lerOculto);
  const [anexar, setAnexar] = useState(false);
  const [aviso, setAviso] = useState('');
  const arquivo = useRef(null);

  const brl = (n) => (oculto ? 'R$ •••' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const brl0 = (n) => (oculto ? 'R$ •••' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
  const alternarOculto = () =>
    setOculto((o) => {
      try {
        localStorage.setItem('fin-oculto', o ? '0' : '1');
      } catch {
        /* ignora */
      }
      return !o;
    });

  const r = resumoMes(fin, mes);
  const antes = resumoMes(fin, somaMes(mes, -1));
  const revisar = Object.values(fin.transacoes).filter((t) => t.data.startsWith(mes)).length ? r.lista.filter((t) => t.categoria === 'outros').length : 0;
  const totalGuardado = Object.values(fin.saldos || {}).reduce((s, x) => s + (Number(x.valor) || 0), 0);

  const importar = async (files) => {
    setAviso('Lendo…');
    try {
      let total = 0;
      let novos = 0;
      const vistos = { ...fin.transacoes };
      let nome = '';
      const caixinhas = [];
      for (const f of files) {
        const { itens, nome: n, periodo, custodia } = await lerArquivo(f);
        if (custodia) {
          nome ||= n;
          for (const c of custodia) setSaldoGuardado(c.lugar, c.valor, { em: c.em, liquido: c.liquido });
          caixinhas.push(...custodia.map((c) => c.lugar));
          continue;
        }
        nome ||= n;
        total += itens.length;
        for (const t of itens) if (!jaExiste(t, vistos)) (vistos[t.id] = t), novos++;
        importarFinancas(itens, n, periodo);
      }
      if (nome && !fin.meuNome) setMeuNome(nome);
      const ultimoMes = Object.values(vistos).map((t) => t.data.slice(0, 7)).sort().at(-1);
      if (ultimoMes && total) setMes(ultimoMes);
      const msgs = [];
      if (total) msgs.push(`${novos} movimentações novas (de ${total} lidas; o que já estava não duplica)`);
      if (caixinhas.length) msgs.push(`saldo atualizado: ${caixinhas.join(', ')}`);
      setAviso(`✓ ${msgs.join('. ')}.`);
    } catch (e) {
      setAviso(`⚠️ ${e.message}`);
    }
    if (arquivo.current) arquivo.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* topo: abas, mês, esconder valores, anexar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={aba}
          onChange={setAba}
          options={[
            ['mes', 'Mês'],
            ['ano', 'Ano'],
            ['guardado', 'Guardado'],
            ['movs', revisar ? `Movimentações · ${revisar} a revisar` : 'Movimentações'],
          ]}
        />
        <div className="flex items-center gap-1 text-sm">
          {(aba === 'mes' || aba === 'movs') && (
            <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-200">
              <button onClick={() => setMes(somaMes(mes, -1))} className="px-2 py-1.5 text-slate-500 hover:text-ink" aria-label="Mês anterior">◀</button>
              <span className="min-w-[8.5rem] text-center font-semibold text-slate-700">{nomeMes(mes)}</span>
              <button onClick={() => setMes(somaMes(mes, 1))} className="px-2 py-1.5 text-slate-500 hover:text-ink" aria-label="Próximo mês">▶</button>
            </div>
          )}
          <button onClick={alternarOculto} title={oculto ? 'Mostrar valores' : 'Esconder valores'} className="rounded-xl px-2.5 py-1.5 text-slate-500 ring-1 ring-slate-200 hover:text-ink">
            {oculto ? '🙈' : '👁'}
          </button>
          <button onClick={() => setAnexar(!anexar)} className={`rounded-xl px-3 py-1.5 font-semibold ring-1 ${anexar ? 'bg-violet-600 text-white ring-violet-600' : 'text-violet-700 ring-violet-200 hover:bg-violet-50'}`}>
            📎 Anexar
          </button>
        </div>
      </div>

      {anexar && (
        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <b className="text-slate-700">Nubank:</b> CSV da conta, CSV do cartão, PDF da conta ou extrato de custódia (saldo das caixinhas). <b className="text-slate-700">PicPay:</b> CSV. Pode mandar vários de uma vez.
            </div>
            <label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
              Escolher arquivos
              <input ref={arquivo} type="file" accept=".csv,.pdf" multiple className="hidden" onChange={(e) => e.target.files.length && importar([...e.target.files])} />
            </label>
          </div>
          {aviso && <div className={`rounded-lg px-3 py-2 text-sm ${aviso.startsWith('⚠️') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{aviso}</div>}
          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            Seu nome no banco (Pix entre as suas contas não é gasto):
            <input value={fin.meuNome} onChange={(e) => setMeuNome(e.target.value)} placeholder="como aparece no extrato" className="w-64 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
          </label>
        </section>
      )}

      {!meses.length ? (
        <Empty>Clique em 📎 Anexar e mande um extrato do Nubank ou do PicPay para começar.</Empty>
      ) : aba === 'mes' ? (
        <>
          {!fin.meuNome && (
            <label className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-100">
              ⚠️ Falta o seu nome como aparece no banco: sem ele, o Pix entre as suas contas conta como gasto e entrada.
              <input onBlur={(e) => e.target.value.trim() && setMeuNome(e.target.value.trim())} placeholder="Nome completo" className="w-60 rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm" />
            </label>
          )}
          <Mes r={r} antes={antes} mes={mes} totalGuardado={totalGuardado} brl={brl} brl0={brl0} irGuardado={() => setAba('guardado')} irMovs={() => setAba('movs')} />
        </>

      ) : aba === 'ano' ? (
        <Ano fin={fin} ano={mes.slice(0, 4)} brl0={brl0} oculto={oculto} onMes={(m) => (setMes(m), setAba('mes'))} />
      ) : aba === 'guardado' ? (
        <Guardado fin={fin} meses={meses} brl={brl} brl0={brl0} store={store} />
      ) : (
        <Movimentacoes r={r} brl={brl} store={store} />
      )}
    </div>
  );
}

// ── Mês: os 4 números, pra onde foi (barra), de onde veio e um aviso ──
function Mes({ r, antes, mes, totalGuardado, brl, brl0, irGuardado, irMovs }) {
  const [verTodas, setVerTodas] = useState(false);
  const [aberta, setAberta] = useState(null);
  // só compara se o mês anterior tem extrato de verdade (senão o % não diz nada)
  const variacao = (agora, a) => (a && antes.lista.length >= 15 ? `${agora >= a ? '+' : ''}${Math.round(((agora - a) / Math.abs(a)) * 100)}% vs ${MESES[Number(somaMes(mes, -1).slice(5)) - 1].slice(0, 3)}` : null);
  const avisos = avisosMes(r, antes.lista.length >= 15 ? antes : { entrou: 0, saiu: 0, sobrou: 0, gastosPorCat: [] });
  const cats = verTodas ? r.gastosPorCat : r.gastosPorCat.slice(0, 4);
  if (!r.lista.length) return <Empty>Nada lançado em {nomeMes(mes).toLowerCase()}. Anexe o extrato deste mês.</Empty>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero titulo="Entrou" valor={brl0(r.entrou)} cor="text-emerald-600" sub={variacao(r.entrou, antes.entrou)} />
        <Numero titulo="Saiu" valor={brl0(r.saiu)} cor="text-red-600" sub={variacao(r.saiu, antes.saiu)} />
        <Numero titulo="Sobrou" valor={brl0(r.sobrou)} cor={r.sobrou >= 0 ? 'text-ink' : 'text-red-600'} sub={r.entrou ? `${Math.round((r.sobrou / r.entrou) * 100)}% do que entrou` : null} />
        <button onClick={irGuardado} className="text-left">
          <Numero titulo="Guardado →" valor={totalGuardado ? brl0(totalGuardado) : '—'} cor="text-violet-700" sub={r.guardou || r.tirou ? `${r.guardou - r.tirou >= 0 ? '+' : '−'}${brl0(Math.abs(r.guardou - r.tirou))} no mês` : 'saldos em Guardado'} />
        </button>
      </div>

      {avisos.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-100">💡 {avisos.join(' · ')}</div>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-slate-700">Pra onde foi</h2>
        <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-100">
          {r.gastosPorCat.slice(0, 6).map((x, i) => (
            <div key={x.cat} title={CATEGORIAS[x.cat].nome} className={CORES[i]} style={{ width: `${(x.total / r.saiu) * 100}%` }} />
          ))}
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {cats.map((x, i) => (
            <div key={x.cat}>
              <button onClick={() => setAberta(aberta === x.cat ? null : x.cat)} className="flex w-full items-center gap-2 py-0.5 text-left text-sm">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CORES[i] || 'bg-slate-300'}`} />
                <span className="min-w-0 flex-1 truncate text-slate-700">{CATEGORIAS[x.cat].nome}</span>
                <span className="text-xs text-slate-400">{Math.round((x.total / r.saiu) * 100)}%</span>
                <b className="text-slate-800">{brl0(x.total)}</b>
              </button>
              {aberta === x.cat && (
                <div className="mb-1 ml-4 space-y-0.5 border-l border-slate-100 pl-2">
                  {x.itens.map((t) => (
                    <div key={t.id} className="flex justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{dm(t.data)} · {limpa(t.desc)}</span>
                      <span>{brl(Math.abs(t.valor))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {r.gastosPorCat.length > 4 && (
          <button onClick={() => setVerTodas(!verTodas)} className="text-xs font-semibold text-slate-500 hover:text-ink">
            {verTodas ? 'mostrar menos' : `+ ${r.gastosPorCat.length - 4} categorias`}
          </button>
        )}
      </section>

      {r.entradasPorCat.length > 0 && (
        <section className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
          <span className="font-bold text-slate-700">De onde veio: </span>
          <span className="text-slate-600">{r.entradasPorCat.map((x) => `${CATEGORIAS[x.cat].icone} ${CATEGORIAS[x.cat].nome} ${brl0(x.total)}`).join('  ·  ')}</span>
        </section>
      )}

      <button onClick={irMovs} className="text-xs font-semibold text-slate-500 hover:text-ink">
        Ver as {r.lista.length} movimentações do mês →
      </button>
    </div>
  );
}

// ── Ano: entrou × saiu por mês, guardado e médias ──
function Ano({ fin, ano, brl0, oculto, onMes }) {
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
  const res = meses.map((m) => ({ m, ...resumoMes(fin, m) })).filter((x) => x.lista.length);
  if (!res.length) return <Empty>Nada lançado em {ano}.</Empty>;
  const max = Math.max(1, ...res.flatMap((x) => [x.entrou, x.saiu]));
  const soma = (k) => res.reduce((s, x) => s + x[k], 0);
  const cats = {};
  for (const x of res) for (const c of x.gastosPorCat) cats[c.cat] = (cats[c.cat] || 0) + c.total;
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero titulo={`Entrou em ${ano}`} valor={brl0(soma('entrou'))} cor="text-emerald-600" />
        <Numero titulo={`Saiu em ${ano}`} valor={brl0(soma('saiu'))} cor="text-red-600" sub={`média ${brl0(soma('saiu') / res.length)}/mês`} />
        <Numero titulo="Sobrou" valor={brl0(soma('sobrou'))} cor="text-ink" />
        <Numero titulo="Guardou (líquido)" valor={brl0(soma('guardou') - soma('tirou'))} cor="text-violet-700" />
      </div>
      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">Mês a mês</h2>
          <span className="flex gap-3 text-xs text-slate-500">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />entrou</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />saiu</span>
          </span>
        </div>
        <div className="flex h-40 items-end gap-2">
          {res.map((x) => (
            <button key={x.m} onClick={() => onMes(x.m)} title={`${nomeMes(x.m)}: entrou ${brl0(x.entrou)} · saiu ${brl0(x.saiu)}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <div className="w-1/3 rounded-t bg-emerald-500" style={{ height: oculto ? '0' : `${(x.entrou / max) * 100}%` }} />
                <div className="w-1/3 rounded-t bg-red-400" style={{ height: oculto ? '0' : `${(x.saiu / max) * 100}%` }} />
              </div>
              <span className="text-[11px] text-slate-500">{MESES[Number(x.m.slice(5)) - 1].slice(0, 3)}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Clique num mês para abrir.</p>
      </section>
      <section className="space-y-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-slate-700">O que mais pesou no ano</h2>
        {top.map(([cat, v]) => (
          <div key={cat} className="flex justify-between text-sm">
            <span className="text-slate-700">{CATEGORIAS[cat].icone} {CATEGORIAS[cat].nome}</span>
            <b className="text-slate-800">{brl0(v)} <span className="text-xs font-normal text-slate-400">({brl0(v / res.length)}/mês)</span></b>
          </div>
        ))}
      </section>
    </div>
  );
}

// ── Guardado: um cartão por lugar (saldo, data, meta) + quanto entrou/saiu por mês ──
function Guardado({ fin, meses, brl, brl0, store }) {
  const { setSaldoGuardado, setMetaGuardado } = store;
  const saldos = fin.saldos || {};
  const metas = fin.metas || {};
  const lugares = [...new Set(['Cofrinho PicPay', ...Object.keys(saldos)])].filter((l) => l !== 'Caixinhas Nubank' || saldos[l]);
  const total = Object.values(saldos).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const [editando, setEditando] = useState(null);
  const [novo, setNovo] = useState('');
  const hist = meses.slice(-8).map((m) => ({ m, ...resumoMes(fin, m) }));
  const maxH = Math.max(1, ...hist.map((x) => Math.max(x.guardou, x.tirou)));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-violet-500">Total guardado hoje</div>
        <div className="text-3xl font-bold text-violet-800">{total ? brl(total) : '—'}</div>
        <div className="text-xs text-violet-500">Não entra em "Saiu" nem em "Entrou": é dinheiro seu mudando de lugar.</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {lugares.map((l) => {
          const s = saldos[l];
          const meta = metas[l];
          return (
            <div key={l} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-700">🐷 {l}</div>
                  <div className="text-2xl font-bold text-ink">{s ? brl(s.valor) : '—'}</div>
                  <div className="text-xs text-slate-400">
                    {s ? `em ${s.em.split('-').reverse().join('/')}` : 'sem saldo ainda'}
                    {s?.liquido != null && ` · líquido ${brl(s.liquido)}`}
                  </div>
                </div>
                <button onClick={() => setEditando(editando === l ? null : l)} className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-ink" aria-label="Editar">✏️</button>
              </div>
              {meta > 0 && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, ((s?.valor || 0) / meta) * 100)}%` }} />
                  </div>
                  <div className="text-xs text-slate-500">
                    {Math.round(((s?.valor || 0) / meta) * 100)}% da meta de {brl0(meta)}
                  </div>
                </div>
              )}
              {editando === l && (
                <EditaLugar
                  s={s}
                  meta={meta}
                  salvar={(valor, m) => {
                    if (valor != null) setSaldoGuardado(l, valor, s?.liquido != null && valor === s.valor ? { liquido: s.liquido, em: s.em } : {});
                    setMetaGuardado(l, m);
                    setEditando(null);
                  }}
                  remover={() => confirm(`Tirar "${l}" da lista?`) && (setSaldoGuardado(l, null), setMetaGuardado(l, 0), setEditando(null))}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="outro lugar (ex.: Viagem)" className="w-56 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <button onClick={() => novo.trim() && (setSaldoGuardado(novo.trim(), 0), setNovo(''), setEditando(novo.trim()))} className="rounded-lg px-3 py-1.5 font-semibold text-violet-700 ring-1 ring-violet-200">
          + adicionar
        </button>
        <span className="text-xs text-slate-400">As caixinhas do Nubank atualizam sozinhas com o extrato de custódia (📎 Anexar).</span>
      </div>

      {hist.some((x) => x.guardou || x.tirou) && (
        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-700">Guardou e tirou por mês</h2>
          {hist.map((x) => (
            <div key={x.m} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-slate-500">{MESES[Number(x.m.slice(5)) - 1].slice(0, 3)}</span>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-violet-400" style={{ width: `${(x.guardou / maxH) * 100}%` }} />
                {x.tirou > 0 && <div className="mt-0.5 h-2 rounded-full bg-amber-300" style={{ width: `${(x.tirou / maxH) * 100}%` }} />}
              </div>
              <span className="w-28 shrink-0 text-right text-slate-600">
                +{brl0(x.guardou)}
                {x.tirou > 0 && <span className="text-amber-600"> −{brl0(x.tirou)}</span>}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function EditaLugar({ s, meta, salvar, remover }) {
  const num = (v) => (String(v).trim() ? Number(String(v).replace(/\./g, '').replace(',', '.')) || 0 : null);
  const [valor, setValor] = useState(s ? String(s.valor).replace('.', ',') : '');
  const [m, setM] = useState(meta ? String(meta).replace('.', ',') : '');
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2 text-xs">
      <label className="space-y-0.5">
        <span className="block text-slate-500">Saldo de hoje (R$)</span>
        <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
      </label>
      <label className="space-y-0.5">
        <span className="block text-slate-500">Meta (opcional)</span>
        <input inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} placeholder="ex.: 5.000" className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
      </label>
      <button onClick={() => salvar(num(valor), num(m) || 0)} className="rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white">Salvar</button>
      <button onClick={remover} className="ml-auto text-slate-400 hover:text-red-500">tirar da lista</button>
    </div>
  );
}

// ── Movimentações: busca, filtro, "a revisar" e lançar à mão ──
function Movimentacoes({ r, brl, store }) {
  const { setCategoriaTransacao, deleteTransacao, addTransacao } = store;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas'); // todas | revisar | categoria
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = r.lista
    .filter((t) => (filtro === 'todas' ? true : filtro === 'revisar' ? t.categoria === 'outros' : t.categoria === filtro))
    .filter((t) => !busca.trim() || norm(t.desc).includes(norm(busca.trim())));
  const nRevisar = r.lista.filter((t) => t.categoria === 'outros').length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar (ex.: uber, ifood, nome)" className={`${inputCls} max-w-xs py-1.5`} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="todas">Todas ({r.lista.length})</option>
          {nRevisar > 0 && <option value="revisar">❔ A revisar ({nRevisar})</option>}
          {Object.entries(CATEGORIAS).map(([k, c]) => {
            const n = r.lista.filter((t) => t.categoria === k).length;
            return n ? <option key={k} value={k}>{c.icone} {c.nome} ({n})</option> : null;
          })}
        </select>
      </div>
      {nRevisar > 0 && filtro !== 'revisar' && (
        <button onClick={() => setFiltro('revisar')} className="w-full rounded-xl bg-amber-50 px-3.5 py-2.5 text-left text-sm text-amber-900 ring-1 ring-amber-100">
          ❔ {nRevisar} movimentações caíram em "Outros". Classifique uma vez (com "todas iguais") e a central aprende →
        </button>
      )}
      <div className="space-y-1">
        {lista.map((t) => (
          <Mov key={t.id} t={t} brl={brl} setCat={setCategoriaTransacao} apagar={deleteTransacao} />
        ))}
        {!lista.length && <p className="text-sm text-slate-400">Nada encontrado.</p>}
      </div>
      <Manual add={addTransacao} />
    </div>
  );
}

const limpa = (desc) => desc.replace(/^Compra no débito - /, '').replace(/ - •••.*$/, '').replace(/ - \d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/, '');

function Numero({ titulo, valor, cor, sub }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</div>
      <div className={`whitespace-nowrap text-lg font-bold lg:text-xl ${cor}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// Uma movimentação, com a troca de categoria
function Mov({ t, brl, setCat, apagar }) {
  const [lembrar, setLembrar] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-100">
      <span className="w-11 shrink-0 text-xs text-slate-400">{dm(t.data)}</span>
      <span className="min-w-0 flex-1 truncate text-slate-700" title={t.desc}>
        {limpa(t.desc)}
        <span className="ml-1 text-[10px] uppercase text-slate-300">{t.origem}</span>
      </span>
      <b className={`shrink-0 ${t.valor > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>{t.valor > 0 ? '+' : ''}{brl(t.valor)}</b>
      <select value={t.categoria} onChange={(e) => setCat(t.id, e.target.value, lembrar)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs">
        {Object.entries(CATEGORIAS).map(([k, c]) => (
          <option key={k} value={k}>{c.icone} {c.nome}</option>
        ))}
      </select>
      <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400" title="Vale para as outras movimentações da mesma pessoa/loja">
        <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> todas iguais
      </label>
      {t.origem === 'manual' && (
        <button onClick={() => confirm('Apagar este lançamento?') && apagar(t.id)} className="text-xs text-slate-300 hover:text-red-500">✕</button>
      )}
    </div>
  );
}

// Lançamento à mão (dinheiro, outro banco…)
function Manual({ add }) {
  const [f, setF] = useState({ data: today(), desc: '', valor: '', tipo: 'gasto', cat: 'outros' });
  const salvar = (e) => {
    e.preventDefault();
    const v = Number(String(f.valor).replace(/\./g, '').replace(',', '.'));
    if (!f.desc.trim() || !v) return;
    add({ data: f.data, desc: f.desc.trim(), valor: f.tipo === 'gasto' ? -Math.abs(v) : Math.abs(v), catManual: f.cat });
    setF({ ...f, desc: '', valor: '' });
  };
  const cats = Object.entries(CATEGORIAS).filter(([, c]) => c.tipo === (f.tipo === 'gasto' ? 'gasto' : 'entrada'));
  return (
    <form onSubmit={salvar} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm font-bold text-slate-700">✍️ Lançar à mão</div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, cat: e.target.value === 'gasto' ? 'outros' : 'outras_entradas' })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="gasto">Gasto</option>
          <option value="entrada">Entrada</option>
        </select>
        <input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input className={`${inputCls} min-w-[10rem] flex-1 py-1.5`} placeholder="Descrição" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
        <input inputMode="decimal" placeholder="R$" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm" />
        <select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          {cats.map(([k, c]) => (
            <option key={k} value={k}>{c.icone} {c.nome}</option>
          ))}
        </select>
        <button className="rounded-xl bg-ink px-4 py-1.5 text-sm font-bold text-white">Lançar</button>
      </div>
    </form>
  );
}
