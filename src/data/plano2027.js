// Plano RANKEN nov/2026 → dez/2027: calendário 2027, fases, marcos e frentes (só a estrutura).
// Os NÚMEROS (meta, receita, praças e metas por cidade) não ficam aqui: o repositório é público.
// Eles moram só na conta da Laura (state.plano27.previsao), digitados ou colados do Excel na aba Plano.
// O que muda com o tempo (pagantes reais, checklist das praças) vem do Hub pela extensão.

// Etapas de 2027 (calendário oficial, o mesmo divulgado aos atletas)
export const ETAPAS_2027 = [
  { nome: 'Etapa 01', inicio: '2027-01-17', fim: '2027-05-02' },
  { nome: 'Etapa 02', inicio: '2027-05-09', fim: '2027-08-22' },
  { nome: 'Etapa 03', inicio: '2027-08-29', fim: '2027-12-12' },
];

// Estreia das praças novas: junto com a Etapa 01. O checklist da Expansão começa no Dia −48.
export const ESTREIA = '2027-01-17';
export const DIA_MENOS_48 = '2026-11-30';

// Fases do plano
export const FASES = [
  { id: 'preparar', nome: 'Preparar', de: '2026-11-01', ate: '2027-01-16', resumo: 'Manter a base, fechar 2026 e deixar as praças novas prontas para estrear.' },
  { id: 'lancar', nome: 'Lançar e crescer', de: '2027-01-17', ate: '2027-05-02', resumo: 'Etapa 01 com as praças novas: captar, reter e bater a meta de abril.' },
  { id: 'consolidar', nome: 'Consolidar', de: '2027-05-03', ate: '2027-08-28', resumo: 'Etapa 02 e eventos de agosto: segurar quem entrou e firmar as praças novas.' },
  { id: 'fechar', nome: 'Fechar o ano', de: '2027-08-29', ate: '2027-12-31', resumo: 'Etapa 03, temporada 2028 e o balanço do ano.' },
];

// Marcos da linha do tempo (fixos do calendário + calculados a partir dele)
export const MARCOS = [
  { data: '2026-11-06', titulo: 'Projetos das praças que faltam criados no Hub', tipo: 'prazo' },
  { data: DIA_MENOS_48, titulo: 'Dia −48: checklist da Expansão andando em todas as praças', tipo: 'prazo' },
  { data: '2026-12-10', titulo: 'Reajuste comunicado (Instagram, WhatsApp e app)', tipo: 'prazo' },
  { data: '2026-12-13', titulo: 'Fim das etapas de Beach 2026', tipo: 'etapa' },
  { data: '2026-12-15', titulo: 'Gala anunciada (30 dias antes)', tipo: 'prazo' },
  { data: '2026-12-20', titulo: 'Fim das etapas de Tênis 2026', tipo: 'etapa' },
  { data: '2027-01-01', titulo: 'Reajuste em vigor', tipo: 'marco' },
  { data: '2027-01-14', titulo: 'Gala de confraternização', tipo: 'evento' },
  { data: ESTREIA, titulo: 'Etapa 01 começa · estreia das praças novas', tipo: 'etapa' },
  { data: '2027-04-30', titulo: 'Meta de pagantes de abril', tipo: 'meta' },
  { data: '2027-05-02', titulo: 'Fim da Etapa 01', tipo: 'etapa' },
  { data: '2027-05-09', titulo: 'Etapa 02 começa', tipo: 'etapa' },
  { data: '2027-08-07', titulo: 'Eventos de agosto (07, 14, 21 e 28/08)', tipo: 'evento' },
  { data: '2027-08-22', titulo: 'Fim da Etapa 02', tipo: 'etapa' },
  { data: '2027-08-29', titulo: 'Etapa 03 começa', tipo: 'etapa' },
  { data: '2027-12-12', titulo: 'Fim da Etapa 03', tipo: 'etapa' },
];

// Frentes, iniciativas e passos iniciais (ponto de partida: tudo editável na aba Plano).
// Cada passo pode virar tarefa na lista do dia, com o "porquê" nas notas.
const p = (texto, prazo, porque = '') => ({ texto, prazo, porque });
export const FRENTES_INICIAIS = [
  {
    id: 'lancamentos',
    nome: 'Lançamentos jan/27',
    objetivo: 'Todas as praças da previsão prontas para a estreia da Etapa 01, em 17/01.',
    iniciativas: [
      {
        titulo: 'Toda praça com projeto e responsável no Hub',
        prazo: '2026-11-06',
        passos: [
          p('Criar na Expansão do Hub os projetos das praças novas que faltam (veja em Praças, "sem projeto no Hub")', '2026-11-06', 'Estreiam em 17/01, e o checklist começa no Dia −48 (30/11).'),
          p('Definir quem toca cada praça (Laura, Thales ou Yorran) e pôr no projeto do Hub', '2026-11-06', 'Hoje quase tudo está no nome da Laura, com muitas estreias no mesmo dia.'),
          p('Tirar Itapema (Padel) da lista de lançamentos de janeiro', '2026-11-06', 'Ficou fora do plano de 2027.'),
        ],
      },
      {
        titulo: 'Checklists no ritmo até a estreia',
        prazo: '2027-01-17',
        passos: [
          p('Dia −48: todas as praças com o checklist andando', '2026-11-30', 'Sem começar no Dia −48, a praça não fica pronta para 17/01.'),
          p('Revisão das praças atrasadas (1ª)', '2026-12-11', 'De 15 em 15 dias: ver no Plano quem está vermelho e destravar.'),
          p('Revisão das praças atrasadas (2ª)', '2026-12-23'),
          p('Revisão final: o que não fica pronto para 17/01 entra em fevereiro', '2027-01-08', 'Melhor adiar uma praça do que estrear mal.'),
        ],
      },
    ],
  },
  {
    id: 'base',
    nome: 'Base atual: reinscrição e reajuste',
    objetivo: 'Passar pela virada do ano sem perder atleta (as metas são de saldo).',
    iniciativas: [
      {
        titulo: 'Comunicar o reajuste de janeiro',
        prazo: '2026-12-10',
        passos: [
          p('Texto do comunicado do reajuste aprovado (com o que melhora em 2027)', '2026-12-05', 'O reajuste começa em janeiro e vale também para quem já assina.'),
          p('Publicar no Instagram, nos grupos de WhatsApp e no app', '2026-12-10', 'Avisar com antecedência, antes do fim das etapas de 2026.'),
          p('Acompanhar cancelamentos depois do aviso', '2026-12-20'),
        ],
      },
      {
        titulo: 'Reinscrição para a Etapa 01',
        prazo: '2027-01-16',
        passos: [
          p('Campanha de reinscrição para quem joga hoje (fim das etapas de 2026)', '2026-12-14', 'As etapas de 2026 terminam em 13/12 (Beach) e 20/12 (Tênis); a Etapa 01 começa em 17/01, nas férias.'),
          p('Lembrete de reinscrição no começo de janeiro', '2027-01-05'),
          p('Campanha de volta para cancelados e inadimplentes', '2027-01-10', 'Cada atleta que volta conta no saldo da meta.'),
        ],
      },
    ],
  },
  {
    id: 'fechar2026',
    nome: 'Fechar 2026 e Gala',
    objetivo: 'Encerrar a temporada bem e fazer da Gala (14/01) o pontapé de 2027.',
    iniciativas: [
      {
        titulo: 'Troféus e premiação das etapas de 2026',
        prazo: '2026-12-13',
        passos: [p('Encomendar os troféus', '2026-11-20', 'Com 45 dias de antecedência evita correria e preço alto.')],
      },
      {
        titulo: 'Gala de confraternização (14/01/2027)',
        prazo: '2027-01-14',
        dono: 'Yorran', // ele cuida da maior parte; a Laura acompanha
        passos: [
          p('Local, formato e orçamento da Gala definidos', '2026-11-20'),
          p('Patrocínio da Gala', '2026-12-05'),
          p('Anunciar a Gala com os valores (30 dias antes)', '2026-12-15', 'O regulamento pede o anúncio da confraternização com 30 dias de antecedência.'),
          p('Confirmados e premiação no evento', '2027-01-10'),
        ],
      },
    ],
  },
  {
    id: 'receitas',
    nome: 'Patrocínio e receitas 2027',
    objetivo: 'Receita além das mensalidades e prêmios para os sorteios das praças novas.',
    iniciativas: [
      {
        titulo: 'Patrocinadores 2027',
        prazo: '2026-12-15',
        passos: [
          p('Lista dos patrocinadores atuais: quem renova', '2026-11-20'),
          p('Proposta comercial 2027 (com as praças novas)', '2026-11-30', 'Com mais praças o RANKEN vale mais para o patrocinador.'),
        ],
      },
      {
        titulo: 'Apoiadores dos sorteios nas praças novas',
        prazo: '2027-01-10',
        passos: [p('No mínimo 8 apoiadores por praça nova (pelo checklist da Expansão)', '2027-01-10')],
      },
      {
        titulo: 'Kits de boas-vindas para os novos atletas',
        prazo: '2026-12-01',
        passos: [p('Pedido de kits para as entradas de janeiro (pela meta de janeiro da previsão)', '2026-12-01', 'Cada atleta novo ganha kit de boas-vindas.')],
      },
    ],
  },
  {
    id: 'equipe',
    nome: 'Equipe e processos',
    objetivo: 'Dar conta de muito mais praças sem multiplicar o trabalho manual.',
    iniciativas: [
      {
        titulo: 'Rotinas que aguentam as praças novas',
        prazo: '2027-01-10',
        passos: [
          p('Manual da Lolis (mensagens padrão e passo a passo)', '2026-11-30'),
          p('Base do Bot com as cidades novas (Hub › Base do Bot)', '2027-01-10', 'O atendimento do WhatsApp responde pelas cidades cadastradas.'),
          p('Sorteio diário e grupos de WhatsApp das praças novas', '2027-01-10'),
        ],
      },
    ],
  },
];

// Foco sugerido por mês (até 3): ponto de partida das metas do mês
export const FOCO_SUGERIDO = {
  '2026-11': ['Todas as praças com projeto e responsável no Hub', 'Checklist andando em todas as praças até 30/11 (Dia −48)', 'Gala: local, formato e orçamento definidos'],
  '2026-12': ['Reajuste comunicado até 10/12', 'Campanha de reinscrição no ar', 'Gala anunciada até 15/12'],
  '2027-01': ['Estrear a Etapa 01 nas praças prontas', 'Gala de 14/01 feita', 'Bater a meta de pagantes de janeiro'],
};
