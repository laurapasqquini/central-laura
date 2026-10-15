import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { gerarCampanhas, TIPOS, statusCampanha, ajustesCampanha } from '../data/campanhas';
import { today, fmtCurto } from '../lib/dates';
import { limiteDiasUteis } from '../lib/engine';
import { Empty, Pill, Segmented, inputCls } from '../components/ui';

const brData = (s) => s.split('-').reverse().join('/');

// Campanhas push da etapa: cada uma é criada UMA vez no backoffice (Programada, repetindo a cada N dias,
// do início ao fim). A lista vem dos calendários; aqui a Laura copia os campos e marca o que já criou.
export default function Campanhas() {
  const { state, setCampanha } = useStore();
  const ref = today();
  const [ver, setVer] = useState('criar'); // criar | todas
  const [cidade, setCidade] = useState('all');
  const [aberta, setAberta] = useState(null);

  const todas = useMemo(() => gerarCampanhas(ref), [ref]);
  const cidades = [...new Set(todas.map((c) => c.cidade))];
  const ov = state.campanhas || {};
  const status = (c) => statusCampanha(ov, c);

  const lista = todas.filter((c) => cidade === 'all' || c.cidade === cidade).filter((c) => (ver === 'criar' ? status(c) === 'pendente' : true));
  const urgentes = todas.filter((c) => status(c) === 'pendente' && c.data <= limiteDiasUteis(state, ref, 3)).length;
  const criadas = todas.filter((c) => status(c) === 'agendada').length;

  // agrupadas por categoria (cidade · categoria)
  const porCategoria = lista.reduce((acc, c) => ((acc[`${c.cidade} · ${c.categoria}`] ||= []).push(c), acc), {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={ver}
          onChange={setVer}
          options={[
            ['criar', `Para criar (${todas.length - criadas})`],
            ['todas', 'Todas'],
          ]}
        />
        <Segmented value={cidade} onChange={setCidade} options={[['all', 'Todas as cidades'], ...cidades.map((c) => [c, c])]} />
      </div>

      <div className="space-y-1 rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900 ring-1 ring-indigo-100">
        <div className="font-bold">Como criar no backoffice</div>
        <div>
          Cada campanha daqui é criada <b>uma vez só</b> e se repete sozinha até o fim. Os campos abaixo estão na mesma ordem do backoffice, cada um com o seu
          <b> copiar</b>. Duplas e Beach de Maringá aparecem duas vezes porque lá são duas etapas (masculina e feminina).
        </div>
      </div>

      {urgentes > 0 && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800 ring-1 ring-red-100">
          📣 {urgentes} {urgentes === 1 ? 'campanha começa' : 'campanhas começam'} nos próximos 3 dias úteis e ainda não {urgentes === 1 ? 'foi criada' : 'foram criadas'}.
        </div>
      )}

      {!lista.length && <Empty>Todas as campanhas da etapa já foram criadas. 🎉</Empty>}

      {Object.entries(porCategoria).map(([cat, cs]) => (
        <section key={cat} className="space-y-2">
          <div className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">{cat}</div>
          {cs.map((c) => (
            <Card key={c.id} c={c} st={status(c)} ov={ajustesCampanha(ov, c)} aberta={aberta === c.id} onToggle={() => setAberta(aberta === c.id ? null : c.id)} set={(p) => ('status' in p ? c.instancias.forEach((i) => setCampanha(i, p)) : setCampanha(c.instancias[0], p))} ref0={ref} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Copiar({ texto, rotulo = 'copiar' }) {
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
      className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
    >
      {ok ? '✓ copiado' : rotulo}
    </button>
  );
}

function Campo({ nome, valor, dica, copiar = true }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{nome}</div>
        <div className="text-sm text-slate-800">{valor}</div>
        {dica && <div className="text-xs text-slate-400">{dica}</div>}
      </div>
      {copiar && <Copiar texto={valor} />}
    </div>
  );
}

function Card({ c, st, ov, aberta, onToggle, set, ref0 }) {
  const titulo = ov.titulo ?? c.titulo;
  const mensagem = ov.mensagem ?? c.mensagem;
  const etapa = ov.etapa ?? c.etapa;
  const hora = ov.hora ?? c.hora;
  const feito = st !== 'pendente';
  const confira = /confira/i.test(etapa);
  const unica = c.envios === 1;

  return (
    <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-60' : ''}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3.5 text-left">
        <span className="text-xl">{TIPOS[c.tipo].icone}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-800">{TIPOS[c.tipo].nome}</span>
            <Pill className="bg-slate-50 text-slate-500 ring-slate-200">{c.rodadas}</Pill>
            {/MASCULINA|FEMININA|MASCULINO -|FEMININO -/.test(etapa) && (
              <Pill className="bg-violet-50 text-violet-700 ring-violet-200">{/MASCULIN/.test(etapa) ? 'masculino' : 'feminino'}</Pill>
            )}
            {st === 'agendada' && <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">✓ criada{ov.idBackoffice ? ` · ID ${ov.idBackoffice}` : ''}</Pill>}
            {st === 'pulada' && <Pill className="bg-slate-50 text-slate-400 ring-slate-200">pulada</Pill>}
            {c.data <= ref0 && st === 'pendente' && <Pill className="bg-red-50 text-red-600 ring-red-200">começa hoje</Pill>}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">
            {unica ? `${fmtCurto(c.inicio)} · ${hora.replace(':00', 'h')} (uma vez)` : `${fmtCurto(c.inicio)} → ${fmtCurto(c.fim)} · a cada ${c.repetir} dias · ${hora.replace(':00', 'h')} · ${c.envios} envios`}
          </div>
        </div>
      </button>

      {aberta && (
        <div className="space-y-3 border-t border-slate-100 px-3.5 pb-3.5 pt-2">
          <div className="divide-y divide-slate-100">
            <Campo nome="Alcance" valor="Jogadores de uma etapa" copiar={false} />
            <Campo nome="Gatilho" valor="Programada" copiar={false} />
            <Campo nome="Etapa" valor={etapa} dica={confira ? 'Nome ainda não conferido: escolha na lista do backoffice a etapa desta categoria.' : 'Procure este nome na lista do backoffice.'} />
            <Campo nome="Repetir a cada (dias)" valor={String(c.repetir)} dica={unica ? 'Envio único: início e fim no mesmo dia.' : undefined} />
            <Campo nome="Início" valor={brData(c.inicio)} />
            <Campo nome="Fim" valor={brData(c.fim)} dica={unica ? undefined : `O último envio é nesse dia (${c.rodadas}).`} />
            <div className="flex items-center justify-between gap-3 py-1.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Horário de envio</div>
                <input type="time" step="900" value={hora} onChange={(e) => set({ hora: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
              </div>
              <Copiar texto={hora} />
            </div>
          </div>
          <label className="block space-y-1">
            <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Título <Copiar texto={titulo} />
            </span>
            <input className={inputCls} value={titulo} onChange={(e) => set({ titulo: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Mensagem <span className="flex items-center gap-2 normal-case">{mensagem.length}/500 <Copiar texto={mensagem} /></span>
            </span>
            <textarea rows={3} className={inputCls} value={mensagem} onChange={(e) => set({ mensagem: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ID no backoffice</span>
            <input
              inputMode="numeric"
              placeholder="ex.: 12"
              value={ov.idBackoffice || ''}
              onChange={(e) => set({ idBackoffice: e.target.value.trim() })}
              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            <span className="text-xs text-slate-400">a coluna ID da lista de campanhas (para achar e excluir depois)</span>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {st !== 'agendada' && (
              <button onClick={() => set({ status: 'agendada', em: today() })} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                ✓ Criei no backoffice
              </button>
            )}
            {st === 'pendente' && (
              <button onClick={() => set({ status: 'pulada' })} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                Não vou usar
              </button>
            )}
            {st !== 'pendente' && (
              <button onClick={() => set({ status: 'pendente' })} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
                Voltar para criar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
