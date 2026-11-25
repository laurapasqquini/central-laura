// Inadimplentes: quem está com o pagamento falhando no Stripe (Hub › Assinaturas › Cobranças), lido pela extensão.
// "Vai bloquear" = o Stripe ainda tenta de novo; "Já bloqueado" = esgotou as tentativas e o app bloqueou o acesso.
// Cada pessoa tem a mensagem pronta; quem paga ou cancela sai da lista do Hub e some daqui sozinha.
import { useState } from 'react';
import { useStore } from '../lib/store';
import { today, fmtCurto, relativo } from '../lib/dates';
import { atualizarHistorico, situacao } from '../lib/inadimplentes.js';
import { Empty } from '../components/ui';

// a mensagem certa sai sozinha do histórico da pessoa: 1º contato (pelo status), follow-up ou "inadimplente de novo"
export const MSG_INADIMPLENTES = {
  vai: 'Oii {nome}, tudo bem? Lau do ranken aquii\nO pagamento da sua mensalidade está dando algum probleminha, e se a próxima tentativa também falhar o app bloqueia o seu acesso aos jogos. Consegue conferir o cartão no app (Perfil › Assinaturas)? Qualquer dúvida fico a disposição.',
  bloqueado: 'Oii {nome}, tudo bem? Aqui é a Lau, do RANKEN 🎾\n\nVi que o pagamento da sua mensalidade de {esporte} não passou nas últimas tentativas e por isso o seu acesso ao app ficou bloqueado. Aconteceu alguma coisa? Pra voltar a jogar, é só ir no app, em Perfil › Assinaturas, e pagar por pix ou trocar o cartão.\n\nQualquer coisa me fala!',
  followup: 'Oii {nome}, tudo bem? Eu de novo aquii kkkk\n\nO pagamento da sua mensalidade ainda não passou. Dá pra resolver rapidinho pelo próprio app: em Perfil › Assinaturas você paga por pix ou troca o cartão.\n\nA gente adoraria continuar contando com você nos jogos! Se a ideia for parar por agora, me conta se é esse o caso e qual o motivo? E se tiver qualquer dúvida sobre o cancelamento, fico à disposição.',
  followupBloqueado: 'Oii {nome}, tudo bem? Eu de novo aquii kkkk\n\nSeu acesso ao app continua bloqueado porque o pagamento da mensalidade de {esporte} não passou. Pra voltar a jogar é bem simples: pelo app, em Perfil › Assinaturas, dá pra pagar por pix ou trocar o cartão.\n\nSeria muito bom ter você de volta nas rodadas! Se a ideia for parar, me conta se é esse o caso e qual o motivo? E se tiver qualquer dúvida sobre o cancelamento, fico à disposição.',
  followup3: 'Oii {nome}, tudo bem? Desculpa a insistência kkkk\n\nSó passando pra lembrar que a sua mensalidade do RANKEN ainda está em aberto, e se não for resolvida o app bloqueia o seu acesso aos jogos. Lá no app, em Perfil › Assinaturas, dá pra pagar por pix ou trocar o cartão rapidinho.\n\nSe estiver pensando em dar uma pausa, me conta? Assim eu consigo te ajudar e já organizo as rodadas por aqui.',
  followup3Bloqueado: 'Oii {nome}, tudo bem? Desculpa a insistência kkkk\n\nSeu acesso ao app continua bloqueado por causa da mensalidade de {esporte}. Queria entender se ainda faz sentido pra você seguir com a gente: se sim, é só pagar por pix ou trocar o cartão no app, em Perfil › Assinaturas.\n\nSe a ideia for parar, me fala o motivo? Ajuda bastante a gente a melhorar. E se tiver dúvida sobre como cancelar, fico à disposição.',
  reincidente: 'Oii {nome}, tudo bem? Aqui é a Lau, do RANKEN 🎾\n\nO pagamento da sua mensalidade de {esporte} não passou de novo. Às vezes é o cartão que venceu ou trocou. Dá pra resolver pelo próprio app: em Perfil › Assinaturas você paga por pix ou troca o cartão.\n\nQualquer coisa me fala!',
};
const ROTULO_MSG = [
  ['vai', '1º contato · vai bloquear'],
  ['bloqueado', '1º contato · já bloqueado'],
  ['followup', '2º contato (3 dias depois do 1º) · vai bloquear'],
  ['followupBloqueado', '2º contato (3 dias depois do 1º) · já bloqueado'],
  ['followup3', '3º contato (7 dias depois do 2º) · vai bloquear'],
  ['followup3Bloqueado', '3º contato (7 dias depois do 2º) · já bloqueado'],
  ['reincidente', 'Inadimplente de novo (já pagou uma vez e voltou)'],
];
// qual modelo usar para a pessoa (os de follow-up têm versão "vai bloquear" e "já bloqueado")
const chaveMsg = (sit, x) => (sit.tipo.startsWith('followup') ? `${sit.tipo}${x.status === 'unpaid' ? 'Bloqueado' : ''}` : sit.tipo);
const mesAno = (d) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
// o histórico salvo; antes da primeira lista nova, monta na hora a partir do "falei hoje" antigo
const histDe = (state) => state.inadHist || atualizarHistorico({}, state.inadimplentesHub?.itens || [], today(), state.inadimplentesContato || {});

const primeiroNome = (n = '') => {
  const w = n.trim().split(/\s+/)[0] || '';
  return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '';
};
const brl = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const telWhats = (t = '') => (t.length >= 12 ? t : `55${t}`);

// quantos pedem atenção (para o número na aba): sem contato ou no dia do próximo contato
export function contaInadimplentes(state, ref = today()) {
  const hist = histDe(state);
  return (state.inadimplentesHub?.itens || []).filter((x) => situacao(hist, x, ref).pedeAtencao).length;
}


// cor de cada grupo: faixa à esquerda do cartão e o título do grupo
const COR = {
  vai: { faixa: 'bg-amber-500', titulo: 'text-amber-700', fundo: 'bg-amber-50/60' },
  bloqueado: { faixa: 'bg-red-500', titulo: 'text-red-700', fundo: 'bg-red-50/50' },
  falei: { faixa: 'bg-slate-300', titulo: 'text-slate-500', fundo: 'bg-slate-50' },
  sem: { faixa: 'bg-violet-400', titulo: 'text-violet-700', fundo: 'bg-violet-50/50' },
};

export default function Inadimplentes() {
  const { state, setMsgInadimplentes } = useStore();
  const ref = today();
  const [editar, setEditar] = useState(false);
  const [aberta, setAberta] = useState(null); // só uma mensagem aberta por vez
  const [verFalei, setVerFalei] = useState(false);
  const [verNao, setVerNao] = useState(false);
  const hub = state.inadimplentesHub;
  const itens = hub?.itens || [];
  const hist = histDe(state);
  const sit = Object.fromEntries(itens.map((x) => [x.id, situacao(hist, x, ref)]));
  const proprias = Object.fromEntries(Object.entries(state.msgInadimplentes || {}).filter(([, v]) => v));
  const msgs = { ...MSG_INADIMPLENTES, ...proprias };
  const pede = (x) => sit[x.id].pedeAtencao;
  const porValor = (a, b) => (b.valor || 0) - (a.valor || 0);
  // quem já recebeu contato espera o prazo do próximo em "Já falei"; depois do 3º sem pagar, "Sem retorno"
  const vai = itens.filter((x) => x.status !== 'unpaid' && pede(x)).sort(porValor);
  const bloqueados = itens.filter((x) => x.status === 'unpaid' && pede(x)).sort(porValor);
  const naoCobrar = itens.filter((x) => sit[x.id].naoCobrar).sort((a, b) => sit[b.id].naoCobrar.localeCompare(sit[a.id].naoCobrar));
  const semRetorno = itens.filter((x) => !pede(x) && sit[x.id].semRetorno).sort(porValor);
  const falei = itens.filter((x) => !pede(x) && !sit[x.id].semRetorno && !sit[x.id].naoCobrar).sort((a, b) => (sit[a.id].proximoEm || '9').localeCompare(sit[b.id].proximoEm || '9'));
  const lidoEm = hub ? new Date(hub.em) : null;
  const msgDe = (x) => msgs[chaveMsg(sit[x.id], x)];
  const card = (x, cor) => <Pessoa key={x.id} x={x} cor={cor} msg={msgDe(x)} sit={sit[x.id]} aberta={aberta === x.id} onAlternar={() => alternar(x.id)} />;
  const alternar = (id) => setAberta(aberta === id ? null : id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Inadimplentes</h1>
          <p className="text-sm text-slate-500">
            Pagamento falhando no Stripe (Hub › Assinaturas › Cobranças).{' '}
            {lidoEm ? `Lido ${relativo(lidoEm.toLocaleDateString('sv-SE'), ref)} às ${lidoEm.toTimeString().slice(0, 5)}.` : 'Abra o Hub para a extensão ler a lista.'} Quem paga ou cancela some daqui sozinho.
          </p>
        </div>
        <button onClick={() => setEditar(!editar)} className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
          {editar ? 'Fechar edição' : 'Editar mensagens'}
        </button>
      </header>

      {itens.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Resumo cor="bg-amber-500" n={vai.length} rotulo={vai.length === 1 ? 'vai bloquear' : 'vão bloquear'} />
          <Resumo cor="bg-red-500" n={bloqueados.length} rotulo={bloqueados.length === 1 ? 'bloqueado' : 'bloqueados'} />
          <Resumo cor="bg-slate-300" n={falei.length} rotulo="já falei" />
          {naoCobrar.length > 0 && <Resumo cor="bg-slate-200" n={naoCobrar.length} rotulo="não cobrar mais" />}
          {semRetorno.length > 0 && <Resumo cor="bg-violet-400" n={semRetorno.length} rotulo="sem retorno" />}
        </div>
      )}

      {editar && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">
            A central escolhe sozinha qual usar e quando: a 1ª quando a pessoa aparece no Hub, a 2ª 3 dias depois, a 3ª 7 dias depois da 2ª (e &quot;inadimplente de novo&quot; no lugar da 1ª para quem já pagou uma vez e voltou). Depois da 3ª, a pessoa vai para &quot;Sem retorno&quot;. Use {'{nome}'} e {'{esporte}'}: entram sozinhos.
          </p>
          {ROTULO_MSG.map(([k, rot]) => (
            <div key={k} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{rot}</span>
                {proprias[k] && proprias[k] !== MSG_INADIMPLENTES[k] && (
                  <button onClick={() => setMsgInadimplentes({ [k]: '' })} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                    voltar ao padrão
                  </button>
                )}
              </div>
              <textarea key={msgs[k]} rows={4} defaultValue={msgs[k]} onBlur={(e) => e.target.value.trim() !== msgs[k] && setMsgInadimplentes({ [k]: e.target.value.trim() })} className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-slate-400" />
            </div>
          ))}
        </div>
      )}

      {!hub && <Empty>Ainda sem leitura do Hub. Recarregue a extensão (versão 1.40) e abra qualquer página do Hub.</Empty>}
      {hub && !itens.length && <Empty>Ninguém inadimplente agora. 🎉</Empty>}

      {vai.length > 0 && (
        <Grupo cor={COR.vai} titulo={`Vai bloquear (${vai.length})`} dica="O Stripe ainda vai tentar cobrar de novo: dá tempo de evitar o bloqueio.">
          {vai.map((x) => card(x, COR.vai))}
        </Grupo>
      )}
      {bloqueados.length > 0 && (
        <Grupo cor={COR.bloqueado} titulo={`Já bloqueado (${bloqueados.length})`} dica="O Stripe já esgotou as tentativas e o acesso ao app está bloqueado.">
          {bloqueados.map((x) => card(x, COR.bloqueado))}
        </Grupo>
      )}
      {falei.length > 0 && (
        <section className="space-y-2">
          <button onClick={() => setVerFalei(!verFalei)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide ${COR.falei.titulo} hover:bg-slate-100`}>
            <span>Já falei ({falei.length})</span>
            <span className="text-xs normal-case tracking-normal">{verFalei ? 'esconder ▴' : 'mostrar ▾'}</span>
          </button>
          {verFalei && (
            <div className="space-y-2">
              <p className="px-1 text-xs text-slate-500">Você já falou com eles. Se não pagarem, voltam para cima no dia do próximo contato (3 dias depois do 1º, 7 dias depois do 2º), ou na hora se o acesso for bloqueado.</p>
              {falei.map((x) => card(x, COR.falei))}
            </div>
          )}
        </section>
      )}
      {semRetorno.length > 0 && (
        <Grupo cor={COR.sem} titulo={`Sem retorno (${semRetorno.length})`} dica="Já receberam as 3 mensagens e continuam sem pagar. A central não pede mais mensagem: decida caso a caso (o Stripe ajuda).">
          {semRetorno.map((x) => card(x, COR.sem))}
        </Grupo>
      )}
      {naoCobrar.length > 0 && (
        <section className="space-y-2">
          <button onClick={() => setVerNao(!verNao)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide ${COR.falei.titulo} hover:bg-slate-100`}>
            <span>Não cobrar mais ({naoCobrar.length})</span>
            <span className="text-xs normal-case tracking-normal">{verNao ? 'esconder ▴' : 'mostrar ▾'}</span>
          </button>
          {verNao && (
            <div className="space-y-2">
              <p className="px-1 text-xs text-slate-500">Avisaram que não vão mais jogar. A central não cobra mais; somem daqui quando o Hub tirar da lista (em até 30 dias).</p>
              {naoCobrar.map((x) => card(x, COR.falei))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Resumo({ cor, n, rotulo }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
      <span className={`h-2.5 w-2.5 rounded-sm ${cor}`} />
      <b className="text-ink">{n}</b> <span className="text-slate-600">{rotulo}</span>
    </span>
  );
}

function Grupo({ cor, titulo, dica, children }) {
  return (
    <section className="space-y-2">
      <div className="px-1">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${cor.titulo}`}>{titulo}</h2>
        <p className="text-xs text-slate-500">{dica}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Pessoa({ x, cor, msg, sit, aberta, onAlternar }) {
  const { falarInadimplente, naoCobrarInadimplente } = useStore();
  const ref = today();
  const [copiado, setCopiado] = useState('');
  const texto = msg.replaceAll('{nome}', primeiroNome(x.nome)).replaceAll('{esporte}', (x.esporte || 'tênis').toLowerCase());
  const copiar = async (t, qual) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopiado(qual);
      setTimeout(() => setCopiado(''), 1500);
    } catch {
      prompt('Copie:', t);
    }
  };
  const detalhe = [x.esporte, x.cidade, brl(x.valor), x.tentativas ? `${x.tentativas} tentativas` : null, x.motivo || null].filter(Boolean).join(' · ');
  const contatoHub = x.ultimoContato ? `contato no Hub em ${fmtCurto(x.ultimoContato.slice(0, 10))}` : null;
  const parar = (e) => e.stopPropagation(); // os botões não abrem/fecham o cartão
  const falouEm = sit.ultimo;
  // em que contato estamos neste episódio (o de hoje conta como o atual)
  // quem pede atenção: o contato que vai ser feito agora; os outros: quantos já foram feitos
  const n = sit.pedeAtencao && falouEm !== ref ? sit.contatos + 1 : sit.contatos;
  const etapa = n <= 1 ? '1º contato' : `${n}º contato · último em ${fmtCurto(falouEm)}`;
  const proximo = !sit.pedeAtencao && !sit.semRetorno && sit.proximoEm && sit.proximoEm > ref ? `próximo contato ${fmtCurto(sit.proximoEm)}` : null;

  return (
    <div className={`flex overflow-hidden rounded-lg bg-white shadow-sm ring-1 ${aberta ? 'ring-slate-300' : 'ring-slate-200'}`}>
      <span className={`w-1.5 shrink-0 ${cor.faixa}`} />
      <div className="min-w-0 flex-1">
        <div role="button" tabIndex={0} onClick={onAlternar} onKeyDown={(e) => e.key === 'Enter' && onAlternar()} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-slate-50">
          <div className="min-w-[200px] flex-1">
            <div className="text-[15px] font-semibold text-ink">{x.nome || 'Sem nome'}</div>
            <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className={`rounded px-1.5 py-0.5 ${n <= 1 ? 'bg-slate-100 text-slate-600' : 'bg-sky-50 text-sky-800 ring-1 ring-sky-200'}`}>{etapa}</span>
              {sit.virouBloqueado && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-800 ring-1 ring-red-200">foi bloqueado depois do último contato</span>}
              {sit.naoCobrar && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">não cobrar mais · desde {fmtCurto(sit.naoCobrar)}</span>}
              {proximo && <span className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-500 ring-1 ring-slate-200">{proximo}</span>}
              {sit.reincidente && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-800 ring-1 ring-violet-200">inadimplente de novo{sit.ultimaVez ? ` (última vez em ${mesAno(sit.ultimaVez)})` : ''}</span>}
            </div>
            <div className="text-xs text-slate-500">{detalhe}</div>
            {(falouEm || contatoHub) && <div className="text-xs text-emerald-700">{[falouEm && `você falou ${relativo(falouEm, ref)} (${fmtCurto(falouEm)})`, contatoHub].filter(Boolean).join(' · ')}</div>}
          </div>
          {x.stripeCliente && (
            <a href={`https://dashboard.stripe.com/customers/${x.stripeCliente}`} target="_blank" rel="noreferrer" onClick={parar} title="Abrir o cliente no Stripe" className="rounded-md px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
              Stripe ↗
            </a>
          )}
          <span className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{aberta ? 'Fechar ▴' : 'Mensagem ▾'}</span>
          {sit.naoCobrar ? (
            <button onClick={(e) => (parar(e), naoCobrarInadimplente(x, null))} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-white">
              Voltar a cobrar
            </button>
          ) : falouEm === ref ? (
            <button onClick={(e) => (parar(e), falarInadimplente(x, null))} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700" title="Desfazer">
              falei hoje ✓
            </button>
          ) : (
            <button onClick={(e) => (parar(e), falarInadimplente(x, ref), aberta && onAlternar())} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-white">
              Falei hoje
            </button>
          )}
        </div>
        {aberta && (
          <div className={`space-y-2 border-t border-slate-100 px-4 py-3 ${cor.fundo}`}>
            <pre className="whitespace-pre-wrap rounded-md bg-white p-3 font-sans text-sm text-slate-800 ring-1 ring-slate-200">{texto}</pre>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copiar(texto, 'msg')} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">
                {copiado === 'msg' ? 'Copiado ✓' : 'Copiar mensagem'}
              </button>
              {x.telefone && (
                <>
                  <a href={`https://wa.me/${telWhats(x.telefone)}`} target="_blank" rel="noreferrer" className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-50">
                    Abrir no WhatsApp
                  </a>
                  <button onClick={() => copiar(x.telefone, 'tel')} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">
                    {copiado === 'tel' ? 'Copiado ✓' : 'Copiar número'}
                  </button>
                </>
              )}
              {!sit.naoCobrar && (
                <button onClick={() => confirm(`${primeiroNome(x.nome)} avisou que não vai mais jogar? Paro de cobrar (some daqui quando o Hub tirar, em até 30 dias).`) && naoCobrarInadimplente(x, ref)} className="ml-auto rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-300 hover:bg-slate-50 hover:text-slate-800">
                  Não cobrar mais
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
