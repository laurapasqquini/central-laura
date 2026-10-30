import { Component, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today, fmtLongo, fmtCurto, relativo } from '../lib/dates';
import { gerarVoucher, modeloVoucher } from '../lib/voucher';
import { gerarArte6x0, MODELOS_6X0 } from '../lib/arte6x0';
import { pontoHoje, baterPonto, resumoDia, hora, duracao, JORNADA_MAX } from '../lib/ponto';
import { quemFala } from '../lib/engine';
import { EtapasRodadas } from './Etapas';
import { EntregasLolis } from '../components/Entregas';

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

// embutida = dentro da central da Laura (aba Lolis): a mesma página, sem a moldura de tela cheia
export default function LolisPublica({ token, embutida }) {
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

  if (dados === undefined) return embutida ? <Caixa>Carregando a página da Lolis…</Caixa> : <Tela>Carregando…</Tela>;
  if (!dados) return embutida ? <Caixa>Não consegui abrir a página dela. Tente "trocar link" em Delegado, link e frases.</Caixa> : <Tela>Link inválido ou desatualizado. Peça o link novo para a Laura.</Tela>;

  const hoje = today();
  const dias = (dados.dias || []).filter((d) => d.date >= hoje);
  const dia = dias[Math.min(idx, dias.length - 1)];

  return (
    <div className={embutida ? '' : 'min-h-screen bg-paper'}>
      <div className={embutida ? 'space-y-5 p-2 sm:p-3' : 'mx-auto max-w-3xl space-y-5 px-4 py-6 sm:py-10'}>
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">RANKEN · Página da Lolis{embutida && ' · exatamente o que ela vê agora'}</p>
          {!embutida && <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Oi, Lolis! 👋</h1>}
          <p className="text-xs text-slate-400">Atualizado {relativo(dados.geradoEm.slice(0, 10), hoje)} às {new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · a página se atualiza sozinha</p>
        </header>

        <Protecao>
          <CartaoPonto token={token} embutida={embutida} />
        </Protecao>

        {(dados.avisos || []).length > 0 && (
          <section className="space-y-1.5 rounded-lg bg-red-50 px-4 py-3 ring-2 ring-red-200">
            <div className="text-xs font-bold uppercase tracking-wide text-red-700">📌 Sempre lembrar</div>
            {dados.avisos.map((a) => (
              <p key={a} className="text-[15px] font-bold text-red-900">
                {a}
              </p>
            ))}
          </section>
        )}

        {dias.length > 1 && (
          <div className="flex gap-1.5">
            {dias.map((d, i) => (
              <button key={d.date} onClick={() => setIdx(i)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${i === idx ? 'bg-ink text-white ring-ink' : 'bg-white text-slate-600 ring-slate-200'}`}>
                {d.date === hoje ? 'Hoje' : fmtCurto(d.date)}
              </button>
            ))}
          </div>
        )}

        {!dia ? <Caixa>Nada publicado para hoje ainda. A Laura atualiza quando abre a central.</Caixa> : <Protecao key={dia.date}><Dia dia={dia} andamento={dados.andamento || []} banco={dia.date === hoje ? dados.banco || [] : []} adiantar={dia.date === hoje ? dados.adiantar || [] : []} expansao={dia.date === hoje ? dados.expansao || null : null} token={token} /></Protecao>}
      </div>
    </div>
  );
}

// Ponto: "Cheguei" e "Saí". Chega às 13h30 ou 14h e fica no máximo 4 horas.
// Na central da Laura (embutida) só mostra, sem os botões.
function CartaoPonto({ token, embutida }) {
  const [reg, setReg] = useState(undefined);
  const [agora, setAgora] = useState(() => new Date());
  const [batendo, setBatendo] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ler = () => pontoHoje(token).then((r) => vivo && setReg(r));
    ler();
    const t = setInterval(() => {
      setAgora(new Date());
      ler();
    }, 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token]);
  const dow = agora.getDay();
  if (reg === undefined || reg === null || dow === 0 || dow === 6) return null; // banco sem o ponto, ou fim de semana
  const hoje = today();
  const r = resumoDia(reg, hoje, hoje, true, agora);
  const bater = async (tipo) => {
    if (tipo === 'saida' && reg.saida && !confirm('Você já marcou a saída. Marcar de novo com o horário de agora?')) return;
    if (tipo === 'saida' && !reg.saida && r.minutos < JORNADA_MAX - 30 && !confirm(`Marcar a saída agora? Hoje deu ${duracao(r.minutos)}.`)) return;
    setBatendo(true);
    const ok = await baterPonto(token, tipo);
    setBatendo(false);
    if (!ok) return alert('Não consegui marcar. Confira a internet e tente de novo.');
    setAgora(new Date());
    setReg(await pontoHoje(token));
  };
  const deu4h = r.status === 'trabalhando' && r.minutos >= JORNADA_MAX;
  const falta = r.status === 'trabalhando' ? Math.max(0, JORNADA_MAX - r.minutos) : 0;

  return (
    <section className={`space-y-2 rounded-lg p-4 shadow-sm ring-1 ${deu4h ? 'bg-amber-50 ring-amber-300' : 'bg-white ring-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl">⏰</span>
        <div className="min-w-0 flex-1">
          {!reg.entrada ? (
            <>
              <div className="text-[15px] font-bold text-ink">{embutida ? 'A Lolis ainda não marcou a chegada hoje' : 'Chegou? Marque aqui 👇'}</div>
              <div className="text-xs text-slate-500">Horário de chegada: 13h30 ou 14h · no máximo 4 horas por dia</div>
            </>
          ) : r.status === 'saiu' ? (
            <>
              <div className="text-[15px] font-bold text-emerald-700">
                Hoje: {hora(r.entrada)} → {hora(r.saida)} · {duracao(r.minutos)} {embutida ? '' : '· até amanhã! 💚'}
              </div>
              {r.passou > 0 && <div className="text-xs font-semibold text-red-600">Passou {duracao(r.passou)} das 4 horas</div>}
            </>
          ) : (
            <>
              <div className="text-[15px] font-bold text-ink">
                Chegou às {hora(r.entrada)} · {deu4h ? 'já deu 4 horas: pode encerrar e marcar a saída 💚' : `horário até ${hora(r.limite)}`}
              </div>
              <div className="text-xs text-slate-500">
                {duracao(r.minutos)} trabalhadas{falta > 0 && ` · faltam ${duracao(falta)}`}
                {r.atraso > 0 && <span className="text-amber-700"> · chegou {r.atraso} min depois das 14h</span>}
              </div>
            </>
          )}
        </div>
        {!embutida && !reg.entrada && (
          <button disabled={batendo} onClick={() => bater('entrada')} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            Cheguei 👋
          </button>
        )}
        {!embutida && reg.entrada && (
          <button
            disabled={batendo}
            onClick={() => bater('saida')}
            className={r.status === 'saiu' ? 'text-xs font-semibold text-slate-400' : 'rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50'}
          >
            {r.status === 'saiu' ? 'marcar a saída de novo' : 'Saí 👋'}
          </button>
        )}
      </div>
    </section>
  );
}

// Rotinas de sorteio viram uma tarefa por sorteio do dia (Tênis Maringá, Tênis Londrina, Beach...), conforme a programação
// Expansão (cidades novas): todas as tarefas na ordem do prazo; cada uma abre o "como fazer"
// (meta do dia e onde anotar no Hub) e tem a própria bolinha
const itensExpansao = (e) => (e ? e.itens || (e.atual ? [e.atual, ...(e.depois || [])] : []) : []); // formato antigo: atual + depois

// ── "Acabou? Puxa daqui": o cardápio do que ela pode fazer quando termina o dia. Ela escolhe o que puxa pra hoje;
// o que foi puxado aparece em Tarefas (fica guardado no navegador dela, por dia).
const EXP = /^\[Expansão (Beach Tennis|Tênis|Padel) ([^\]]+)\]\s*/;
const TAREFA_CURTA = [
  [/telefone do respons/i, 'Telefones dos responsáveis'],
  [/professores/i, 'Professores'],
  [/apoiadores/i, 'Apoiadores e local dos kits'],
];
const curtoExpansao = (titulo) => {
  const resto = titulo.replace(EXP, '');
  return TAREFA_CURTA.find(([re]) => re.test(resto))?.[1] || (resto.length > 48 ? `${resto.slice(0, 46)}…` : resto);
};
const iconeEsporte = (e = '') => (/beach/i.test(e) ? '🏖️' : /padel/i.test(e) ? '🥎' : '🎾');
// linha curta de números: "faltam 39 de 43 · 4/dia · até 13/11"
const resumoExpansao = (a) =>
  [a.vencida ? 'prazo passou' : null, a.faltam != null ? (a.total ? `faltam ${a.faltam} de ${a.total}` : `faltam ${a.faltam}`) : null, a.porDia && a.porDia < a.faltam ? `${a.porDia}/dia` : null, `até ${fmtCurto(a.ate).slice(5)}`].filter(Boolean).join(' · ');
// cidades novas agrupadas por cidade (Tênis e Beach juntos), na ordem do prazo mais próximo
const porCidade = (itens) => {
  const m = new Map();
  for (const a of itens) {
    const [, esporte, cidade] = a.titulo.match(EXP) || [null, a.esporte || '', a.cidade || 'Outras'];
    if (!m.has(cidade)) m.set(cidade, []);
    m.get(cidade).push({ ...a, esporte: a.esporte || esporte });
  }
  return [...m].map(([cidade, its]) => ({ cidade, itens: its.sort((x, y) => x.ate.localeCompare(y.ate)), ate: its.reduce((min, x) => (x.ate < min ? x.ate : min), '9999') })).sort((x, y) => x.ate.localeCompare(y.ate));
};

function Puxar({ onClick }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
      Puxar pra hoje
    </button>
  );
}

function ComoFazer({ texto }) {
  const [ab, setAb] = useState(false);
  if (!texto) return null;
  return (
    <>
      <button onClick={() => setAb(!ab)} className="text-xs text-slate-400 hover:text-slate-600">
        {ab ? '▲ fechar' : '▼ como fazer'}
      </button>
      {ab && <p className="mt-1 rounded-md bg-slate-50 p-2 text-sm text-slate-700">{texto}</p>}
    </>
  );
}

function Cardapio({ expansao, banco, adiantar, puxados, feitos, puxar }) {
  const livre = (t) => !puxados.includes(t.key) && (!feitos.includes(t.key) || t.continua);
  const cidades = porCidade(expansao.filter(livre));
  const outras = banco.filter(livre);
  const comPrazo = adiantar.filter(livre);
  if (!cidades.length && !outras.length && !comPrazo.length) return <Caixa>Nada no cardápio agora. Bom trabalho! 🎉</Caixa>;
  return (
    <div className="space-y-5">
      <p className="px-1 text-xs text-slate-500">Escolha o que vai fazer hoje: o que você puxa vai para a aba Tarefas.</p>
      {cidades.length > 0 && (
        <Secao titulo="Cidades novas">
          {cidades.map((c) => (
            <div key={c.cidade} className="rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-1 text-[15px] font-semibold text-ink">{c.cidade}</div>
              <div className="divide-y divide-slate-100">
                {c.itens.map((a) => (
                  <div key={a.key} className="flex items-center gap-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800">
                        {iconeEsporte(a.esporte)} {/beach/i.test(a.esporte) ? 'Beach' : a.esporte} · {curtoExpansao(a.titulo)}
                      </div>
                      <div className={`text-xs ${a.vencida ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{resumoExpansao(a)}</div>
                    </div>
                    <Puxar onClick={() => puxar(a.key)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Secao>
      )}
      {comPrazo.length > 0 && (
        <Secao titulo="Com prazo mais pra frente">
          {comPrazo.map((t) => (
            <div key={t.key} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">{tituloExpansao(t.titulo)}</div>
                <div className="text-xs text-slate-500">até {fmtCurto(t.ate)}</div>
              </div>
              <Puxar onClick={() => puxar(t.key)} />
            </div>
          ))}
        </Secao>
      )}
      {outras.length > 0 && (
        <Secao titulo="Outras">
          {outras.map((t) => (
            <div key={t.key} className="flex items-start gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">
                  {t.titulo}
                  {t.continua && <span className="ml-1 text-xs text-slate-400" title="Volta todo dia">🔁</span>}
                </div>
                <ComoFazer texto={t.detalhe} />
              </div>
              <Puxar onClick={() => puxar(t.key)} />
            </div>
          ))}
        </Secao>
      )}
    </div>
  );
}

// o que ela puxou pra hoje, dentro da aba Tarefas: marca como feita ou devolve para o cardápio
function Puxadas({ itens, feitos, marcas, marcar, devolver }) {
  if (!itens.length) return null;
  return (
    <Secao titulo="Puxadas pra hoje">
      {itens.map((t) => {
        const feito = feitos.includes(t.key);
        const exp = EXP.test(t.titulo);
        return (
          <div key={t.key} className={`flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${feito ? 'opacity-60' : ''}`}>
            <Marca feito={feito} marca={marcas[t.key]} onClick={() => marcar(t.key)} />
            <div className="min-w-0 flex-1">
              <div className={`text-[15px] ${feito ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {exp ? `${iconeEsporte(t.titulo.match(EXP)[1])} ${t.titulo.match(EXP)[2]} · ${curtoExpansao(t.titulo)}` : t.titulo}
              </div>
              {exp && t.ate && <div className="text-xs text-slate-500">{resumoExpansao(t)}</div>}
              <Nota marca={marcas[t.key]} />
              <ComoFazer texto={t.detalhe} />
              {exp && !feito && <p className="mt-0.5 text-[11px] text-slate-400">Ao terminar a cidade, conclua também no Hub (Atividades).</p>}
            </div>
            {!feito && (
              <button onClick={() => devolver(t.key)} className="shrink-0 text-xs text-slate-400 hover:text-slate-600" title="Devolver para o Acabou? Puxa daqui">
                devolver
              </button>
            )}
          </div>
        );
      })}
    </Secao>
  );
}

// "[Expansão Beach Tennis Paranavaí] Listar os professores..." (tarefa do Hub) → "🏖️ Paranavaí · Listar os professores..."
const tituloExpansao = (s = '') => s.replace(/^\[Expansão (Beach Tennis|Tênis|Padel) ([^\]]+)\]\s*/,(_, e, c) => `${/beach/i.test(e) ? '🏖️' : /padel/i.test(e) ? '🥎' : '🎾'} ${c} · `);
const ehSorteio = (t) => /sorteio di[aá]rio/i.test(t.titulo);
const chaveSorteio = (p) => `sorteio:${p.grupo}`;
const idGrupo = (p) => `sorteio-${p.grupo.replace(/\W+/g, '-')}`;

function Dia({ dia, andamento, banco, adiantar, expansao, token }) {
  const [aba, setAba] = useState('tarefas');
  // o que ela puxou do "Acabou? Puxa daqui" para hoje (guardado no navegador dela, por dia)
  const [puxados, setPuxados] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`lolis-puxados-${dia.date}`) || '[]');
    } catch {
      return [];
    }
  });
  const guardarPuxados = (lista) => {
    setPuxados(lista);
    try {
      localStorage.setItem(`lolis-puxados-${dia.date}`, JSON.stringify(lista));
    } catch {
      /* ignora */
    }
  };
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
    : temRotinaSorteio
      ? [{ key: 'sorteio', titulo: '🎾 Sorteio diário', alvo: null }]
      : [];
  const tarefas = dia.tarefas.filter((t) => !ehSorteio(t));
  // a tarefa "Lembretes de brinde" fica feita quando todos os lembretes dentro dela forem marcados
  const ehLembretes = (t) => t.key.startsWith('r:lembretes-brinde:');
  const lembretesOk = lembretes.length > 0 && lembretes.every((b) => feitos.includes(b.key));
  const pendTarefas = tarefas.filter((t) => (ehLembretes(t) ? !lembretesOk && !t.feito : !feitos.includes(t.key) && !t.feito)).length + dia.atrasadas.filter((t) => !feitos.includes(t.key)).length + itensSorteio.filter((x) => !feitos.includes(x.key)).length;
  const pendSorteio = itensSorteio.filter((x) => !feitos.includes(x.key)).length;
  const cardapio = [...itensExpansao(expansao), ...adiantar, ...banco];
  const itensPuxados = puxados.map((k) => cardapio.find((t) => t.key === k)).filter(Boolean);
  const pendPuxados = itensPuxados.filter((t) => !feitos.includes(t.key)).length;
  const noCardapio = cardapio.filter((t) => !puxados.includes(t.key) && (!feitos.includes(t.key) || t.continua)).length;

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
    ...banco.map((t) => [t.key, t.titulo]),
    ...adiantar.map((t) => [t.key, tituloExpansao(t.titulo)]),
    ...itensExpansao(expansao).map((t) => [t.key, tituloExpansao(t.titulo)]),
    ...lembretes.map((b) => [b.key, `${b.tipo === 'lembrete' ? 'Lembrete do prazo' : 'Conferir se deu certo'} · ${b.linha}`]),
  ]);

  const ABAS = [['tarefas', '📝 Tarefas', pendTarefas + pendPuxados], ...(itensSorteio.length ? [['sorteio', '🎾 Sorteio diário', pendSorteio]] : []), ['etapas', '🏆 Etapas', 0], ...(cardapio.length ? [['acabou', '🙌 Acabou? Puxa daqui', noCardapio]] : [])];

  return (
    <div className="space-y-5">
      {pedindo && <CaixaMarca titulo={titulos[pedindo] || ''} onSalvar={salvarMarca} onFechar={() => setPedindo(null)} />}
      <h2 className="text-sm font-semibold text-slate-500 first-letter:uppercase">{fmtLongo(dia.date)}</h2>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:flex">
        {ABAS.map(([id, nome, n]) => (
          <button key={id} onClick={() => setAba(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${aba === id ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {nome}
            {n > 0 && <span className={`rounded-full px-1.5 text-xs ${aba === id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{n}</span>}
          </button>
        ))}
      </div>

      {aba === 'etapas' ? (
        <EtapasRodadas />
      ) : aba === 'acabou' ? (
        <Cardapio expansao={itensExpansao(expansao)} banco={banco} adiantar={adiantar} puxados={puxados} feitos={feitos} puxar={(k) => guardarPuxados([...puxados, k])} />
      ) : aba === 'tarefas' ? (
        <>
          {dia.atrasadas.length > 0 && (
            <Secao titulo="⚠️ Atrasadas (prioridade)">
              {dia.atrasadas.map((t) => (
                <Tarefa key={t.key} t={t} feito={feitos.includes(t.key)} marca={marcas[t.key]} onMarcar={() => marcar(t.key)} />
              ))}
            </Secao>
          )}

          {dia.date === today() && <EntregasLolis token={token} />}

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
            {tarefas.map((t) =>
              ehLembretes(t) ? (
                <Lembretes key={t.key} t={t} lembretes={lembretes} feito={lembretesOk || !!t.feito} feitos={feitos} marcas={marcas} marcar={marcar} />
              ) : (
                <Tarefa key={t.key} t={t} feito={feitos.includes(t.key) || !!t.feito} marca={marcas[t.key]} onMarcar={() => marcar(t.key)} />
              ),
            )}
            {!tarefas.length && !itensSorteio.length && <Caixa>Nenhuma tarefa.</Caixa>}
          </Secao>

          {(dia.seisZero || []).length > 0 && (
            <Secao titulo="🏆 6x0 6x0 da semana">
              <p className="px-1 text-xs text-slate-500">
                {dia.seisZero[0].lidoEm
                  ? <>Lidos do Hub (Torneios › 6x0 6x0) em {fmtCurto(dia.seisZero[0].lidoEm)}: todos os jogos <b>no prazo</b> que ainda não saíram na arte. Depois de postar, marque o 📷 no Hub (senão o nome volta na próxima quarta); depois de mandar a mensagem, marque o 🎁.</>
                  : <>Os ganhadores chegam do Hub na quarta à tarde (Torneios › 6x0 6x0, só os jogos <b>no prazo</b>).</>}
              </p>
              {dia.seisZero.map((c) => (
                <div key={c.cidade} className="space-y-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm font-bold text-slate-800">
                    {c.cidade} <span className="font-normal text-slate-500">· {c.premios.join(' + ')}</span>
                  </div>
                  {c.ganhadores.length > 0 ? (
                    <div className="space-y-1.5">
                      {c.ganhadores.map((g) => (
                        <div key={g.key} className={`flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 ring-1 ring-slate-100 ${feitos.includes(g.key) ? 'opacity-50' : ''}`}>
                          <Marca feito={feitos.includes(g.key)} marca={marcas[g.key]} onClick={() => marcar(g.key)} />
                          <span className="min-w-0 flex-1 text-sm text-slate-800">
                            <b>{g.nome}</b> <span className="text-slate-500">(R{g.rodada}) · classe {g.classe}{g.lancado ? ` · lançado ${g.lancado}` : ''}</span>
                            {g.brinde && <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">🎁 brinde já marcado no Hub</span>}
                            {g.jaSaiu && (
                              <span className="mt-1 block rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                                ⚠️ Já saiu na arte de {fmtCurto(g.jaSaiu)}: não vai de novo na arte. Marque o 📷 no Hub (Torneios › 6x0 6x0).
                              </span>
                            )}
                          </span>
                          <BotaoWhats tel={g.telefone} />
                        </div>
                      ))}
                      <BotaoArte6x0 cidade={c.cidade} nomes={c.ganhadores.filter((g) => !g.jaSaiu).map((g) => `${g.nome} (R${g.rodada})`)} />
                      <Texto rotulo="Nomes para a arte do Instagram" texto={c.ganhadores.filter((g) => !g.jaSaiu).map((g) => `${g.nome} (R${g.rodada})`).join('\n')} />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">{c.lidoEm ? 'Nenhum ganhador pendente nesta cidade.' : 'Aguardando a leitura do Hub.'}</p>
                  )}
                  <Texto rotulo="Mensagem no privado do ganhador" texto={c.mensagem} />
                </div>
              ))}
            </Secao>
          )}

          <Puxadas itens={itensPuxados} feitos={feitos} marcas={marcas} marcar={marcar} devolver={(k) => guardarPuxados(puxados.filter((x) => x !== k))} />

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
  const voucher = p.patrocinadores.find((x) => x.canva || modeloVoucher(x.nome));
  const retirada = p.patrocinadores.map((x) => (x.local ? `${x.nome}: ${x.local}` : '')).filter(Boolean);
  const [aberto, setAberto] = useState(!feito);
  useEffect(() => {
    if (feito) setAberto(false); // marcou como feito: recolhe
  }, [feito]);
  const msgApoiador = (x) =>
    // Primor: mensagem curta e informal, só com o nome do ganhador (o Leo gera o voucher)
    x.pedeVoucher
      ? `Oii ${x.apelido || (x.contato?.trim() ? nomeProprio(x.contato) : '')}, tudo bem? Segue o nome do ganhador de hoje: ${quem} 💚`
      : `Oii${x.apelido ? ` ${x.apelido}` : x.contato?.trim() ? ` ${nomeProprio(x.contato)}` : ''}, tudo bem?\nPassando pra avisar que quem ganhou o sorteio diário do ranken de hoje foi ${quem}, que vai retirar ${x.premio}.\nValeuuu pela parceria 👊🏻`;
  const msgGanhador = [
    `Oiii ${primeiro}, tudo bem? Parabéns, você foi sorteado(a) hoje no sorteio diário do ranken 🎉`,
    '',
    `🎁 Seu prêmio: ${premios}`,
    ...(retirada.length ? [`📍 ${retirada.join(' · ')}`] : []),
    // retirada que depende de combinar com alguém (receber em casa, entrar em contato...): vai o contato do patrocinador
    ...p.patrocinadores
      .map((x) => ({ ...x, cr: (x.contatoRetirada ?? x.contato ?? '').trim(), tr: x.telefoneRetirada || x.telefone }))
      .filter((x) => x.cr && x.tr && (x.contatoAtleta ?? /bonna|olaia/i.test(x.nome)))
      .map((x) => `📞 Entre em contato com ${quemFala(x.cr, x.nome)}${quemFala(x.cr, x.nome).startsWith('a ') ? '' : ` (${x.nome})`} ${x.instrucao || (/olaia/i.test(x.nome) ? 'para fazer o pedido da sua marmita' : 'para combinar a retirada')}: ${x.tr}${linkWhats(x.tr, '') ? ` · ${linkWhats(x.tr, '').replace('?text=', '')}` : ''}`),
    `⏱ Você tem 7 dias para solicitar: até ${prazo}.`,
    // passo a passo do apoiador (ex.: como usar o voucher da Lívia Madi)
    ...p.patrocinadores.filter((x) => x.textoGanhador).flatMap((x) => ['', x.textoGanhador]),
    ...(voucher ? ['', 'Segue o seu voucher 👇'] : []),
    '',
    'Qualquer dúvida é só chamar aqui 💚',
  ].join('\n');

  return (
    <div id={idGrupo(p)} className={`scroll-mt-4 space-y-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-60' : ''}`}>
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
            {/@\d{4}/.test(p.parabens) ? (
              <>
                No grupo, o <b>{p.parabens.match(/@\d{4}/)[0]}</b> colado ainda não marca: apague o último número e digite de novo. Aí a lista abre e você escolhe a pessoa.
              </>
            ) : (
              <>
                No grupo, apague <b>[marque o ganhador]</b>, digite <b>@</b> e escolha a pessoa na lista, para ela ser marcada de verdade.
              </>
            )}
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
            {voucher?.canva && !modeloVoucher(voucher.nome) && <BotaoCanva c={voucher.canva} />}
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
// Número da pessoa para copiar e colar no WhatsApp (só os números, com DDD, sem o 55):
// mais fácil do que o link "Abrir no WhatsApp"
function BotaoWhats({ tel }) {
  const [ok, setOk] = useState(false);
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  const bonito = `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(d);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          prompt('Copie o número:', d);
        }
      }}
      title="Copiar o número"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ring-1 ${ok ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-emerald-700 ring-emerald-300 hover:bg-emerald-50'}`}
    >
      📱 {bonito} <span className="font-semibold">{ok ? '✓ copiado' : '· copiar'}</span>
    </button>
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
    <div className={`space-y-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 ${feito ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <Marca feito={feito} marca={marca} onClick={onMarcar} />
        <div className="min-w-0 flex-1">
          {b.sorteio && (
            <div className={`mb-0.5 text-xs font-bold ${b.tipo === 'lembrete' ? 'text-violet-700' : 'text-emerald-700'}`}>
              {b.tipo === 'lembrete' ? '🎁 Lembrete do prazo (3º dia)' : '✅ Conferir se deu certo (último dia do prazo)'} · sorteio de {fmtCurto(b.sorteio)} · prazo até {fmtCurto(b.prazo)}
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

// Tarefa do dia com os lembretes de brinde de sorteios anteriores: abre e mostra cada mensagem com a sua bolinha.
// Fica feita sozinha quando todas forem marcadas.
function Lembretes({ t, lembretes, feito, feitos, marcas, marcar }) {
  const [aberto, setAberto] = useState(!feito);
  const ok = lembretes.filter((b) => feitos.includes(b.key)).length;
  return (
    <div className={`space-y-2 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/70 ${feito && !aberto ? 'opacity-50' : ''}`}>
      <button onClick={() => setAberto(!aberto)} className="flex w-full items-center gap-3 text-left">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white ${feito ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>{feito ? '✓' : ''}</span>
        <span className={`flex-1 text-[15px] ${feito ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.titulo}</span>
        <span className="shrink-0 text-xs font-semibold text-slate-500">
          {ok} de {lembretes.length} {aberto ? '▲' : '▼'}
        </span>
      </button>
      {aberto && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">No privado, para ganhadores de outros dias. O telefone está em cada um (ou no Hub › Sorteio Diário › Ganhadores do dia). Marque cada um: quando todos estiverem marcados, a tarefa fica feita.</p>
          {lembretes.map((b) => (
            <Mensagem key={b.key} b={b} feito={feitos.includes(b.key)} marca={marcas[b.key]} onMarcar={() => marcar(b.key)} />
          ))}
        </div>
      )}
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
          {tituloExpansao(t.titulo)}
          {t.era && <span className="ml-1 text-xs text-red-500">(era {fmtCurto(t.era)})</span>}
        </span>
        <Nota marca={marca} />
        {/* mensagem pronta (ex.: cobrança de Pix), com Copiar e WhatsApp */}
        {t.mensagem && !feito && (
          <span className="mt-2 block space-y-2 rounded-lg bg-[#e7ffdb] p-2.5">
            <span className="block whitespace-pre-wrap text-sm text-slate-800">{t.mensagem}</span>
            <span className="flex flex-wrap gap-2">
              <Copiar texto={t.mensagem} />
              <BotaoWhats tel={t.telefone} texto={t.mensagem} />
            </span>
          </span>
        )}
        {/* veio do WhatsApp da Laura: lembrar de responder o atleta por lá */}
        {t.retorno && !feito && (
          <span className="mt-2 block rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900 ring-1 ring-amber-300">
            📲 Fez a tarefa? Não esquece de dar o retorno pro atleta no WhatsApp da Laura!
          </span>
        )}
        {/* imagens que a Laura anexou: clica e abre grande */}
        {t.anexos?.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-2">
            {t.anexos.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer" title="Abrir a imagem">
                <img src={a.url} alt="Imagem da tarefa" className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200" />
              </a>
            ))}
          </span>
        )}
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
// Arte do 6x0 6x0 da cidade, já com os nomes (PNG para o Instagram)
function BotaoArte6x0({ cidade, nomes }) {
  const [gerando, setGerando] = useState(false);
  if (!MODELOS_6X0[cidade] || !nomes.length) return null;
  return (
    <button
      disabled={gerando}
      onClick={async () => {
        setGerando(true);
        try {
          await gerarArte6x0(cidade, nomes);
        } finally {
          setGerando(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
    >
      {gerando ? 'Gerando…' : `🎨 Baixar a arte de ${cidade} com os nomes (PNG)`}
    </button>
  );
}

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
      <div className="w-full max-w-lg space-y-3 rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
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
