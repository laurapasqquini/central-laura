// Pessoal: tarefas pessoais, contas fixas e o financeiro (extratos do Nubank).
import { useState } from 'react';
import ListaDoDia from '../components/ListaDoDia';
import { ContasCard } from '../components/Contas';
import { AbasTopo } from '../components/ui';
import Financeiro from './Financeiro';

export default function Pessoal() {
  const [aba, setAba] = useState('tarefas');
  return (
    <div className="space-y-6">
      <AbasTopo area="pessoal" titulo="Pessoal" abas={[{ id: 'tarefas', label: 'Tarefas e contas' }, { id: 'financeiro', label: 'Financeiro' }]} valor={aba} onChange={setAba} />
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
