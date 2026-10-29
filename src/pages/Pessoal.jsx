// Pessoal: tarefas pessoais, contas fixas e o financeiro (extratos do Nubank).
import { useState } from 'react';
import ListaDoDia from '../components/ListaDoDia';
import { ContasCard } from '../components/Contas';
import { Segmented } from '../components/ui';
import Financeiro from './Financeiro';

export default function Pessoal() {
  const [aba, setAba] = useState('tarefas');
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-violet-500 align-middle" />
          Pessoal
        </h1>
        <Segmented
          value={aba}
          onChange={setAba}
          options={[
            ['tarefas', 'Tarefas e contas', 'bg-violet-500 text-white ring-transparent'],
            ['financeiro', 'Financeiro', 'bg-violet-500 text-white ring-transparent'],
          ]}
        />
      </header>
      {aba === 'tarefas' ? (
        <>
          <ListaDoDia area="pessoal" />
          <ContasCard />
        </>
      ) : (
        <Financeiro />
      )}
    </div>
  );
}
