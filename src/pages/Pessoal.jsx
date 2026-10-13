// Pessoal: tarefas pessoais e as contas fixas do mês.
import ListaDoDia from '../components/ListaDoDia';
import { ContasCard } from '../components/Contas';

export default function Pessoal() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        <span className="mr-2 inline-block h-3 w-3 rounded-full bg-violet-500 align-middle" />
        Pessoal
      </h1>
      <ListaDoDia area="pessoal" />
      <ContasCard />
    </div>
  );
}
