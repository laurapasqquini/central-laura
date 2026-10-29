import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { AREAS } from '../lib/engine';
import { parseQuick } from '../lib/parse';
import { fmtCurto, relativo, today, addDays } from '../lib/dates';
import { imagensDoEvento } from '../lib/imagens';
import { subirAnexo, apagarAnexos, linksAnexos } from '../lib/anexos';

export const HUB_URL = 'https://ranken-financeiro.vercel.app/';

// emoji no começo de um título (os do Hub vêm com 🤖, 📩…): na tela fica só o texto
export const semEmoji = (s = '') => s.replace(/^(?:[\p{Extended_Pictographic}\uFE0F\u200D]|\s)+/u, '');

export const Pill = ({ className = '', children }) => (
  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>{children}</span>
);

export const AreaPill = ({ area }) => <Pill className={AREAS[area].soft}>{AREAS[area].label}</Pill>;

export function Check({ done, onClick, area }) {
  return (
    <button
      onClick={onClick}
      aria-label={done ? 'Desmarcar' : 'Concluir'}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] transition ${
        done ? `${AREAS[area].bar} border-transparent pop` : 'border-slate-300 hover:border-slate-500 bg-white'
      }`}
    >
      {done && (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 10l4 4 8-8" />
        </svg>
      )}
    </button>
  );
}

export function ItemRow({ item, showDate = false, onEdit }) {
  const { toggleTask, toggleRoutine, postpone, pixPraLolis } = useStore();
  const [verMsg, setVerMsg] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (item.kind === 'marco') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2.5">
        <span className="grid h-6 w-6 place-items-center text-base">📌</span>
        <div className="min-w-0 flex-1 text-sm font-semibold text-indigo-900">{item.title}</div>
        {showDate && <span className="text-xs font-medium text-indigo-500">{fmtCurto(item.date)}</span>}
      </div>
    );
  }

  const toggle = () => (item.kind === 'task' ? toggleTask(item.id) : toggleRoutine(item.id, item.date, item.doneValue));
  const late = !item.done && item.date && item.date < today();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(item.mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      prompt('Copie a mensagem:', item.mensagem);
    }
  };

  return (
    <div>
    <div className={`group flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-slate-300 ${item.done ? 'opacity-55' : ''}`}>
      <span className={`mt-0.5 h-6 w-1 shrink-0 rounded-full ${AREAS[item.area].bar}`} />
      <Check done={item.done} onClick={toggle} area={item.area} />
      <button onClick={() => item.kind === 'task' && onEdit?.(item.id)} className="min-w-0 flex-1 text-left">
        <div title={item.title} className={`line-clamp-2 text-[15px] leading-snug font-medium ${item.done ? 'line-through text-slate-500' : 'text-slate-800'}`}>
          {semEmoji(item.title)}
          {item.anexos?.length > 0 && <span className="ml-1 text-xs text-slate-400" title="Tem imagem anexada">📎{item.anexos.length > 1 ? item.anexos.length : ''}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.urgent && !item.done && <Pill className="bg-red-50 text-red-600 ring-red-200">urgente</Pill>}
          {item.who === 'lolis' && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">Lolis</Pill>}
          {item.kind === 'routine' && item.freq !== 'calendario' && <Pill className="bg-slate-50 text-slate-500 ring-slate-200">Rotina</Pill>}
          {item.project && <Pill className="bg-indigo-50 text-indigo-600 ring-indigo-200">{item.project}</Pill>}
          {(showDate || late) && item.date && (
            <span className={`text-xs font-medium ${late ? 'text-red-500' : 'text-slate-400'}`}>
              {late ? `venceu ${relativo(item.date)}` : fmtCurto(item.date)}
            </span>
          )}
          {item.movedFrom && <span className="text-xs font-medium text-slate-400">↪ era {fmtCurto(item.movedFrom)}</span>}
          {item.hubCriadoEm && <span className="text-xs font-medium text-slate-400" title="Quando a tarefa entrou no RANKEN Hub">{quandoEntrou(item.hubCriadoEm)}</span>}
          {item.notes && <span className="text-xs text-slate-400">· com nota</span>}
        </div>
      </button>
      {item.hub && !item.done && (
        <a href={HUB_URL + (item.hubPath || '')} target="_blank" rel="noreferrer" title="Abrir o RANKEN Hub" className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
          Hub ↗
        </a>
      )}
      {item.acao === 'revisao' && !item.done && (
        <button onClick={() => window.dispatchEvent(new CustomEvent('abrir-revisao', { detail: item }))} className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
          Abrir revisão
        </button>
      )}
      {item.mensagem && !item.done && (
        <button onClick={() => setVerMsg((v) => !v)} title="Ver a mensagem pronta" className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
          Mensagem
        </button>
      )}
      {item.freq === 'pix' && !item.done && (
        <button
          onClick={() => pixPraLolis(item.id.replace(/^pix:/, ''), item.who !== 'lolis')}
          title={item.who === 'lolis' ? 'Voltar a cobrança para você' : 'Passar a cobrança para a Lolis (vai para a página dela com a mensagem e o número)'}
          className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50"
        >
          {item.who === 'lolis' ? 'Voltar pra mim' : 'Pra Lolis'}
        </button>
      )}
      {item.kind === 'task' && !item.done && (
        <button
          onClick={() => postpone(item.id, 1)}
          title="Adiar 1 dia"
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100"
        >
          +1d
        </button>
      )}
    </div>
    {verMsg && item.mensagem && !item.done && (
      <div className="mx-1 -mt-1 space-y-2 rounded-b-xl bg-[#e7ffdb] p-3 ring-1 ring-emerald-100">
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{item.mensagem}</pre>
        <button onClick={copiar} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700">
          {copiado ? 'Copiado ✓' : 'Copiar mensagem'}
        </button>
        {item.telefone && <CopiarNumero tel={item.telefone} />}
      </div>
    )}
    </div>
  );
}

// Número da pessoa para copiar e colar no WhatsApp (só números, com DDD, sem o 55)
function CopiarNumero({ tel }) {
  const [ok, setOk] = useState(false);
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(d);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          prompt('Copie o número:', d);
        }
      }}
      className="w-full rounded-lg bg-white py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50"
    >
      📱 ({d.slice(0, 2)}) {d.slice(2, -4)}-{d.slice(-4)} · {ok ? 'copiado ✓' : 'copiar número'}
    </button>
  );
}

export function Section({ title, count, tone = 'slate', children, right }) {
  const tones = { red: 'text-red-600', slate: 'text-slate-700', indigo: 'text-indigo-700' };
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${tones[tone]}`}>
          {semEmoji(title)} {count != null && <span className="ml-1 font-semibold text-slate-400">{count}</span>}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export const Empty = ({ children }) => <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">{children}</div>;

// "gastei 45 ifood" / "paguei 120,50 farmácia" / "recebi 300 pix da mãe": vai para o Financeiro (hoje)
const GASTO_RAPIDO = /^(gastei|paguei|recebi|ganhei)\s+(?:r\$\s*)?(\d[\d.]*(?:,\d{1,2})?)\s*(?:reais\s*)?(?:(?:no|na|em|de|do|da|com)\s+)?(.*)$/i;
function gastoRapido(text) {
  const m = text.trim().match(GASTO_RAPIDO);
  if (!m) return null;
  const valor = Number(m[2].replace(/\./g, '').replace(',', '.'));
  if (!valor) return null;
  const entrada = /^(recebi|ganhei)$/i.test(m[1]);
  return { data: today(), desc: m[3].trim() || (entrada ? 'Entrada' : 'Gasto'), valor: entrada ? valor : -valor, rapido: true };
}

export function QuickAdd({ defaultArea }) {
  const { addTask, addTransacao, user } = useStore();
  const [text, setText] = useState('');
  const [fotos, setFotos] = useState([]); // imagens coladas, sobem ao criar a tarefa
  const [enviando, setEnviando] = useState(false);
  const [lancado, setLancado] = useState('');
  const [focado, setFocado] = useState(false); // os atalhos só aparecem com o campo em uso
  const gasto = text.trim() ? gastoRapido(text) : null;
  const preview = text.trim() && !gasto ? parseQuick(text, { area: defaultArea }) : null;

  const submit = (e) => {
    e.preventDefault();
    if (gasto) {
      addTransacao(gasto);
      setLancado(`✓ ${gasto.valor < 0 ? 'Gasto' : 'Entrada'} de R$ ${Math.abs(gasto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} lançado no Financeiro`);
      setTimeout(() => setLancado(''), 2500);
      setText('');
      return;
    }
    if (!preview?.title) return;
    if (!fotos.length) {
      addTask(preview);
      setText('');
      return;
    }
    const id = crypto.randomUUID().slice(0, 8);
    setEnviando(true);
    Promise.all(fotos.map((f) => subirAnexo(user.id, id, f)))
      .then((anexos) => {
        addTask({ ...preview, id, anexos });
        setText('');
        setFotos([]);
      })
      .catch((err) => alert(`Não consegui subir a imagem: ${err.message}`))
      .finally(() => setEnviando(false));
  };

  return (
    <form onSubmit={submit} className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <span className="pl-2 text-slate-400">＋</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          onPaste={(e) => {
            const imgs = imagensDoEvento(e);
            if (imgs.length) {
              e.preventDefault();
              setFotos((f) => [...f, ...imgs]);
            }
          }}
          placeholder="Anotar… ex.: pedir pra @lolis contar estoque sexta !urgente (Ctrl+V cola imagem)"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-slate-400"
        />
        <button className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-30" disabled={(!preview?.title && !gasto) || enviando}>
          {enviando ? 'Enviando…' : gasto ? 'Lançar' : 'Criar'}
        </button>
      </div>
      {gasto && (
        <div className="px-2 pt-1 pb-1 text-xs text-slate-500">
          vai lançar no 💰 Financeiro (hoje): <b className={gasto.valor < 0 ? 'text-red-600' : 'text-emerald-600'}>{gasto.valor < 0 ? '−' : '+'}R$ {Math.abs(gasto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> · {gasto.desc}
        </div>
      )}
      {fotos.length > 0 && (
        <div className="flex items-center gap-2 px-2 pt-1 text-xs text-slate-600">
          📎 {fotos.length === 1 ? '1 imagem vai junto' : `${fotos.length} imagens vão juntas`}
          <button type="button" onClick={() => setFotos([])} className="font-semibold text-slate-400 hover:text-red-500">tirar</button>
        </div>
      )}
      {lancado && <div className="px-2 pt-1 pb-1 text-xs font-semibold text-emerald-600">{lancado}</div>}
      {preview?.title && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-1 text-xs text-slate-500">
          <span>vai criar:</span>
          <b className="text-slate-700">{preview.title}</b>
          <AreaPill area={preview.area} />
          <Pill className="bg-slate-50 text-slate-600 ring-slate-200">{preview.due ? (preview.due === today() ? 'hoje' : fmtCurto(preview.due)) : 'sem data'}</Pill>
          {preview.who === 'lolis' && <Pill className="bg-amber-50 text-amber-700 ring-amber-200">Lolis</Pill>}
          {preview.urgent && <Pill className="bg-red-50 text-red-600 ring-red-200">urgente</Pill>}
          {preview.hub && <Pill className="bg-emerald-600 text-white ring-transparent">fazer no Hub</Pill>}
        </div>
      )}
      {!text && focado && (
        <div className="hidden px-2 pb-1 text-[11px] text-slate-400 sm:block">
          <b>#ranken #gralha #pessoal</b> escolhe a área · <b>#hub</b> = fazer no Hub · <b>#whats</b> = aba WhatsApp · <b>@lolis</b> delega · <b>!urgente</b> · sem data escrita = hoje · amanhã, sexta, 15/10, em 3 dias · <b>sem data</b> = sem dia · <b>gastei 45 ifood</b> / <b>recebi 300 pix</b> = Financeiro
        </div>
      )}
    </form>
  );
}

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);
export const inputBase = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
export const inputCls = `w-full ${inputBase}`;

// Topo de cada frente (Ranken, Gralha, Pessoal): título à esquerda e as abas à direita, numa barra cinza
// em que a aba aberta fica branca. abas = [{ id, label, badge? }]
const COR_FRENTE = { ranken: 'text-emerald-800', gralha: 'text-sky-700', pessoal: 'text-violet-700' };
export function AbasTopo({ area, titulo, detalhe, abas, valor, onChange }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${COR_FRENTE[area] || 'text-slate-500'}`}>Frente</div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{titulo}</h1>
        {detalhe && <p className="text-sm text-slate-500">{detalhe}</p>}
      </div>
      <nav className="-mx-1 max-w-full overflow-x-auto px-1">
        <div className="inline-flex gap-0.5 rounded-lg bg-slate-200/70 p-[3px]">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm transition ${
                valor === a.id ? 'bg-white font-semibold text-ink shadow-sm' : 'font-medium text-slate-600 hover:text-ink'
              }`}
            >
              {a.label}
              {a.badge > 0 && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-xs font-bold text-red-700">{a.badge}</span>}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label, cls]) => (
        <button
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
            value === v ? cls || 'bg-ink text-white ring-ink' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const areaOptions = Object.entries(AREAS).map(([k, a]) => [k, a.label, `${a.bar} text-white ring-transparent`]);

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// "entrou 14:32" (hoje), "entrou ontem 14:32" ou "entrou 27/10 14:32"
function quandoEntrou(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = d.toLocaleDateString('sv-SE');
  if (dia === today()) return `entrou ${hora}`;
  if (dia === addDays(today(), -1)) return `entrou ontem ${hora}`;
  return `entrou ${dia.slice(8, 10)}/${dia.slice(5, 7)} ${hora}`;
}

export function TaskModal({ id, onClose }) {
  const { state, updateTask, deleteTask, user } = useStore();
  const t = state.tasks.find((x) => x.id === id);
  const [form, setForm] = useState(() => ({ ...t }));
  if (!t) return null;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    updateTask(id, { title: form.title, area: form.area, who: form.area === 'gralha' ? 'laura' : form.who, due: form.due || null, urgent: form.urgent, hub: !!form.hub, whats: !!form.whats, notes: form.notes });
    onClose();
  };

  return (
    <Modal title="Editar tarefa" onClose={onClose}>
      <div className="space-y-4">
        <Field label="O quê">
          <input className={inputCls} value={form.title} onChange={(e) => set('title')(e.target.value)} />
        </Field>
        <Field label="Área">
          <Segmented value={form.area} onChange={set('area')} options={areaOptions} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quando">
            <input type="date" className={inputCls} value={form.due || ''} onChange={(e) => set('due')(e.target.value)} />
          </Field>
          {/* Gralha é só da Laura: não delega para a Lolis */}
          {form.area !== 'gralha' && (
            <Field label="Quem faz">
              <Segmented value={form.who} onChange={set('who')} options={[['laura', 'Eu'], ['lolis', '🙋 Lolis', 'bg-amber-500 text-white ring-transparent']]} />
            </Field>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={!!form.urgent} onChange={(e) => set('urgent')(e.target.checked)} className="h-4 w-4 accent-red-500" /> Urgente
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={!!form.hub} onChange={(e) => set('hub')(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Fazer no RANKEN Hub
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={!!form.whats} onChange={(e) => set('whats')(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> 💬 Só na aba WhatsApp (fora da lista do dia)
        </label>
        <Field label="Notas">
          <textarea rows={10} className={`${inputCls} min-h-[14rem] resize-y leading-relaxed`} value={form.notes || ''} onChange={(e) => set('notes')(e.target.value)} placeholder="Detalhes, contato, link…" />
        </Field>
        <Field label="Imagens">
          <Anexos taskId={id} anexos={t.anexos || []} userId={user?.id} onChange={(anexos) => updateTask(id, { anexos })} />
        </Field>
        {t.phase && <p className="text-xs text-slate-400">Etapa do projeto: {t.phase}</p>}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              if (confirm('Excluir esta tarefa?')) {
                deleteTask(id);
                onClose();
              }
            }}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
          >
            Excluir
          </button>
          <button onClick={save} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

// Imagens da tarefa: Ctrl+V (com a janela aberta), arrastar ou escolher. Sobem na hora e ficam na tarefa.
export function Anexos({ taskId, anexos, userId, onChange }) {
  const [links, setLinks] = useState({});
  const [enviando, setEnviando] = useState(0);
  const chave = anexos.map((a) => a.path).join('|');
  useEffect(() => {
    if (anexos.length) linksAnexos(anexos.map((a) => a.path)).then(setLinks, () => {});
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const adicionar = async (files) => {
    if (!files.length) return;
    setEnviando((n) => n + files.length);
    try {
      const novos = await Promise.all(files.map((f) => subirAnexo(userId, taskId, f)));
      onChange([...anexos, ...novos]);
    } catch (err) {
      alert(`Não consegui subir a imagem: ${err.message}`);
    } finally {
      setEnviando((n) => n - files.length);
    }
  };
  useEffect(() => {
    const colar = (e) => {
      const imgs = imagensDoEvento(e);
      if (imgs.length) {
        e.preventDefault();
        adicionar(imgs);
      }
    };
    window.addEventListener('paste', colar);
    return () => window.removeEventListener('paste', colar);
  });
  const tirar = (a) => {
    if (!confirm('Tirar esta imagem da tarefa?')) return;
    apagarAnexos([a]);
    onChange(anexos.filter((x) => x.path !== a.path));
  };
  return (
    <div
      className="space-y-2 rounded-xl border border-dashed border-slate-300 p-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        adicionar(imagensDoEvento(e));
      }}
    >
      {anexos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {anexos.map((a) => (
            <div key={a.path} className="relative">
              <a href={links[a.path]} target="_blank" rel="noreferrer">
                {links[a.path] ? <img src={links[a.path]} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" /> : <div className="grid h-20 w-20 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">…</div>}
              </a>
              <button type="button" onClick={() => tirar(a)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-xs text-red-500 shadow ring-1 ring-slate-200" aria-label="Tirar imagem">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {enviando > 0 ? <span className="font-semibold text-indigo-600">Enviando…</span> : <span>Cole com <b>Ctrl+V</b>, arraste aqui ou</span>}
        <label className="cursor-pointer font-semibold text-indigo-600">
          escolha o arquivo
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => (adicionar(imagensDoEvento(e)), (e.target.value = ''))} />
        </label>
        <span className="text-slate-400">· a Lolis vê na página dela</span>
      </div>
    </div>
  );
}
