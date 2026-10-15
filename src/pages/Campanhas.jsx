import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { gerarCampanhas, TIPOS, statusCampanha, ajustesCampanha } from '../data/campanhas';
import { CALENDARIOS } from '../data/calendarios';
import { today, fmtCurto, relativo } from '../lib/dates';
import { limiteDiasUteis } from '../lib/engine';
import { Empty, Segmented, inputCls } from '../components/ui';

const CIDADES_ORDEM = ['Maringá', 'Londrina', 'Santa Fé'];

const brData = (s) => s.split('-').reverse().join('/');
const quando = (c) => (c.envios === 1 ? `${fmtCurto(c.inicio)} · ${c.hora.replace(':00', 'h')} · envio único` : `${fmtCurto(c.inicio)} → ${fmtCurto(c.fim)} · a cada ${c.repetir} dias · ${c.hora.replace(':00', 'h')} · ${c.envios} envios`);

// Campanhas push: cada uma é criada UMA vez no backoffice e se repete sozinha até o fim.
// Para criar → Criadas (com o ID do backoffice) → Não vou usar.
export default function Campanhas() {
  const { state, setCampanha } = useStore();
  const ref = today();
  const [ver, setVer] = useState('criar'); // criar | criadas | puladas
  const [cidade, setCidade] = useState('all');
  const [aberta, setAberta] = useState(null);

  const todas = useMemo(() => gerarCampanhas(ref), [ref]);
  const ov = state.campanhas || {};
  const st = (c) => statusCampanha(ov, c);
  const n = { criar: todas.filter((c) => st(c) === 'pendente').length, criadas: todas.filter((c) => st(c) === 'agendada').length, puladas: todas.filter((c) => st(c) === 'pulada').length };
  const limite = limiteDiasUteis(state, ref, 3);
  const cidades = [...new Set(todas.map((c) => c.cidade))];
  const alvo = { criar: 'pendente', criadas: 'agendada', puladas: 'pulada' }[ver];
  const lista = todas.filter((c) => st(c) === alvo && (cidade === 'all' || c.cidade === cidade));

  // agrupadas pela etapa do backoffice (é o que se escolhe primeiro lá), em ordem FIXA:
  // cidade e categoria na ordem dos calendários; dentro, Rodada nova → Já marcou? → Último dia
  const ORDEM_TIPO = { inicio: 0, meio: 1, fim: 2 };
  const ordem = (c) => [CIDADES_ORDEM.indexOf(c.cidade), CALENDARIOS.findIndex((x) => x.id === c.calId), Number(c.id.split(':')[1]), ORDEM_TIPO[c.tipo]];
  const compara = (a, b) => {
    const [x, y] = [ordem(a), ordem(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.inicio.localeCompare(b.inicio);
  };
  const grupos = [...lista].sort(compara).reduce((acc, c) => ((acc[c.etapa] ||= { cidade: c.cidade, categoria: c.categoria, itens: [] }).itens.push(c), acc), {});
  const feitas = n.criadas + n.puladas;
  const pct = todas.length ? Math.round((feitas / todas.length) * 100) : 100;
  const set = (c, p) => ('status' in p ? c.instancias.forEach((i) => setCampanha(i, p)) : setCampanha(c.instancias[0], p));

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-bold text-ink">
            {n.criadas} de {todas.length} campanhas criadas
          </div>
          <div className="text-xs text-slate-500">{n.criar ? `faltam ${n.criar}` : 'tudo criado 🎉'}</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          Cada campanha é criada <b>uma vez</b> no backoffice e se repete sozinha até o fim da etapa. Abra uma, siga os passos na ordem do formulário, cole o ID e clique em <b>Criei</b>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={ver}
          onChange={setVer}
          options={[
            ['criar', `Para criar (${n.criar})`],
            ['criadas', `✓ Criadas (${n.criadas})`],
            ...(n.puladas ? [['puladas', `Não vou usar (${n.puladas})`]] : []),
          ]}
        />
        <select value={cidade} onChange={(e) => setCidade(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <option value="all">Todas as cidades</option>
          {cidades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {!lista.length && <Empty>{ver === 'criar' ? 'Nada para criar aqui. 🎉' : ver === 'criadas' ? 'Nenhuma campanha marcada como criada ainda.' : 'Nada aqui.'}</Empty>}

      {Object.entries(grupos).map(([etapa, g]) => (
        <section key={etapa} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <div className="text-sm font-bold text-slate-800">
              {g.cidade} · {g.categoria}
              {/MASCULIN/.test(etapa) && g.categoria.includes('Duplas') ? ' · masculino' : /FEMININ/.test(etapa) && g.categoria.includes('Duplas') ? ' · feminino' : ''}
              {/BEACH MASCULINO -/.test(etapa) ? ' · masculino' : /BEACH FEMININO -/.test(etapa) ? ' · feminino' : ''}
            </div>
            <div className="text-[11px] text-slate-400">Etapa no backoffice: {etapa}</div>
          </div>
          <div className="divide-y divide-slate-100">
            {g.itens.map((c) => (
              <Linha key={c.id} c={c} st={st(c)} ov={ajustesCampanha(ov, c)} urgente={st(c) === 'pendente' && c.data <= limite} ref0={ref} aberta={aberta === c.id} onToggle={() => setAberta(aberta === c.id ? null : c.id)} set={(p) => set(c, p)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Copiar({ texto }) {
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
      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${ok ? 'bg-emerald-600 text-white ring-emerald-600' : 'text-indigo-600 ring-indigo-200 hover:bg-indigo-50'}`}
    >
      {ok ? '✓ copiado' : 'copiar'}
    </button>
  );
}

// Um passo do formulário do backoffice
function Passo({ n, nome, valor, copiar = true, dica, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{nome}</div>
        {children || <div className="break-words text-sm text-slate-800">{valor}</div>}
        {dica && <div className="text-xs text-slate-400">{dica}</div>}
      </div>
      {copiar && !children && <Copiar texto={valor} />}
    </div>
  );
}

function Linha({ c, st, ov, urgente, ref0, aberta, onToggle, set }) {
  const titulo = ov.titulo ?? c.titulo;
  const mensagem = ov.mensagem ?? c.mensagem;
  const hora = ov.hora ?? c.hora;
  const confira = /confira/i.test(c.etapa);
  const [id, setId] = useState(ov.idBackoffice || '');

  return (
    <div className={st === 'pulada' ? 'opacity-60' : ''}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-xl">{TIPOS[c.tipo].icone}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-slate-800">
            {TIPOS[c.tipo].nome}
            <span className="text-xs font-medium text-slate-400">{c.rodadas}</span>
          </div>
          <div className="text-sm text-slate-500">{quando({ ...c, hora })}</div>
        </div>
        {st === 'agendada' ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">✓ ID {ov.idBackoffice || '—'}</span>
        ) : urgente ? (
          <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200">começa {relativo(c.data, ref0)}</span>
        ) : (
          <span className="shrink-0 text-xs text-slate-400">começa {relativo(c.data, ref0)}</span>
        )}
        <span className="shrink-0 text-slate-300">{aberta ? '▴' : '▾'}</span>
      </button>

      {aberta && (
        <div className="space-y-3 bg-slate-50/60 px-4 pb-4">
          <div className="text-xs font-semibold text-slate-500">Preencha assim no backoffice (Campanhas › Nova):</div>
          <div className="divide-y divide-slate-100 rounded-xl bg-white px-3 ring-1 ring-slate-200">
            <Passo n={1} nome="Alcance" valor="Jogadores de uma etapa" copiar={false} />
            <Passo n={2} nome="Gatilho" valor="Programada" copiar={false} />
            <Passo n={3} nome="Etapa" valor={c.etapa} dica={confira ? 'Nome ainda não conferido: escolha a etapa desta categoria na lista.' : 'Procure este nome na lista.'} />
            <Passo n={4} nome="Repetir a cada (dias)" valor={String(c.repetir)} dica={c.envios === 1 ? 'Envio único: início e fim no mesmo dia.' : undefined} />
            <Passo n={5} nome="Início" valor={brData(c.inicio)} />
            <Passo n={6} nome="Fim" valor={brData(c.fim)} />
            <Passo n={7} nome="Horário de envio">
              <div className="flex items-center gap-2">
                <input type="time" step="900" value={hora} onChange={(e) => set({ hora: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                <Copiar texto={hora} />
              </div>
            </Passo>
            <Passo n={8} nome="Título">
              <div className="flex items-center gap-2">
                <input className={`${inputCls} py-1.5`} value={titulo} onChange={(e) => set({ titulo: e.target.value })} />
                <Copiar texto={titulo} />
              </div>
            </Passo>
            <Passo n={9} nome={`Mensagem (${mensagem.length}/500)`}>
              <div className="flex items-start gap-2">
                <textarea rows={3} className={`${inputCls} py-1.5`} value={mensagem} onChange={(e) => set({ mensagem: e.target.value })} />
                <Copiar texto={mensagem} />
              </div>
            </Passo>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <span className="text-sm font-semibold text-slate-700">Depois de salvar lá:</span>
            <input
              inputMode="numeric"
              placeholder="ID da campanha"
              value={id}
              onChange={(e) => setId(e.target.value.trim())}
              onBlur={() => id !== (ov.idBackoffice || '') && set({ idBackoffice: id })}
              className="w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            {st !== 'agendada' ? (
              <button onClick={() => set({ status: 'agendada', em: today(), idBackoffice: id })} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                ✓ Criei
              </button>
            ) : (
              <button onClick={() => set({ status: 'pendente' })} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                ↩ Voltar para criar
              </button>
            )}
            {st === 'pendente' && (
              <button onClick={() => set({ status: 'pulada' })} className="ml-auto text-xs font-semibold text-slate-400 hover:text-slate-600">
                Não vou usar
              </button>
            )}
            {st === 'pulada' && (
              <button onClick={() => set({ status: 'pendente' })} className="ml-auto text-xs font-semibold text-slate-500">
                ↩ Voltar para criar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
