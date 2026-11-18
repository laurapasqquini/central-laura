// Testes do histórico de inadimplentes (rodar com: npm test). Nomes e ids inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atualizarHistorico, marcarContato, situacao } from '../src/lib/inadimplentes.js';

const ana = { id: '1', stripeCliente: 'cus_teste_ana', status: 'past_due' };
const beto = { id: '2', stripeCliente: 'cus_teste_beto', status: 'unpaid' };

test('primeira vez na lista: 1º contato com a mensagem do status', () => {
  const h = atualizarHistorico({}, [ana, beto], '2026-11-10');
  assert.equal(situacao(h, ana, '2026-11-10').tipo, 'vai');
  assert.equal(situacao(h, beto, '2026-11-10').tipo, 'bloqueado');
  assert.equal(situacao(h, ana, '2026-11-10').pedeAtencao, true);
});

test('frequência: 2º contato 3 dias depois do 1º, 3º 7 dias depois do 2º, e depois "Sem retorno"', () => {
  let h = atualizarHistorico({}, [ana], '2026-11-01');
  h = marcarContato(h, ana, '2026-11-01', '2026-11-01');
  assert.equal(situacao(h, ana, '2026-11-03').pedeAtencao, false);
  let s = situacao(h, ana, '2026-11-04');
  assert.equal(s.pedeAtencao, true);
  assert.equal(s.tipo, 'followup');
  h = marcarContato(h, ana, '2026-11-04', '2026-11-04');
  assert.equal(situacao(h, ana, '2026-11-10').pedeAtencao, false);
  s = situacao(h, ana, '2026-11-11');
  assert.equal(s.pedeAtencao, true);
  assert.equal(s.tipo, 'followup3');
  h = marcarContato(h, ana, '2026-11-11', '2026-11-11');
  s = situacao(h, ana, '2026-11-17');
  assert.equal(s.pedeAtencao, false);
  assert.equal(s.semRetorno, false);
  s = situacao(h, ana, '2026-11-18');
  assert.equal(s.pedeAtencao, false);
  assert.equal(s.semRetorno, true);
});

test('virou bloqueado depois do contato: volta na hora para a lista', () => {
  let h = atualizarHistorico({}, [ana], '2026-11-01');
  h = marcarContato(h, ana, '2026-11-01', '2026-11-01');
  const bloqueada = { ...ana, status: 'unpaid' };
  const s = situacao(h, bloqueada, '2026-11-02');
  assert.equal(s.virouBloqueado, true);
  assert.equal(s.pedeAtencao, true);
  assert.equal(s.tipo, 'followup');
  h = marcarContato(h, bloqueada, '2026-11-02', '2026-11-02');
  assert.equal(situacao(h, bloqueada, '2026-11-03').pedeAtencao, false);
});

test('depois de um contato, a próxima mensagem é o follow-up', () => {
  let h = atualizarHistorico({}, [ana], '2026-11-10');
  h = marcarContato(h, ana, '2026-11-10', '2026-11-10');
  assert.equal(situacao(h, ana, '2026-11-10').tipo, 'vai'); // o contato de hoje ainda é o 1º
  assert.equal(situacao(h, ana, '2026-11-12').pedeAtencao, false);
  h = atualizarHistorico(h, [ana], '2026-11-15');
  const s = situacao(h, ana, '2026-11-15');
  assert.equal(s.tipo, 'followup');
  assert.equal(s.pedeAtencao, true);
  assert.equal(s.contatos, 1);
});

test('desmarcar o "falei hoje" tira só o contato de hoje', () => {
  let h = atualizarHistorico({}, [ana], '2026-11-10');
  h = marcarContato(h, ana, '2026-11-10', '2026-11-10');
  h = marcarContato(h, ana, null, '2026-11-10');
  assert.equal(situacao(h, ana, '2026-11-10').contatos, 0);
});

test('saiu da lista e voltou depois: inadimplente de novo', () => {
  let h = atualizarHistorico({}, [ana], '2026-10-01');
  h = marcarContato(h, ana, '2026-10-01', '2026-10-01');
  h = atualizarHistorico(h, [beto], '2026-10-05'); // pagou: some da lista
  h = atualizarHistorico(h, [beto], '2026-10-09');
  h = atualizarHistorico(h, [ana], '2026-11-20'); // caiu de novo
  const s = situacao(h, ana, '2026-11-20');
  assert.equal(s.reincidente, true);
  assert.equal(s.tipo, 'reincidente');
  assert.equal(s.ultimaVez, '2026-10-01');
  assert.equal(s.contatos, 0);
});

test('uma leitura que falha por um dia não vira reincidência', () => {
  let h = atualizarHistorico({}, [ana], '2026-11-10');
  h = atualizarHistorico(h, [beto], '2026-11-11');
  h = atualizarHistorico(h, [ana], '2026-11-12');
  assert.equal(situacao(h, ana, '2026-11-12').reincidente, false);
});

test('o "falei hoje" antigo é aproveitado no histórico novo', () => {
  const h = atualizarHistorico({}, [ana], '2026-11-12', { 1: '2026-11-06' });
  const s = situacao(h, ana, '2026-11-12');
  assert.equal(s.contatos, 1);
  assert.equal(s.tipo, 'followup');
});

test('dias sem leitura (Chrome fechado) não encerram o episódio', () => {
  let h = atualizarHistorico({}, [ana, beto], '2026-11-01');
  h = atualizarHistorico(h, [], '2026-11-03'); // leitura vazia: ignorada
  h = atualizarHistorico(h, [ana, beto], '2026-11-20');
  assert.equal(situacao(h, ana, '2026-11-20').reincidente, false);
});
