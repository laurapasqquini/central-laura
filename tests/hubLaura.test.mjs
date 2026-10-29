// Testes da junção Hub › Atividades da Laura → central (rodar com: npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarHubLaura, RODAPE_HUB_LAURA } from '../src/lib/hubLaura.js';

const HOJE = '2026-10-29';
let n = 0;
const ctx = { hoje: HOJE, uid: () => `novo${++n}` };
const tarefa = (title, extra = {}) => ({ id: title, title, area: 'ranken', who: 'laura', hubLaura: true, hubPrazo: '2026-10-28', due: '2026-10-28', done: false, notes: RODAPE_HUB_LAURA, ...extra });
const leitura = (...abertas) => ({ dia: HOJE, abertas: abertas.map((a) => (typeof a === 'string' ? { titulo: a, prazo: '2026-10-28' } : a)) });

test('tarefa nova do Hub entra na central com a descrição nas notas', () => {
  const s = aplicarHubLaura({ tasks: [] }, leitura({ titulo: 'Recado — Jansen', prazo: '2026-10-28', descricao: 'Mandar o Pix ao Jansen' }), ctx);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.tasks[0].title, 'Recado — Jansen');
  assert.match(s.tasks[0].notes, /^Mandar o Pix ao Jansen\n\nVeio do Hub/);
});

test('descrição nova do Hub substitui a nota errada antiga', () => {
  const s = aplicarHubLaura({ tasks: [tarefa('Recado — Jansen', { notes: `Mensalidade Pix de Beach\n\n${RODAPE_HUB_LAURA}` })] }, leitura({ titulo: 'Recado — Jansen', prazo: '2026-10-28', descricao: 'Amex não passa no app' }), ctx);
  assert.match(s.tasks[0].notes, /^Amex não passa no app/);
});

test('tarefa que sumiu do Hub é dada como feita, com a nota de "saiu"', () => {
  const s = aplicarHubLaura({ tasks: [tarefa('A'), tarefa('B')] }, leitura('A'), ctx);
  const b = s.tasks.find((t) => t.title === 'B');
  assert.equal(b.done, true);
  assert.match(b.notes, /Saiu de "em aberto" no Hub em 29\/10\/2026/);
});

test('"saiu" por leitura errada volta para a lista quando o Hub mostra de novo', () => {
  const t = tarefa('A', { done: true, doneAt: HOJE, notes: `${RODAPE_HUB_LAURA}\nSaiu de "em aberto" no Hub em 29/10/2026` });
  const s = aplicarHubLaura({ tasks: [t] }, leitura('A'), ctx);
  assert.equal(s.tasks[0].done, false);
  assert.doesNotMatch(s.tasks[0].notes, /Saiu de/);
});

test('feita na central e ainda aberta no Hub volta para a fila de concluir', () => {
  const t = tarefa('A', { done: true, doneAt: HOJE });
  const s = aplicarHubLaura({ tasks: [t], hubConcluir: [] }, leitura('A'), ctx);
  assert.deepEqual(s.hubConcluir, [{ titulo: 'A', em: HOJE }]);
});

test('a fila de concluir não perde o que ainda está aberto no Hub', () => {
  const t = tarefa('A', { done: true, doneAt: HOJE });
  const s = aplicarHubLaura({ tasks: [t], hubConcluir: [{ titulo: 'A', em: HOJE }] }, leitura('A', 'B'), ctx);
  assert.equal(s.hubConcluir.length, 1);
});

test('o que o Hub já concluiu sai da fila', () => {
  const t = tarefa('A', { done: true, doneAt: HOJE });
  const s = aplicarHubLaura({ tasks: [t], hubConcluir: [{ titulo: 'A', em: HOJE }] }, leitura('B'), ctx);
  assert.equal(s.hubConcluir.length, 0);
});

test('prazo diferente acha a mesma tarefa pelo título (não duplica)', () => {
  const s = aplicarHubLaura({ tasks: [tarefa('A', { hubPrazo: '2026-10-29' })] }, leitura({ titulo: 'A', prazo: '2026-10-27' }), ctx);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.tasks[0].hubPrazo, '2026-10-27');
  assert.equal(s.tasks[0].done, false);
});

test('leitura vazia não mexe em nada', () => {
  const antes = { tasks: [tarefa('A')] };
  assert.equal(aplicarHubLaura(antes, leitura(), ctx), antes);
});
