// 💬 WhatsApp do RANKEN: o que ficou pendurado nas conversas (lido pela extensão na lista do WhatsApp Web,
// sem abrir nenhuma conversa). Três listas: prometi e não voltei, esperando minha resposta, esperando o outro.
import { useState } from 'react';
import { useStore } from '../lib/store';
import { pendenciasWhats, linkConversa } from '../lib/whats';
import { today } from '../lib/dates';
import { TaskModal } from '../components/ui';

const GRUPOS = [
  ['prometi', '🔁 Prometi e não voltei', 'Sua última mensagem foi uma promessa ("vou ver", "já te falo"…) e ficou nisso.', 'ring-red-200 bg-red-50/40'],
  ['responder', '💬 Esperando minha resposta', 'A última mensagem é da pessoa (e não é só "obrigado" ou "ok").', 'ring-amber-200 bg-amber-50/40'],
  ['aguardando', '⏳ Esperando o outro', 'A pessoa ficou de te avisar ou de fazer algo. Só para não perder de vista.', 'ring-slate-200 bg-white'],
];

export default function WhatsApp() {
  const { state } = useStore();
  const p = pendenciasWhats(state);
  const hora = p.em ? new Date(p.em) : null;
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-ink">WhatsApp do RANKEN</h2>
        <p className="text-sm text-slate-500">
          {hora
            ? `Lido ${p.em.slice(0, 10) === today() ? 'hoje' : `em ${p.em.slice(8, 10)}/${p.em.slice(5, 7)}`} às ${hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
            : 'Ainda não chegou nenhuma leitura.'}{' '}
          A extensão olha a lista de conversas do WhatsApp Web a cada 30 min (sem abrir nenhuma, então nada fica como lido). Para ver o que cada pessoa pediu, peça ao Claude: "varre meu WhatsApp".
        </p>
      </header>
      {p.invalida && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          A última leitura foi feita com uma <b>busca aberta</b> no WhatsApp (mostra resultados antigos, não as conversas), então foi descartada. A próxima leitura corrige sozinha. Se a extensão estiver na versão 1.26, isso não acontece mais.
        </div>
      )}
      {!hora && (
        <div className="rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Para começar: deixe o WhatsApp do RANKEN aberto no Chrome (web.whatsapp.com) com a extensão da central logada e marcada como <b>RANKEN</b> no ícone dela.
        </div>
      )}
      <MinhasTarefas />
      {GRUPOS.map(([id, titulo, ajuda, cor]) => (
        <section key={id} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              {titulo} <span className="text-slate-400">({p[id].length})</span>
            </h3>
          </div>
          <p className="px-1 text-xs text-slate-400">{ajuda}</p>
          {p[id].length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-200">Nada aqui ✓</p>
          ) : (
            <div className={`divide-y divide-slate-100 overflow-hidden rounded-lg shadow-sm ring-1 ${cor}`}>
              {p[id].map((c) => (
                <Item key={c.nome} c={c} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// Tarefas que a Laura tirou do WhatsApp: ficam só aqui (fora da lista do dia). Marca com #whats ou pelo botão.
function MinhasTarefas() {
  const { state, toggleTask, updateTask } = useStore();
  const [editando, setEditando] = useState(null);
  const lista = state.tasks.filter((t) => t.whats && !t.done).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  return (
    <section className="space-y-2">
      {editando && <TaskModal id={editando} onClose={() => setEditando(null)} />}
      <h3 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">
        📌 Minhas tarefas do WhatsApp <span className="text-slate-400">({lista.length})</span>
      </h3>
      <p className="px-1 text-xs text-slate-400">Ficam só aqui, fora da lista do dia. Para mandar uma pra cá: "📝 Tarefa pra mim" numa conversa abaixo, ou escreva #whats na anotação rápida.</p>
      {lista.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-200">Nada aqui ✓</p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-sky-200">
          {lista.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-4 py-3">
              <button onClick={() => toggleTask(t.id)} title="Feito" className="mt-0.5 h-5 w-5 shrink-0 rounded-full ring-2 ring-slate-300 hover:ring-emerald-500" />
              <button onClick={() => setEditando(t.id)} className="min-w-0 flex-1 text-left">
                <span className="text-sm font-semibold text-slate-800">{t.title}</span>
                {t.urgent && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-[11px] font-bold text-red-700">urgente</span>}
                {t.due && t.due < today() && <span className="ml-1.5 text-[11px] font-semibold text-red-500">desde {t.due.slice(8, 10)}/{t.due.slice(5, 7)}</span>}
                {/* contexto (quem é, número, o que aconteceu) sem precisar abrir */}
                {t.notes && !/^Veio da aba/.test(t.notes) && <span className="mt-1 block whitespace-pre-line text-xs text-slate-500 line-clamp-4">{t.notes}</span>}
              </button>
              <button
                onClick={() => updateTask(t.id, { whats: false, who: 'lolis', due: today(), entradaId: t.entradaId || `whats:${t.id}` })}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50"
              >
                🙋 Pra Lolis
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Item({ c }) {
  const { addTask, resolverWhats, ignorarWhats } = useStore();
  const [copiado, setCopiado] = useState(false);
  const link = linkConversa(c.nome);
  const parado = c.parado === 0 ? 'hoje' : c.parado === 1 ? 'há 1 dia' : `há ${c.parado} dias`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(c.nome);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      prompt('Copie o nome e procure no WhatsApp:', c.nome);
    }
  };
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">{c.nome}</div>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
            {c.tipo === 'prometi' && <span className="font-semibold text-slate-500">Você: </span>}
            {/^\d{1,2}:\d{2}$/.test(c.prev) ? `🎤 Áudio (${c.prev})` : c.prev}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${c.parado >= 1 && c.tipo !== 'aguardando' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{parado}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700">
            Abrir conversa
          </a>
        ) : (
          <button onClick={copiar} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700">
            {copiado ? 'Copiado ✓' : '📋 Copiar nome (pra buscar no WhatsApp)'}
          </button>
        )}
        {/* só cria tarefa quando ela clica (nada automático); para a Lolis vai com o aviso de dar retorno no WhatsApp da Laura */}
        {[
          ['laura', '📝 Tarefa pra mim'],
          ['lolis', '🙋 Pra Lolis'],
        ].map(([who, rotulo]) => (
          <button
            key={who}
            onClick={() => {
              addTask({
                title: `WhatsApp · ${c.nome}: ${c.prev.slice(0, 120)}`,
                who,
                due: today(),
                urgent: c.tipo === 'prometi',
                notes: `Veio da aba 💬 WhatsApp (${c.tipo === 'prometi' ? 'a Laura prometeu' : c.tipo === 'responder' ? 'esperando resposta' : 'esperando o outro'})`,
                ...(who === 'lolis' ? { entradaId: `whats:${c.nome}` } : { whats: true }), // a minha fica só aqui na aba
              });
              resolverWhats(c.nome, c.prev);
            }}
            className="rounded-lg px-2.5 py-1 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50"
          >
            {rotulo}
          </button>
        ))}
        <button onClick={() => resolverWhats(c.nome, c.prev)} className="rounded-lg px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
          ✓ Resolvido
        </button>
        <button onClick={() => confirm(`Nunca mais mostrar a conversa "${c.nome}" aqui?`) && ignorarWhats(c.nome)} className="rounded-lg px-2.5 py-1 text-slate-400 hover:text-slate-600">
          Ignorar sempre
        </button>
      </div>
    </div>
  );
}
