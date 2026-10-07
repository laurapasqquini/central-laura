import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { today, addDays, nextWorkday } from './dates';
import { seedRoutines, seedTasks, seedMarcos, TEMPLATES } from './seed';
import { buildAgenda, dadosPaginaLolis } from './engine';
import { INDICADORES_PADRAO } from './chefes';

// Os dados ficam no Supabase (nuvem) e com uma cópia no navegador (localStorage).
// Tudo é salvo como um único documento por usuária, sincronizado entre PC e iPhone.

const KEY = 'central-laura:v1';
const uid = () => crypto.randomUUID().slice(0, 8);

function initial() {
  const hoje = today();
  return {
    version: 18,
    createdAt: hoje,
    tasks: seedTasks(hoje).map((t) => ({ done: false, createdAt: hoje, postponed: 0, notes: '', ...t })),
    routines: seedRoutines().map((r) => ({ ...r, createdAt: hoje })),
    routineDone: {},
    projects: [],
    marcos: seedMarcos(),
  };
}

// Ajustes que chegam com novas versões da Central e precisam valer para dados já salvos.
const PIX = 'Cobrar mensalidades Pix de hoje e as atrasadas';
const PIX_LOLIS = 'Mandar a 1ª mensagem de cobrança Pix (vencimentos do dia)';
const MAPEAMENTO = 'Mapeamento de quadras de tênis no Brasil (em andamento)';

function migrate(s) {
  if (!s) return s;
  const hoje = today();
  const nova = (title, who, freq, extra) => ({ id: uid(), title, area: 'ranken', who, freq, active: true, createdAt: hoje, ...extra });
  const tarefa = (title, due, who = 'laura') => ({ id: uid(), title, area: 'ranken', who, due, urgent: false, done: false, createdAt: hoje, postponed: 0, notes: '' });

  // v2: boas-vindas passa para a Lolis, conferência semanal e preparação da delegação
  if ((s.version || 1) < 2) {
    s = {
      ...s,
      version: 2,
      routines: [
        ...s.routines.map((r) => (r.title === 'Conferir novas inscrições e mandar boas-vindas' ? { ...r, who: 'lolis' } : r)),
        nova('Conferência da semana com a Lolis (15 min)', 'laura', 'weekly', { weekday: 5 }),
      ],
      tasks: [
        tarefa('Escrever as mensagens padrão da Lolis (boas-vindas, 6x0, brindes, pendências, licenciamento)', nextWorkday(hoje)),
        tarefa('Confirmar os acessos da Lolis: Hub, grupos do WhatsApp e Instagram', nextWorkday(hoje)),
        ...s.tasks,
      ],
    };
  }

  // v3: Pix fica só com a Laura (sai do número da empresa dela); mapeamento de quadras com a Lolis
  if (s.version < 3) {
    s = {
      ...s,
      version: 3,
      routines: s.routines
        .filter((r) => r.title !== PIX_LOLIS)
        .map((r) => (r.title === 'Cobrar o Pix de quem não pagou após a 1ª mensagem' ? { ...r, title: PIX, who: 'laura' } : r)),
      tasks: [
        ...(s.tasks.some((t) => t.title === MAPEAMENTO) ? [] : [tarefa(MAPEAMENTO, null, 'lolis')]),
        ...s.tasks.map((t) => (t.title.startsWith('Escrever as mensagens padrão da Lolis (Pix, ') ? { ...t, title: t.title.replace('(Pix, ', '(') } : t)),
      ],
    };
  }
  // v4: boas-vindas é automática (número da RANKEN na Meta); a Lolis só confere o cadastro
  if (s.version < 4) {
    s = {
      ...s,
      version: 4,
      routines: s.routines.map((r) =>
        r.title === 'Conferir novas inscrições e mandar boas-vindas' ? { ...r, title: 'Conferir se o cadastro dos novos inscritos está completo (foto, Instagram)', who: 'lolis' } : r
      ),
      tasks: s.tasks.map((t) => (t.title.startsWith('Escrever as mensagens padrão da Lolis (boas-vindas, ') ? { ...t, title: t.title.replace('(boas-vindas, ', '(') } : t)),
    };
  }
  // v5: pendências encontradas no Hub em 02/10 (Cianorte, Cascavel e Maringá)
  if (s.version < 5) {
    const t = (title, due, extra = {}) => ({ ...tarefa(title, due), ...extra });
    const seg = nextWorkday(hoje);
    s = {
      ...s,
      version: 5,
      tasks: [
        t('Passar para a Lolis a pesquisa de Cascavel: telefones dos 18 locais, apoiadores e professores', hoje, { hub: true, urgent: true }),
        t('Passar para a Lolis a pesquisa de Cianorte: apoiadores, local dos kits e professores', hoje, { hub: true, urgent: true }),
        t('Maringá: mandar no grupo a reta final da rodada 5 (prazo, resultado no app, próximo sorteio)', hoje, { urgent: true }),
        t('Definir quem cuida dos itens sem responsável em Cianorte e Cascavel (donos, clubes, síndicos, apoiadores)', seg, { hub: true }),
        t('Colocar o banner da cidade no grupo do WhatsApp: Cianorte (prazo 04/10) e Cascavel (06/10)', seg),
        t('Maringá: avisar no grupo que saíram os jogos da rodada 6', seg),
        t('Maringá: marcar na rotina do projeto o que já foi feito nas rodadas 1 a 5', seg, { hub: true }),
        t('Avisar o Yorran: sorteio da rodada 9 de Maringá está depois do início da rodada (corrigir no app)', seg),
        t('Planejar as campanhas push de Maringá: data, público e texto de cada aviso por rodada', addDays(seg, 1)),
        ...s.tasks,
      ],
    };
  }
  // v6: Cascavel e Cianorte viram uma tarefa só, sem data (a Laura define quando delegar)
  if (s.version < 6) {
    const juntar = [
      'Passar para a Lolis a pesquisa de Cascavel: telefones dos 18 locais, apoiadores e professores',
      'Passar para a Lolis a pesquisa de Cianorte: apoiadores, local dos kits e professores',
      'Definir quem cuida dos itens sem responsável em Cianorte e Cascavel (donos, clubes, síndicos, apoiadores)',
      'Colocar o banner da cidade no grupo do WhatsApp: Cianorte (prazo 04/10) e Cascavel (06/10)',
    ];
    const notas = [
      'Pesquisa para passar à Lolis (pelo Hub):',
      '• Cascavel: telefone do responsável de cada local (0 de 18 levantados), possíveis apoiadores e local dos kits, professores com WhatsApp',
      '• Cianorte: possíveis apoiadores e local dos kits, professores com WhatsApp',
      '',
      'Também no Hub:',
      '• Itens sem responsável nos dois projetos: conversas com donos, clubes, síndicos e apoiadores',
      '• Banner da cidade no grupo do WhatsApp (Hub marca prazo 04/10 Cianorte e 06/10 Cascavel)',
    ].join('\n');
    const unica = { ...tarefa('Cascavel e Cianorte: passar a pesquisa pra Lolis e organizar o que falta', null), hub: true, notes: notas };
    s = { ...s, version: 6, tasks: [unica, ...s.tasks.filter((t) => !juntar.includes(t.title))] };
  }

  // v7: o app está certo (sorteio da rodada 9 de duplas é 15/11); o alerta era do Hub
  if (s.version < 7) {
    s = { ...s, version: 7, tasks: s.tasks.filter((t) => !t.title.startsWith('Avisar o Yorran: sorteio da rodada 9')) };
  }

  // v8: lembretes de Maringá agora vêm dos calendários oficiais (src/data/calendarios.js)
  if (s.version < 8) {
    const velhos = ['Sorteio Maringá Masc (5ª) e Fem (2ª) às 20h', 'Último dia de encaixes em Maringá Masc', 'Fim do ciclo 02 em Maringá Masc', 'Fim do ciclo 02 em Maringá Fem'];
    s = { ...s, version: 8, marcos: s.marcos.filter((m) => !velhos.includes(m.title)) };
  }

  // v9: "melhores da rodada" agora sai do calendário; a postagem semanal antiga fica desligada
  if (s.version < 9) {
    s = { ...s, version: 9, routines: s.routines.map((r) => (r.title === 'Postagem da semana: destaques, ganhadores, ranking' ? { ...r, active: false } : r)) };
  }

  // v10: Londrina vem do calendário oficial; prazo da confra (04/11) era do PDF e estava errado
  if (s.version < 10) {
    const velhos = ['Sorteio Londrina (7ª) às 20h', 'Último dia de encaixes em Londrina', 'Fim do ciclo 02 em Londrina', 'Prazo para anunciar a confraternização'];
    s = {
      ...s,
      version: 10,
      marcos: s.marcos.filter((m) => !velhos.includes(m.title)),
      tasks: s.tasks.map((x) =>
        x.title === 'Decidir data e local da confraternização (anúncio até 04/11)' ? { ...x, title: 'Decidir data e local da confraternização (anunciar 30 dias antes, com valores)' } : x
      ),
    };
  }
  // v11: começo de semana em 05/10 — rotinas de 02 a 04/10 ficam resolvidas e a reta final da R5 (já encerrada) sai
  if (s.version < 11) {
    const routineDone = { ...s.routineDone };
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-04']) for (const r of s.routines) routineDone[`${r.id}:${d}`] = true;
    s = {
      ...s,
      version: 11,
      routineDone,
      tasks: s.tasks.filter((t) => !t.title.startsWith('Maringá: mandar no grupo a reta final da rodada 5')),
    };
  }
  // v12: compromissos pessoais fixos (com horário, não mudam de dia em feriado)
  if (s.version < 12) {
    const comp = (title, weekday, hora) => ({ id: uid(), title, area: 'pessoal', who: 'laura', freq: 'weekly', weekday, hora, active: true, createdAt: hoje });
    s = { ...s, version: 12, routines: [...s.routines, comp('Terapia', 1, '13:30'), comp('Treino', 3, '17:00')] };
  }
  // v13: aviso de rodada aberta agora sai do calendário, com mensagem pronta
  if (s.version < 13) {
    s = { ...s, version: 13, tasks: s.tasks.filter((t) => t.title !== 'Maringá: avisar no grupo que saíram os jogos da rodada 6') };
  }
  // v14: WOs/substituições e encaixes passam pra Lolis; lista diária pra mandar pra ela
  if (s.version < 14) {
    const praLolis = ['Conferir WOs e pedidos de substituição', 'Suspensos e sem adversário: tentar encaixes (até a 9ª rodada)'];
    s = {
      ...s,
      version: 14,
      routines: [
        { id: uid(), title: 'Mandar pra Lolis a lista de hoje e as sugestões', area: 'ranken', who: 'laura', freq: 'daily', tipo: 'lolis-lista', active: true, createdAt: hoje },
        ...s.routines.map((r) => (praLolis.includes(r.title) ? { ...r, who: 'lolis' } : r)),
      ],
    };
  }
  // v15: o backoffice travou em 06/10; agendar as campanhas da semana logo cedo
  if (s.version < 15) {
    const nota = 'Bloco 1: as 5 do "Já marcou?" de quinta 08/10 às 18h. Bloco 2: Simples Fem, dom 11/10 (último dia R1) e seg 12/10 (R2 no ar). Tudo em Etapas → Campanhas. Se o sistema continuar travado até quinta, mande o "Já marcou?" nos grupos do WhatsApp.';
    s = { ...s, version: 15, tasks: [{ ...tarefa('Agendar as campanhas da semana (blocos 1 e 2): o sistema travou ontem', '2026-10-07'), urgent: true, notes: nota }, ...s.tasks] };
  }
  // v16: os 6x0 são conferidos só na quarta
  if (s.version < 16) {
    s = { ...s, version: 16, routines: s.routines.map((r) => (/^Conferir 6x0/.test(r.title) ? { ...r, title: 'Conferir os 6x0 novos e avisar os ganhadores', freq: 'weekly', weekday: 3 } : r)) };
  }
  // v17: a lista diária da Lolis virou automática (semana na segunda, só o que muda nos outros dias)
  if (s.version < 17) {
    s = { ...s, version: 17, routines: s.routines.filter((r) => r.tipo !== 'lolis-lista') };
  }
  // v18: conferir foto/Instagram dos inscritos não é algo que a RANKEN faz
  if (s.version < 18) {
    s = { ...s, version: 18, routines: s.routines.filter((r) => !/^Conferir se o cadastro dos novos inscritos/.test(r.title)) };
  }
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return initial();
}

export const STAGES = [
  { id: 'enviado', label: 'Orçamento enviado', task: (c) => `Follow-up do orçamento: ${c}`, days: 2 },
  { id: 'arte', label: 'Arte com o marketing', task: (c) => `Cobrar arte do marketing: ${c}`, days: 2 },
  { id: 'aprovacao', label: 'Arte em aprovação', task: (c) => `Cobrar aprovação da arte: ${c}`, days: 2 },
  { id: 'fechado', label: 'Fechado', task: (c) => `Gerar contrato: ${c}`, days: 0, urgent: true },
  { id: 'contrato', label: 'Contrato enviado', task: (c) => `Conferir pagamento dos 50%: ${c}`, days: 3 },
  { id: 'perdido', label: 'Perdido' },
];

function stageTask(pedidoId, cliente, stage) {
  const st = STAGES.find((x) => x.id === stage);
  if (!st?.task) return null;
  return {
    id: uid(),
    title: st.task(cliente),
    area: 'gralha',
    who: 'laura',
    urgent: !!st.urgent,
    due: addDays(today(), st.days),
    pedidoId,
    done: false,
    createdAt: today(),
    postponed: 0,
    notes: '',
  };
}

const Ctx = createContext(null);

// Textos das notificações vão numa coluna à parte; se falhar, os dados continuam salvos.
const saveAgenda = (userId, state) =>
  supabase
    .from('central_state')
    .update({ agenda: buildAgenda(state) })
    .eq('user_id', userId)
    .then(() => {}, () => {})
    .then(() => salvarPaginaLolis(state));

// Página da Lolis (link sem login): publica o dia dela sempre que a central salva.
const salvarPaginaLolis = (state) =>
  state.lolisToken
    ? supabase
        .from('lolis_pagina')
        .upsert({ token: state.lolisToken, dados: dadosPaginaLolis(state), updated_at: new Date().toISOString() })
        .then(() => {}, () => {})
    : null;

export function StoreProvider({ user, children }) {
  const [state, setState] = useState(load);
  const [sync, setSync] = useState('loading'); // loading | ok | saving | offline
  const ready = useRef(false);
  const lastJson = useRef(null); // o que a nuvem tem: evita salvar de volta o que acabou de chegar

  // Cópia local: abre rápido e funciona sem internet.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state]);

  // Ao entrar: puxa da nuvem. Se a nuvem estiver vazia, sobe o que está aqui.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const { data, error } = await supabase.from('central_state').select('data').eq('user_id', user.id).maybeSingle();
      if (!alive) return;
      if (error) return setSync('offline');
      if (data) {
        const migrated = migrate(data.data);
        // se a migração mudou algo, lastJson fica com a versão antiga e o efeito de salvar sobe a nova
        lastJson.current = JSON.stringify(data.data);
        setState(migrated);
      } else {
        await supabase.from('central_state').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
        lastJson.current = JSON.stringify(state);
      }
      ready.current = true;
      setSync('ok');
      saveAgenda(user.id, data ? migrate(data.data) : state);
      puxarEntrada();
    };

    // Mensagens que a extensão do WhatsApp mandou: viram tarefa de hoje e saem da caixa de entrada.
    const puxarEntrada = async () => {
      const { data: rows } = await supabase.from('entrada').select('*').order('created_at');
      if (!alive || !rows?.length) return;
      setState((s0) => {
        // números do Hub (Beach Tênis): vão para Plano › Números da semana, no dia em que chegaram
        let s = s0;
        for (const r of rows.filter((x) => x.conta === 'numeros')) {
          let n = null;
          try {
            n = JSON.parse(r.texto);
          } catch {
            /* ignora */
          }
          if (!n) continue;
          const dia = new Date(r.created_at).toLocaleDateString('sv-SE');
          const pl = { iniciativas: [], ocultos: [], metas: {}, numeros: {}, ...(s.plano || {}) };
          const inds = pl.indicadores || INDICADORES_PADRAO;
          s = {
            ...s,
            plano: {
              ...pl,
              indicadores: [...inds, ...Object.keys(n).filter((k) => !inds.includes(k))].filter((k) => !/^Beach · (inscritos|faturamento do mês)/.test(k)),
              numeros: { ...pl.numeros, [dia]: { ...(pl.numeros[dia] || {}), ...Object.fromEntries(Object.entries(n).map(([k, v]) => [k, String(v)])) } },
            },
          };
        }
        // ganhadores do sorteio diário (Hub): base dos lembretes de brinde da Lolis
        for (const r of rows.filter((x) => x.conta === 'ganhadores')) {
          let lista = null;
          try {
            lista = JSON.parse(r.texto);
          } catch {
            /* ignora */
          }
          if (!Array.isArray(lista)) continue;
          const limite = addDays(today(), -30);
          const g = Object.fromEntries(Object.entries(s.ganhadores || {}).filter(([, x]) => x.data >= limite));
          for (const x of lista) if (x.nome && x.data) g[`${x.data}|${x.nome}|${x.patrocinador}`] = x;
          s = { ...s, ganhadores: g, ganhadoresEm: new Date(r.created_at).toLocaleDateString('sv-SE') };
        }
        // programação do sorteio diário (por cidade e esporte): base dos posts de anúncio e parabéns
        for (const r of rows.filter((x) => x.conta === 'programacao')) {
          let p = null;
          try {
            p = JSON.parse(r.texto);
          } catch {
            /* ignora */
          }
          if (!p?.cidade || !p?.esporte || !p.dias) continue;
          s = { ...s, programacao: { ...(s.programacao || {}), [`${p.cidade}|${p.esporte}`]: { cidade: p.cidade, esporte: p.esporte, dias: p.dias, em: new Date(r.created_at).toLocaleDateString('sv-SE') } } };
        }
        const ja = new Set(s.tasks.map((t) => t.entradaId).filter(Boolean));
        const novas = rows
          .filter((r) => !['numeros', 'ganhadores', 'programacao'].includes(r.conta) && !ja.has(r.id))
          .map((r) => {
            const curto = r.texto.replace(/\s+/g, ' ').trim();
            return {
              id: uid(),
              entradaId: r.id,
              title: `💬 ${r.contato ? `${r.contato}: ` : ''}${curto.length > 90 ? `${curto.slice(0, 90)}…` : curto}`,
              notes: `${r.texto}\n\n— ${r.contato || 'WhatsApp'}${r.hora ? `, ${r.hora}` : ''} (WhatsApp ${r.conta === 'gralha' ? 'Gralha' : 'RANKEN'})`,
              area: r.conta === 'gralha' ? 'gralha' : 'ranken',
              who: 'laura',
              urgent: false,
              due: today(),
              done: false,
              createdAt: today(),
              postponed: 0,
            };
          });
        return novas.length ? { ...s, tasks: [...novas, ...s.tasks] } : s;
      });
      // apaga depois de salvar a central (se apagar antes e a aba fechar, a mensagem se perderia)
      setTimeout(() => supabase.from('entrada').delete().in('id', rows.map((r) => r.id)).then(() => {}, () => {}), 3000);
    };
    pull();

    // Outro aparelho mudou algo: atualiza aqui na hora.
    const ch = supabase
      .channel('central')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'central_state', filter: `user_id=eq.${user.id}` }, (p) => {
        const json = JSON.stringify(p.new?.data);
        if (p.new?.data && json !== lastJson.current) {
          lastJson.current = json;
          setState(migrate(p.new.data));
        }
      })
      .subscribe();
    // canal separado: se a tabela da extensão ainda não existir, não atrapalha a sincronização
    const chEntrada = supabase
      .channel('entrada')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entrada', filter: `user_id=eq.${user.id}` }, () => ready.current && puxarEntrada())
      .subscribe();

    // iPhone: ao voltar para o app, confere se tem novidade.
    const onVis = () => document.visibilityState === 'visible' && ready.current && pull();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      supabase.removeChannel(chEntrada);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Cada mudança vai para a nuvem (agrupando cliques rápidos).
  useEffect(() => {
    if (!ready.current) return;
    const json = JSON.stringify(state);
    if (json === lastJson.current) return;
    setSync('saving');
    const t = setTimeout(async () => {
      const { error } = await supabase.from('central_state').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
      if (error) return setSync('offline');
      lastJson.current = json;
      setSync('ok');
      saveAgenda(user.id, state);
    }, 700);
    return () => clearTimeout(t);
  }, [state, user.id]);

  const actions = useMemo(() => {
    const patchTask = (id, fn) => setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)) }));
    return {
      addTask: (t) =>
        setState((s) => ({
          ...s,
          tasks: [
            { id: uid(), done: false, createdAt: today(), postponed: 0, notes: '', who: 'laura', area: 'ranken', urgent: false, due: null, ...t },
            ...s.tasks,
          ],
        })),
      updateTask: (id, patch) => patchTask(id, () => patch),
      toggleTask: (id) => patchTask(id, (t) => ({ done: !t.done, doneAt: !t.done ? today() : null })),
      postpone: (id, days = 1) =>
        patchTask(id, (t) => ({ due: addDays(t.due && t.due > today() ? t.due : today(), days), postponed: (t.postponed || 0) + 1 })),
      deleteTask: (id) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

      toggleRoutine: (rid, date, valor) =>
        setState((s) => {
          const k = `${rid}:${date}`;
          const routineDone = { ...s.routineDone };
          if (valor !== undefined) {
            if (valor === null) delete routineDone[k];
            else routineDone[k] = valor;
          } else if (routineDone[k]) delete routineDone[k];
          else routineDone[k] = true;
          return { ...s, routineDone };
        }),
      addRoutine: (r) => setState((s) => ({ ...s, routines: [...s.routines, { id: uid(), active: true, createdAt: today(), ...r }] })),
      updateRoutine: (id, patch) => setState((s) => ({ ...s, routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRoutine: (id) => setState((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== id) })),

      createProject: ({ templateId, name, start, end, area }) =>
        setState((s) => {
          const tpl = TEMPLATES.find((t) => t.id === templateId);
          const pid = uid();
          const tasks = tpl.items
            .filter((it) => it.anchor === 'start' || end)
            .map((it) => ({
              id: uid(),
              title: it.title,
              area,
              who: it.who,
              urgent: it.urgent,
              phase: it.phase,
              projectId: pid,
              due: addDays(it.anchor === 'end' ? end : start, it.offset),
              done: false,
              createdAt: today(),
              postponed: 0,
              notes: '',
            }));
          return {
            ...s,
            projects: [{ id: pid, name, templateId, area, start, end: end || null, createdAt: today() }, ...s.projects],
            tasks: [...tasks, ...s.tasks],
          };
        }),
      deleteProject: (id) =>
        setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id), tasks: s.tasks.filter((t) => t.projectId !== id) })),

      addMarco: (m) => setState((s) => ({ ...s, marcos: [...s.marcos, { id: uid(), ...m }] })),
      deleteMarco: (id) => setState((s) => ({ ...s, marcos: s.marcos.filter((m) => m.id !== id) })),

      // Gralha: cada mudança de etapa do pedido fecha a cobrança anterior e cria a próxima.
      addPedido: (p) =>
        setState((s) => {
          const id = uid();
          return {
            ...s,
            pedidos: [{ id, stage: 'enviado', createdAt: today(), history: [{ stage: 'enviado', date: today() }], ...p }, ...(s.pedidos || [])],
            tasks: [stageTask(id, p.cliente, 'enviado'), ...s.tasks],
          };
        }),
      moveStage: (id, stage) =>
        setState((s) => {
          const ped = (s.pedidos || []).find((p) => p.id === id);
          const next = stageTask(id, ped.cliente, stage);
          return {
            ...s,
            pedidos: s.pedidos.map((p) => (p.id === id ? { ...p, stage, history: [...(p.history || []), { stage, date: today() }] } : p)),
            tasks: [
              ...(next ? [next] : []),
              ...s.tasks.map((t) => (t.pedidoId === id && !t.done ? { ...t, done: true, doneAt: today() } : t)),
            ],
          };
        }),
      updatePedido: (id, patch) => setState((s) => ({ ...s, pedidos: s.pedidos.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePedido: (id) =>
        setState((s) => ({ ...s, pedidos: s.pedidos.filter((p) => p.id !== id), tasks: s.tasks.filter((t) => t.pedidoId !== id || t.done) })),

      setMelhoresWho: (who) => setState((s) => ({ ...s, melhoresWho: who })),
      // Plano: iniciativas, radar descartado, metas do mês e números da semana
      // link da Página da Lolis (novo link = o antigo para de funcionar)
      novoLinkLolis: () =>
        setState((s) => {
          const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
          if (s.lolisToken) supabase.from('lolis_pagina').delete().eq('token', s.lolisToken).then(() => {}, () => {});
          return { ...s, lolisToken: token };
        }),
      setPlano: (fn) => setState((s) => ({ ...s, plano: fn({ iniciativas: [], ocultos: [], metas: {}, numeros: {}, ...(s.plano || {}) }) })),
      // contas fixas pessoais (nome, valor, dia do vencimento)
      addConta: (c) => setState((s) => ({ ...s, contas: [...(s.contas || []), { id: uid(), ativo: true, ...c }] })),
      updateConta: (id, patch) => setState((s) => ({ ...s, contas: (s.contas || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteConta: (id) => setState((s) => ({ ...s, contas: (s.contas || []).filter((c) => c.id !== id) })),
      // dá baixa de vários itens de uma vez (tarefas e rotinas)
      darBaixa: (itens) =>
        setState((s) => {
          const ids = new Set(itens.filter((x) => x.kind === 'task').map((x) => x.id));
          const routineDone = { ...s.routineDone };
          for (const x of itens) if (x.kind === 'routine') routineDone[`${x.id}:${x.date}`] = true;
          return { ...s, routineDone, tasks: s.tasks.map((t) => (ids.has(t.id) ? { ...t, done: true, doneAt: today() } : t)) };
        }),
      // relatórios do dia: chave 'relatosLolis' (texto que ela manda) ou 'relatosLaura' (anotações suas)
      setRelato: (chave, date, texto) =>
        setState((s) => {
          const r = { ...(s[chave] || {}) };
          if (texto.trim()) r[date] = texto.trim();
          else delete r[date];
          return { ...s, [chave]: r };
        }),
      setGralhaCfg: (patch) => setState((s) => ({ ...s, gralhaCfg: { comissao: 8, base: 'total', ...(s.gralhaCfg || {}), ...patch } })),
      addFolga: (date, nome) => setState((s) => ({ ...s, folgas: { ...(s.folgas || {}), [date]: nome || 'Folga' } })),
      removeFolga: (date) =>
        setState((s) => {
          const folgas = { ...(s.folgas || {}) };
          delete folgas[date];
          return { ...s, folgas };
        }),
      toggleFeriado: (date) =>
        setState((s) => {
          const ig = s.feriadosIgnorados || [];
          return { ...s, feriadosIgnorados: ig.includes(date) ? ig.filter((d) => d !== date) : [...ig, date] };
        }),
      setCampanha: (id, patch) => setState((s) => ({ ...s, campanhas: { ...(s.campanhas || {}), [id]: { ...((s.campanhas || {})[id] || {}), ...patch } } })),
      setNotif: (patch) =>
        setState((s) => {
          const atual = { manha: true, tarde: true, noite: true, ...(s.notif || {}) };
          return { ...s, notif: { ...atual, ...patch, horarios: { ...(atual.horarios || {}), ...(patch.horarios || {}) } } };
        }),
      replaceAll: (next) => setState(next),
    };
  }, []);

  return <Ctx.Provider value={{ state, sync, user, ...actions }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
