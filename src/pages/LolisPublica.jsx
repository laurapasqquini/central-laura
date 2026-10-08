import { Component, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today, fmtLongo, fmtCurto, relativo } from '../lib/dates';
import { gerarVoucher, modeloVoucher } from '../lib/voucher';

// Página da Lolis: abre pelo link secreto, sem login. Só mostra o dia dela, com um Copiar em cada mensagem.
// O que ela marca (feito / não consegui + nota) vai para a central da Laura.

// quem recebe mensagem do ganhador (dados antigos não trazem isso: decide pelo nome)
const avisa = (x) => x.avisar ?? /primor|bonna|olaia/i.test(x.nome);

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
    const t = setInterval(carregar, 60 * 1000); // atualiza sozinha a cada 1 min
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
  // marcas: { chave: { status: 'feito' | 'nao', nota } }. Vão para a nuvem: a central da Laura vê e dá baixa no que foi feito.
  const [marcas, setMarcas] = useState(() => lerMarcas(dia.date));
  const [pedindo, setPedindo] = useState(null); // item que ela acabou de clicar (abre a caixinha)
  useEffect(() => {
    setMarcas(lerMarcas(dia.date));
    if (import.meta.env.DEV && localStorage.getItem('paginaDemo')) return; // teste com dados de exemplo
    supabase.rpc('lolis_marcados_do_dia', { p_token: token, p_dia: dia.date }).then(({ data, error }) => {
      if (!error && Array.isArray(data)) return setMarcas(Object.fromEntries(data.map((x) => [x.chave, { status: x.status || 'feito', nota: x.nota || '' }])));
      // banco ainda sem as notas: usa a lista antiga (só feitos)
      supabase.rpc('lolis_feitos_do_dia', { p_token: token, p_dia: dia.date }).then(({ data: d2, error: e2 }) => {
        if (!e2 && Array.isArray(d2)) setMarcas(Object.fromEntries(d2.map((x) => [typeof x === 'string' ? x : Object.values(x)[0], { status: 'feito', nota: '' }])));
      });
    });
  }, [dia.date, token]);
  const guardar = (n) => {
    try {
      localStorage.setItem(`lolis-marcas-${dia.date}`, JSON.stringify(n));
    } catch {
      /* ignora */
    }
  };
  const feitos = Object.keys(marcas).filter((k) => marcas[k].status === 'feito');
  // clicou na bolinha: se já estava marcado, desmarca; se não, abre a caixinha (feito / não consegui + nota)
  const marcar = (key) => {
    if (marcas[key]) {
      const n = { ...marcas };
      delete n[key];
      setMarcas(n);
      guardar(n);
      supabase.rpc('lolis_marcar', { p_token: token, p_dia: dia.date, p_chave: key, p_feito: false }).then(() => {}, () => {});
      return;
    }
    setPedindo(key);
  };
  const salvarMarca = (status, nota) => {
    const key = pedindo;
    const n = { ...marcas, [key]: { status, nota } };
    setMarcas(n);
    guardar(n);
    setPedindo(null);
    supabase.rpc('lolis_anotar', { p_token: token, p_dia: dia.date, p_chave: key, p_status: status, p_nota: nota || null }).then(({ error }) => {
      // banco ainda sem as notas: pelo menos marca como feito
      if (error && status === 'feito') supabase.rpc('lolis_marcar', { p_token: token, p_dia: dia.date, p_chave: key, p_feito: true }).then(() => {}, () => {});
    });
  };

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

  // nome de cada item, para a caixinha que abre ao marcar
  const titulos = Object.fromEntries([
    ...dia.atrasadas.map((t) => [t.key, t.titulo]),
    ...tarefas.map((t) => [t.key, t.titulo]),
    ...itensSorteio.map((x) => [x.key, x.titulo]),
    ...dia.posts.map((p) => [chaveSorteio(p), `Sorteio diário · ${p.grupo}`]),
    ...lembretes.map((b) => [b.key, `${b.tipo === 'lembrete' ? 'Lembrete do prazo' : 'Conferir se deu certo'} · ${b.linha}`]),
  ]);

  const ABAS = [['tarefas', '📝 Tarefas', pendTarefas], ...(itensSorteio.length || lembretes.length ? [['sorteio', '🎾 Sorteio diário', pendSorteio]] : [])];

  return (
    <div className="space-y-5">
      {pedindo && <CaixaMarca titulo={titulos[pedindo] || ''} onSalvar={salvarMarca} onFechar={() => setPedindo(null)} />}
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
                <Tarefa key={t.key} t={t} feito={feitos.includes(t.key)} marca={marcas[t.key]} onMarcar={() => marcar(t.key)} />
              ))}
            </Secao>
          )}

          <Secao titulo="Tarefas do dia">
            {itensSorteio.map((x) => (
              <div key={x.key} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${feitos.includes(x.key) ? 'opacity-50' : ''}`}>
                <Marca feito={feitos.includes(x.key)} marca={marcas[x.key]} onClick={() => marcar(x.key)} />
                <span className={`flex-1 text-[15px] ${feitos.includes(x.key) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {x.titulo}
                  <Nota marca={marcas[x.key]} />
                </span>
                <button onClick={() => abrirSorteio(x.alvo)} className="shrink-0 rounded-lg bg-ink px-3 py-1 text-xs font-bold text-white">
                  Abrir →
                </button>
              </div>
            ))}
            {tarefas.map((t) => (
              <Tarefa key={t.key} t={t} feito={feitos.includes(t.key) || !!t.feito} marca={marcas[t.key]} onMarcar={() => marcar(t.key)} />
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
                <Post key={p.grupo} p={p} data={dia.date} feito={feitos.includes(chaveSorteio(p))} marca={marcas[chaveSorteio(p)]} onMarcar={() => marcar(chaveSorteio(p))} />
              ))}
            </Secao>
          ) : (
            <Caixa>A programação do sorteio deste dia ainda não chegou na central.</Caixa>
          )}

          {lembretes.length > 0 && (
            <Secao titulo="📅 Lembretes de sorteios de dias anteriores" dica="Não são do sorteio de hoje: são para ganhadores de outros dias, no privado. O telefone está no Hub › Sorteio Diário › Ganhadores do dia (clicando no nome).">
              {lembretes.map((b) => (
                <Mensagem key={b.key} b={b} feito={feitos.includes(b.key)} marca={marcas[b.key]} onMarcar={() => marcar(b.key)} />
              ))}
            </Secao>
          )}
        </>
      )}
    </div>
  );
}

// Um sorteio do dia: à esquerda as mensagens do grupo; à direita, no privado, ganhador e apoiador
function Post({ p: post, data, feito, marca, onMarcar }) {
  // dados publicados por uma versão antiga da central podem não ter patrocinadores/prazo
  const p = { titulo: post.grupo, patrocinadores: [], ...post };
  const [nome, setNome] = useState(p.ganhador || '');
  // o ganhador chegou do Hub com a página aberta: preenche sozinho (se ela ainda não digitou)
  useEffect(() => {
    if (p.ganhador) setNome((n) => n || p.ganhador);
  }, [p.ganhador]);
  const primeiro = nome.trim() ? nome.trim().split(/\s+/)[0] : '[nome]';
  const quem = nome.trim() || '[nome do ganhador]';
  const prazo = p.prazo ? `${fmtLongo(p.prazo).split(',')[0]}, ${fmtCurto(p.prazo).slice(5)}` : 'daqui a 7 dias';
  const premios = p.patrocinadores.map((x) => x.premio).join(' + ');
  const voucher = p.patrocinadores.find((x) => x.canva);
  const retirada = p.patrocinadores.map((x) => (x.local ? `${x.nome}: ${x.local}` : '')).filter(Boolean);
  const [aberto, setAberto] = useState(!feito);
  useEffect(() => {
    if (feito) setAberto(false); // marcou como feito: recolhe
  }, [feito]);
  const msgApoiador = (x) =>
    `Oi${x.contato?.trim() ? `, ${nomeProprio(x.contato)}` : ''}! Tudo bem? 😊 Passando pra avisar que o(a) ganhador(a) do sorteio diário da RANKEN de hoje (${p.titulo}) foi ${quem}, que vai retirar ${x.premio}. Obrigado pela parceria! 💚🎾`;
  const msgGanhador = [
    `Oi, ${primeiro}! Parabéns, você foi sorteado(a) hoje no sorteio diário da RANKEN (${p.titulo})! 🎉`,
    '',
    `🎁 Seu prêmio: ${premios}`,
    ...(retirada.length ? [`📍 ${retirada.join(' · ')}`] : []),
    // retirada que depende de combinar com alguém (receber em casa, entrar em contato...): vai o contato do patrocinador
    ...p.patrocinadores
      .filter((x) => x.contato?.trim() && x.telefone && /contato|casa|combin|endere|entrega/i.test(x.local || ''))
      .map((x) => `📞 Para combinar, fale com ${nomeProprio(x.contato)} (${x.nome}) no WhatsApp: ${x.telefone}${linkWhats(x.telefone, '') ? ` · ${linkWhats(x.telefone, '').replace('?text=', '')}` : ''}`),
    `⏱ Você tem 7 dias para solicitar: até ${prazo}.`,
    ...(voucher ? ['', 'Segue o seu voucher 👇'] : []),
    '',
    'Qualquer dúvida é só chamar aqui 💚',
  ].join('\n');

  return (
    <div id={idGrupo(p)} className={`scroll-mt-4 space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <Marca feito={feito} marca={marca} onClick={onMarcar} />
        <button onClick={() => setAberto(!aberto)} className="flex flex-1 items-center gap-2 text-left">
          <span className="flex-1 text-[15px] font-bold text-ink">
            Sorteio diário · {p.grupo}
            <Nota marca={marca} />
          </span>
          <span className="text-xs text-slate-400">{p.titulo}</span>
          <span className="text-xs font-semibold text-slate-500">{aberto ? '▲' : '▼'}</span>
        </button>
      </div>

      {aberto && (
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
          <div className="flex flex-wrap gap-2">
            <BotaoWhats tel={p.telefoneGanhador} texto={msgGanhador} />
            {p.patrocinadores.filter((x) => modeloVoucher(x.nome)).map((x) => (
              <BotaoVoucher key={x.nome} patrocinador={x.nome} nome={nome} data={data} />
            ))}
            {voucher && !modeloVoucher(voucher.nome) && <BotaoCanva c={voucher.canva} />}
          </div>
          {p.patrocinadores.filter((x) => x.regra && !avisa(x)).map((x) => (
            <p key={`r-${x.nome}`} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{x.nome}: {x.regra}</p>
          ))}
          {p.patrocinadores.filter(avisa).map((x) => (
            <div key={x.nome} className="space-y-1.5">
              {x.regra && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{x.nome}: {x.regra}</p>}
              <Texto rotulo={`Mensagem para o apoiador · ${x.nome}`} texto={msgApoiador(x)} />
              <BotaoWhats tel={x.telefone} texto={msgApoiador(x)} />
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

// Abre a conversa no WhatsApp com o texto pronto (o telefone vem do Hub)
const linkWhats = (tel, texto) => {
  let d = (tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (!(d.startsWith('55') && d.length >= 12)) d = '55' + d;
  if (d.length === 12 && /[6-9]/.test(d[4])) d = d.slice(0, 4) + '9' + d.slice(4); // celular antigo sem o 9
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
};
function BotaoWhats({ tel, texto }) {
  const href = linkWhats(tel, texto);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">
      💬 Abrir no WhatsApp
    </a>
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

function Mensagem({ b, feito, marca, onMarcar, semCopiar }) {
  return (
    <div className={`space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <Marca feito={feito} marca={marca} onClick={onMarcar} />
        <div className="min-w-0 flex-1">
          {b.sorteio && (
            <div className={`mb-0.5 text-xs font-bold ${b.tipo === 'lembrete' ? 'text-violet-700' : 'text-emerald-700'}`}>
              {b.tipo === 'lembrete' ? '🎁 Lembrete do prazo (3º dia)' : '✅ Conferir se deu certo (4º dia)'} · sorteio de {fmtCurto(b.sorteio)} · prazo até {fmtCurto(b.prazo)}
            </div>
          )}
          <div className="text-sm font-semibold text-slate-700">{b.linha}</div>
          <Nota marca={marca} />
        </div>
        {!semCopiar && <Copiar texto={b.texto} />}
      </div>
      {(b.canva || b.telefone) && (
        <div className="flex flex-wrap gap-2">
          <BotaoWhats tel={b.telefone} texto={b.texto} />
          {b.canva && <BotaoCanva c={b.canva} />}
        </div>
      )}
      <p className={`text-sm ${semCopiar ? 'font-medium text-amber-800' : 'whitespace-pre-wrap rounded-xl bg-[#e7ffdb] p-3 text-slate-800'}`}>{b.texto}</p>
    </div>
  );
}

function Tarefa({ t, feito, marca, onMarcar }) {
  const [verTexto, setVerTexto] = useState(false);
  return (
    <div className={`flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${feito ? 'opacity-50' : ''}`}>
      <Marca feito={feito} marca={marca} onClick={onMarcar} />
      <span className="min-w-0 flex-1">
        <span className={`text-[15px] ${feito ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {t.titulo}
          {t.era && <span className="ml-1 text-xs text-red-500">(era {fmtCurto(t.era)})</span>}
        </span>
        <Nota marca={marca} />
        {/* o que está escrito na tarefa (ex.: o recado completo que veio do Hub) */}
        {t.detalhe && (
          <>
            <button onClick={() => setVerTexto(!verTexto)} className="mt-1 block text-xs font-semibold text-indigo-600">
              {verTexto ? '▲ esconder detalhes' : '▼ ver detalhes'}
            </button>
            {verTexto && <span className="mt-1.5 block whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">{t.detalhe}</span>}
          </>
        )}
      </span>
      {t.canva && <span className="shrink-0"><BotaoCanva c={t.canva} /></span>}
    </div>
  );
}

// Voucher pronto em PDF (Burgo, Jacaré): modelo do Canva + nome do ganhador + data do sorteio
function BotaoVoucher({ patrocinador, nome, data }) {
  const [gerando, setGerando] = useState(false);
  const semNome = !nome.trim();
  return (
    <button
      disabled={semNome || gerando}
      title={semNome ? 'Preencha o nome do ganhador' : ''}
      onClick={async () => {
        setGerando(true);
        try {
          await gerarVoucher(patrocinador, nome, data);
        } finally {
          setGerando(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
    >
      {gerando ? 'Gerando…' : `📄 Baixar voucher ${modeloVoucher(patrocinador).nome} (PDF)`}
    </button>
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

function Marca({ feito, marca, onClick }) {
  const nao = marca?.status === 'nao';
  return (
    <button
      onClick={onClick}
      aria-label={feito || nao ? 'Desmarcar' : 'Marcar'}
      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[11px] text-white ${feito ? 'border-transparent bg-emerald-500' : nao ? 'border-transparent bg-red-500' : 'border-slate-300 bg-white'}`}
    >
      {feito ? '✓' : nao ? '✕' : ''}
    </button>
  );
}

// O que ela escreveu ao marcar (ou o motivo de não ter conseguido)
function Nota({ marca }) {
  if (!marca || (!marca.nota && marca.status !== 'nao')) return null;
  return (
    <span className={`mt-0.5 block text-xs no-underline ${marca.status === 'nao' ? 'text-red-600' : 'text-slate-500'}`} style={{ textDecoration: 'none' }}>
      {marca.status === 'nao' ? '✕ Não consegui' : '📝'}
      {marca.nota ? `${marca.status === 'nao' ? ': ' : ' '}${marca.nota}` : ''}
    </span>
  );
}

// Caixinha que abre ao marcar: feito ou não consegui, com uma nota opcional
function CaixaMarca({ titulo, onSalvar, onFechar }) {
  const [nota, setNota] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onFechar}>
      <div className="w-full max-w-lg space-y-3 rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Marcar</div>
        <div className="text-[15px] font-semibold text-ink">{titulo}</div>
        <textarea
          autoFocus
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          placeholder="Como foi? O que você fez? (opcional) · Se não conseguiu, conta o que aconteceu"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={() => onSalvar('feito', nota.trim())} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white">
            ✓ Feito
          </button>
          <button onClick={() => onSalvar('nao', nota.trim())} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white">
            ✕ Não consegui
          </button>
        </div>
        <button onClick={onFechar} className="w-full text-center text-xs font-semibold text-slate-400">
          cancelar
        </button>
      </div>
    </div>
  );
}

const lerMarcas = (date) => {
  try {
    const m = JSON.parse(localStorage.getItem(`lolis-marcas-${date}`) || 'null');
    if (m) return m;
    // formato antigo: só a lista do que foi feito
    return Object.fromEntries(JSON.parse(localStorage.getItem(`lolis-feitos-${date}`) || '[]').map((k) => [k, { status: 'feito', nota: '' }]));
  } catch {
    return {};
  }
};

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
