import { Component, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today, fmtLongo, fmtCurto, relativo } from '../lib/dates';

// Página da Lolis: abre pelo link secreto, sem login. Só mostra o dia dela, com um Copiar em cada mensagem.
// Os "feitos" ficam salvos só no computador dela.
const lerFeitos = (date) => {
  try {
    return JSON.parse(localStorage.getItem(`lolis-feitos-${date}`) || '[]');
  } catch {
    return [];
  }
};

const nomeProprio = (s) => {
  const w = s.trim().split(/\s+/)[0];
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
};

// Se algo der errado ao montar a tela, mostra um aviso em vez de tela branca
class Protecao extends Component {
  state = { erro: null };
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  render() {
    if (this.state.erro)
      return (
        <div className="rounded-xl border border-dashed border-red-200 bg-white px-4 py-4 text-center text-sm text-red-600">
          Não consegui mostrar esta parte. Peça para a Laura abrir a central (ela atualiza a página) e dê F5 aqui.
        </div>
      );
    return this.props.children;
  }
}

export default function LolisPublica({ token }) {
  const [dados, setDados] = useState(undefined);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let vivo = true;
    // só no computador de desenvolvimento: dados de exemplo para testar a tela
    if (import.meta.env.DEV && localStorage.getItem('paginaDemo')) return void setDados(JSON.parse(localStorage.getItem('paginaDemo')));
    const carregar = () =>
      supabase.rpc('pagina_lolis', { p_token: token }).then(({ data, error }) => vivo && setDados(error ? null : data));
    carregar();
    const t = setInterval(carregar, 5 * 60 * 1000); // atualiza sozinha a cada 5 min
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token]);

  if (dados === undefined) return <Tela>Carregando…</Tela>;
  if (!dados) return <Tela>Link inválido ou desatualizado. Peça o link novo para a Laura.</Tela>;

  const hoje = today();
  const dias = (dados.dias || []).filter((d) => d.date >= hoje);
  const dia = dias[Math.min(idx, dias.length - 1)];

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:py-10">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">RANKEN · Página da Lolis</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Oi, Lolis! 👋</h1>
          <p className="text-xs text-slate-400">Atualizado {relativo(dados.geradoEm.slice(0, 10), hoje)} às {new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · a página se atualiza sozinha</p>
        </header>

        {dias.length > 1 && (
          <div className="flex gap-1.5">
            {dias.map((d, i) => (
              <button key={d.date} onClick={() => setIdx(i)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${i === idx ? 'bg-ink text-white ring-ink' : 'bg-white text-slate-600 ring-slate-200'}`}>
                {d.date === hoje ? 'Hoje' : fmtCurto(d.date)}
              </button>
            ))}
          </div>
        )}

        {!dia ? <Caixa>Nada publicado para hoje ainda. A Laura atualiza quando abre a central.</Caixa> : <Protecao key={dia.date}><Dia dia={dia} andamento={dados.andamento || []} token={token} /></Protecao>}
      </div>
    </div>
  );
}

// Rotinas de sorteio viram uma tarefa por sorteio do dia (Tênis Maringá, Tênis Londrina, Beach...), conforme a programação
const ehSorteio = (t) => /sorteio di[aá]rio/i.test(t.titulo);
const chaveSorteio = (p) => `sorteio:${p.grupo}`;
const idGrupo = (p) => `sorteio-${p.grupo.replace(/\W+/g, '-')}`;

function Dia({ dia, andamento, token }) {
  const [aba, setAba] = useState('tarefas');
  const [feitos, setFeitos] = useState(() => lerFeitos(dia.date));
  // o que ela marca vai para a nuvem: a central da Laura vê e dá baixa (a cópia local é só reserva)
  useEffect(() => {
    setFeitos(lerFeitos(dia.date));
    if (import.meta.env.DEV && localStorage.getItem('paginaDemo')) return; // teste com dados de exemplo
    supabase.rpc('lolis_feitos_do_dia', { p_token: token, p_dia: dia.date }).then(({ data, error }) => {
      if (!error && Array.isArray(data)) setFeitos(data.map((x) => (typeof x === 'string' ? x : Object.values(x)[0])));
    });
  }, [dia.date, token]);
  const marcar = (key) =>
    setFeitos((f) => {
      const feito = !f.includes(key);
      const n = feito ? [...f, key] : f.filter((k) => k !== key);
      try {
        localStorage.setItem(`lolis-feitos-${dia.date}`, JSON.stringify(n));
      } catch {
        /* ignora */
      }
      supabase.rpc('lolis_marcar', { p_token: token, p_dia: dia.date, p_chave: key, p_feito: feito }).then(() => {}, () => {});
      return n;
    });

  const lembretes = dia.brindes.filter((b) => b.tipo !== 'acao');
  const temRotinaSorteio = dia.tarefas.some(ehSorteio);
  // um item por sorteio do dia; sem programação no Hub, fica o item geral
  const itensSorteio = dia.posts.length
    ? dia.posts.map((p) => ({ key: chaveSorteio(p), titulo: `🎾 Sorteio diário · ${p.grupo}`, alvo: idGrupo(p) }))
    : temRotinaSorteio || lembretes.length
      ? [{ key: 'sorteio', titulo: '🎾 Sorteio diário', alvo: null }]
      : [];
  const tarefas = dia.tarefas.filter((t) => !ehSorteio(t));
  const pendTarefas = tarefas.filter((t) => !feitos.includes(t.key) && !t.feito).length + dia.atrasadas.filter((t) => !feitos.includes(t.key)).length + itensSorteio.filter((x) => !feitos.includes(x.key)).length;
  const pendSorteio = itensSorteio.filter((x) => !feitos.includes(x.key)).length + lembretes.filter((b) => !feitos.includes(b.key)).length;

  const abrirSorteio = (alvo) => {
    setAba('sorteio');
    if (alvo) setTimeout(() => document.getElementById(alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const ABAS = [['tarefas', '📝 Tarefas', pendTarefas], ...(itensSorteio.length || lembretes.length ? [['sorteio', '🎾 Sorteio diário', pendSorteio]] : [])];

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-slate-500 first-letter:uppercase">{fmtLongo(dia.date)}</h2>

      <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {ABAS.map(([id, nome, n]) => (
          <button key={id} onClick={() => setAba(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${aba === id ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {nome}
            {n > 0 && <span className={`rounded-full px-1.5 text-xs ${aba === id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{n}</span>}
          </button>
        ))}
      </div>

      {aba === 'tarefas' ? (
        <>
          {dia.atrasadas.length > 0 && (
            <Secao titulo="⚠️ Atrasadas (prioridade)">
              {dia.atrasadas.map((t) => (
                <Tarefa key={t.key} t={t} feito={feitos.includes(t.key)} onMarcar={() => marcar(t.key)} />
              ))}
            </Secao>
          )}

          <Secao titulo="Tarefas do dia">
            {itensSorteio.map((x) => (
              <div key={x.key} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${feitos.includes(x.key) ? 'opacity-50' : ''}`}>
                <Marca feito={feitos.includes(x.key)} onClick={() => marcar(x.key)} />
                <span className={`flex-1 text-[15px] ${feitos.includes(x.key) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{x.titulo}</span>
                <button onClick={() => abrirSorteio(x.alvo)} className="shrink-0 rounded-lg bg-ink px-3 py-1 text-xs font-bold text-white">
                  Abrir →
                </button>
              </div>
            ))}
            {tarefas.map((t) => (
              <Tarefa key={t.key} t={t} feito={feitos.includes(t.key) || !!t.feito} onMarcar={() => marcar(t.key)} />
            ))}
            {!tarefas.length && !itensSorteio.length && <Caixa>Nenhuma tarefa.</Caixa>}
          </Secao>

          {andamento.length > 0 && (
            <Secao titulo="🗂️ Em andamento">
              {andamento.map((t) => (
                <div key={t} className="rounded-xl bg-white px-3 py-2.5 text-[15px] text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                  {t}
                </div>
              ))}
            </Secao>
          )}

          <Caixa>No fim do dia, manda pra Laura no WhatsApp o que você fez 💚</Caixa>
        </>
      ) : (
        <>
          {dia.posts.length > 0 ? (
            <Secao titulo="🎾 Sorteios de hoje" dica="Assim que chegar: 1) anúncio no grupo e no Instagram, 2) sorteio no Hub, 3) parabéns no grupo e as mensagens no privado.">
              {dia.posts.map((p) => (
                <Post key={p.grupo} p={p} feito={feitos.includes(chaveSorteio(p))} onMarcar={() => marcar(chaveSorteio(p))} />
              ))}
            </Secao>
          ) : (
            <Caixa>A programação do sorteio deste dia ainda não chegou na central.</Caixa>
          )}

          {lembretes.length > 0 && (
            <Secao titulo="📅 Lembretes de sorteios de dias anteriores" dica="Não são do sorteio de hoje: são para ganhadores de outros dias, no privado. O telefone está no Hub › Sorteio Diário › Ganhadores do dia (clicando no nome).">
              {lembretes.map((b) => (
                <Mensagem key={b.key} b={b} feito={feitos.includes(b.key)} onMarcar={() => marcar(b.key)} />
              ))}
            </Secao>
          )}
        </>
      )}
    </div>
  );
}

// Um sorteio do dia: à esquerda as mensagens do grupo; à direita, no privado, ganhador e apoiador
function Post({ p: post, feito, onMarcar }) {
  // dados publicados por uma versão antiga da central podem não ter patrocinadores/prazo
  const p = { titulo: post.grupo, patrocinadores: [], ...post };
  const [nome, setNome] = useState(p.ganhador || '');
  const primeiro = nome.trim() ? nome.trim().split(/\s+/)[0] : '[nome]';
  const quem = nome.trim() || '[nome do ganhador]';
  const prazo = p.prazo ? `${fmtLongo(p.prazo).split(',')[0]}, ${fmtCurto(p.prazo).slice(5)}` : 'daqui a 7 dias';
  const premios = p.patrocinadores.map((x) => x.premio).join(' + ');
  const voucher = p.patrocinadores.find((x) => x.canva);
  const retirada = p.patrocinadores.map((x) => (x.local ? `${x.nome}: ${x.local}` : '')).filter(Boolean);
  const msgGanhador = [
    `Oi, ${primeiro}! Parabéns, você foi sorteado(a) hoje no sorteio diário da RANKEN (${p.titulo})! 🎉`,
    '',
    `🎁 Seu prêmio: ${premios}`,
    ...(retirada.length ? [`📍 ${retirada.join(' · ')}`] : []),
    `⏱ Você tem 7 dias para solicitar: até ${prazo}.`,
    ...(voucher ? ['', 'Segue o seu voucher 👇'] : []),
    '',
    'Qualquer dúvida é só chamar aqui 💚',
  ].join('\n');

  return (
    <div id={idGrupo(p)} className={`scroll-mt-4 space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <Marca feito={feito} onClick={onMarcar} />
        <div className="flex-1 text-[15px] font-bold text-ink">Sorteio diário · {p.grupo}</div>
        <span className="text-xs text-slate-400">{p.titulo}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">👥 No grupo</div>
          <Texto rotulo="1. Anúncio" texto={p.anuncio} />
          <Texto rotulo="2. Parabéns (depois do sorteio no Hub)" texto={p.parabens} />
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No grupo, apague <b>[marque o ganhador]</b>, digite <b>@</b> e escolha a pessoa na lista, para ela ser marcada de verdade.
          </p>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">💬 No privado · sorteio de HOJE</div>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            placeholder="Ganhador de hoje (nome)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Texto rotulo="Mensagem para o ganhador" texto={msgGanhador} />
          {voucher && <BotaoCanva c={voucher.canva} />}
          {p.patrocinadores.map((x) => (
            <div key={x.nome} className="space-y-1.5">
              {x.regra && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{x.nome}: {x.regra}</p>}
              <Texto
                rotulo={`Mensagem para o apoiador · ${x.nome}${x.regra ? '' : ' (se precisar)'}`}
                texto={`Oi${x.contato?.trim() ? `, ${nomeProprio(x.contato)}` : ''}! Tudo bem? 😊 Passando pra avisar que o(a) ganhador(a) do sorteio diário da RANKEN de hoje (${p.titulo}) foi ${quem}, que vai retirar ${x.premio}. Obrigado pela parceria! 💚🎾`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Texto({ rotulo, texto }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{rotulo}</span>
        <Copiar texto={texto} />
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-[#e7ffdb] p-3 font-sans text-sm text-slate-800">{texto}</pre>
    </div>
  );
}

function Mensagem({ b, feito, onMarcar, semCopiar }) {
  return (
    <div className={`space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <Marca feito={feito} onClick={onMarcar} />
        <div className="min-w-0 flex-1">
          {b.sorteio && (
            <div className={`mb-0.5 text-xs font-bold ${b.tipo === 'lembrete' ? 'text-violet-700' : 'text-emerald-700'}`}>
              {b.tipo === 'lembrete' ? '🎁 Lembrete do prazo (3º dia)' : '✅ Conferir se deu certo (4º dia)'} · sorteio de {fmtCurto(b.sorteio)} · prazo até {fmtCurto(b.prazo)}
            </div>
          )}
          <div className="text-sm font-semibold text-slate-700">{b.linha}</div>
        </div>
        {!semCopiar && <Copiar texto={b.texto} />}
      </div>
      {b.canva && <BotaoCanva c={b.canva} />}
      <p className={`text-sm ${semCopiar ? 'font-medium text-amber-800' : 'whitespace-pre-wrap rounded-xl bg-[#e7ffdb] p-3 text-slate-800'}`}>{b.texto}</p>
    </div>
  );
}

function Tarefa({ t, feito, onMarcar }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${feito ? 'opacity-50' : ''}`}>
      <Marca feito={feito} onClick={onMarcar} />
      <span className={`text-[15px] ${feito ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
        {t.titulo}
        {t.era && <span className="ml-1 text-xs text-red-500">(era {fmtCurto(t.era)})</span>}
      </span>
      {t.canva && <span className="ml-auto shrink-0"><BotaoCanva c={t.canva} /></span>}
    </div>
  );
}

// Abre o modelo do Canva desta tarefa (link colado pela Laura)
function BotaoCanva({ c }) {
  return (
    <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white hover:bg-violet-700">
      🎨 Abrir modelo no Canva
    </a>
  );
}

function Marca({ feito, onClick }) {
  return (
    <button onClick={onClick} aria-label={feito ? 'Desmarcar' : 'Feito'} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[11px] text-white ${feito ? 'border-transparent bg-emerald-500' : 'border-slate-300 bg-white'}`}>
      {feito && '✓'}
    </button>
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
      className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-white ${ok ? 'bg-emerald-600' : 'bg-ink'}`}
    >
      {ok ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

function Secao({ titulo, dica, children }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-700">{titulo}</h3>
      {dica && <p className="px-1 text-xs text-slate-500">{dica}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const Caixa = ({ children }) => <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-4 text-center text-sm text-slate-500">{children}</div>;
const Tela = ({ children }) => <div className="grid min-h-screen place-items-center bg-paper px-6 text-center text-slate-500">{children}</div>;
