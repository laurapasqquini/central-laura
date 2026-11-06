import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { dadosPaginaLolis, expansaoLolis, isWorkday } from '../lib/engine';
import { today, addDays, fmtCurto } from '../lib/dates';
import { pontoDesde, porDia, resumoDia, hora, duracao } from '../lib/ponto';
import { metasLolis, metaTelefones, resumoDoDia, cobrancas, elogios, semana, telefonesNoDia, diasUteisEntre, segundaDe, METAS_PADRAO } from '../lib/acompanhamento.js';
import { Empty, inputCls } from './ui';

// Ranken › Lolis › Acompanhamento: o painel que se monta sozinho (sem IA) para a Laura acompanhar a Lolis:
// o dia dela, o que cobrar e o que elogiar (com mensagem pronta para copiar), a semana e a pauta de sexta.
// Nada é enviado sozinho.

const ehSorteio = (t) => /sorteio di[aá]rio/i.test(t.titulo);

// o que estava combinado num dia (o mesmo que aparece na página dela) + o que ela marcou
function montarDia(state, d, ref, ponto, agora, meta, metas) {
  const dia = dadosPaginaLolis(state, d).dias.find((x) => x.date === d);
  if (!dia) return null;
  const lembretes = dia.brindes.filter((b) => b.tipo !== 'acao');
  const sorteios = dia.posts.length ? dia.posts.map((p) => `sorteio:${p.grupo}`) : dia.tarefas.some(ehSorteio) || lembretes.length ? ['sorteio'] : [];
  const itens = [
    ...(d === ref ? dia.atrasadas.map((t) => ({ key: t.key, titulo: t.titulo })) : []),
    ...sorteios.map((k) => ({ key: k, titulo: k === 'sorteio' ? 'Sorteio diário' : `Sorteio diário · ${k.slice(8)}` })),
    ...dia.tarefas.filter((t) => !ehSorteio(t)).map((t) => ({ key: t.key, titulo: t.titulo, feito: t.feito })),
    ...lembretes.map((b) => ({ key: b.key, titulo: b.linha })),
  ];
  const feitos = (state.lolisFeitos || {})[d] || [];
  const chaves = new Set(itens.map((x) => x.key));
  // o que ela fez além do combinado: veio do "Acabou? Puxa daqui" (banco, Expansão, tarefas para adiantar)
  const extras = feitos
    .filter((k) => !chaves.has(k) && (k.startsWith('b:') || k.startsWith('t:')))
    .map((k) => ({ key: k, titulo: k.startsWith('b:') ? (state.lolisBanco || []).find((b) => b.id === k.slice(2))?.titulo || 'Item do banco' : state.tasks.find((t) => t.id === k.slice(2))?.title || 'Tarefa' }));
  const r = resumoDoDia(
    {
      date: d,
      itens,
      sorteios,
      notas: (state.lolisNotas || {})[d] || {},
      feitos,
      extras,
      ponto: ponto ? resumoDia(ponto[d] || {}, d, ref, true, agora) : null,
      telefones: telefonesNoDia(state.telefonesHist, d),
    },
    metas,
    meta,
  );
  return { ...r, atrasadas: d === ref ? dia.atrasadas : [] };
}

function usePontoAcomp(desde) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let vivo = true;
    const ler = () => pontoDesde(desde).then((r) => vivo && setRes(r));
    ler();
    const t = setInterval(ler, 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [desde]);
  return res;
}

export default function AcompanhamentoLolis() {
  const { state, escalarCobrancasLolis } = useStore();
  const ref = today();
  const seg = segundaDe(ref);
  const res = usePontoAcomp(addDays(seg, -7));
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const metas = metasLolis(state);
  const util = (d) => isWorkday(state, d);
  const ponto = res && !res.erro ? porDia(res.rows) : null;

  const dados = useMemo(() => {
    const expansao = expansaoLolis(state, ref);
    const meta = metaTelefones(metas, expansao);
    let ant = addDays(ref, -1);
    while (!isWorkday(state, ant) && ant > addDays(ref, -10)) ant = addDays(ant, -1);
    const hoje = isWorkday(state, ref) ? montarDia(state, ref, ref, ponto, agora, meta, metas) : null;
    const anterior = montarDia(state, ant, ref, ponto, agora, meta, metas);
    const atrasadas = (hoje?.atrasadas || []).map((t) => ({ ...t, dias: diasUteisEntre(t.era, ref, (d) => isWorkday(state, d)) }));
    const ctx = { ref, hoje, anterior, atrasadas, expansao, agora };
    const dias = Array.from({ length: 5 }, (_, i) => addDays(seg, i)).map((d) =>
      d > ref ? { date: d, futuro: true } : isWorkday(state, d) ? (d === ref ? hoje : d === ant ? anterior : montarDia(state, d, ref, ponto, agora, meta, metas)) : { date: d, folga: true },
    );
    const resumos = dias.filter((r) => r && !r.futuro && !r.folga);
    return { expansao, meta, hoje, anterior, cobrar: cobrancas(ctx, metas), elogiar: elogios(ctx), dias, sem: semana(resumos, metas) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ref, res, agora.getHours(), agora.getMinutes()]);

  // cobrança que fica na lista vira tarefa da Laura (só depois de ler o ponto, para a lista não "piscar")
  const ids = dados.cobrar.map((c) => c.id).join('|');
  useEffect(() => {
    if (!res) return;
    escalarCobrancasLolis(dados.cobrar.map(({ id, titulo, tarefa, porque, mensagem }) => ({ id, titulo, tarefa, porque, mensagem })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, !!res]);

  const reg = state.lolisCobrancas || {};
  return (
    <div className="space-y-6">
      <Metas meta={dados.meta} expansao={dados.expansao} />
      <Hoje r={dados.hoje} anterior={dados.anterior} pontoErro={res?.erro} carregando={!res} />

      <Bloco titulo="O que cobrar" tom="text-red-700" count={dados.cobrar.length} dica="Mensagens prontas, em tom acolhedor. Copie e mande só se fizer sentido: nada sai sozinho.">
        {dados.cobrar.length ? (
          dados.cobrar.map((c) => {
            const r = reg[c.id];
            const n = r ? diasUteisEntre(r.desde, ref, util) : 0;
            return (
              <Cartao key={c.id} titulo={c.titulo} porque={c.porque} mensagem={c.mensagem} cor="red">
                {r?.tarefa ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">virou tarefa sua em {fmtCurto(r.tarefa)}</span>
                ) : n > 0 ? (
                  <span className="text-[11px] font-semibold text-slate-400">
                    na lista há {n} dia{n > 1 ? 's' : ''} útil{n > 1 ? 'eis' : ''} · vira tarefa sua com {metas.diasEscalar}
                  </span>
                ) : null}
              </Cartao>
            );
          })
        ) : (
          <Empty>Nada para cobrar agora.</Empty>
        )}
      </Bloco>

      <Bloco titulo="O que elogiar" tom="text-emerald-700" count={dados.elogiar.length} dica="Reconhecer o que deu certo também é acompanhar.">
        {dados.elogiar.length ? dados.elogiar.map((c) => <Cartao key={c.id} titulo={c.titulo} mensagem={c.mensagem} cor="emerald" />) : <Empty>Ainda nada para elogiar hoje.</Empty>}
      </Bloco>

      <Semana dias={dados.dias} sem={dados.sem} metas={metas} sexta={new Date(`${ref}T12:00`).getDay() === 5} />
    </div>
  );
}

// ── Hoje ──
function Hoje({ r, anterior, pontoErro, carregando }) {
  if (!r)
    return (
      <Bloco titulo="Hoje" tom="text-amber-700">
        <Empty>Hoje não é dia de trabalho da Lolis.{anterior ? ` Último dia: ${fmtCurto(anterior.date)}, ${anterior.feitas} de ${anterior.total} tarefas.` : ''}</Empty>
      </Bloco>
    );
  const horas = r.minutos != null ? `${duracao(r.minutos)} de ${duracao(r.metaMin)}` : '—';
  const STATUS = { aguardando: 'ainda não é hora', 'nao-chegou': 'não marcou a chegada', trabalhando: 'trabalhando', saiu: 'saiu', falta: 'falta', folga: 'folga combinada', 'sem-saida': 'sem saída' };
  return (
    <Bloco titulo="Hoje" tom="text-amber-700">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Num rotulo="Chegada · saída" valor={r.entrada ? `${hora(r.entrada)} · ${r.saida ? hora(r.saida) : '…'}` : '—'} sub={carregando ? 'lendo o ponto…' : pontoErro ? 'ponto não ligado' : r.atrasoChegada ? `${r.atrasoChegada} min depois das 14h` : STATUS[r.status] || ''} alerta={!!r.atrasoChegada || r.status === 'nao-chegou'} />
        <Num rotulo="Horas" valor={horas} sub={r.status === 'trabalhando' ? 'até agora' : ''} />
        <Num rotulo="Tarefas" valor={`${r.feitas} de ${r.total}`} sub={r.naoConsegui.length ? `${r.naoConsegui.length} não conseguiu` : r.pendentes.length ? `${r.pendentes.length} em aberto` : r.total ? 'tudo feito' : ''} ok={r.total > 0 && r.feitas === r.total} />
        <Num rotulo="Telefones" valor={r.telefones == null ? '—' : r.metaTelefones ? `${r.telefones} de ${r.metaTelefones}` : `${r.telefones}`} sub={r.telefones == null ? 'sem leitura do Hub hoje' : 'responsáveis anotados'} ok={r.metaTelefones > 0 && r.telefones >= r.metaTelefones} />
        <Num rotulo="Sorteio · parabéns" valor={r.sorteios ? `${r.sorteiosOk} de ${r.sorteios}` : '—'} sub={r.sorteios ? (r.sorteiosOk === r.sorteios ? 'feito' : 'falta') : 'sem sorteio hoje'} ok={r.sorteios > 0 && r.sorteiosOk === r.sorteios} />
      </div>
      {r.naoConsegui.length > 0 && (
        <div className="space-y-1 rounded-lg bg-red-50/60 p-3 ring-1 ring-red-100">
          <div className="text-xs font-bold uppercase tracking-wide text-red-700">Não conseguiu</div>
          {r.naoConsegui.map((x) => (
            <div key={x.key} className="text-sm text-slate-700">
              {x.titulo}
              <span className={`block text-xs ${x.nota ? 'text-slate-500' : 'text-red-600'}`}>{x.nota ? `"${x.nota}"` : 'sem nota'}</span>
            </div>
          ))}
        </div>
      )}
      {r.pendentes.length > 0 && (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">Em aberto ({r.pendentes.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {r.pendentes.map((x) => (
              <li key={x.key}>{x.titulo}</li>
            ))}
          </ul>
        </details>
      )}
      {r.extras.length > 0 && <p className="text-xs text-emerald-700">Puxou do "Acabou? Puxa daqui": {r.extras.map((x) => x.titulo).join(' · ')}</p>}
    </Bloco>
  );
}

// ── Semana ──
function Semana({ dias, sem, metas, sexta }) {
  const NOME = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const t = sem.tot;
  return (
    <Bloco titulo="Semana" tom="text-indigo-700">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-1 pr-2 font-semibold">Dia</th>
              <th className="py-1 pr-2 font-semibold">Feitas</th>
              <th className="py-1 pr-2 font-semibold">Horas</th>
              <th className="py-1 pr-2 font-semibold">Telefones</th>
              <th className="py-1 font-semibold">Chegada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dias.map((r, i) => (
              <tr key={r?.date || i} className={r?.futuro ? 'text-slate-300' : 'text-slate-700'}>
                <td className="py-1.5 pr-2 font-semibold">
                  {NOME[i]} <span className="font-normal text-slate-400">{r?.date?.slice(8, 10)}/{r?.date?.slice(5, 7)}</span>
                </td>
                {!r || r.futuro || r.folga ? (
                  <td colSpan={4} className="py-1.5 text-xs text-slate-400">
                    {r?.folga ? 'folga / feriado' : '—'}
                  </td>
                ) : (
                  <>
                    <td className={`py-1.5 pr-2 ${r.total && r.feitas === r.total ? 'text-emerald-700' : ''}`}>
                      {r.feitas} de {r.total}
                      {r.extras.length > 0 && <span className="text-xs text-emerald-600"> +{r.extras.length}</span>}
                    </td>
                    <td className="py-1.5 pr-2">{r.minutos != null ? duracao(r.minutos) : r.status === 'falta' ? 'falta' : r.status === 'folga' ? 'folga' : '—'}</td>
                    <td className={`py-1.5 pr-2 ${r.metaTelefones && r.telefones != null ? (r.telefones >= r.metaTelefones ? 'text-emerald-700' : 'text-red-600') : ''}`}>
                      {r.telefones ?? '—'}
                      {r.metaTelefones ? <span className="text-xs text-slate-400"> / {r.metaTelefones}</span> : null}
                    </td>
                    <td className={`py-1.5 ${r.atrasoChegada ? 'text-red-600' : ''}`}>{r.entrada ? `${hora(r.entrada)}${r.atrasoChegada ? ` (+${r.atrasoChegada}min)` : ''}` : '—'}</td>
                  </>
                )}
              </tr>
            ))}
            <tr className="font-bold text-ink">
              <td className="py-1.5 pr-2">Total</td>
              <td className="py-1.5 pr-2">
                {t.feitas} de {t.total}
              </td>
              <td className="py-1.5 pr-2">
                {duracao(t.minutos)}
                {sem.metaHoras ? <span className="text-xs font-normal text-slate-400"> / {duracao(sem.metaHoras)}</span> : null}
              </td>
              <td className="py-1.5 pr-2">
                {t.telefones}
                {t.meta ? <span className="text-xs font-normal text-slate-400"> / {t.meta}</span> : null}
              </td>
              <td className="py-1.5">{t.atrasos ? `${t.atrasos} atraso${t.atrasos > 1 ? 's' : ''}` : 'sem atrasos'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={`space-y-2 rounded-lg p-3 ring-1 ${sexta ? 'bg-indigo-50/60 ring-indigo-200' : 'bg-slate-50 ring-slate-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-700">{sexta ? 'Hoje é sexta: pauta da conversa 1:1' : 'Pauta da conversa de sexta (1:1)'}</div>
          <Copiar texto={['Pauta da nossa conversa da semana:', ...sem.pauta.map((p, i) => `${i + 1}. ${p}`)].join('\n')} rotulo="Copiar pauta" />
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {sem.pauta.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p className="text-[11px] text-slate-400">Meta da semana: {metas.horasDia}h por dia trabalhado e os telefones da meta de cada dia.</p>
      </div>
    </Bloco>
  );
}

// ── Metas editáveis ──
function Metas({ meta, expansao }) {
  const { state, setLolisMetas } = useStore();
  const [aberto, setAberto] = useState(false);
  const m = state.lolisMetas || {};
  const auto = metaTelefones({ ...METAS_PADRAO }, expansao);
  const metas = metasLolis(state);
  const campo = (k, rotulo, dica, props = {}) => (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-600">{rotulo}</span>
      <input type="number" inputMode="numeric" className={inputCls} value={m[k] ?? ''} placeholder={String(k === 'telefonesDia' ? `automático: ${auto}` : METAS_PADRAO[k])} onChange={(e) => setLolisMetas({ [k]: e.target.value === '' ? '' : Number(e.target.value) })} {...props} />
      <span className="block text-[11px] text-slate-400">{dica}</span>
    </label>
  );
  return (
    <section className="space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <button onClick={() => setAberto(!aberto)} className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Metas combinadas</h2>
        <span className="text-xs text-slate-500">
          {meta ? `${meta} telefones/dia` : 'sem meta de telefones'} · {metas.horasDia}h/dia · cobrar atraso com {metas.diasAtraso} dias · <b className="text-slate-600">{aberto ? 'fechar' : 'editar'}</b>
        </span>
      </button>
      {aberto && (
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('telefonesDia', 'Telefones por dia', `Em branco, a central calcula pelo prazo da Expansão (mínimo de 4). Hoje daria ${auto || 'nenhum'}.`, { min: 0 })}
          {campo('horasDia', 'Horas por dia', 'Jornada combinada (estágio: no máximo 4h).', { min: 1, max: 4, step: 0.5 })}
          {campo('diasAtraso', 'Cobrar tarefa atrasada a partir de (dias úteis)', 'Antes disso, a atrasada aparece só na página dela.', { min: 1 })}
          {campo('diasEscalar', 'Cobrança vira tarefa sua depois de (dias úteis)', 'Cria "Cobrar Lolis: …" com o contexto nas notas.', { min: 1 })}
          {campo('toleranciaMin', 'Tolerância para "saiu cedo" (minutos)', 'Saiu até esse tanto antes do fim da jornada não conta.', { min: 0 })}
        </div>
      )}
    </section>
  );
}

// ── peças ──
function Bloco({ titulo, tom, count, dica, children }) {
  return (
    <section className="space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className={`text-sm font-bold uppercase tracking-wide ${tom}`}>
          {titulo} {count != null && <span className="ml-1 font-semibold text-slate-400">{count}</span>}
        </h2>
        {dica && <p className="text-xs text-slate-500">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

const Num = ({ rotulo, valor, sub, ok, alerta }) => (
  <div className={`rounded-lg p-3 ring-1 ${ok ? 'bg-emerald-50/60 ring-emerald-200' : alerta ? 'bg-red-50/60 ring-red-200' : 'bg-slate-50 ring-slate-200'}`}>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</div>
    <div className={`text-lg font-bold ${ok ? 'text-emerald-700' : alerta ? 'text-red-700' : 'text-ink'}`}>{valor}</div>
    {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
  </div>
);

function Cartao({ titulo, porque, mensagem, cor, children }) {
  const anel = cor === 'red' ? 'ring-red-100' : 'ring-emerald-100';
  return (
    <div className={`space-y-2 rounded-lg p-3 ring-1 ${anel}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{titulo}</div>
          {porque && <div className="text-xs text-slate-500">{porque}</div>}
        </div>
        {children}
      </div>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 rounded-lg bg-[#e7ffdb] px-3 py-2 text-sm text-slate-700">{mensagem}</p>
        <Copiar texto={mensagem} />
      </div>
    </div>
  );
}

function Copiar({ texto, rotulo = 'Copiar' }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {
      prompt('Copie a mensagem:', texto);
    }
  };
  return (
    <button onClick={copiar} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">
      {ok ? 'Copiado ✓' : rotulo}
    </button>
  );
}
