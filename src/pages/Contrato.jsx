import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { priceFor } from '../lib/gralha';
import { gerarContrato, totaisContrato, brl, PAGAMENTOS } from '../lib/contrato';
import { gerarContratoPdf } from '../lib/contratoPdf';
import { arquivoParaImagem, imagensDoEvento, salvarImagens, carregarImagens } from '../lib/imagens';
import { today } from '../lib/dates';
import { inputCls, Segmented } from '../components/ui';

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];
const uid = () => Math.random().toString(36).slice(2, 8);

// ---- Cola a resposta do cliente e separa os campos ----
const so = (s) => s.replace(/\D/g, '');
const fmtDoc = (d) =>
  d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : d;
// CPF de verdade (dígitos verificadores): separa CPF de celular, que também tem 11 dígitos
export const cpfValido = (d) => {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
};
const ehDoc = (d) => (d.length === 11 ? cpfValido(d) : d.length === 14);
const fmtTel = (d) => (d.length === 11 ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : d.length === 10 ? d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3') : d);

export function lerResposta(txt) {
  const out = {};
  const linhas = txt
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const resto = [];
  for (let l of linhas) {
    // "Rótulo: valor" (quando o cliente responde em cima do formulário)
    const m = l.match(/^([^:]{3,70}):\s*(.*)$/);
    const rot = m ? m[1].toLowerCase() : '';
    let v = m && m[2] ? m[2] : m ? '' : l;
    if (m && !v) continue;
    if (/pedido|atl[eé]tica|time|empresa/.test(rot)) out.pedido = v;
    else if (/nome/.test(rot)) out.nome = v;
    else if (/cpf|cnpj/.test(rot) || (/^[\d.\-/\s]+$/.test(v) && ehDoc(so(v)))) out.doc = fmtDoc(so(v));
    else if (/pagamento/.test(rot) || /^(pagamento|50|à vista|a vista|pix|boleto)/i.test(v)) out.pagamento = /boleto/i.test(v) ? 'boleto' : /vista/i.test(v) ? 'pixvista' : 'pix5050';
    else if (/telefone|contato|whats/.test(rot) || (/^[\d()\s+\-]+$/.test(v) && [10, 11, 12, 13].includes(so(v).length))) out.telefone = fmtTel(so(v).replace(/^55(?=\d{10,11}$)/, ''));
    else if (/endere|entrega|cep/.test(rot)) resto.push(v);
    else if (!out.nome && /^[A-Za-zÀ-ú]+(\s+[A-Za-zÀ-ú]+){1,}$/.test(v) && !/(rua|av|avenida|residencial|bloco|apto|bairro)/i.test(v)) out.nome = v;
    else resto.push(v);
  }
  if (resto.length) out.endereco = resto.join(', ').replace(/\.\s*,/g, ',').replace(/,\s*,/g, ',');
  if (out.nome) out.nome = out.nome.replace(/\b([a-zà-ú])([a-zà-ú]*)/gi, (w, a, b) => (/^(de|da|do|dos|das|e)$/i.test(w) ? w.toLowerCase() : a.toUpperCase() + b.toLowerCase()));
  return out;
}

const maiorNumero = (s) => Math.max(...(String(s || '').match(/\d+/g) || ['30']).map(Number));

function contratoInicial(p, cat) {
  const itens = (p.itens || []).map((it) => {
    const prod = cat.produtos.find((x) => x.id === it.prodId) || {};
    return {
      key: uid(),
      prodId: it.prodId,
      qtdOrcada: it.qtd,
      titulo: prod.nome || '',
      produto: prod.nome || '',
      tecido: prod.tecido || '',
      cor: 'Conforme layout aprovado',
      personalizacao: prod.personalizacao || '',
      descPers: 'Conforme layout aprovado.',
      preco: it.precoManual ?? priceFor(prod, it.qtd || prod.minimo || 1).atual?.preco ?? 0,
      tamanhos: TAMANHOS.map((tam) => ({ tam, qtd: '' })),
    };
  });
  const prazo = Math.max(30, ...itens.map((i) => maiorNumero(cat.produtos.find((x) => x.id === i.prodId)?.prazo)));
  return {
    pedido: p.cliente || '',
    cliente: { nome: '', doc: '', endereco: '', entrega: '', telefone: '' },
    itens,
    frete: p.frete || 0,
    pagamento: 'pix5050',
    prazoDias: prazo,
    data: today(),
  };
}

export default function Contrato({ pedido, cat, onVoltar }) {
  const { updatePedido, moveStage } = useStore();
  const [c, setC] = useState(() => pedido.contrato || contratoInicial(pedido, cat));
  const [fotos, setFotos] = useState({}); // { itemKey: [{dataUrl,w,h,nome}] }
  const [colado, setColado] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    carregarImagens(pedido.id).then(setFotos);
  }, [pedido.id]);
  // salva o rascunho do contrato no pedido (sem as fotos, que ficam neste aparelho)
  useEffect(() => {
    const t = setTimeout(() => updatePedido(pedido.id, { contrato: c }), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  const set = (patch) => setC((x) => ({ ...x, ...patch }));
  const setCli = (patch) => setC((x) => ({ ...x, cliente: { ...x.cliente, ...patch } }));
  const setItem = (key, patch) => setC((x) => ({ ...x, itens: x.itens.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const t = totaisContrato(c);

  const addFotos = async (key, files) => {
    const novas = await Promise.all(files.map(arquivoParaImagem));
    setFotos((f) => {
      const prox = { ...f, [key]: [...(f[key] || []), ...novas] };
      salvarImagens(pedido.id, prox);
      return prox;
    });
  };
  const tiraFoto = (key, i) =>
    setFotos((f) => {
      const prox = { ...f, [key]: (f[key] || []).filter((_, j) => j !== i) };
      salvarImagens(pedido.id, prox);
      return prox;
    });

  const aplicarColado = () => {
    const r = lerResposta(colado);
    setC((x) => ({
      ...x,
      pedido: r.pedido || x.pedido,
      pagamento: r.pagamento || x.pagamento,
      cliente: { ...x.cliente, ...Object.fromEntries(Object.entries(r).filter(([k]) => ['nome', 'doc', 'endereco', 'telefone'].includes(k))) },
    }));
    setColado('');
  };

  const faltando = [
    !c.cliente.nome && 'nome do cliente',
    !c.cliente.doc && 'CPF/CNPJ',
    !c.cliente.endereco && 'endereço',
    !c.cliente.telefone && 'telefone',
    !c.itens.length && 'pelo menos um produto',
    ...t.itens.filter((i) => !i.qtdTotal).map((i) => `tamanhos de ${i.produto || 'um produto'}`),
  ].filter(Boolean);

  const baixar = async (tipo = 'pdf') => {
    setBusy(true);
    setMsg('');
    try {
      const dados = { ...c, itens: c.itens.map((i) => ({ ...i, imagens: fotos[i.key] || [] })) };
      const blob = tipo === 'pdf' ? await gerarContratoPdf(dados) : await gerarContrato(dados);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `CONTRATO_${(c.pedido || 'GRALHA').toUpperCase().replace(/[^A-Z0-9À-Ú]+/gi, '_')}.${tipo === 'pdf' ? 'pdf' : 'docx'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      updatePedido(pedido.id, { total: t.total });
      setMsg(tipo === 'pdf' ? 'PDF baixado ✓ Confira e mande para o cliente.' : 'Word baixado ✓ Use quando precisar editar algo à mão.');
    } catch (e) {
      setMsg(`Não deu certo: ${e.message}`);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onVoltar} className="text-sm font-semibold text-sky-600">
          ← Pedidos
        </button>
        <span className="text-xs text-slate-400">O rascunho é salvo sozinho. As fotos ficam neste aparelho.</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-ink">📄 Contrato · {c.pedido || pedido.cliente}</h1>

      {/* 1. Cliente */}
      <Bloco n="1" titulo="Cliente">
        <div className="space-y-2 rounded-xl bg-sky-50 p-3 ring-1 ring-sky-100">
          <div className="text-sm font-semibold text-sky-900">Cole aqui a resposta do cliente (o formulário que você manda no WhatsApp)</div>
          <textarea rows={4} className={inputCls} value={colado} onChange={(e) => setColado(e.target.value)} placeholder={'Nome Completo: ...\nCPF: ...\nEndereço: ...\nForma de pagamento: ...\nTelefone: ...'} />
          <button disabled={!colado.trim()} onClick={aplicarColado} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            Preencher os campos
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome do pedido (produção)" valor={c.pedido} onChange={(v) => set({ pedido: v })} />
          <Campo rotulo="Nome completo" valor={c.cliente.nome} onChange={(v) => setCli({ nome: v })} />
          <Campo rotulo="CPF ou CNPJ" valor={c.cliente.doc} onChange={(v) => setCli({ doc: v })} />
          <Campo rotulo="Telefone" valor={c.cliente.telefone} onChange={(v) => setCli({ telefone: v })} />
        </div>
        <Campo rotulo="Endereço" valor={c.cliente.endereco} onChange={(v) => setCli({ endereco: v })} area />
        <Campo rotulo="Endereço de entrega (só se for diferente)" valor={c.cliente.entrega} onChange={(v) => setCli({ entrega: v })} area />
      </Bloco>

      {/* 2. Produtos */}
      <Bloco n="2" titulo="Produtos, tamanhos e fotos">
        {c.itens.map((it, n) => (
          <Item
            key={it.key}
            n={n + 1}
            it={it}
            fotos={fotos[it.key] || []}
            set={(p) => setItem(it.key, p)}
            remover={() => set({ itens: c.itens.filter((x) => x.key !== it.key) })}
            addFotos={(files) => addFotos(it.key, files)}
            tiraFoto={(i) => tiraFoto(it.key, i)}
            prod={cat.produtos.find((x) => x.id === it.prodId)}
          />
        ))}
        <button
          onClick={() =>
            set({
              itens: [
                ...c.itens,
                { key: uid(), titulo: '', produto: '', tecido: '', cor: 'Conforme layout aprovado', personalizacao: '', descPers: 'Conforme layout aprovado.', preco: 0, tamanhos: TAMANHOS.map((tam) => ({ tam, qtd: '' })) },
              ],
            })
          }
          className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-3 text-sm font-semibold text-slate-500 hover:border-sky-300 hover:text-sky-600"
        >
          + Produto
        </button>
      </Bloco>

      {/* 3. Valores */}
      <Bloco n="3" titulo="Valores, pagamento e prazo">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Frete (R$, 0 = grátis)" valor={c.frete} onChange={(v) => set({ frete: v.replace(',', '.') })} />
          <Campo rotulo="Prazo (dias úteis)" valor={c.prazoDias} onChange={(v) => set({ prazoDias: v.replace(/\D/g, '') })} />
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data do contrato</span>
            <input type="date" className={inputCls} value={c.data} onChange={(e) => set({ data: e.target.value })} />
          </label>
        </div>
        <Segmented value={c.pagamento} onChange={(v) => set({ pagamento: v })} options={Object.entries(PAGAMENTOS).map(([k, p]) => [k, p.nome, 'bg-sky-500 text-white ring-transparent'])} />
        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          {t.itens.map((i) => (
            <div key={i.key} className="flex justify-between text-slate-600">
              <span>
                {i.produto || 'Produto'}: {i.qtdTotal} × {brl(Number(i.preco) || 0)}
              </span>
              <span>{brl(i.subtotal)}</span>
            </div>
          ))}
          <div className="flex justify-between text-slate-600">
            <span>Frete</span>
            <span>{t.frete ? brl(t.frete) : 'grátis'}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-ink">
            <span>Total</span>
            <span>{brl(t.total)}</span>
          </div>
          {c.pagamento === 'pix5050' && <div className="text-right text-xs text-slate-500">2 parcelas de {brl(t.total / 2)}</div>}
        </div>
      </Bloco>

      {/* 4. Baixar */}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {faltando.length > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Falta: {faltando.join(', ')}.</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || faltando.length > 0} onClick={() => baixar('pdf')} className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
            {busy ? 'Gerando…' : '⬇ Baixar PDF'}
          </button>
          <button disabled={busy || faltando.length > 0} onClick={() => baixar('docx')} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-300 disabled:opacity-40">
            Word (para editar)
          </button>
          {pedido.stage !== 'contrato' && (
            <button onClick={() => moveStage(pedido.id, 'contrato')} className="rounded-xl px-4 py-3 text-sm font-semibold text-sky-700 ring-1 ring-sky-200">
              Marcar como contrato enviado
            </button>
          )}
        </div>
        {msg && <p className="text-sm font-medium text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}

function Bloco({ n, titulo, children }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="flex items-center gap-2 font-bold text-ink">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-sky-500 text-xs text-white">{n}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({ rotulo, valor, onChange, area }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      {area ? <textarea rows={2} className={inputCls} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} /> : <input className={inputCls} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function Item({ n, it, fotos, set, remover, addFotos, tiraFoto, prod }) {
  const zona = useRef(null);
  const [foco, setFoco] = useState(false);
  const [novoTam, setNovoTam] = useState('');
  const soma = it.tamanhos.reduce((s, t) => s + (Number(t.qtd) || 0), 0);
  const faixa = prod && soma ? priceFor(prod, soma).atual?.preco : null;
  const setTam = (i, qtd) => set({ tamanhos: it.tamanhos.map((t, j) => (j === i ? { ...t, qtd: qtd.replace(/\D/g, '') } : t)) });

  // Ctrl+V com o quadro de fotos selecionado
  useEffect(() => {
    if (!foco) return;
    const onPaste = (e) => {
      const files = imagensDoEvento(e);
      if (files.length) {
        e.preventDefault();
        addFotos(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [foco, addFotos]);

  return (
    <div className="space-y-3 rounded-2xl p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800">
          ITEM {n} — {(it.titulo || it.produto || 'novo produto').toUpperCase()}
        </span>
        <button onClick={remover} className="text-xs font-semibold text-red-500">
          remover
        </button>
      </div>

      {/* Fotos */}
      <div
        ref={zona}
        tabIndex={0}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onClick={() => zona.current?.focus()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFotos(imagensDoEvento(e));
        }}
        className={`rounded-xl border-2 border-dashed p-3 text-center text-sm outline-none transition ${foco ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}
      >
        {fotos.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-center gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={f.dataUrl} alt="" className="h-28 rounded-lg bg-white object-contain ring-1 ring-slate-200" />
                <button onClick={(e) => (e.stopPropagation(), tiraFoto(i))} className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-xs font-bold text-white">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="text-slate-500">
          {foco ? <b className="text-sky-700">Pode dar Ctrl+V agora</b> : <>Clique aqui e dê <b>Ctrl+V</b>, ou arraste a imagem</>}
          {' · '}
          <label className="cursor-pointer font-semibold text-sky-600" onClick={(e) => e.stopPropagation()}>
            escolher arquivo
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => (addFotos(imagensDoEvento(e)), (e.target.value = ''))} />
          </label>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Campo rotulo="Produto" valor={it.produto} onChange={(v) => set({ produto: v, titulo: v })} />
        <Campo rotulo="Tecido" valor={it.tecido} onChange={(v) => set({ tecido: v })} />
        <Campo rotulo="Cor base" valor={it.cor} onChange={(v) => set({ cor: v })} />
        <Campo rotulo="Personalização" valor={it.personalizacao} onChange={(v) => set({ personalizacao: v })} />
      </div>
      <Campo rotulo="Descrição da personalização" valor={it.descPers} onChange={(v) => set({ descPers: v })} />

      {/* Tamanhos */}
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade por tamanho</span>
        <div className="flex flex-wrap items-end gap-2">
          {it.tamanhos.map((t, i) => (
            <label key={t.tam} className="w-14 text-center">
              <span className="block text-xs font-bold text-slate-600">{t.tam}</span>
              <input inputMode="numeric" className={`${inputCls} px-1 text-center`} value={t.qtd} onChange={(e) => setTam(i, e.target.value)} />
            </label>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (novoTam.trim()) set({ tamanhos: [...it.tamanhos, { tam: novoTam.trim().toUpperCase(), qtd: '' }] });
              setNovoTam('');
            }}
            className="w-20"
          >
            <span className="block text-center text-xs text-slate-400">+ tamanho</span>
            <input className={`${inputCls} px-1 text-center`} placeholder="ex.: 10" value={novoTam} onChange={(e) => setNovoTam(e.target.value)} />
          </form>
          <div className="pb-2 text-sm font-bold text-ink">= {soma} un.</div>
        </div>
        {it.qtdOrcada && soma > 0 && soma !== Number(it.qtdOrcada) && (
          <p className="text-xs font-semibold text-amber-700">
            O orçamento foi de {it.qtdOrcada} peças e os tamanhos somam {soma}.
            {faixa && faixa !== Number(it.preco) && (
              <>
                {' '}
                Na tabela, {soma} peças custam {brl(faixa)}.{' '}
                <button onClick={() => set({ preco: faixa })} className="underline">
                  usar {brl(faixa)}
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-40">
          <Campo rotulo="Preço unitário (R$)" valor={it.preco} onChange={(v) => set({ preco: v.replace(',', '.') })} />
        </div>
        <div className="pt-5 text-sm text-slate-600">
          = <b className="text-ink">{brl(soma * (Number(it.preco) || 0))}</b>
        </div>
      </div>
    </div>
  );
}
