// Gralha › Pedidos: "Pra fazer agora" e o ritmo da meta. Gralha › Clientes: a ficha de cada cliente.
import { useState } from 'react';
import { useStore, STAGES } from '../lib/store';
import { agruparClientes, brl, cfgComissao, comissaoDe, dataFechamento, valoresPedido, mensagemParcela2, pagaEmDuas } from '../lib/gralha';
import { addDays, fmtCurto, lastDayOfMonth, today } from '../lib/dates';
import { dataEfetiva, isWorkday } from '../lib/engine';
import { Empty, inputBase, CopiarNumero } from '../components/ui';

const semAcento = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// link do WhatsApp a partir do telefone do contrato ("(44) 99999-9999" → wa.me/5544999999999), já com o texto se tiver
const linkWhats = (tel, texto) => {
  const d = String(tel || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length >= 10 ? `https://wa.me/55${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}` : null;
};

function BotaoCopiar({ texto, rotulo = 'Copiar mensagem', grande }) {
  const [ok, setOk] = useState(false);
  return (
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
      className={grande ? 'w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700' : 'shrink-0 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white'}
    >
      {ok ? '✓ Copiado' : rotulo}
    </button>
  );
}

// "Falta a 2ª parcela": todo contrato PIX 50/50 com a 2ª em aberto, com a mensagem pronta.
// Não depende de marcar a 1ª: a produção só começa depois da entrada.
export function SegundaParcela({ pedidos }) {
  const [aberto, setAberto] = useState(null);
  const lista = pedidos
    .filter((p) => p.stage === 'contrato' && !p.historico && !p.pos?.pago2 && pagaEmDuas(p))
    .map((p) => ({ p, previsao: p.pos?.previsao || addDays(dataFechamento(p) || p.createdAt, 30) }))
    .sort((a, b) => a.previsao.localeCompare(b.previsao));
  if (!lista.length) return null;
  const total = lista.reduce((s, { p }) => s + (valoresPedido(p).total || 0) - Math.round(((valoresPedido(p).total || 0) / 2) * 100) / 100, 0);
  return (
    <section className="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-amber-200">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
          💸 Falta a 2ª parcela <span className="text-amber-500">{lista.length}</span>
        </h2>
        <span className="text-xs font-semibold text-amber-700">{brl(total)} a receber</span>
      </div>
      {lista.map(({ p, previsao }) => (
        <CartaoParcela2 key={p.id} p={p} previsao={previsao} aberto={aberto === p.id} onAbrir={() => setAberto(aberto === p.id ? null : p.id)} />
      ))}
    </section>
  );
}

// Um pedido do quadro: tocar abre a mensagem (como as cobranças Pix do RANKEN), com copiar mensagem e número
function CartaoParcela2({ p, previsao, aberto, onAbrir }) {
  const { setPosVenda } = useStore();
  const v = valoresPedido(p).total || 0;
  const valor2 = Math.round((v - Math.round((v / 2) * 100) / 100) * 100) / 100;
  const msg = mensagemParcela2(p);
  const tel = p.contrato?.cliente?.telefone;
  const whats = linkWhats(tel, msg);
  return (
    <div>
      <button onClick={onAbrir} className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:ring-amber-300">
        <span className="h-6 w-1 shrink-0 rounded-full bg-sky-500" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-slate-800">{p.cliente}</span>
          <span className="block text-xs text-slate-500">
            <b className="text-slate-700">{brl(valor2)}</b>
            {p.pos?.entregue ? ' · já enviado' : ` · entrega prevista ${fmtCurto(previsao).replace(/^[^,]+, /, '')}`}
            {p.contrato?.cliente?.nome && ` · ${p.contrato.cliente.nome.split(/\s+/)[0]}`}
          </span>
        </span>
        <span className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{aberto ? 'fechar' : 'Mensagem'}</span>
      </button>
      {aberto && (
        <div className="mx-1 -mt-1 space-y-2 rounded-b-xl bg-[#e7ffdb] p-3 ring-1 ring-emerald-100">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{msg}</pre>
          <BotaoCopiar texto={msg} grande />
          {tel ? <CopiarNumero tel={tel} /> : <p className="text-center text-xs text-slate-500">Sem telefone no contrato.</p>}
          <div className="flex gap-2">
            {whats && (
              <a href={whats} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-white py-2 text-center text-sm font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50">
                Abrir no WhatsApp
              </a>
            )}
            <button
              onClick={() => setPosVenda(p.id, { ...(p.pos?.pago1 ? {} : { pago1: dataFechamento(p) || today() }), pago2: today() })}
              className="flex-1 rounded-lg bg-white py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-300 hover:ring-emerald-400"
            >
              ✓ 2ª parcela recebida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Dias úteis que ainda sobram no mês (contando hoje): o ritmo da meta
export function uteisRestantes(state) {
  const fim = `${today().slice(0, 7)}-${String(lastDayOfMonth(today())).padStart(2, '0')}`;
  let n = 0;
  for (let d = today(); d <= fim; d = addDays(d, 1)) if (isWorkday(state, d)) n++;
  return n;
}

// Grupo (cliente) de um pedido, para abrir a ficha a partir dele
export const grupoDoPedido = (pedidos, id) => agruparClientes(pedidos).find((g) => g.pedidos.some((p) => p.id === id))?.id || '';

// "Pra fazer agora": as tarefas da Gralha de hoje e atrasadas, com o pedido e o WhatsApp do cliente
const pedidoDaTarefa = (t) => t.pedidoId || t.pedidoPos || t.pedidoEnvio || t.pedidoRecorrente;
export function PraFazer({ pedidos, onCliente }) {
  const { state, toggleTask } = useStore();
  const hoje = today();
  const abertas = state.tasks
    .filter((t) => t.area === 'gralha' && !t.done && t.due)
    .map((t) => ({ t, data: dataEfetiva(state, t) }))
    .sort((a, b) => a.data.localeCompare(b.data) || Number(!!b.t.urgent) - Number(!!a.t.urgent));
  const agora = abertas.filter((x) => x.data <= hoje);
  const proxima = abertas.find((x) => x.data > hoje);
  return (
    <section className="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="shrink-0 text-sm font-bold uppercase tracking-wide text-slate-700">
          ⚡ Pra fazer agora {agora.length > 0 && <span className="text-slate-400">{agora.length}</span>}
        </h2>
        {proxima && (
          <span className="truncate text-xs text-slate-400">
            depois: {proxima.t.title} · {fmtCurto(proxima.data)}
          </span>
        )}
      </div>
      {!agora.length && <p className="text-sm text-slate-400">Nada pendente na Gralha hoje. 🎉</p>}
      {agora.map(({ t, data }) => {
        const ped = pedidos.find((p) => p.id === pedidoDaTarefa(t));
        const cobranca = ped && /50% restantes|2ª parcela/i.test(t.title) ? mensagemParcela2(ped) : null;
        const whats = linkWhats(ped?.contrato?.cliente?.telefone, cobranca);
        const atrasada = data < hoje;
        return (
          <div key={t.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ${atrasada || t.urgent ? 'ring-red-200' : 'ring-slate-200'}`}>
            <button onClick={() => toggleTask(t.id)} aria-label="Marcar como feita" title="Marcar como feita" className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 hover:border-emerald-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{t.title}</div>
              <div className={`text-xs ${atrasada ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{atrasada ? `atrasada desde ${fmtCurto(data)}` : 'hoje'}</div>
            </div>
            {cobranca && <BotaoCopiar texto={cobranca} />}
            {whats && (
              <a href={whats} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                WhatsApp
              </a>
            )}
            {ped && (
              <button onClick={() => onCliente(ped.id)} className="shrink-0 text-xs font-semibold text-sky-600">
                ficha
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

// Aba Clientes: um cartão por cliente (turma, atlética), com o histórico de pedidos.
// A central sugere quem é o mesmo cliente; ela confirma ou separa.
export function Clientes({ aberto, onAbrir, onDuplicar }) {
  const { state, updatePedido } = useStore();
  const [busca, setBusca] = useState('');
  const cfg = cfgComissao(state);
  const grupos = agruparClientes(state.pedidos || []);
  const g = aberto && grupos.find((x) => x.id === aberto);
  const confirmar = (gr) => gr.pedidos.forEach((p) => p.clienteId !== gr.id && updatePedido(p.id, { clienteId: gr.id }));
  const separar = (p) => updatePedido(p.id, { clienteId: `p:${p.id}` });

  if (g) {
    const recompra = state.tasks.find((t) => !t.done && g.pedidos.some((p) => p.id === t.pedidoRecorrente));
    const produtos = {};
    for (const p of g.fechados)
      for (const it of p.contrato?.itens || []) {
        const nome = it.produto || it.titulo;
        produtos[nome] = (produtos[nome] || 0) + it.tamanhos.reduce((s, t) => s + (Number(t.qtd) || 0), 0);
      }
    const whats = linkWhats(g.telefone);
    const comItens = g.pedidos.find((p) => p.itens?.length);
    return (
      <div className="space-y-4">
        <button onClick={() => onAbrir(null)} className="text-sm font-semibold text-sky-600">
          ← Clientes
        </button>
        <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">{g.nome}</h2>
            <p className="text-sm text-slate-500">{[g.cidade, g.telefone].filter(Boolean).join(' · ') || 'sem telefone ainda (vem do contrato)'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Pedidos', g.pedidos.length],
              ['Fechados', g.fechados.length],
              ['Já comprou', brl(g.comprado)],
              ['Sua comissão', brl(g.fechados.reduce((s, p) => s + comissaoDe(p, cfg), 0))],
            ].map(([r, v]) => (
              <div key={r} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">{r}</div>
                <div className="text-lg font-bold text-slate-800">{v}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            {g.ultimaCompra ? (
              <>
                Última compra em <b>{fmtCurto(g.ultimaCompra)}</b>.{' '}
              </>
            ) : (
              'Ainda não fechou nenhum pedido. '
            )}
            {recompra && (
              <>
                Oferecer de novo: <b>{fmtCurto(recompra.due)}</b>.
              </>
            )}
          </p>
          {Object.keys(produtos).length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(produtos).map(([nome, n]) => (
                <span key={nome} className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                  {nome} · {n} un.
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {whats && (
              <a href={whats} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                Abrir no WhatsApp
              </a>
            )}
            {comItens && (
              <button onClick={() => onDuplicar(comItens.id)} className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white">
                ⧉ Novo orçamento a partir do último
              </button>
            )}
          </div>
        </section>
        {g.sugestao && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            A central juntou estes pedidos pelo nome ou pelo telefone. É o mesmo cliente?
            <button onClick={() => confirmar(g)} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white">
              Sim, é
            </button>
            <span className="text-xs">Se algum não for, toque em "separar".</span>
          </div>
        )}
        <section className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          {g.pedidos.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="w-12 shrink-0 text-xs text-slate-400">{fmtCurto(dataFechamento(p) || p.createdAt).replace(/^[^,]+, /, '')}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{p.cliente}</span>
              <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 sm:inline">{STAGES.find((s) => s.id === p.stage)?.label}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-600">{p.total == null && !p.contrato ? 'tabela' : brl(valoresPedido(p).total)}</span>
              {g.pedidos.length > 1 && (
                <button onClick={() => separar(p)} className="shrink-0 text-xs text-slate-400 hover:text-red-500" title="Não é o mesmo cliente">
                  separar
                </button>
              )}
            </div>
          ))}
        </section>
      </div>
    );
  }

  const q = semAcento(busca.trim());
  const lista = grupos
    .filter((x) => !q || semAcento(`${x.nome} ${x.cidade} ${x.pedidos.map((p) => p.cliente).join(' ')}`).includes(q))
    .sort((a, b) => Number(b.sugestao) - Number(a.sugestao) || b.comprado - a.comprado);
  const sugestoes = grupos.filter((x) => x.sugestao).length;
  if (!grupos.length) return <Empty>Nenhum cliente ainda. Eles aparecem aqui conforme você faz orçamentos.</Empty>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-500">
          {grupos.length} clientes
          {sugestoes > 0 && <b className="text-amber-700"> · {sugestoes} para confirmar</b>}
        </p>
        <input className={`${inputBase} w-full sm:ml-auto sm:w-56`} placeholder="Buscar cliente, cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!lista.length && <Empty>Nenhum cliente com essa busca.</Empty>}
      <section className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        {lista.map((x) => (
          <button key={x.id} onClick={() => onAbrir(x.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-800">
                {x.nome}
                {x.sugestao && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">confirmar</span>}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {x.pedidos.length} {x.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                {x.cidade && ` · ${x.cidade}`}
                {x.ultimaCompra && ` · última compra ${fmtCurto(x.ultimaCompra).replace(/^[^,]+, /, '')}`}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-emerald-600">{x.comprado > 0 ? brl(x.comprado) : ''}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
