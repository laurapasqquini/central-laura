// RANKEN: tudo da liga num lugar só. Tarefas (com as do Hub), WhatsApp, Etapas, Plano, Lolis e Relatórios.
import ListaDoDia from '../components/ListaDoDia';
import Etapas from './Etapas';
import Plano from './Plano';
import Lolis from './Lolis';
import Relatorios from './Relatorios';
import WhatsApp from './WhatsApp';
import { useStore } from '../lib/store';
import { totalWhats } from '../lib/whats';
import { AbasTopo } from '../components/ui';

export const SUBABAS_RANKEN = [
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'etapas', label: 'Etapas' },
  { id: 'plano', label: 'Plano' },
  { id: 'lolis', label: 'Lolis' },
  { id: 'relatorios', label: 'Relatórios' },
];

export default function Ranken({ sub = 'tarefas', setSub, go }) {
  const { state } = useStore();
  const whats = totalWhats(state) + state.tasks.filter((t) => t.whats && !t.done).length; // prometi + esperando resposta + tarefas da aba
  return (
    <div className="space-y-5">
      <AbasTopo area="ranken" titulo="Ranken" abas={SUBABAS_RANKEN.map((s) => ({ ...s, badge: s.id === 'whatsapp' ? whats : 0 }))} valor={sub} onChange={setSub} />
      {sub === 'tarefas' && <ListaDoDia area="ranken" />}
      {sub === 'whatsapp' && <WhatsApp />}
      {sub === 'etapas' && <Etapas go={go} />}
      {sub === 'plano' && <Plano go={go} />}
      {sub === 'lolis' && <Lolis go={go} />}
      {sub === 'relatorios' && <Relatorios go={go} />}
    </div>
  );
}
