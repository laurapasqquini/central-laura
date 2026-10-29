// Testes do "colar do Excel" da aba Plano (rodar com: npm test). Usa números de exemplo, não os da previsão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerColagem } from '../src/lib/plano.js';

const T = (...linhas) => linhas.map((l) => l.join('\t')).join('\n');

test('lê meses, total de pagantes e receita do resumo', () => {
  const r = lerColagem(T(['Indicador', 'Out/26', 'Nov/26', 'Jan/27'], ['Atletas pagantes — TOTAL', '100', '110', '200'], ['Receita mensal*', '5000,5', '5.100,00', '9000']));
  assert.deepEqual(r.meses, { '2026-10': { pagantes: 100, receita: 5001 }, '2026-11': { pagantes: 110, receita: 5100 }, '2027-01': { pagantes: 200, receita: 9000 } });
});

test('lê as praças da tabela de atletas, e não as da tabela de receita', () => {
  const r = lerColagem(
    T(
      ['Atletas pagantes por cidade'],
      ['Cidade', 'Esporte', 'Out/26', 'Jan/27'],
      ['Cidade A', 'Tênis', '40', '45'],
      ['Cidade B', 'Beach Tennis', '0', '20'],
      ['Subtotal Tênis', '', '40', '45'],
      ['TOTAL', '', '40', '65'],
      ['Receita mensal por cidade (R$)*'],
      ['Cidade', 'Esporte', 'Out/26', 'Jan/27'],
      ['Cidade A', 'Tênis', '1996', '2245,5'],
      ['TOTAL', '', '1996', '2245,5'],
    ),
  );
  assert.equal(r.pracas.length, 2);
  assert.deepEqual(r.pracas[0], { id: 'Cidade A|Tênis', cidade: 'Cidade A', esporte: 'Tênis', operando: true, metas: { '2026-10': 40, '2027-01': 45 } });
  assert.equal(r.pracas[1].operando, false);
  assert.deepEqual(r.meses, { '2026-10': { pagantes: 40 }, '2027-01': { pagantes: 65 } });
});

test('sem a linha dos meses, conta a partir do mês inicial', () => {
  const r = lerColagem(T(['Cidade C', 'Padel', '3', '4']), '2027-01');
  assert.deepEqual(r.pracas[0].metas, { '2027-01': 3, '2027-02': 4 });
});
