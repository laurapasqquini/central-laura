// Radar: iniciativas que a Laura poderia estar puxando, com antecedência.
// Cada sugestão aparece a partir de "desde" e tem um "prazo" para virar ação.
// Ela aceita (vira iniciativa no Plano) ou descarta.
import { CALENDARIOS, fimEtapa } from './calendarios';

const add = (s, n) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const br = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export const FRENTES = [
  { id: 'beach', nome: 'Beach Tennis', icone: '🏖️' },
  { id: 'tenis', nome: 'Tênis', icone: '🎾' },
  { id: 'expansao', nome: 'Expansão', icone: '🗺️' },
  { id: 'patrocinio', nome: 'Patrocínios', icone: '🤝' },
  { id: 'padel', nome: 'Padel', icone: '🏓' },
  { id: 'gestao', nome: 'Gestão e processos', icone: '⚙️' },
];

export function radar(ref) {
  const out = [];
  const ano = Number(ref.slice(0, 4));
  const prox = ano + 1;

  out.push({
    id: 'alinhamento-chefes',
    titulo: 'Reunião de alinhamento com os chefes',
    porque: 'Combinar prioridades do fim de ano, o que eles querem acompanhar (números, frequência, formato) e quais frentes ficam com você.',
    frente: 'gestao',
    desde: ref,
    prazo: add(ref, 7),
  });

  // Fim de etapa: reinscrição, pesquisa e premiação, por cidade e esporte
  const grupos = {};
  for (const c of CALENDARIOS) {
    const k = `${c.cidade}|${c.esporte}`;
    const fim = fimEtapa(c);
    if (!grupos[k] || fim > grupos[k].fim) grupos[k] = { cidade: c.cidade, esporte: c.esporte, fim };
  }
  for (const g of Object.values(grupos)) {
    const nome = `${g.esporte === 'beach' ? 'Beach' : 'Tênis'} ${g.cidade}`;
    const frente = g.esporte === 'beach' ? 'beach' : 'tenis';
    const slug = `${g.esporte}-${g.cidade}`.toLowerCase().normalize('NFD').replace(/[^a-z-]/g, '');
    out.push({
      id: `reinscricao-${slug}-${g.fim}`,
      titulo: `Reinscrição da próxima etapa · ${nome}`,
      porque: `A etapa termina em ${br(g.fim)}. Planejar com 30 dias de antecedência: datas da próxima etapa, condição para quem renovar cedo, mensagem e meta de renovação.`,
      frente,
      desde: add(g.fim, -50),
      prazo: add(g.fim, -30),
    });
    out.push({
      id: `pesquisa-${slug}-${g.fim}`,
      titulo: `Pesquisa de satisfação no fim da etapa · ${nome}`,
      porque: 'Um formulário curto na última rodada vira dado para propor melhorias (e argumento para patrocinador).',
      frente,
      desde: add(g.fim, -35),
      prazo: add(g.fim, -14),
    });
    out.push({
      id: `premiacao-${slug}-${g.fim}`,
      titulo: `Troféus e premiação do fim de etapa · ${nome}`,
      porque: `Orçamentos com 45 dias de antecedência evitam correria e preço alto (fim de etapa ${br(g.fim)}).`,
      frente,
      desde: add(g.fim, -60),
      prazo: add(g.fim, -40),
    });
  }

  out.push({
    id: `patrocinio-${prox}`,
    titulo: `Patrocinadores ${prox}`,
    porque: 'O ano vira em breve: listar os atuais (renovam?), o que entregamos a eles, novos alvos por cidade e montar a proposta comercial.',
    frente: 'patrocinio',
    desde: `${ano}-09-15`,
    prazo: `${ano}-11-15`,
  });
  out.push({
    id: `calendario-${prox}`,
    titulo: `Calendário das etapas de ${prox} (1º semestre)`,
    porque: 'Ter as datas antes do fim do ano ajuda na reinscrição, na divulgação e na conversa com patrocinadores.',
    frente: 'gestao',
    desde: `${ano}-10-01`,
    prazo: `${ano}-12-01`,
  });
  out.push({
    id: `confra-${ano}`,
    titulo: 'Confraternização de fim de ano',
    porque: 'O regulamento pede o anúncio 30 dias antes, já com valores. Com as etapas acabando em dezembro, a data precisa sair logo.',
    frente: 'gestao',
    desde: `${ano}-10-01`,
    prazo: `${ano}-11-10`,
  });
  out.push({
    id: `beach-meta-${ano}`,
    titulo: 'Meta de crescimento do Beach para a próxima etapa',
    porque: 'Você está à frente do Beach: propor uma meta de inscritos por classe e o plano para chegar lá (indicação, parceiros, novas categorias).',
    frente: 'beach',
    desde: `${ano}-10-01`,
    prazo: `${ano}-11-20`,
  });
  out.push({
    id: 'campanha-volta',
    titulo: 'Campanha de volta para cancelados e inadimplentes',
    porque: 'Quem já jogou é o público mais barato de reconquistar: uma oferta de retorno para a próxima etapa.',
    frente: 'beach',
    desde: ref,
    prazo: null,
  });
  out.push({
    id: 'expansao-proxima',
    titulo: 'Próxima cidade da expansão',
    porque: 'Com Cascavel e Cianorte em andamento no Hub, já deixar a próxima candidata pesquisada (a Lolis pode levantar quadras e professores).',
    frente: 'expansao',
    desde: ref,
    prazo: null,
  });
  out.push({
    id: 'padel-lancamento',
    titulo: 'Proposta de lançamento do Padel',
    porque: 'Data de início, cidade, locais parceiros e meta de inscritos para levar aos chefes.',
    frente: 'padel',
    desde: ref,
    prazo: null,
  });
  out.push({
    id: 'manual-lolis',
    titulo: 'Manual da Lolis (mensagens padrão e passo a passo)',
    porque: 'Documentar o que ela faz libera seu tempo e prepara a equipe para crescer com a expansão.',
    frente: 'gestao',
    desde: ref,
    prazo: null,
  });

  return out.filter((r) => r.desde <= ref && (!r.prazo || r.prazo >= add(ref, -30))).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
}
