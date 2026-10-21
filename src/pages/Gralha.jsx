import { useEffect, useMemo, useState } from 'react';
import { useStore, STAGES } from '../lib/store';
import { cfgComissao, comissaoDe, dataFechamento, valoresPedido, resumoAtivacoes, cidadesConhecidas, cidadeDe } from '../lib/gralha';
import { brl, priceFor, search, searchMany, detalhe, totals, mensagem, mensagemTabela, faixasLabel, isMaringa } from '../lib/gralha';
import { fmtCurto, relativo, today, addDays } from '../lib/dates';
import { inputCls, inputBase, Empty, Pill, Segmented } from '../components/ui';
import Contrato from './Contrato';
import ListaDoDia from '../components/ListaDoDia';
import { pedidosParados } from '../lib/engine';

// O catálogo (242 produtos) só carrega quando a aba é aberta.
function useCatalogo() {
  const [cat, setCat] = useState(null);
  useEffect(() => {
    import('../data/gralha.json').then((m) => setCat(m.default));
  }, []);
  return cat;
}

export default function Gralha() {
  const cat = useCatalogo();
  const [view, setView] = useState('novo');
  const { state } = useStore();
  const abertos = (state.pedidos || []).filter((p) => !['contrato', 'perdido'].includes(p.stage)).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Gralha Azul</h1>
          <p className="text-sm text-slate-500">
            Orçamento em segundos e cada pedido acompanhado até o contrato.
            {cat && <span className="text-slate-400"> · {cat.produtos.length} produtos da planilha</span>}
          </p>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            ['novo', '+ Novo orçamento', 'bg-sky-500 text-white ring-transparent'],
            ['pedidos', `Pedidos${abertos ? ` (${abertos})` : ''}`, 'bg-sky-500 text-white ring-transparent'],
            ['tarefas', 'Tarefas', 'bg-sky-500 text-white ring-transparent'],
          ]}
        />
      </header>
      {view === 'tarefas' ? (
        <ListaDoDia area="gralha" />
      ) : !cat ? (
        <Empty>Carregando catálogo…</Empty>
      ) : view.startsWith('contrato:') && (state.pedidos || []).some((p) => p.id === view.slice(9)) ? (
        <Contrato key={view} pedido={state.pedidos.find((p) => p.id === view.slice(9))} cat={cat} onVoltar={() => setView('pedidos')} />
      ) : view.startsWith('editar:') && (state.pedidos || []).some((p) => p.id === view.slice(7)) ? (
        <Novo key={view} cat={cat} pedido={state.pedidos.find((p) => p.id === view.slice(7))} onSaved={() => setView('pedidos')} />
      ) : view === 'novo' ? (
        <Novo cat={cat} onSaved={() => setView('pedidos')} />
      ) : (
        <Pedidos cat={cat} onContrato={(id) => setView(`contrato:${id}`)} onEditar={(id) => setView(`editar:${id}`)} />
      )}
    </div>
  );
}

// Novo orçamento, ou edição de um pedido já salvo (pedido = o pedido a editar)
function Novo({ cat, onSaved, pedido }) {
  const { addPedido, updatePedido } = useStore();
  const [q, setQ] = useState('');
  const [aba, setAba] = useState('');
  const [modo, setModo] = useState(pedido?.tipo || 'qtd'); // qtd | tabela
  const [itens, setItens] = useState(() =>
    (pedido?.itens || []).filter((it) => cat.produtos.some((p) => p.id === it.prodId)).map((it) => ({ key: crypto.randomUUID().slice(0, 6), ...it })),
  );
  const [cliente, setCliente] = useState(pedido?.cliente || '');
  const [cidade, setCidade] = useState(pedido?.cidade || '');
  const [frete, setFrete] = useState(pedido?.frete ? String(pedido.frete).replace('.', ',') : '');
  const [desconto, setDesconto] = useState(pedido?.descontoTexto || ''); // "10%" ou valor em R$
  const [ativacao, setAtivacao] = useState(pedido?.ativacao || '');
  const { state } = useStore();
  const ativacoes = useMemo(() => [...new Set((state.pedidos || []).map((p) => (p.ativacao || '').trim()).filter(Boolean))], [state.pedidos]);
  const cidades = useMemo(() => cidadesConhecidas((state.pedidos || []).filter((p) => p.id !== pedido?.id)), [state.pedidos, pedido]);
  const cidadeSalva = cidadeDe(cidades, cidade);
  const [copied, setCopied] = useState(false);
  const abas = useMemo(() => [...new Set(cat.produtos.map((p) => p.aba))], [cat]);
  const groups = useMemo(() => {
    if (q.trim()) return searchMany(cat.produtos, q, aba).map((g) => ({ ...g, results: g.results.slice(0, 12) }));
    return aba ? [{ termo: '', results: search(cat.produtos, '', aba) }] : [];
  }, [cat, q, aba]);
  const added = new Set(itens.map((i) => i.prodId));

  const freteNum = isMaringa(cidade) ? 0 : parseFloat(String(frete).replace(',', '.')) || 0;
  const { linhas, produtosTotal, desconto: descontoR, total, aVista } = totals(itens, cat.produtos, freteNum, desconto);
  const tabela = modo === 'tabela';
  const msg = !itens.length ? '' : tabela ? mensagemTabela({ cliente, cidade, itens, produtos: cat.produtos, descontoTexto: desconto, ativacao: ativacao.trim() }) : mensagem({ cliente, cidade, itens, produtos: cat.produtos, frete: freteNum, descontoTexto: desconto, ativacao: ativacao.trim() });

  const add = (p) => {
    setItens((xs) => [...xs, { key: crypto.randomUUID().slice(0, 6), prodId: p.id, qtd: Math.max(p.minimo || 1, 1) }]);
  };
  const setQtd = (key, qtd) => setItens((xs) => xs.map((x) => (x.key === key ? { ...x, qtd: Math.max(1, qtd || 1) } : x)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copie a mensagem:', msg);
    }
  };

  const salvar = () => {
    const dados = { cliente: cliente.trim() || 'Cliente sem nome', cidade, tipo: modo, itens: itens.map(({ prodId, qtd, precoManual }) => ({ prodId, qtd, ...(precoManual != null ? { precoManual } : {}) })), frete: freteNum, total: tabela ? null : total, mensagem: msg, ativacao: ativacao.trim(), descontoTexto: desconto.trim(), desconto: tabela ? 0 : descontoR };
    // editando: atualiza o mesmo pedido (mantém a etapa e o histórico)
    if (pedido) updatePedido(pedido.id, { ...dados, editadoEm: today() });
    else addPedido(dados);
    onSaved();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <Segmented
          value={modo}
          onChange={setModo}
          options={[
            ['qtd', 'Com quantidade', 'bg-ink text-white ring-ink'],
            ['tabela', 'Só tabela de preços', 'bg-ink text-white ring-ink'],
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} placeholder="Cliente (ex.: Medicina UEM 2027)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input className={inputCls} list="cidades-gralha" placeholder="Cidade de entrega" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </div>
        <datalist id="cidades-gralha">
          {Object.values(cidades).map((c) => <option key={c.nome} value={c.nome} />)}
        </datalist>

        <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <input autoFocus className={inputCls} placeholder="Buscar… vários de uma vez com vírgula: camiseta algodão, samba, body" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {abas.map((a) => (
              <button
                key={a}
                onClick={() => setAba(aba === a ? '' : a)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${aba === a ? 'bg-sky-500 text-white ring-transparent' : 'bg-white text-slate-500 ring-slate-200'}`}
              >
                {a.replace(/\s+/g, ' ').toLowerCase()}
              </button>
            ))}
          </div>
          {groups.length > 0 && (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {groups.map((g) => (
                <div key={g.termo} className="space-y-1">
                  {groups.length > 1 && <div className="px-2 text-xs font-bold uppercase tracking-wide text-sky-600">{g.termo}</div>}
                  {!g.results.length && <p className="px-2 text-sm text-slate-400">Nada encontrado.</p>}
                  {g.results.map((p) => (
                    <button
                      key={p.id}
                      // clicou de novo num já escolhido: tira do orçamento
                      onClick={() => (added.has(p.id) ? setItens((xs) => xs.filter((x) => x.prodId !== p.id)) : add(p))}
                      title={added.has(p.id) ? 'Clique para tirar do orçamento' : 'Clique para adicionar'}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left ${added.has(p.id) ? 'bg-sky-50' : 'hover:bg-sky-50'}`}
                    >
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-semibold text-slate-800">{added.has(p.id) && '✓ '}{p.nome}</div>
                        <div className="truncate text-xs text-slate-500">{detalhe(p) || p.aba}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        a partir de <b className="text-slate-700">{brl(Math.min(...p.faixas.map((f) => f.preco)))}</b>
                        <div>mín. {p.minimo}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

        </div>

        {linhas.map((l) => {
          const { proxima, abaixoMinimo } = priceFor(l.p, l.qtd);
          return (
            <div key={l.key} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800">{l.p.nome}</div>
                  <div className="text-xs text-slate-500">{detalhe(l.p)}{l.p.prazo && ` · prazo ${l.p.prazo}`}</div>
                </div>
                <button onClick={() => setItens((xs) => xs.filter((x) => x.key !== l.key))} className="text-xl leading-none text-slate-300 hover:text-red-500">×</button>
              </div>
              {tabela ? (
                <div className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                  {faixasLabel(l.p).map((f) => (
                    <div key={f.label} className="flex justify-between"><span className="text-slate-500">{f.label}</span><b className="text-slate-700">{brl(f.preco)}</b></div>
                  ))}
                </div>
              ) : (
              <>
              <div className="flex items-center gap-3">
                <input type="number" min="1" className={`${inputBase} w-24`} value={l.qtd} onChange={(e) => setQtd(l.key, parseInt(e.target.value, 10))} />
                <span className="text-sm text-slate-500">× {brl(l.unit)}</span>
                <span className="ml-auto font-bold text-ink">{brl(l.subtotal)}</span>
              </div>
              {abaixoMinimo && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">Abaixo do pedido mínimo ({l.p.minimo} peças).</p>}
              {proxima && !abaixoMinimo && (
                <p className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  💡 Com <b>{proxima.min - l.qtd}</b> peças a mais ({proxima.min}), cai para <b>{brl(proxima.preco)}</b> cada.
                </p>
              )}
              </>
              )}
            </div>
          );
        })}

        {itens.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-700">🎯 Desconto de ativação <span className="font-normal text-slate-400">(opcional)</span></div>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <input className={inputBase} list="ativacoes-gralha" placeholder="Ativação / motivo (ex.: Jogos Universitários)" value={ativacao} onChange={(e) => setAtivacao(e.target.value)} />
              <input className={`${inputBase} text-right`} placeholder="R$ ou %" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </div>
            <datalist id="ativacoes-gralha">
              {ativacoes.map((a) => <option key={a} value={a} />)}
            </datalist>
            {desconto.trim() && !ativacao.trim() && <p className="text-xs font-semibold text-amber-600">Coloque a ativação ou o motivo, para dar para acompanhar depois quanto vendeu.</p>}
          </div>
        )}

        {itens.length > 0 && !tabela && (
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Frete</span>
              {isMaringa(cidade) ? (
                <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">grátis (Maringá)</Pill>
              ) : (
                <input className={`${inputBase} w-36 text-right`} placeholder="R$ (opcional)" value={frete} onChange={(e) => setFrete(e.target.value)} />
              )}
            </div>
            {/* fretes já passados para esta cidade: referência (o valor muda com o volume) */}
            {!isMaringa(cidade) && cidadeSalva?.fretes.length > 0 && (
              <div className="space-y-1 rounded-lg bg-sky-50 px-2.5 py-2 text-xs text-sky-800">
                <div className="font-semibold">🚚 Fretes já passados para {cidadeSalva.nome}:</div>
                {cidadeSalva.fretes.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span>
                      <b>{brl(f.frete)}</b> · {f.cliente}{f.pecas ? `, ${f.pecas} peças` : ''}{f.data ? ` (${fmtCurto(f.data)})` : ''}
                    </span>
                    {String(f.frete).replace('.', ',') !== frete && (
                      <button onClick={() => { setFrete(String(f.frete).replace('.', ',')); setCidade(cidadeSalva.nome); }} className="shrink-0 rounded-full bg-sky-500 px-2 py-0.5 font-bold text-white">usar</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Row label="Produtos" value={brl(produtosTotal)} />
            {descontoR > 0 && <Row label={`Desconto${ativacao.trim() ? ` · ${ativacao.trim()}` : ''}`} value={`−${brl(descontoR)}`} />}
            <Row label="Total" value={brl(total)} strong />
            <Row label="Se pedirem desconto: à vista (5% off nos produtos)" value={brl(aVista)} />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">Mensagem pro WhatsApp</h2>
        {msg ? (
          <>
            <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#e7ffdb] p-4 font-sans text-sm text-slate-800 shadow-sm ring-1 ring-emerald-100">{msg}</pre>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copy} className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white">{copied ? 'Copiado ✓' : 'Copiar mensagem'}</button>
              <button onClick={salvar} className="rounded-xl bg-ink py-3 text-sm font-bold text-white">{pedido ? 'Salvar alterações' : 'Salvar e acompanhar'}</button>
            </div>
            {pedido ? (
              <p className="px-1 text-xs text-slate-400">
                Atualiza o pedido de {pedido.cliente}, sem mudar a etapa.
                {pedido.contrato && <b className="text-amber-600"> O contrato já começado não muda sozinho: confira as quantidades e os preços nele.</b>}
              </p>
            ) : (
              <p className="px-1 text-xs text-slate-400">"Salvar e acompanhar" coloca o pedido no funil e cria o follow-up em 2 dias.</p>
            )}
          </>
        ) : (
          <Empty>Busque e adicione produtos. A mensagem aparece aqui, pronta para colar.</Empty>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value, strong }) => (
  <div className={`flex justify-between text-sm ${strong ? 'text-base font-bold text-ink' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

// Quanto cada ativação trouxe: orçamentos, fechados, vendido e desconto dado
function Ativacoes({ pedidos }) {
  const lista = resumoAtivacoes(pedidos);
  if (!lista.length) return null;
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">🎯 Ativações</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="py-1 pr-3 font-semibold">Ativação</th>
              <th className="py-1 pr-3 text-right font-semibold">Orçamentos</th>
              <th className="py-1 pr-3 text-right font-semibold">Fechados</th>
              <th className="py-1 pr-3 text-right font-semibold">Vendido</th>
              <th className="py-1 text-right font-semibold">Desconto dado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.nome} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 font-semibold text-slate-800">{a.nome}</td>
                <td className="py-1.5 pr-3 text-right text-slate-600">{a.orcamentos}</td>
                <td className="py-1.5 pr-3 text-right text-slate-600">{a.fechados}{a.perdidos > 0 && <span className="text-slate-400"> · {a.perdidos} perdido{a.perdidos > 1 ? 's' : ''}</span>}</td>
                <td className="py-1.5 pr-3 text-right font-bold text-ink">{brl(a.vendido)}</td>
                <td className="py-1.5 text-right text-slate-600">{brl(a.desconto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Vendido e desconto contam só os pedidos fechados (ou em contrato).</p>
    </section>
  );
}

// Pedidos: em andamento (cartões, por etapa), fechados e perdidos (lista compacta, por mês, com busca).
// Assim a tela não cresce sem fim quando os contratos se acumulam.
const EM_ANDAMENTO = ['enviado', 'arte', 'aprovacao', 'fechado'];
const MOTIVOS_PERDA = ['Preço', 'Prazo de produção', 'Fechou com outro', 'Sumiu / não respondeu', 'Desistiu do pedido', 'Outro'];
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (ym) => `${MESES_NOME[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
const semAcento = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Pedidos({ onContrato, onEditar }) {
  const { state, setGralhaCfg } = useStore();
  const [aba, setAba] = useState('andamento');
  const [etapa, setEtapa] = useState('');
  const [busca, setBusca] = useState('');
  const [ajustes, setAjustes] = useState(false);
  const pedidos = state.pedidos || [];
  if (!pedidos.length) return <Empty>Nenhum pedido ainda. Faça um orçamento e clique em "Salvar e acompanhar".</Empty>;

  const cfg = cfgComissao(state);
  const parados = Object.fromEntries(pedidosParados(state).map((p) => [p.id, p.dias]));
  const mes = today().slice(0, 7);
  const fechadosMes = pedidos.filter((p) => p.stage !== 'perdido' && (dataFechamento(p) || '').startsWith(mes));
  const comissaoMes = fechadosMes.reduce((s, p) => s + comissaoDe(p, cfg), 0);
  const ano = today().slice(0, 4);
  const comissaoAno = pedidos.filter((p) => p.stage !== 'perdido' && (dataFechamento(p) || '').startsWith(ano)).reduce((s, p) => s + comissaoDe(p, cfg), 0);
  const abertos = pedidos.filter((p) => ['enviado', 'arte', 'aprovacao'].includes(p.stage) && p.total != null);
  const possivel = abertos.reduce((s, p) => s + comissaoDe(p, cfg), 0);

  const andamento = pedidos.filter((p) => EM_ANDAMENTO.includes(p.stage));
  const fechados = pedidos.filter((p) => p.stage === 'contrato');
  const perdidos = pedidos.filter((p) => p.stage === 'perdido');
  const q = semAcento(busca.trim());
  const bate = (p) => !q || semAcento(`${p.cliente} ${p.cidade || ''} ${p.ativacao || ''}`).includes(q);

  // taxa de fechamento: dos orçamentos que já tiveram desfecho, quantos fecharam
  const ganhos = fechados.length + pedidos.filter((p) => p.stage === 'fechado').length;
  const taxa = ganhos + perdidos.length ? Math.round((ganhos / (ganhos + perdidos.length)) * 100) : null;

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 p-4 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-100">💰 Sua comissão em {MESES_NOME[Number(mes.slice(5)) - 1]}</div>
            <div className="text-3xl font-bold">{brl(comissaoMes)}</div>
            <div className="text-xs text-sky-100">
              {fechadosMes.length} {fechadosMes.length === 1 ? 'pedido fechado' : 'pedidos fechados'} no mês
              {possivel > 0 && ` · + ${brl(possivel)} se os ${abertos.length} em aberto fecharem`}
            </div>
            <div className="mt-1 text-xs text-sky-100">
              No ano: <b className="text-white">{brl(comissaoAno)}</b>
              {taxa != null && (
                <>
                  {' '}
                  · fecha <b className="text-white">{taxa}%</b> dos orçamentos que tiveram resposta
                </>
              )}
            </div>
          </div>
          {/* ajustes discretos: um botãozinho que abre % da comissão, base e meta */}
          <div className="flex flex-col items-end gap-1.5 text-[11px] text-sky-100">
            <button onClick={() => setAjustes(!ajustes)} className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold hover:bg-white/25">
              ⚙️ {cfg.comissao}% {cfg.base === 'produtos' ? 'dos produtos' : 'do total'}
              {Number(cfg.meta) > 0 ? ` · meta ${brl(Number(cfg.meta))}` : ' · definir meta'}
            </button>
            {ajustes && (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <input
                  inputMode="decimal"
                  aria-label="Porcentagem da comissão"
                  value={cfg.comissao}
                  onChange={(e) => setGralhaCfg({ comissao: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
                  className="w-9 rounded-md bg-white/20 px-1 py-0.5 text-center text-xs font-bold text-white outline-none"
                />
                % sobre
                <select value={cfg.base} onChange={(e) => setGralhaCfg({ base: e.target.value })} className="rounded-md bg-white/20 px-1 py-0.5 text-xs font-semibold text-white outline-none">
                  <option value="total" className="text-slate-800">o total</option>
                  <option value="produtos" className="text-slate-800">só produtos</option>
                </select>
                · meta R$
                <input
                  inputMode="decimal"
                  aria-label="Meta de comissão do mês"
                  placeholder="0"
                  value={cfg.meta || ''}
                  onChange={(e) => setGralhaCfg({ meta: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
                  className="w-16 rounded-md bg-white/20 px-1 py-0.5 text-center text-xs font-bold text-white outline-none placeholder:text-white/60"
                />
              </div>
            )}
          </div>
        </div>
        {Number(cfg.meta) > 0 && (
          <div className="space-y-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, (comissaoMes / Number(cfg.meta)) * 100)}%` }} />
            </div>
            <div className="text-xs text-sky-100">
              {comissaoMes >= Number(cfg.meta) ? '🎉 Meta do mês batida!' : `${Math.round((comissaoMes / Number(cfg.meta)) * 100)}% da meta · faltam ${brl(Number(cfg.meta) - comissaoMes)}`}
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={aba}
          onChange={(v) => {
            setAba(v);
            setEtapa('');
          }}
          options={[
            ['andamento', `Em andamento (${andamento.length})`, 'bg-sky-500 text-white ring-transparent'],
            ['fechados', `✅ Contratos fechados (${fechados.length})`, 'bg-emerald-600 text-white ring-transparent'],
            ['perdidos', `Perdidos (${perdidos.length})`, 'bg-slate-500 text-white ring-transparent'],
            ['ativacoes', '🎯 Ativações', 'bg-violet-600 text-white ring-transparent'],
          ]}
        />
        {aba !== 'ativacoes' && <input className={`${inputBase} w-full sm:ml-auto sm:w-56`} placeholder="Buscar cliente, cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />}
      </div>

      {aba === 'andamento' && (
        <>
          {/* funil: quantos em cada etapa; clicar filtra */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAGES.filter((st) => EM_ANDAMENTO.includes(st.id)).map((st) => {
              const n = andamento.filter((p) => p.stage === st.id).length;
              const ativo = etapa === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setEtapa(ativo ? '' : st.id)}
                  className={`rounded-xl px-3 py-2 text-left ring-1 transition ${ativo ? 'bg-sky-500 text-white ring-sky-500' : 'bg-white text-slate-700 ring-slate-200 hover:ring-sky-300'}`}
                >
                  <div className="text-xl font-bold">{n}</div>
                  <div className={`text-xs font-semibold ${ativo ? 'text-sky-100' : 'text-slate-500'}`}>{st.id === 'fechado' ? 'Fechado (falta contrato)' : st.label}</div>
                </button>
              );
            })}
          </div>
          {STAGES.filter((st) => EM_ANDAMENTO.includes(st.id) && (!etapa || etapa === st.id)).map((st) => {
            const list = andamento.filter((p) => p.stage === st.id && bate(p));
            if (!list.length) return null;
            return (
              <section key={st.id} className="space-y-2">
                <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">
                  {st.id === 'fechado' ? 'Fechado (falta contrato)' : st.label} <span className="text-slate-400">{list.length}</span>
                </h2>
                {list.map((p) => (
                  <CartaoPedido key={p.id} p={p} cfg={cfg} parado={parados[p.id]} onContrato={onContrato} onEditar={onEditar} />
                ))}
              </section>
            );
          })}
          {!andamento.some(bate) && <Empty>{q ? 'Nenhum pedido em andamento com essa busca.' : 'Nenhum pedido em andamento.'}</Empty>}
        </>
      )}

      {aba === 'fechados' && (
        <>
          <ComoFui pedidos={pedidos} cfg={cfg} />
          <VendaAntiga />
          <ListaPorMes pedidos={fechados.filter(bate)} cfg={cfg} tipo="fechado" onContrato={onContrato} onEditar={onEditar} />
        </>
      )}
      {aba === 'perdidos' && <ListaPorMes pedidos={perdidos.filter(bate)} cfg={cfg} tipo="perdido" onContrato={onContrato} onEditar={onEditar} />}
      {aba === 'ativacoes' && (resumoAtivacoes(pedidos).length ? <Ativacoes pedidos={pedidos} /> : <Empty>Nenhuma ativação ainda. Preencha o campo de ativação no orçamento.</Empty>)}
    </div>
  );
}

// Cartão de um pedido em andamento: avançar etapa, perdido (com motivo), contrato e editar
function CartaoPedido({ p, cfg, parado, onContrato, onEditar }) {
  const { moveStage, deletePedido, updatePedido } = useStore();
  const [aberto, setAberto] = useState(false);
  const [perdendo, setPerdendo] = useState(false);
  const [follow, setFollow] = useState(false);
  const since = p.history?.at(-1)?.date || p.createdAt;
  const idx = STAGES.findIndex((x) => x.id === p.stage);
  const next = STAGES[idx + 1];
  const perder = (motivo) => {
    updatePedido(p.id, { motivoPerda: motivo });
    moveStage(p.id, 'perdido');
    setPerdendo(false);
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setAberto(!aberto)} className="min-w-0 text-left">
          <div className="font-bold text-slate-800">
            {p.cliente}
            {parado && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">⏳ parado há {parado} dias</span>}
          </div>
          <div className="text-xs text-slate-500">
            {p.total == null && !p.contrato ? 'tabela de preços' : brl(valoresPedido(p).total)}
            {p.stage === 'fechado' && <b className="text-emerald-600"> · comissão {brl(comissaoDe(p, cfg))}</b>} · {p.itens.length} {p.itens.length > 1 ? 'itens' : 'item'}
            {p.cidade && ` · ${p.cidade}`}
            {p.ativacao && (
              <b className="text-violet-600">
                {' '}
                · 🎯 {p.ativacao}
                {valoresPedido(p).desconto > 0 && ` (−${brl(valoresPedido(p).desconto)})`}
              </b>
            )}{' '}
            · nesta etapa desde {since === today() ? 'hoje' : relativo(since)}
          </div>
        </button>
        <span className="shrink-0 text-xs text-slate-400">{fmtCurto(p.createdAt)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {next && next.id !== 'perdido' && (
          <button onClick={() => moveStage(p.id, next.id)} className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white">
            → {next.id === 'contrato' ? 'Contrato enviado (fechado ✅)' : next.label}
          </button>
        )}
        <button onClick={() => onContrato(p.id)} className="rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-white">
          📄 {p.contrato ? 'Continuar contrato' : 'Contrato'}
        </button>
        <button onClick={() => onEditar(p.id)} className="rounded-xl px-3 py-1.5 text-xs font-bold text-sky-600 ring-1 ring-sky-200">
          ✏️ Editar orçamento
        </button>
        {FOLLOW[p.stage] && (
          <button onClick={() => setFollow(!follow)} className="rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            💬 Follow-up
          </button>
        )}
        <button onClick={() => setPerdendo(!perdendo)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
          Perdido
        </button>
      </div>
      {follow && FOLLOW[p.stage] && <TextoCopiar texto={FOLLOW[p.stage](p)} />}
      {perdendo && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2 text-xs">
          <span className="font-semibold text-slate-500">Por que perdeu?</span>
          {MOTIVOS_PERDA.map((m) => (
            <button key={m} onClick={() => perder(m)} className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400">
              {m}
            </button>
          ))}
        </div>
      )}
      {aberto && (
        <div className="mt-3 space-y-2">
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-xs text-slate-700">{p.mensagem}</pre>
          <button onClick={() => confirm(`Excluir o pedido de ${p.cliente}?`) && deletePedido(p.id)} className="text-xs font-semibold text-red-500">
            Excluir pedido
          </button>
        </div>
      )}
    </div>
  );
}

// Fechados e perdidos: uma linha por pedido, agrupados por mês (o mês atual aberto, os outros recolhidos)
function ListaPorMes({ pedidos, cfg, tipo, onContrato, onEditar }) {
  const { moveStage, deletePedido } = useStore();
  const mesAtual = today().slice(0, 7);
  const [abertos, setAbertos] = useState({ [mesAtual]: true });
  const [linha, setLinha] = useState(null);
  if (!pedidos.length) return <Empty>{tipo === 'fechado' ? 'Nenhum contrato fechado ainda.' : 'Nenhum pedido perdido.'}</Empty>;
  const dataDe = (p) => (tipo === 'fechado' ? dataFechamento(p) : [...(p.history || [])].reverse().find((h) => h.stage === 'perdido')?.date) || p.createdAt;
  const porMes = {};
  for (const p of pedidos) (porMes[dataDe(p).slice(0, 7)] ||= []).push(p);
  const meses = Object.keys(porMes).sort().reverse();
  // motivos de perda: o que mais faz perder
  const contagem = {};
  if (tipo === 'perdido') for (const p of pedidos) contagem[p.motivoPerda || 'Sem motivo'] = (contagem[p.motivoPerda || 'Sem motivo'] || 0) + 1;
  const motivos = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      {motivos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {motivos.map(([m, n]) => (
            <span key={m} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              {m}: {n}
            </span>
          ))}
        </div>
      )}
      {meses.map((m) => {
        const lista = porMes[m].sort((a, b) => dataDe(b).localeCompare(dataDe(a)));
        const total = lista.reduce((s, p) => s + (valoresPedido(p).total || 0), 0);
        const com = lista.reduce((s, p) => s + comissaoDe(p, cfg), 0);
        const ab = !!abertos[m];
        return (
          <section key={m} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <button onClick={() => setAbertos((x) => ({ ...x, [m]: !ab }))} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="flex-1 text-sm font-bold capitalize text-slate-800">{nomeMes(m)}</span>
              <span className="text-xs text-slate-500">
                {lista.length} {lista.length === 1 ? 'pedido' : 'pedidos'} · {brl(total)}
                {tipo === 'fechado' && <b className="text-emerald-600"> · comissão {brl(com)}</b>}
              </span>
              <span className="text-xs text-slate-400">{ab ? '▲' : '▼'}</span>
            </button>
            {ab && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {lista.map((p) => (
                  <div key={p.id} className="px-4 py-2">
                    <button onClick={() => setLinha(linha === p.id ? null : p.id)} className="flex w-full items-center gap-3 text-left text-sm">
                      <span className="w-12 shrink-0 text-xs text-slate-400">{fmtCurto(dataDe(p)).replace(/^\w+, /, '')}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                        {p.cliente}
                        {p.cidade && <span className="font-normal text-slate-400"> · {p.cidade}</span>}
                        {tipo === 'perdido' && p.motivoPerda && <span className="font-normal text-slate-400"> · {p.motivoPerda}</span>}
                      </span>
                      {tipo === 'fechado' && <ChipPos p={p} />}
                      <span className="shrink-0 text-xs font-semibold text-slate-600">{p.total == null && !p.contrato ? 'tabela' : brl(valoresPedido(p).total)}</span>
                    </button>
                    {linha === p.id && tipo === 'fechado' && (p.historico ? <DataVendaAntiga p={p} /> : <PosVenda p={p} />)}
                    {linha === p.id && (
                      <div className="mt-2 flex flex-wrap gap-2 pb-1">
                        {tipo === 'fechado' && !p.historico && (
                          <button onClick={() => onContrato(p.id)} className="rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-white">
                            📄 Ver contrato
                          </button>
                        )}
                        {!p.historico && (
                          <button onClick={() => onEditar(p.id)} className="rounded-xl px-3 py-1.5 text-xs font-bold text-sky-600 ring-1 ring-sky-200">
                            ✏️ Ver orçamento
                          </button>
                        )}
                        <button
                          onClick={() => moveStage(p.id, [...(p.history || [])].reverse().find((h) => h.stage !== p.stage)?.stage || 'enviado')}
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-sky-600 ring-1 ring-sky-200"
                        >
                          ↩ Reabrir
                        </button>
                        <button onClick={() => confirm(`Excluir o pedido de ${p.cliente}?`) && deletePedido(p.id)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500">
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Mensagens de follow-up prontas, por etapa (é só copiar e mandar no WhatsApp da Gralha)
const FOLLOW = {
  enviado: (p) => `Oii, tudo bem? 😊 Passando pra saber se vocês conseguiram ver o orçamento da ${p.cliente} que te mandei. Ficou alguma dúvida sobre os produtos, os prazos ou os valores? Se quiserem, consigo ajustar quantidades ou modelos!`,
  arte: (p) => `Oii, tudo bem? Só pra te atualizar: a arte da ${p.cliente} já está com o nosso time de criação. Assim que ficar pronta eu te mando por aqui 💙`,
  aprovacao: (p) => `Oii, tudo bem? Conseguiram dar uma olhada na arte da ${p.cliente}? Se estiver tudo certo, já sigo com o contrato pra garantir o prazo de produção 😊`,
  fechado: (p) => `Oii! Vou te mandar o contrato da ${p.cliente} pra gente garantir o prazo de produção. Me confirma o nome completo e o CPF de quem vai assinar? 😊`,
};

function TextoCopiar({ texto }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-[#e7ffdb] p-3">
      <p className="whitespace-pre-wrap text-sm text-slate-800">{texto}</p>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          } catch {
            prompt('Copie a mensagem:', texto);
          }
        }}
        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white"
      >
        {ok ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

// Depois do contrato: 1ª parcela → produção → entregue → 2ª parcela
const previsaoDe = (p) => p.pos?.previsao || addDays(dataFechamento(p) || p.createdAt, 30);
function ChipPos({ p }) {
  const pos = p.pos || {};
  const [txt, cor] = pos.pago2
    ? ['✔ concluído', 'bg-emerald-50 text-emerald-700']
    : pos.entregue
      ? ['📦 falta a 2ª parcela', 'bg-amber-50 text-amber-800']
      : pos.pago1
        ? [`🏭 entrega até ${fmtCurto(previsaoDe(p)).replace(/^\w+, /, '')}`, 'bg-sky-50 text-sky-700']
        : ['💸 falta a 1ª parcela', 'bg-red-50 text-red-700'];
  return <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline ${cor}`}>{txt}</span>;
}
function PosVenda({ p }) {
  const { setPosVenda } = useStore();
  const pos = p.pos || {};
  const passo = (chave, rotulo) => (
    <button
      onClick={() => setPosVenda(p.id, { [chave]: pos[chave] ? null : today() })}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ${pos[chave] ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400'}`}
    >
      <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] text-white ${pos[chave] ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>{pos[chave] ? '✓' : ''}</span>
      {rotulo}
      {pos[chave] && <span className="font-normal text-emerald-600">{fmtCurto(pos[chave]).replace(/^\w+, /, '')}</span>}
    </button>
  );
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Depois do contrato</div>
      <div className="flex flex-wrap items-center gap-2">
        {passo('pago1', '1ª parcela (50%) recebida')}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          🏭 entrega prevista
          <input type="date" value={previsaoDe(p)} onChange={(e) => e.target.value && setPosVenda(p.id, { previsao: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" />
        </label>
        {passo('entregue', 'Enviado / entregue')}
        {passo('pago2', '2ª parcela (50%) recebida')}
      </div>
      <p className="text-[11px] text-slate-400">Ao marcar "Enviado / entregue", a central cria a tarefa de cobrar os 50% restantes.</p>
    </div>
  );
}

// Como fui: vendas fechadas por mês nos últimos 12 meses (inclui as vendas antigas registradas)
function ComoFui({ pedidos, cfg }) {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const dados = meses.map((m) => {
    const ps = pedidos.filter((p) => p.stage !== 'perdido' && (dataFechamento(p) || '').startsWith(m));
    return { m, n: ps.length, vendido: ps.reduce((s, p) => s + (valoresPedido(p).total || 0), 0), comissao: ps.reduce((s, p) => s + comissaoDe(p, cfg), 0) };
  });
  const max = Math.max(...dados.map((d) => d.vendido), 1);
  const total = dados.reduce((s, d) => s + d.comissao, 0);
  const comVenda = dados.filter((d) => d.n).length;
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">📈 Como fui · últimos 12 meses</h2>
        <span className="text-xs text-slate-500">
          comissão <b className="text-emerald-600">{brl(total)}</b>
          {comVenda > 0 && <> · média de {brl(total / comVenda)} nos meses com venda</>}
        </span>
      </div>
      <div className="flex h-32 items-end gap-1.5">
        {dados.map((d) => (
          <div key={d.m} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${nomeMes(d.m)}: ${d.n} ${d.n === 1 ? 'venda' : 'vendas'} · ${brl(d.vendido)} · comissão ${brl(d.comissao)}`}>
            <span className="text-[10px] font-bold text-slate-500">{d.n || ''}</span>
            <div className={`w-full rounded-t-md ${d.m === today().slice(0, 7) ? 'bg-sky-500' : 'bg-sky-200'}`} style={{ height: `${Math.max(d.vendido ? 4 : 0, (d.vendido / max) * 96)}px` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 text-[10px] text-slate-400">
        {dados.map((d) => (
          <span key={d.m} className="min-w-0 flex-1 text-center">
            {MESES_NOME[Number(d.m.slice(5)) - 1].slice(0, 3)}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-400">Altura da barra = valor vendido no mês; o número em cima = quantas vendas. Passe o mouse para ver a comissão.</p>
    </section>
  );
}

// Registrar vendas fechadas antes da central (só para o histórico e a comissão do mês em que fechou)
// Várias vendas antigas coladas de uma vez. Uma por linha ("Cliente - 4.740,00");
// uma linha só com o nome do mês ("Setembro") vale para as linhas de baixo. Entram no dia 1º do mês.
function lerVendasEmLote(texto, mesPadrao) {
  const ano = mesPadrao.slice(0, 4);
  let mes = mesPadrao;
  let viuMes = false;
  const out = [];
  for (const bruta of texto.split('\n')) {
    const l = bruta.trim();
    if (!l || /^total\b/i.test(semAcento(l))) continue; // linhas de total são só conferência
    const m = semAcento(l).match(/^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b\s*(?:de\s*)?(\d{4})?\s*:?$/);
    if (m) {
      const i = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].indexOf(m[1]);
      mes = `${m[2] || ano}-${String(i + 1).padStart(2, '0')}`;
      // mês escrito DEPOIS das vendas (sem nenhum mês antes): vale também para as linhas de cima
      if (!viuMes) for (const x of out) x.data = `${mes}-01`;
      viuMes = true;
      continue;
    }
    const v = l.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+\.\d{1,2})\s*$/);
    const cliente = v ? l.slice(0, v.index).replace(/[\s\-–—:·|=]+$/, '').trim() : '';
    out.push({ linha: l, cliente, total: v ? valorDigitado(v[1]) : 0, data: `${mes}-01` });
  }
  return out;
}
function VendasEmLote() {
  const { addVendaAntiga } = useStore();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mes, setMes] = useState(today().slice(0, 7));
  const [feito, setFeito] = useState(0);
  const lidas = texto.trim() ? lerVendasEmLote(texto, mes) : [];
  const boas = lidas.filter((x) => x.cliente && x.total > 0);
  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="text-xs font-semibold text-sky-600">
        📋 Colar várias vendas de uma vez
      </button>
    );
  return (
    <div className="space-y-2 rounded-xl bg-sky-50/60 p-3 ring-1 ring-sky-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-sky-700">Colar várias de uma vez</span>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          mês (se o texto não disser)
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" />
        </label>
      </div>
      <textarea
        rows={6}
        className={inputCls}
        placeholder={'Uma venda por linha, com o valor no fim. O nome do mês numa linha vale para as de baixo:\n\nSetembro\nNSA - 4.740,00\nODONTO UEM 2.300\nOutubro\nSHARK - 1.361,68'}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setFeito(0);
        }}
      />
      {lidas.length > 0 && (
        <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg bg-white p-2 text-xs">
          {lidas.map((x, i) => (
            <div key={i} className={`flex gap-2 ${x.cliente && x.total ? 'text-slate-700' : 'text-red-500'}`}>
              <span className="w-16 shrink-0 text-slate-400">{nomeMes(x.data.slice(0, 7)).replace(/ \d{4}$/, '').slice(0, 3)}/{x.data.slice(2, 4)}</span>
              <span className="min-w-0 flex-1 truncate">{x.cliente || x.linha}</span>
              <span className="shrink-0 font-semibold">{x.total ? brl(x.total) : 'sem valor: não entra'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={!boas.length}
          onClick={() => {
            boas.forEach((x) => addVendaAntiga({ cliente: x.cliente, data: x.data, total: x.total, cidade: '' }));
            setFeito(boas.length);
            setTexto('');
          }}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Registrar {boas.length || ''} {boas.length === 1 ? 'venda' : 'vendas'}
        </button>
        {feito > 0 && <span className="text-xs font-semibold text-emerald-600">✓ {feito} {feito === 1 ? 'venda registrada' : 'vendas registradas'}</span>}
        <button onClick={() => setAberto(false)} className="ml-auto text-xs font-semibold text-slate-400">
          fechar
        </button>
      </div>
    </div>
  );
}

// '3.565,00', '3565' ou '3565.5' → número
const valorDigitado = (v) => {
  const t = String(v || '').trim();
  const milhar = t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t); // "3.565" = três mil e quinhentos
  return Number(milhar ? t.replace(/\./g, '').replace(',', '.') : t) || 0;
};
function VendaAntiga() {
  const { state, addVendaAntiga } = useStore();
  // cidades já usadas (orçamentos e vendas), das mais frequentes para as menos
  const cidades = useMemo(() => {
    const cont = {};
    for (const p of state.pedidos || []) {
      const c = (p.cidade || '').trim();
      if (!c) continue;
      const k = c.toLowerCase();
      cont[k] = { nome: cont[k]?.nome || c, n: (cont[k]?.n || 0) + 1 };
    }
    return Object.values(cont).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome)).map((x) => x.nome);
  }, [state.pedidos]);
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ cliente: '', data: '', total: '', cidade: '' });
  const ok = f.cliente.trim() && f.data && valorDigitado(f.total) > 0;
  const salvar = () => {
    if (!ok) return;
    addVendaAntiga({ cliente: f.cliente.trim(), data: f.data, total: valorDigitado(f.total), cidade: f.cidade.trim() });
    setF({ cliente: '', data: f.data, total: '', cidade: '' });
  };
  if (!aberto)
    return (
      <button onClick={() => setAberto(true)} className="text-sm font-semibold text-sky-600">
        + Registrar uma venda dos meses anteriores
      </button>
    );
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sky-200">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-sky-700">Venda dos meses anteriores</h2>
        <button onClick={() => setAberto(false)} className="text-xs font-semibold text-slate-400">fechar</button>
      </div>
      <p className="text-xs text-slate-500">Para ter a base de como você foi. Entra direto em Contratos fechados, já como concluída, no mês em que fechou.</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <input className={`${inputCls} sm:col-span-2`} placeholder="Cliente (ex.: Medicina UEM 2026)" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} />
        <input type="date" className={inputCls} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} aria-label="Data em que fechou" />
        <input inputMode="decimal" className={inputCls} placeholder="Valor total R$" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
        <input className={`${inputCls} sm:col-span-2`} list="cidades-venda-antiga" placeholder="Cidade (opcional)" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} />
        <datalist id="cidades-venda-antiga">
          {cidades.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button disabled={!ok} onClick={salvar} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 sm:col-span-2">
          Registrar venda
        </button>
      </div>
      <VendasEmLote />
      {cidades.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400">Cidades já usadas:</span>
          {cidades.slice(0, 10).map((c) => (
            <button
              key={c}
              onClick={() => setF({ ...f, cidade: c })}
              className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${f.cidade === c ? 'bg-sky-500 text-white ring-sky-500' : 'bg-white text-slate-600 ring-slate-200 hover:ring-sky-300'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// Venda antiga: trocar o mês em que fechou (ex.: entrou no mês errado ao colar)
function DataVendaAntiga({ p }) {
  const { updatePedido } = useStore();
  const data = dataFechamento(p) || p.createdAt;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
      Venda registrada à mão · fechou em
      <input
        type="date"
        value={data}
        onChange={(e) => {
          const d = e.target.value;
          if (d) updatePedido(p.id, { createdAt: d, history: [{ stage: 'contrato', date: d }], pos: { pago1: d, entregue: d, pago2: d } });
        }}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
      />
      <span className="text-slate-400">(mudando a data, ela vai para o mês certo)</span>
    </div>
  );
}
