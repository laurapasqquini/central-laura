import { useState } from 'react';
import { useStore } from '../lib/store';
import { today, fmtCurto, relativo } from '../lib/dates';
import { periodo, montarRelatorio, textoRelatorio, baixarPdf, tituloRelatorio } from '../lib/relatorio';
import { Section, Empty, Segmented, inputCls } from '../components/ui';
import { sugerirBaixas } from '../lib/engine';

const PERIODOS = [
  ['hoje', 'Hoje'],
  ['semana', 'Esta semana'],
  ['semana-passada', 'Semana passada'],
  ['mes', 'Este mês'],
  ['mes-passado', 'Mês passado'],
  ['livre', 'Escolher datas'],
];

export default function Relatorios() {
  const { state } = useStore();
  const ref = today();
  const [tipo, setTipo] = useState('semana');
  const [livre, setLivre] = useState([ref, ref]);
  const [area, setArea] = useState('ranken');
  const [inclui, setInclui] = useState({ eu: true, lolis: true });
  const [msg, setMsg] = useState('');

  const per = tipo === 'livre' ? livre : periodo(tipo, ref);
  const dias = montarRelatorio(state, per, area);

  const aviso = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2000);
  };
  const copiar = async () => {
    const texto = textoRelatorio(dias, per, area, inclui);
    try {
      await navigator.clipboard.writeText(texto);
      aviso('Copiado ✓ É só colar no WhatsApp.');
    } catch {
      prompt('Copie o relatório:', texto);
    }
  };
  const pdf = async () => {
    aviso('Gerando o PDF…');
    await baixarPdf(dias, per, area, inclui);
    aviso('PDF baixado ✓');
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">📊 Relatórios</h1>
        <p className="text-sm text-slate-500">O que você fez sai sozinho do que marcou como feito. O da Lolis é o que você cola.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Colar chave="relatosLolis" titulo="🙋 Colar o que a Lolis fez" placeholder="Cole aqui o que a Lolis mandou no WhatsApp…" cor="bg-amber-500" />
        <Colar chave="relatosLaura" titulo="✍️ Anotar o que eu fiz (fora da central)" placeholder="Ex.: reunião com a arena X, liguei pra 4 inadimplentes, resolvi o WO do João…" cor="bg-indigo-600" />
      </div>

      <Section title="Ver e exportar">
        <div className="space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <Segmented value={tipo} onChange={setTipo} options={PERIODOS} />
          {tipo === 'livre' && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              de <input type="date" className={`${inputCls} w-40`} value={livre[0]} onChange={(e) => e.target.value && setLivre([e.target.value, livre[1] < e.target.value ? e.target.value : livre[1]])} />
              até <input type="date" className={`${inputCls} w-40`} value={livre[1]} onChange={(e) => e.target.value && setLivre([livre[0] > e.target.value ? e.target.value : livre[0], e.target.value])} />
            </div>
          )}
          <Segmented value={area} onChange={setArea} options={[['ranken', 'RANKEN'], ['gralha', 'Gralha Azul'], ['pessoal', 'Pessoal'], ['all', 'Tudo']]} />
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={inclui.eu} onChange={(e) => setInclui({ ...inclui, eu: e.target.checked })} /> O que eu fiz
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={inclui.lolis} onChange={(e) => setInclui({ ...inclui, lolis: e.target.checked })} /> O que a Lolis fez
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copiar} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">📋 Copiar texto</button>
            <button onClick={pdf} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">⬇ Baixar PDF</button>
            {msg && <span className="self-center text-sm font-medium text-slate-600">{msg}</span>}
          </div>
        </div>
      </Section>

      <Section title={tituloRelatorio(per, area)} count={dias.length || null}>
        {!dias.length && <Empty>Nada registrado neste período.</Empty>}
        <div className="space-y-3">
          {dias.map((d) => (
            <div key={d.date} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-2 text-sm font-bold capitalize text-slate-700">
                {relativo(d.date, ref)} <span className="font-normal normal-case text-slate-400">· {fmtCurto(d.date)}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {inclui.eu && <Bloco nome="Eu" itens={d.eu} texto={d.notaEu} cor="text-indigo-700" />}
                {inclui.lolis && <Bloco nome="Lolis" itens={d.lolisFeitos} texto={d.lolis} cor="text-amber-700" />}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Bloco({ nome, itens, texto, cor }) {
  return (
    <div className="min-w-0">
      <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${cor}`}>{nome}</div>
      {!itens.length && !texto && <div className="text-sm text-slate-400">—</div>}
      <ul className="space-y-0.5 text-sm text-slate-700">
        {itens.map((t) => (
          <li key={t}>✓ {t}</li>
        ))}
      </ul>
      {texto && <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-700">{texto}</pre>}
    </div>
  );
}

// Caixa de colar/anotar por dia (fica salvo na central)
function Colar({ chave, titulo, placeholder, cor }) {
  const { state, setRelato, darBaixa } = useStore();
  const ref = today();
  const relatos = state[chave] || {};
  const [data, setData] = useState(ref);
  const [texto, setTexto] = useState(relatos[ref] || '');
  const [salvo, setSalvo] = useState(false);

  const trocarData = (d) => {
    setData(d);
    setTexto(relatos[d] || '');
  };
  const salvar = () => {
    setRelato(chave, data, texto);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
    // relatório da Lolis: procura o que ela fez entre as atividades dela para dar baixa
    if (chave === 'relatosLolis') {
      const sug = sugerirBaixas(state, data, texto);
      setBaixas(sug);
      setMarcadas(new Set(sug.map((x) => x.key)));
    }
  };
  const [baixas, setBaixas] = useState(null);
  const [marcadas, setMarcadas] = useState(new Set());
  const confirmar = () => {
    darBaixa(baixas.filter((x) => marcadas.has(x.key)));
    setBaixas([]);
  };

  return (
    <Section title={titulo}>
      <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Dia
          <input type="date" className={`${inputCls} w-40`} value={data} onChange={(e) => trocarData(e.target.value || ref)} />
          {relatos[data] && <span className="text-xs font-semibold text-emerald-600">✓ já tem neste dia (editando)</span>}
        </div>
        <textarea rows={4} className={inputCls} placeholder={placeholder} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button onClick={salvar} disabled={texto.trim() === (relatos[data] || '')} className={`w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40 ${cor}`}>
          {salvo ? 'Salvo ✓' : 'Salvar'}
        </button>
        {baixas && baixas.length > 0 && (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
            <div className="text-sm font-bold text-amber-800">Pelo relatório, parece que ela fez:</div>
            {baixas.map((x) => (
              <label key={x.key} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={marcadas.has(x.key)}
                  onChange={() => setMarcadas((m) => {
                    const n = new Set(m);
                    n.has(x.key) ? n.delete(x.key) : n.add(x.key);
                    return n;
                  })}
                />
                <span>{x.title}</span>
              </label>
            ))}
            <div className="flex gap-2">
              <button onClick={confirmar} disabled={!marcadas.size} className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40">
                ✓ Dar baixa ({marcadas.size})
              </button>
              <button onClick={() => setBaixas(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500">Agora não</button>
            </div>
          </div>
        )}
        {baixas && baixas.length === 0 && <p className="text-xs text-slate-500">Nada para dar baixa (ou já está tudo marcado).</p>}
      </div>
    </Section>
  );
}
