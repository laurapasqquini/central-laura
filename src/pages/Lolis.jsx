import { useState } from 'react';
import { useStore } from '../lib/store';
import { buildDay, buildOverdue, noDate, mensagemLolis, dadosPaginaLolis, chaveFrase, fraseAutomatica, MODELOS_CANVA } from '../lib/engine';
import { today, addDays } from '../lib/dates';
import { ItemRow, Section, Empty, TaskModal, inputCls } from '../components/ui';

export default function Lolis() {
  const { state } = useStore();
  const [editing, setEditing] = useState(null);
  const [copied, setCopied] = useState(false);
  const f = { area: 'all', who: 'lolis' };
  const ref = today();
  const late = buildOverdue(state, f, ref);
  const hoje = buildDay(state, ref, f).filter((x) => x.kind !== 'marco');
  const semData = noDate(state, f);
  const semana = Array.from({ length: 6 }, (_, i) => addDays(ref, i + 1)).flatMap((d) => buildDay(state, d, f).filter((x) => x.kind === 'task'));
  const msg = mensagemLolis(state, ref);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copie a mensagem:', msg);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Lolis</h1>
          <p className="text-sm text-slate-500">Tudo o que está delegado. Para delegar, escreva <b>@lolis</b> na anotação rápida. O que ela fez vai em <b>📊 Relatórios</b>.</p>
        </div>
        <button onClick={copy} className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm">
          {copied ? 'Copiado ✓' : 'Copiar lista pro WhatsApp'}
        </button>
      </header>

      <HojeComLolis />
      <LinkLolis />
      <ModelosCanva />
      <FrasesSorteio />

      {late.length > 0 && (
        <Section title="Atrasadas: cobrar retorno" count={late.length} tone="red">
          <div className="space-y-1.5 rounded-2xl bg-red-50/60 p-2 ring-1 ring-red-100">{late.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}</div>
        </Section>
      )}
      <Section title="Hoje" count={hoje.filter((x) => !x.done).length}>
        <div className="space-y-1.5">{hoje.length ? hoje.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />) : <Empty>Nada delegado para hoje.</Empty>}</div>
      </Section>
      <Section title="Próximos dias" count={semana.length} tone="indigo">
        <div className="space-y-1.5">{semana.length ? semana.map((x) => <ItemRow key={x.key} item={x} showDate onEdit={setEditing} />) : <Empty>Sem tarefas avulsas nos próximos dias.</Empty>}</div>
      </Section>

      {semData.length > 0 && (
        <Section title="Em andamento (sem data)" count={semData.length}>
          <div className="space-y-1.5">{semData.map((x) => <ItemRow key={x.key} item={x} onEdit={setEditing} />)}</div>
        </Section>
      )}

      {editing && <TaskModal id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// Link da Página da Lolis (sem login): ela vê só o dia dela, com um Copiar em cada mensagem
function LinkLolis() {
  const { state, novoLinkLolis } = useStore();
  const [ok, setOk] = useState(false);
  const link = state.lolisToken ? `${location.origin}${import.meta.env.BASE_URL}#lolis=${state.lolisToken}` : '';
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      prompt('Copie o link:', link);
    }
  };
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">🔗 Página da Lolis</h2>
      <p className="text-sm text-slate-500">Um link só dela, sem login: as tarefas do dia, os lembretes de brinde e os posts do sorteio, cada mensagem com o seu botão Copiar. Atualiza sozinho quando a central salva.</p>
      <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">O que já chegou do Hub (pela extensão)</div>
        {Object.values(state.programacao || {}).length ? (
          Object.values(state.programacao).map((p) => (
            <div key={`${p.cidade}${p.esporte}`} className="text-emerald-700">✓ Programação {p.cidade} · {p.esporte} <span className="text-slate-400">(em {p.em?.split('-').reverse().slice(0, 2).join('/')})</span></div>
          ))
        ) : (
          <div className="text-red-600">✗ Nenhuma programação ainda: abra o Hub em Sorteio Diário › Programação, em cada cidade e esporte.</div>
        )}
        {state.hubLolisEm ? (
          <div className="text-emerald-700">✓ Tarefas em aberto da Lolis no Hub lidas em {state.hubLolisEm.split('-').reverse().slice(0, 2).join('/')}</div>
        ) : (
          <div className="text-slate-500">○ Tarefas da Lolis no Hub: chegam às 13h25 (ou ao abrir Atividades › Minha equipe › Lolis)</div>
        )}
        {state.ganhadoresEm ? (
          <div className="text-emerald-700">✓ Ganhadores atualizados em {state.ganhadoresEm.split('-').reverse().slice(0, 2).join('/')}</div>
        ) : (
          <div className="text-red-600">✗ Nenhum ganhador ainda: abra qualquer página do Hub (com a extensão atualizada).</div>
        )}
      </div>
      {link ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{link}</code>
          <button onClick={copiar} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">{ok ? 'Copiado ✓' : 'Copiar link'}</button>
          <a href={link} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Abrir</a>
          <button onClick={() => confirm('Criar um link novo? O link atual para de funcionar.') && novoLinkLolis()} className="text-xs font-semibold text-slate-400 hover:text-red-500">
            trocar link
          </button>
        </div>
      ) : (
        <button onClick={novoLinkLolis} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Criar o link da Lolis</button>
      )}
    </section>
  );
}

// O mesmo que está na página dela hoje, com o que ela já marcou como feito
function HojeComLolis() {
  const { state } = useStore();
  const [aberto, setAberto] = useState(null);
  const ref = today();
  const dia = dadosPaginaLolis(state, ref).dias.find((d) => d.date === ref);
  if (!state.lolisToken || !dia) return null;
  const feitos = new Set((state.lolisFeitos || {})[ref] || []);
  const notas = (state.lolisNotas || {})[ref] || {};
  const ehSorteio = (t) => /sorteio di[aá]rio/i.test(t.titulo);
  const lembretes = dia.brindes.filter((b) => b.tipo !== 'acao');
  const sorteios = dia.posts.length
    ? dia.posts.map((p) => ({ key: `sorteio:${p.grupo}`, titulo: `🎾 Sorteio diário · ${p.grupo}` }))
    : dia.tarefas.some(ehSorteio) || lembretes.length
      ? [{ key: 'sorteio', titulo: '🎾 Sorteio diário' }]
      : [];
  const itens = [
    ...dia.atrasadas.map((t) => ({ key: t.key, titulo: `⚠️ ${t.titulo}` })),
    ...sorteios,
    ...dia.tarefas.filter((t) => !ehSorteio(t)).map((t) => ({ key: t.key, titulo: t.titulo, feito: t.feito })),
  ];
  const brindes = lembretes;
  const total = itens.length + brindes.length;
  const ok = [...itens, ...brindes].filter((x) => feitos.has(x.key) || x.feito).length;
  const NOME = { acao: '🤝 Patrocinador', lembrete: '🎁 Lembrete do prazo', conferir: '✅ Conferir se deu certo' };

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">Hoje com a Lolis</h2>
        <span className="text-sm text-slate-500">
          ela marcou <b className="text-emerald-600">{ok}</b> de <b>{total}</b>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${total ? (ok / total) * 100 : 0}%` }} />
      </div>
      <div className="space-y-1">
        {itens.map((x) => (
          <Linha key={x.key} feito={feitos.has(x.key) || !!x.feito} titulo={x.titulo} marca={notas[x.key]} />
        ))}
      </div>
      {brindes.length > 0 && (
        <div className="space-y-1 border-t border-slate-100 pt-2">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Brindes do sorteio</div>
          {brindes.map((b) => (
            <div key={b.key}>
              <button onClick={() => setAberto(aberto === b.key ? null : b.key)} className="w-full text-left">
                <Linha feito={feitos.has(b.key)} titulo={`${NOME[b.tipo]} · ${b.linha}`} marca={notas[b.key]} />
              </button>
              {aberto === b.key && <p className="ml-7 rounded-lg bg-[#e7ffdb] p-2 text-xs text-slate-700">{b.texto}</p>}
            </div>
          ))}
        </div>
      )}
      {dia.posts.length > 0 && <p className="text-xs text-slate-500">📣 Posts do sorteio de hoje: {dia.posts.map((p) => p.grupo).join(' · ')} (veja os textos em Abrir, no quadro abaixo)</p>}
    </section>
  );
}

// item do dia da Lolis: ✓ feito, ✕ não conseguiu, e o que ela escreveu
const Linha = ({ feito, titulo, marca }) => {
  const nao = marca?.status === 'nao';
  return (
    <div className={`flex items-start gap-2 rounded-lg px-1 py-1 text-sm ${feito ? 'text-slate-400' : 'text-slate-700'}`}>
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white ${feito ? 'bg-emerald-500' : nao ? 'bg-red-500' : 'border-2 border-slate-300'}`}>{feito ? '✓' : nao ? '✕' : ''}</span>
      <span className="min-w-0">
        <span className={feito ? 'line-through' : ''}>{titulo}</span>
        {(nao || marca?.nota) && (
          <span className={`block text-xs ${nao ? 'text-red-600' : 'text-slate-500'}`}>
            {nao ? '✕ Não conseguiu' : '📝'}
            {marca?.nota ? `${nao ? ': ' : ' '}${marca.nota}` : ''}
          </span>
        )}
      </span>
    </div>
  );
};

// Frases do parabéns do sorteio diário: uma por dia, em cada cidade e esporte
function FrasesSorteio() {
  const { state, setFraseSorteio } = useStore();
  const [aberto, setAberto] = useState(false);
  const progs = Object.values(state.programacao || {});
  if (!progs.length) return null;
  const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <button onClick={() => setAberto(!aberto)} className="flex w-full items-center justify-between text-left">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">✏️ Frases do parabéns do sorteio</h2>
        <span className="text-xs font-semibold text-slate-500">{aberto ? 'fechar' : 'editar'}</span>
      </button>
      {aberto && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Uma frase por dia. Se deixar em branco, a central usa uma frase automática pelo tipo de prêmio (aparece em cinza).</p>
          {progs.map((p) => (
            <div key={`${p.cidade}${p.esporte}`} className="space-y-2">
              <div className="text-sm font-bold text-ink">
                {p.esporte} · {p.cidade}
              </div>
              {DIAS.filter((d) => p.dias[d]?.patrocinadores?.length).map((d) => {
                const chave = chaveFrase(p, d);
                return (
                  <label key={d} className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-500">
                      {d} · {p.dias[d].titulo || ''} <span className="font-normal text-slate-400">({p.dias[d].patrocinadores.map((x) => x.nome).join(' + ')})</span>
                    </span>
                    <textarea
                      rows={2}
                      className={inputCls}
                      placeholder={fraseAutomatica(p.dias[d].patrocinadores)}
                      value={(state.frasesSorteio || {})[chave] || ''}
                      onChange={(e) => setFraseSorteio(chave, e.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Links dos modelos do Canva: aparecem como botão nas tarefas da página da Lolis
function ModelosCanva() {
  const { state, setCanva } = useStore();
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700">🎨 Modelos do Canva</h2>
      <p className="text-xs text-slate-500">Cole o link de cada modelo. Na página da Lolis, a tarefa ganha o botão "Abrir modelo no Canva".</p>
      <div className="space-y-2">
        {MODELOS_CANVA.map((m) => (
          <label key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-48 shrink-0 font-medium text-slate-700">{m.nome}</span>
            <input className={`${inputCls} min-w-0 flex-1`} placeholder="https://www.canva.com/design/..." value={(state.canva || {})[m.id] || ''} onChange={(e) => setCanva(m.id, e.target.value)} />
          </label>
        ))}
      </div>
    </section>
  );
}
