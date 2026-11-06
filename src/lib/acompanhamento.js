// Acompanhamento da Lolis (Ranken › Lolis › Acompanhamento): regras fixas, sem IA e sem custo.
// Recebe o dia já montado (o que estava combinado, o que ela marcou, o ponto, os telefones do Hub)
// e devolve o que cobrar e o que elogiar, cada um com uma mensagem pronta em tom acolhedor.
// Nada é enviado sozinho: a Laura copia e manda se quiser.
import { addDays, diffDays, weekday } from './dates.js';

export const METAS_PADRAO = {
  telefonesDia: null, // null = automático (pelo prazo da Expansão, mínimo de 4)
  horasDia: 4, // jornada combinada (no máximo 4h)
  diasAtraso: 2, // tarefa atrasada há N dias úteis ou mais vira cobrança
  diasEscalar: 2, // cobrança que fica N dias úteis na lista vira tarefa da Laura
  toleranciaMin: 30, // saiu até N minutos antes do fim da jornada não conta como "cedo"
};
export const metasLolis = (state) => ({ ...METAS_PADRAO, ...(state.lolisMetas || {}) });

const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const curto = (t = '', n = 60) => {
  const s = t.replace(/^\[[^\]]+\]\s*/, '').replace(/^(?:[\p{Extended_Pictographic}️‍]|\s)+/u, '').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const hm = (min) => (min == null ? '—' : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`);

// ── Telefones anotados no dia: diferença entre a última leitura do Hub do dia e a do dia anterior ──
// hist = { 'AAAA-MM-DD': { idDoProjeto: comResponsavel } }
export function telefonesNoDia(hist = {}, dia) {
  const atual = hist[dia];
  const antes = Object.keys(hist).filter((d) => d < dia).sort().at(-1);
  if (!atual || !antes) return null; // sem leitura do Hub no dia (ou sem a de antes para comparar)
  const prev = hist[antes];
  return Object.entries(atual).reduce((a, [id, n]) => a + (prev[id] != null ? Math.max(0, n - prev[id]) : 0), 0);
}
// guarda a leitura do dia (a última do dia vale) e só os últimos 40 dias
export function guardarTelefones(hist = {}, dia, projetos = []) {
  const novo = { ...hist, [dia]: Object.fromEntries(projetos.filter((p) => p.id != null).map((p) => [p.id, p.comResponsavel || 0])) };
  for (const d of Object.keys(novo)) if (d < addDays(dia, -40)) delete novo[d];
  return novo;
}

// meta de telefones do dia: a da Laura, ou a da Expansão (pelo prazo, mínimo de 4); 0 = não tem telefone para fazer
export function metaTelefones(metas, expansao) {
  if (metas.telefonesDia != null && metas.telefonesDia !== '') return Number(metas.telefonesDia) || 0;
  const item = (expansao?.itens || []).find((x) => x.faltam > 0);
  return item ? item.porDia || 4 : 0;
}

// ── Resumo de um dia ──
// dia = { date, itens: [{ key, titulo, feito }], sorteios: [keys], notas: { key: { status, nota } },
//         feitos: [keys], extras: [{ key, titulo }], ponto (resumoDia), telefones (número ou null) }
export function resumoDoDia(dia, metas, meta) {
  const feitos = new Set(dia.feitos || []);
  const notas = dia.notas || {};
  const ok = (x) => !!x.feito || feitos.has(x.key);
  const naoConsegui = dia.itens.filter((x) => !ok(x) && notas[x.key]?.status === 'nao').map((x) => ({ ...x, nota: notas[x.key].nota || '' }));
  const p = dia.ponto || {};
  const encerrou = p.status === 'saiu' || p.status === 'sem-saida';
  return {
    date: dia.date,
    feitas: dia.itens.filter(ok).length,
    total: dia.itens.length,
    pendentes: dia.itens.filter((x) => !ok(x) && notas[x.key]?.status !== 'nao'),
    naoConsegui,
    sorteios: (dia.sorteios || []).length,
    sorteiosOk: (dia.sorteios || []).filter((k) => feitos.has(k)).length,
    extras: dia.extras || [],
    entrada: p.entrada || null,
    saida: p.saida || null,
    minutos: p.minutos ?? null,
    atrasoChegada: p.atraso || 0,
    status: p.status || 'livre',
    encerrou,
    telefones: dia.telefones ?? null,
    metaTelefones: meta,
    metaMin: (Number(metas.horasDia) || 4) * 60,
  };
}

// ── O que cobrar ──
// ctx = { ref, hoje (resumoDoDia), anterior (resumoDoDia do dia útil anterior, ou null),
//         atrasadas: [{ key, titulo, era, dias }], expansao (expansaoLolis), agora: Date }
export function cobrancas(ctx, metas) {
  const { hoje, anterior, atrasadas = [], expansao, agora = new Date() } = ctx;
  const out = [];
  const fimDoDia = (r) => r && (r.encerrou || r.date < ctx.ref || agora.getHours() >= 18);

  for (const t of atrasadas)
    if (t.dias >= (Number(metas.diasAtraso) || 2))
      out.push({
        id: `atraso:${t.key}`,
        titulo: `"${curto(t.titulo)}" atrasada há ${t.dias} dias úteis`,
        tarefa: `"${curto(t.titulo)}" atrasada desde ${ddmm(t.era)}`,
        porque: `Era para ${ddmm(t.era)} e ainda não foi feita.`,
        mensagem: `Lolis, vi que "${curto(t.titulo)}" ficou parada desde ${ddmm(t.era)}. O que aconteceu? Posso te ajudar a destravar? 💚`,
      });

  for (const x of (expansao?.itens || []).filter((x) => x.vencida))
    out.push({
      id: `expansao:${x.key}`,
      titulo: `Expansão ${x.cidade}: o prazo passou (${ddmm(x.ate)})`,
      porque: `${curto(x.titulo)}${x.faltam ? `: faltam ${x.faltam} locais` : ''}.`,
      mensagem: `Lolis, vi que ${x.cidade} travou um pouco${x.faltam ? ` (faltam ${x.faltam} locais)` : ''}. O que aconteceu? Posso te ajudar?`,
    });

  // "não consegui" sem explicar o porquê (hoje e o dia útil anterior)
  for (const r of [hoje, anterior].filter(Boolean))
    for (const x of r.naoConsegui.filter((x) => !x.nota.trim()))
      out.push({
        id: `nao:${r.date}:${x.key}`,
        titulo: `Não conseguiu "${curto(x.titulo)}" (${r.date === ctx.ref ? 'hoje' : ddmm(r.date)}) e não disse o porquê`,
        porque: 'Marcou "não consegui" sem nota.',
        mensagem: `Lolis, vi que você marcou que não conseguiu "${curto(x.titulo)}". Me conta o que travou? Assim eu te ajudo ou vejo outro caminho 💚`,
      });

  // ritmo dos telefones: o último dia encerrado abaixo da meta
  const diaTel = [hoje, anterior].find((r) => r && fimDoDia(r) && r.telefones != null && r.metaTelefones > 0);
  if (diaTel && diaTel.telefones < diaTel.metaTelefones)
    out.push({
      id: 'ritmo-telefones',
      tarefa: `ritmo dos telefones abaixo da meta de ${diaTel.metaTelefones} por dia`,
      titulo: `Telefones abaixo da meta (${diaTel.telefones} de ${diaTel.metaTelefones}${diaTel.date === ctx.ref ? ' hoje' : ` em ${ddmm(diaTel.date)}`})`,
      porque: `A meta é ${diaTel.metaTelefones} telefones de responsáveis por dia.`,
      mensagem: `Lolis, ${diaTel.date === ctx.ref ? 'hoje' : 'no último dia'} foram ${diaTel.telefones} telefones de ${diaTel.metaTelefones} da meta. Teve algo que dificultou? Se quiser, a gente vê juntas um jeito de agilizar.`,
    });

  // sorteio sem parabéns
  for (const r of [hoje, anterior].filter(Boolean))
    if (r.sorteios > r.sorteiosOk && fimDoDia(r))
      out.push({
        id: `sorteio:${r.date}`,
        titulo: `Sorteio ${r.date === ctx.ref ? 'de hoje' : `de ${ddmm(r.date)}`} sem o parabéns (${r.sorteiosOk} de ${r.sorteios})`,
        porque: 'O sorteio diário não foi marcado como feito na página dela.',
        mensagem: `Lolis, o sorteio ${r.date === ctx.ref ? 'de hoje' : `de ${ddmm(r.date)}`} ficou sem o parabéns no grupo. Consegue postar? Os atletas adoram ver 🎉`,
      });

  // saiu cedo sem puxar nada do "Acabou? Puxa daqui"
  for (const r of [hoje, anterior].filter(Boolean))
    if (r.encerrou && r.minutos != null && r.minutos < r.metaMin - (Number(metas.toleranciaMin) || 0) && !r.extras.length)
      out.push({
        id: `cedo:${r.date}`,
        titulo: `Saiu cedo ${r.date === ctx.ref ? 'hoje' : `em ${ddmm(r.date)}`} (${hm(r.minutos)} de ${hm(r.metaMin)}) sem puxar nada extra`,
        porque: `Saiu às ${horaDe(r.saida) || '?'} e não puxou nada do "Acabou? Puxa daqui".`,
        mensagem: `Lolis, vi que ${r.date === ctx.ref ? 'hoje' : `em ${ddmm(r.date)}`} você saiu às ${horaDe(r.saida) || 'cedo'} e não puxou nada do "Acabou? Puxa daqui". Tudo certo por aí? Quando sobrar tempo, pode puxar de lá, tá? 💚`,
      });

  return out;
}

// ── O que elogiar ── (só o dia de hoje, e o anterior se hoje ainda não começou)
export function elogios(ctx) {
  const { hoje, anterior } = ctx;
  const r = hoje && (hoje.feitas || hoje.entrada) ? hoje : anterior;
  if (!r) return [];
  const quando = r.date === ctx.ref ? 'hoje' : `em ${ddmm(r.date)}`;
  const out = [];
  if (r.metaTelefones > 0 && r.telefones != null && r.telefones >= r.metaTelefones)
    out.push({ id: `tel:${r.date}`, titulo: `Bateu a meta de telefones ${quando} (${r.telefones} de ${r.metaTelefones})`, mensagem: `Lolis, ${r.telefones} telefones ${quando}, bateu a meta! Mandou muito bem 👏` });
  if (r.total > 0 && r.feitas === r.total)
    out.push({ id: `tudo:${r.date}`, titulo: `Fechou todas as ${r.total} tarefas ${quando}`, mensagem: `Lolis, você fechou todas as tarefas ${quando}. Obrigada pelo capricho 💚` });
  if (r.extras.length)
    out.push({
      id: `extra:${r.date}`,
      titulo: `Puxou ${r.extras.length} extra${r.extras.length > 1 ? 's' : ''} do "Acabou? Puxa daqui"`,
      mensagem: `Lolis, vi que você terminou e já puxou ${r.extras.length > 1 ? `${r.extras.length} coisas` : `"${curto(r.extras[0].titulo)}"`} do "Acabou? Puxa daqui". Adoro essa iniciativa, obrigada!`,
    });
  if (r.sorteios > 0 && r.sorteiosOk === r.sorteios)
    out.push({ id: `sorteio-ok:${r.date}`, titulo: `Sorteio ${quando} completo, com parabéns`, mensagem: `Lolis, o sorteio ${quando} ficou redondinho, com parabéns e tudo. Obrigada! 🎉` });
  if (r.entrada && !r.atrasoChegada && r.encerrou && r.minutos >= r.metaMin - 15)
    out.push({ id: `ponto:${r.date}`, titulo: `Chegou no horário e cumpriu a jornada ${quando}`, mensagem: `Lolis, obrigada pela pontualidade ${quando} 💚 Faz muita diferença.` });
  return out;
}

// ── Semana: placar e pauta da conversa de sexta ──
export function semana(resumos, metas) {
  const util = resumos.filter((r) => r.util !== false);
  const tot = util.reduce(
    (a, r) => ({ feitas: a.feitas + r.feitas, total: a.total + r.total, minutos: a.minutos + (r.minutos || 0), telefones: a.telefones + (r.telefones || 0), meta: a.meta + (r.metaTelefones || 0), atrasos: a.atrasos + (r.atrasoChegada ? 1 : 0), extras: a.extras + r.extras.length }),
    { feitas: 0, total: 0, minutos: 0, telefones: 0, meta: 0, atrasos: 0, extras: 0 },
  );
  const travou = util.flatMap((r) => r.naoConsegui.map((x) => ({ ...x, date: r.date })));
  const DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const pauta = [
    'Como foi a semana pra você? O que foi mais tranquilo e o que deu mais trabalho?',
    ...(tot.extras ? [`Você puxou ${tot.extras} extra${tot.extras > 1 ? 's' : ''} do "Acabou? Puxa daqui": o que te ajudou a sobrar tempo?`] : []),
    ...travou.slice(0, 3).map((x) => `Sobre "${curto(x.titulo, 50)}" (não conseguiu na ${DIA[weekday(x.date)]}${x.nota ? `: "${curto(x.nota, 40)}"` : ''}): já deu pra resolver? O que faltou?`),
    ...(tot.meta > 0 && tot.telefones < tot.meta ? [`Os telefones ficaram em ${tot.telefones} de ${tot.meta} da semana. O que ajudaria a render mais (um roteiro, outro horário, outra cidade)?`] : []),
    ...(tot.meta > 0 && tot.telefones >= tot.meta ? [`Os telefones bateram a meta da semana (${tot.telefones} de ${tot.meta}). Qual foi o segredo?`] : []),
    ...(tot.total && tot.feitas < tot.total ? [`Ficaram ${tot.total - tot.feitas} tarefas de ${tot.total} sem fazer. Alguma estava pouco clara ou grande demais?`] : []),
    ...(tot.atrasos ? [`Teve ${tot.atrasos} dia${tot.atrasos > 1 ? 's' : ''} com chegada depois do horário. Está tudo bem com o horário combinado?`] : []),
    'Tem algo que eu posso fazer diferente pra te ajudar?',
    'O que é a prioridade número 1 da semana que vem?',
  ];
  // jornada esperada: só os dias em que ela trabalhou (folga e dias ainda por vir não contam)
  const metaHoras = util.filter((r) => r.entrada).length * ((Number(metas.horasDia) || 4) * 60);
  return { tot, metaHoras, pauta };
}

// ── Cobrança que fica na lista vira tarefa da Laura ──
// reg = { [id]: { desde, tarefa? } }; ativas = cobranças de agora; uteis(desde) = dias úteis de desde até ref
// Devolve o registro novo (o mesmo objeto se nada mudou) e as tarefas a criar.
export function escalar(reg = {}, ativas, ref, uteis, metas) {
  const novo = {};
  const criar = [];
  let mudou = false;
  for (const c of ativas) {
    const r = reg[c.id] || ((mudou = true), { desde: ref });
    if (!r.tarefa && uteis(r.desde) >= (Number(metas.diasEscalar) || 2)) {
      mudou = true;
      novo[c.id] = { ...r, tarefa: ref };
      criar.push({
        title: `Cobrar Lolis: ${c.tarefa || c.titulo}`,
        notes: [
          'Quem: Lolis (estagiária da RANKEN).',
          `O que aconteceu: ${c.porque}`,
          `Está na lista "O que cobrar" do Acompanhamento desde ${ddmm(r.desde)} (${uteis(r.desde)} dias úteis) e não se resolveu.`,
          'O que fazer: conversar com ela (de preferência por mensagem ou na conversa de sexta), entender o que travou e combinar um novo prazo ou passar para outra pessoa.',
          `Mensagem pronta:\n${c.mensagem}`,
        ].join('\n'),
      });
    } else novo[c.id] = r;
  }
  if (Object.keys(reg).some((id) => !novo[id])) mudou = true; // saiu da lista: resolveu
  return { reg: mudou ? novo : reg, criar };
}

// dias úteis entre duas datas (sem contar a primeira)
export function diasUteisEntre(de, ate, ehUtil) {
  let n = 0;
  for (let d = addDays(de, 1); d <= ate; d = addDays(d, 1)) if (ehUtil(d)) n++;
  return n;
}
export const segundaDe = (d) => addDays(d, -((weekday(d) + 6) % 7));
export { diffDays };
