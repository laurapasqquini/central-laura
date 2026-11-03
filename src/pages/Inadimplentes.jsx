// Inadimplentes: quem está com o pagamento falhando no Stripe (Hub › Assinaturas › Cobranças), lido pela extensão.
// "Vai bloquear" = o Stripe ainda tenta de novo; "Já bloqueado" = esgotou as tentativas e o app bloqueou o acesso.
// Cada pessoa tem a mensagem pronta; quem paga ou cancela sai da lista do Hub e some daqui sozinha.
import { useState } from 'react';
import { useStore } from '../lib/store';
import { today, addDays, fmtCurto, relativo } from '../lib/dates';
import { Section, Empty } from '../components/ui';

export const MSG_INADIMPLENTES = {
  vai: 'Oi, {nome}! Tudo bem? Aqui é a Laura, do RANKEN 🎾 O pagamento da sua mensalidade não passou, e se a próxima tentativa também falhar o app bloqueia o seu acesso aos jogos. Consegue conferir o cartão no app (Perfil › Assinaturas)? Se preferir, te mando o Pix. Qualquer coisa me fala!',
  bloqueado: 'Oi, {nome}! Tudo bem? Aqui é a Laura, do RANKEN 🎾 Vi que o pagamento da sua mensalidade de {esporte} não passou nas últimas tentativas e por isso o seu acesso ao app ficou bloqueado. Aconteceu alguma coisa? Se quiser voltar a jogar, é só atualizar o cartão no app ou eu te mando o Pix. Se a ideia for pausar ou sair, me avisa que eu te ajudo.',
};
const VOLTA_EM = 5; // dias depois do "falei" para a pessoa voltar a pedir atenção

const primeiroNome = (n = '') => {
  const w = n.trim().split(/\s+/)[0] || '';
  return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '';
};
const brl = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const telWhats = (t = '') => (t.length >= 12 ? t : `55${t}`);

// quantos pedem atenção (para o número na aba): sem contato ou com contato há mais de 5 dias
export function contaInadimplentes(state, ref = today()) {
  const c = state.inadimplentesContato || {};
  return (state.inadimplentesHub?.itens || []).filter((x) => !c[x.id] || c[x.id] <= addDays(ref, -VOLTA_EM)).length;
}

export default function Inadimplentes() {
  const { state, setMsgInadimplentes } = useStore();
  const ref = today();
  const [editar, setEditar] = useState(false);
  const hub = state.inadimplentesHub;
  const itens = hub?.itens || [];
  const contato = state.inadimplentesContato || {};
  const msgs = { ...MSG_INADIMPLENTES, ...(state.msgInadimplentes || {}) };
  const pede = (x) => !contato[x.id] || contato[x.id] <= addDays(ref, -VOLTA_EM);
  // primeiro quem pede atenção; dentro disso, o maior valor
  const ordem = (a, b) => Number(pede(b)) - Number(pede(a)) || (b.valor || 0) - (a.valor || 0);
  const vai = itens.filter((x) => x.status !== 'unpaid').sort(ordem);
  const bloqueados = itens.filter((x) => x.status === 'unpaid').sort(ordem);
  const lidoEm = hub ? new Date(hub.em) : null;

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
          {editar ? 'Fechar mensagens' : 'Editar mensagens'}
        </button>
      </header>

      {editar && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">Use {'{nome}'} e {'{esporte}'}: entram sozinhos em cada mensagem.</p>
          {[
            ['vai', 'Vai bloquear'],
            ['bloqueado', 'Já bloqueado'],
          ].map(([k, rot]) => (
            <label key={k} className="block space-y-1">
              <span className="text-sm font-semibold text-slate-800">{rot}</span>
              <textarea rows={4} defaultValue={msgs[k]} onBlur={(e) => setMsgInadimplentes({ [k]: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-slate-400" />
            </label>
          ))}
        </div>
      )}

      {!hub && <Empty>Ainda sem leitura do Hub. Recarregue a extensão (versão 1.40) e abra qualquer página do Hub.</Empty>}
      {hub && !itens.length && <Empty>Ninguém inadimplente agora. 🎉</Empty>}

      {vai.length > 0 && (
        <Section title={`Vai bloquear (${vai.length})`}>
          <p className="px-1 text-xs text-slate-500">O Stripe ainda vai tentar cobrar de novo: dá tempo de evitar o bloqueio.</p>
          <Lista itens={vai} msg={msgs.vai} contato={contato} pede={pede} />
        </Section>
      )}
      {bloqueados.length > 0 && (
        <Section title={`Já bloqueado (${bloqueados.length})`}>
          <p className="px-1 text-xs text-slate-500">O Stripe já esgotou as tentativas e o acesso ao app está bloqueado.</p>
          <Lista itens={bloqueados} msg={msgs.bloqueado} contato={contato} pede={pede} />
        </Section>
      )}
    </div>
  );
}

function Lista({ itens, msg, contato, pede }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {itens.map((x) => (
        <Pessoa key={x.id} x={x} msg={msg} falouEm={contato[x.id]} pedeAtencao={pede(x)} />
      ))}
    </div>
  );
}

function Pessoa({ x, msg, falouEm, pedeAtencao }) {
  const { falarInadimplente } = useStore();
  const ref = today();
  const [aberta, setAberta] = useState(false);
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

  return (
    <div className={`px-4 py-3 ${pedeAtencao ? '' : 'bg-slate-50/60'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-[200px] flex-1">
          <div className={`text-[15px] font-semibold ${pedeAtencao ? 'text-ink' : 'text-slate-500'}`}>{x.nome || 'Sem nome'}</div>
          <div className="text-xs text-slate-500">{detalhe}</div>
          {(falouEm || contatoHub) && (
            <div className="text-xs text-emerald-700">{[falouEm && `você falou ${relativo(falouEm, ref)} (${fmtCurto(falouEm)})${pedeAtencao ? ': ainda na lista, vale falar de novo' : ''}`, contatoHub].filter(Boolean).join(' · ')}</div>
          )}
        </div>
        <button onClick={() => setAberta(!aberta)} className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
          Mensagem
        </button>
        {falouEm === ref ? (
          <button onClick={() => falarInadimplente(x.id, null)} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700" title="Desfazer">
            falei hoje ✓
          </button>
        ) : (
          <button onClick={() => falarInadimplente(x.id, ref)} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
            Falei hoje
          </button>
        )}
      </div>
      {aberta && (
        <div className="mt-2 space-y-2 rounded-lg bg-[#e7ffdb] p-3 ring-1 ring-emerald-100">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{texto}</pre>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copiar(texto, 'msg')} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">
              {copiado === 'msg' ? 'Copiado ✓' : 'Copiar mensagem'}
            </button>
            {x.telefone && (
              <>
                <a href={`https://wa.me/${telWhats(x.telefone)}`} target="_blank" rel="noreferrer" className="rounded-md px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-white">
                  Abrir no WhatsApp
                </a>
                <button onClick={() => copiar(x.telefone, 'tel')} className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-white">
                  {copiado === 'tel' ? 'Copiado ✓' : 'Copiar número'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
