// Conteúdo inicial da central, tirado do Checklist RANKEN.
// freq: 'daily' (seg a sex) | 'weekly' (weekday 0-6) | 'monthly' (monthday 1-31)

let n = 0;
const id = (p) => `${p}${++n}`;

const r = (title, who, freq, extra = {}, area = 'ranken') => ({ id: id('r'), title, area, who, freq, active: true, ...extra });

export const seedRoutines = () => [
  // Diárias
  r('Responder o WhatsApp da RANKEN', 'laura', 'daily'),
  r('Publicar o sorteio diário no grupo do WhatsApp', 'lolis', 'daily'),
  r('Postar o sorteio diário no Instagram', 'lolis', 'daily'),
  r('Cobrar mensalidades Pix de hoje e as atrasadas', 'laura', 'daily'),
  r('Conferir 6x0 6x0 novos e avisar os ganhadores', 'lolis', 'daily'),
  r('Conferir novas inscrições e mandar boas-vindas', 'lolis', 'daily'),
  r('Zerar os atrasados do Hub antes de encerrar o dia', 'laura', 'daily'),
  // Semanais
  r('Avisar quem tem 2 resultados pendentes (risco de suspensão)', 'lolis', 'weekly', { weekday: 1 }),
  r('Suspensos e sem adversário: tentar encaixes (até a 9ª rodada)', 'laura', 'weekly', { weekday: 1 }),
  r('Conferir WOs e pedidos de substituição', 'laura', 'weekly', { weekday: 2 }),
  r('Postagem da semana: destaques, ganhadores, ranking', 'lolis', 'weekly', { weekday: 3 }),
  r('Sorteio semanal de brindes (só quem está em dia)', 'laura', 'weekly', { weekday: 4 }),
  r('Avisar ganhadores dos brindes: local e prazo de 7 dias', 'lolis', 'weekly', { weekday: 4 }),
  r('Lembrar no grupo: licenciamento até domingo 19h59', 'lolis', 'weekly', { weekday: 5 }),
  r('Revisar inadimplentes e o placar da semana no Hub', 'laura', 'weekly', { weekday: 5 }),
  r('Checar a retirada dos brindes da semana passada', 'lolis', 'weekly', { weekday: 5 }),
  r('Conferência da semana com a Lolis (15 min)', 'laura', 'weekly', { weekday: 5 }),
  r('Planejar a próxima semana aqui na Central', 'laura', 'weekly', { weekday: 5 }, 'pessoal'),
  // Mensais
  r('Fechar o mês: MRR, pagantes, inscrições, churn, inadimplentes', 'laura', 'monthly', { monthday: 1 }),
  r('Efetivar cancelamentos que completaram 30 dias', 'laura', 'monthly', { monthday: 1 }),
  r('Lançar o desafio mensal dos atletas', 'laura', 'monthly', { monthday: 1 }),
  r('Revisar contas a pagar do mês', 'laura', 'monthly', { monthday: 1 }, 'pessoal'),
  r('Contar o estoque (camisetas, kits, bolinhas, troféus)', 'lolis', 'monthly', { monthday: 5 }),
  r('Pedir orçamentos e repor o que está acabando', 'laura', 'monthly', { monthday: 8 }),
  r('Patrocinadores e apoiadores: brindes e contrapartidas', 'laura', 'monthly', { monthday: 10 }),
  r('Atualizar academias e arenas: preços, horários, cupons', 'lolis', 'monthly', { monthday: 15 }),
  r('Revisar categorias com menos de 14 duplas', 'laura', 'monthly', { monthday: 20 }),
  r('Pesquisar cidades e modalidades novas (Beach, Tênis, Padel)', 'laura', 'monthly', { monthday: 25 }),
];

// Roteiros: cada item tem um prazo contado a partir do início (ou do fim) do projeto.
const i = (phase, title, offset, who = 'laura', anchor = 'start', urgent = false) => ({ phase, title, offset, who, anchor, urgent });

export const TEMPLATES = [
  {
    id: 'abrir-cidade',
    name: 'Abrir cidade ou modalidade',
    desc: 'Roteiro do quadro branco, passo a passo: a Lolis pesquisa e faz o primeiro contato; você negocia e decide.',
    area: 'ranken',
    startLabel: 'Início da etapa',
    endLabel: 'Fim da etapa (opcional)',
    items: [
      i('1. Estratégia', 'Definir cidade e modalidade e passar a pesquisa para a Lolis', -43),
      i('1. Estratégia', 'Ficha da cidade: listar academias, arenas e clubes (quadras, coberta, horários, preço da hora, aulas)', -42, 'lolis'),
      i('1. Estratégia', 'Ficha da cidade: descobrir dono ou gerente de cada local e o contato direto', -40, 'lolis'),
      i('1. Estratégia', 'Ficha da cidade: listar professores (onde dão aula, nº de alunos, contato)', -40, 'lolis'),
      i('1. Estratégia', 'Ficha da cidade: ligas e torneios existentes + possíveis apoiadores perto das quadras', -36, 'lolis'),
      i('1. Estratégia', 'Aprovar a mensagem padrão de apresentação da RANKEN', -36),
      i('1. Estratégia', 'Primeiro contato com locais, professores e apoiadores; marcar conversas com a Laura', -35, 'lolis'),
      i('1. Estratégia', 'Conversar com donos de academias e arenas: parceria e preço RANKEN', -33),
      i('1. Estratégia', 'Conversar com professores: cupom de indicação', -32),
      i('1. Estratégia', 'Conversar com apoiadores: brindes em troca de divulgação', -31),
      i('1. Estratégia', 'Registrar na ficha o resultado de cada conversa e resumir', -29, 'lolis'),
      i('1. Estratégia', 'DECIDIR se abre a cidade; definir categorias e datas das rodadas', -28, 'laura', 'start', true),
      i('1. Estratégia', 'Criar o torneio no app e os grupos de WhatsApp (recados, masculino, feminino)', -26, 'lolis'),
      i('1. Estratégia', 'Montar a lista de locais parceiros para o regulamento', -26, 'lolis'),
      i('1. Estratégia', 'Conferir estoque e cotar kit e troféus (3 orçamentos)', -26, 'lolis'),
      i('1. Estratégia', 'Aprovar regulamento, kit e premiação', -22),
      i('2. Divulgação', 'Pedir as artes e montar o calendário de posts', -27, 'lolis'),
      i('2. Divulgação', 'Adaptar o texto "o que é a RANKEN" para a cidade', -27, 'lolis'),
      i('2. Divulgação', 'Listar torneios e eventos da cidade, com custo', -25, 'lolis'),
      i('2. Divulgação', 'Aprovar artes e textos; decidir em quais eventos ir', -23),
      i('2. Divulgação', 'Postar e mandar o material para professores e parceiros', -21, 'lolis'),
      i('3. Inscrições', 'Abrir as inscrições e começar as vendas (WhatsApp e presencial)', -14, 'laura', 'start', true),
      i('3. Inscrições', 'Definir meta diária de inscrições e meta por classe', -14),
      i('3. Inscrições', 'Contagem diária de inscritos por classe (avisar se alguma estiver abaixo de 14 duplas)', -13, 'lolis'),
      i('3. Inscrições', 'Lembrar os professores do cupom de indicação', -10, 'lolis'),
      i('3. Inscrições', 'Conferir a meta: reforçar divulgação ou juntar categorias', -7),
      i('3. Inscrições', 'Checar o mínimo de 14 duplas por categoria', -2, 'laura', 'start', true),
      i('4. Etapa', 'Onboarding: boas-vindas e como funciona', 0),
      i('4. Etapa', 'Reforçar como funciona (1ª semana)', 7),
      i('4. Etapa', 'Contato com quem ainda não jogou', 28),
      i('5. Encerramento', 'Reforçar a meta de jogos e resultados pendentes', -14, 'laura', 'end'),
      i('5. Encerramento', 'Fechar a classificação e aplicar sobe e desce', 0, 'laura', 'end'),
      i('5. Encerramento', 'Mini confra com entrega de troféus', 0, 'laura', 'end'),
      i('6. Reinscrição', 'Campanha de reinscrição para todos os ativos', 2, 'laura', 'end'),
      i('6. Reinscrição', 'Campanha de indicação (atleta traz atleta)', 5, 'laura', 'end'),
      i('6. Reinscrição', 'Contato individual com quem não se reinscreveu', 12, 'laura', 'end'),
    ],
  },
  {
    id: 'confra',
    name: 'Confraternização',
    desc: 'Festa de fim de etapa. O anúncio precisa sair 30 dias antes, já com os valores.',
    area: 'ranken',
    startLabel: 'Data da festa',
    items: [
      i('Planejar', 'Definir data e local', -60),
      i('Planejar', 'Orçamentos: comida, música ao vivo, recreação', -50),
      i('Planejar', 'Definir valores: atleta ativo x convidado', -45),
      i('Anunciar', 'ANUNCIAR a confraternização com os valores (prazo do regulamento)', -30, 'laura', 'start', true),
      i('Anunciar', 'Encomendar troféus de todas as classes', -30),
      i('Preparar', 'Separar brindes para o sorteio do evento', -21, 'lolis'),
      i('Preparar', 'Confirmar todos os fornecedores', -7),
      i('Preparar', 'Separar premiação em dinheiro da Classe 1 (R$ 400, 300 e 200)', -3),
      i('Dia', 'Dia da confraternização', 0, 'laura', 'start', true),
    ],
  },
  {
    id: 'atleta-novo',
    name: 'Atleta novo',
    desc: 'Passo a passo quando alguém entra. Use o nome do atleta.',
    area: 'ranken',
    startLabel: 'Data de entrada',
    items: [
      i('Entrada', 'Conferir cadastro completo no app (foto e Instagram)', 0),
      i('Entrada', 'Confirmar a classe de entrada', 0),
      i('Entrada', 'Boas-vindas: regulamento e grupo do WhatsApp', 0),
      i('Entrada', 'Se entrou no meio da etapa: casar jogos de rodadas passadas', 1),
      i('Entrada', 'Entregar o kit de boas-vindas', 3, 'lolis'),
    ],
  },
  {
    id: 'atleta-saindo',
    name: 'Atleta saindo',
    desc: 'Cancelamento com aviso de 30 dias.',
    area: 'ranken',
    startLabel: 'Data do aviso',
    items: [
      i('Saída', 'Registrar a data do aviso no Hub', 0),
      i('Saída', 'Trocar os jogos de quem tinha esse atleta como adversário', 1),
      i('Saída', 'Confirmar pelo WhatsApp e efetivar o cancelamento', 30, 'laura', 'start', true),
    ],
  },
];

export const seedTasks = (hoje) => [
  { id: id('t'), title: 'Revisar o Checklist RANKEN e mandar pro chefe', area: 'ranken', who: 'laura', due: hoje, urgent: true },
  { id: id('t'), title: 'Cobrar as 5 mensalidades Pix atrasadas', area: 'ranken', who: 'laura', due: hoje, urgent: true },
  { id: id('t'), title: 'Decidir data e local da confraternização (anúncio até 04/11)', area: 'ranken', who: 'laura', due: '2026-10-09', urgent: false },
  { id: id('t'), title: 'Mapeamento de quadras de tênis no Brasil (em andamento)', area: 'ranken', who: 'lolis', due: null },
  { id: id('t'), title: 'Definir data de início do Padel', area: 'ranken', who: 'laura', due: '2026-10-16' },
  { id: id('t'), title: 'Mandar a planilha de preços da Gralha pra Central', area: 'gralha', who: 'laura', due: '2026-10-06' },
];

// Datas que não são tarefa, mas precisam aparecer (marcos).
export const seedMarcos = () => [
  { id: id('m'), title: 'Sorteio Maringá Masc (5ª) e Fem (2ª) às 20h', date: '2026-10-04', area: 'ranken' },
  { id: id('m'), title: 'Sorteio Londrina (7ª) às 20h', date: '2026-10-11', area: 'ranken' },
  { id: id('m'), title: 'Prazo para anunciar a confraternização', date: '2026-11-04', area: 'ranken' },
  { id: id('m'), title: 'Último dia de encaixes em Londrina', date: '2026-11-22', area: 'ranken' },
  { id: id('m'), title: 'Último dia de encaixes em Maringá Masc', date: '2026-11-29', area: 'ranken' },
  { id: id('m'), title: 'Fim do ciclo 02 em Londrina', date: '2026-12-04', area: 'ranken' },
  { id: id('m'), title: 'Fim do ciclo 02 em Maringá Masc', date: '2026-12-11', area: 'ranken' },
  { id: id('m'), title: 'Fim do ciclo 02 em Maringá Fem', date: '2026-12-13', area: 'ranken' },
];
