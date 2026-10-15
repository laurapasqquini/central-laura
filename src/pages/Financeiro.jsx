// Financeiro pessoal: quanto entrou, quanto saiu e pra onde foi, mês a mês.
// Os extratos do Nubank (CSV da conta, CSV do cartão ou PDF da conta) são lidos aqui no navegador:
// só as movimentações ficam guardadas (o arquivo não).
import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { CATEGORIAS, lerArquivo, resumoMes, jaExiste } from '../lib/financas';
import { today } from '../lib/dates';
import { Empty, inputCls } from '../components/ui';

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m) => { const n = MESES[Number(m.slice(5, 7)) - 1]; return `${n[0].toUpperCase()}${n.slice(1)} de ${m.slice(0, 4)}`; };
const mesAntes = (m) => {
  const [y, mm] = m.split('-').map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
};
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function Financeiro() {
  const { state, importarFinancas, setCategoriaTransacao, addTransacao, deleteTransacao, setMeuNome, setSaldoGuardado } = useStore();
  const fin = { transacoes: {}, regras: {}, meuNome: '', ...(state.financas || {}) };
  const meses = useMemo(() => [...new Set(Object.values(fin.transacoes).map((t) => t.data.slice(0, 7)))].sort().reverse(), [fin.transacoes]);
  const [mes, setMes] = useState(() => meses[0] || today().slice(0, 7));
  const [aviso, setAviso] = useState('');
  const [aberta, setAberta] = useState(null); // categoria aberta
  const [verTodas, setVerTodas] = useState(false);
  const arquivo = useRef(null);

  const r = resumoMes(fin, mes);
  const antes = resumoMes(fin, mesAntes(mes));
  const maxGasto = Math.max(1, ...r.gastosPorCat.map((x) => x.total));

  const importar = async (files) => {
    setAviso('Lendo…');
    const partes = [];
    try {
      let total = 0;
      let novos = 0;
      const vistos = { ...fin.transacoes };
      let nome = '';
      for (const f of files) {
        const { itens, nome: n, periodo } = await lerArquivo(f);
        nome ||= n;
        total += itens.length;
        for (const t of itens) if (!jaExiste(t, vistos)) (vistos[t.id] = t), novos++;
        importarFinancas(itens, n, periodo);
        partes.push(f.name);
      }
      if (nome && !fin.meuNome) setMeuNome(nome);
      const ultimoMes = Object.values(vistos).map((t) => t.data.slice(0, 7)).sort().at(-1);
      if (ultimoMes) setMes(ultimoMes);
      setAviso(`✓ ${novos} movimentações novas (de ${total} ${files.length > 1 ? 'nos arquivos' : 'no arquivo'}; as que já estavam não entram de novo).`);
    } catch (e) {
      setAviso(`⚠️ ${e.message}`);
    }
    if (arquivo.current) arquivo.current.value = '';
  };

  const variacao = (agora, antes0) => {
    if (!antes0) return null;
    const p = Math.round(((agora - antes0) / Math.abs(antes0)) * 100);
    return `${p > 0 ? '+' : ''}${p}% vs ${MESES[Number(mesAntes(mes).slice(5, 7)) - 1]}`;
  };

  return (
    <div className="space-y-5">
      {/* importar */}
      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-ink">📎 Extratos (Nubank e PicPay)</div>
            <div className="text-xs text-slate-500">Nubank: CSV da conta, CSV do cartão ou PDF da conta. PicPay: CSV. Pode mandar vários de uma vez; o que já foi lido não duplica.</div>
          </div>
          <label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
            Anexar extrato
            <input ref={arquivo} type="file" accept=".csv,.pdf" multiple className="hidden" onChange={(e) => e.target.files.length && importar([...e.target.files])} />
          </label>
        </div>
        {aviso && <div className={`rounded-lg px-3 py-2 text-sm ${aviso.startsWith('⚠️') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{aviso}</div>}
        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          Seu nome no banco (Pix entre as suas contas não é gasto; para o PicPay conta como guardado):
          <input value={fin.meuNome} onChange={(e) => setMeuNome(e.target.value)} placeholder="como aparece no extrato" className="w-64 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
        </label>
      </section>

      {!meses.length ? (
        <Empty>Anexe um extrato do Nubank para começar. Dá para lançar à mão também (lá embaixo).</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {[...new Set([mes, ...meses])].sort().reverse().map((m) => (
                <option key={m} value={m}>{nomeMes(m)}</option>
              ))}
            </select>
          </div>

          {/* resumo */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Numero titulo="Entrou" valor={r.entrou} cor="text-emerald-600" sub={variacao(r.entrou, antes.entrou)} />
            <Numero titulo="Saiu" valor={r.saiu} cor="text-red-600" sub={variacao(r.saiu, antes.saiu)} />
            <Numero titulo="Sobrou" valor={r.sobrou} cor={r.sobrou >= 0 ? 'text-ink' : 'text-red-600'} sub={r.entrou ? `${Math.round((r.sobrou / r.entrou) * 100)}% do que entrou` : null} />
          </div>

          {/* guardado: cofrinho do PicPay e caixinhas do Nubank (não é gasto nem entrada) */}
          <Guardado fin={fin} r={r} setSaldo={setSaldoGuardado} />


          {/* entradas */}
          {r.entradasPorCat.length > 0 && (
            <section className="space-y-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">De onde veio</h2>
              {r.entradasPorCat.map((x) => (
                <div key={x.cat} className="flex justify-between text-sm">
                  <span className="text-slate-700">{CATEGORIAS[x.cat].icone} {CATEGORIAS[x.cat].nome}</span>
                  <b className="text-slate-800">{brl(x.total)}</b>
                </div>
              ))}
            </section>
          )}

          {/* gastos por categoria */}
          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-700">Pra onde foi</h2>
            {r.gastosPorCat.map((x) => (
              <div key={x.cat}>
                <button onClick={() => setAberta(aberta === x.cat ? null : x.cat)} className="w-full space-y-1 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">
                      {CATEGORIAS[x.cat].icone} {CATEGORIAS[x.cat].nome} <span className="text-xs text-slate-400">({x.itens.length})</span>
                    </span>
                    <span>
                      <b className="text-slate-800">{brl(x.total)}</b> <span className="text-xs text-slate-400">{r.saiu ? `${Math.round((x.total / r.saiu) * 100)}%` : ''}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${(x.total / maxGasto) * 100}%` }} />
                  </div>
                </button>
                {aberta === x.cat && (
                  <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2">
                    {x.itens.map((t) => (
                      <Mov key={t.id} t={t} regras={fin.regras} setCat={setCategoriaTransacao} apagar={deleteTransacao} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!r.gastosPorCat.length && <p className="text-sm text-slate-400">Nenhum gasto neste mês.</p>}
          </section>

          {/* todas as movimentações */}
          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <button onClick={() => setVerTodas(!verTodas)} className="flex w-full items-center justify-between text-left">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                Todas as movimentações <span className="text-slate-400">{r.lista.length}</span>
              </h2>
              <span className="text-xs font-semibold text-slate-400">{verTodas ? 'esconder' : 'ver'}</span>
            </button>
            {verTodas && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Categoria errada? Troque no menu: dá para valer só para esta ou para todas da mesma pessoa/loja.</p>
                {r.lista.map((t) => (
                  <Mov key={t.id} t={t} regras={fin.regras} setCat={setCategoriaTransacao} apagar={deleteTransacao} />
                ))}
              </div>
            )}
            {r.ignoradas.length > 0 && !verTodas && <p className="text-xs text-slate-400">{r.ignoradas.length} não contam no resumo (fatura paga, Pix entre as suas contas).</p>}
          </section>
        </>
      )}

      <Manual add={addTransacao} />
    </div>
  );
}

// Guardado: saldo de hoje de cada lugar (preenchido à mão, o extrato não traz) e o que entrou/saiu no mês
const LUGARES = ['Cofrinho PicPay', 'Caixinhas Nubank'];
function Guardado({ fin, r, setSaldo }) {
  const saldos = fin.saldos || {};
  const lugares = [...new Set([...LUGARES, ...Object.keys(saldos)])];
  const total = Object.values(saldos).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const [novo, setNovo] = useState('');
  const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-violet-700">🐷 Guardado</h2>
        {total > 0 && (
          <span className="text-sm text-slate-500">
            total hoje <b className="text-lg text-violet-700">{brl(total)}</b>
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lugares.map((l) => (
          <label key={l} className="flex items-center justify-between gap-2 rounded-xl bg-violet-50/60 px-3 py-2 text-sm">
            <span className="text-slate-700">{l}</span>
            <span className="flex items-center gap-1">
              <span className="text-xs text-slate-400">R$</span>
              <input
                inputMode="decimal"
                defaultValue={saldos[l] ? String(saldos[l].valor).replace('.', ',') : ''}
                onBlur={(e) => (e.target.value.trim() ? setSaldo(l, num(e.target.value)) : saldos[l] && setSaldo(l, null))}
                placeholder="saldo de hoje"
                className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm"
              />
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="outra caixinha (ex.: Viagem)" className="w-56 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
        <button onClick={() => novo.trim() && (setSaldo(novo.trim(), 0), setNovo(''))} className="rounded-lg px-2 py-1 font-semibold text-violet-700 ring-1 ring-violet-200">
          + adicionar
        </button>
        {Object.values(saldos)[0] && <span>saldos atualizados em {Object.values(saldos).map((x) => x.em).sort().at(-1).split('-').reverse().join('/')}</span>}
      </div>
      <div className="flex flex-wrap gap-x-6 border-t border-slate-100 pt-2 text-sm text-slate-600">
        <span>
          Neste mês: guardou <b className="text-slate-800">{brl(r.guardou)}</b>
        </span>
        <span>
          tirou <b className="text-slate-800">{brl(r.tirou)}</b>
        </span>
        <span>
          saldo <b className={r.guardou - r.tirou >= 0 ? 'text-violet-700' : 'text-amber-600'}>{r.guardou - r.tirou >= 0 ? '+' : ''}{brl(r.guardou - r.tirou)}</b>
        </span>
      </div>
      <p className="text-xs text-slate-400">Não entra em "Saiu" nem em "Entrou": é dinheiro seu mudando de lugar. Com o extrato do PicPay, o guardado é o que foi para o cofrinho.</p>
    </section>
  );
}

function Numero({ titulo, valor, cor, sub }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</div>
      <div className={`text-2xl font-bold ${cor}`}>{brl(valor)}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// Uma movimentação, com a troca de categoria
function Mov({ t, setCat, apagar }) {
  const [lembrar, setLembrar] = useState(true);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm ring-1 ring-slate-100">
      <span className="w-11 shrink-0 text-xs text-slate-400">{dm(t.data)}</span>
      <span className="min-w-0 flex-1 truncate text-slate-700" title={t.desc}>
        {t.desc.replace(/^Compra no débito - /, '').replace(/ - •••.*$/, '').replace(/ - \d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/, '')}
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
