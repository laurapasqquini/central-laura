// Testes da subaba Lolis › Delegadas (rodar com: npm test). Dados de exemplo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { delegadas, periodos, situacao, diaUtilAnterior } from '../src/lib/delegadas.js';

const REF = '2026-11-17'; // terça
const util = (d) => ![0, 6].includes(new Date(`${d}T12:00`).getDay());
const ctx = (notas = {}) => ({ ref: REF, ehUtil: util, prazoDe: (t) => t.due, notas });
const t = (id, extra = {}) => ({ id, title: `Tarefa ${id}`, who: 'lolis', done: false, due: null, createdAt: '2026-11-16', notes: '', ...extra });

test('ontem = dia útil anterior (segunda vira sexta)', () => {
  assert.equal(diaUtilAnterior(REF, util), '2026-11-16');
  assert.equal(diaUtilAnterior('2026-11-16', util), '2026-11-13');
  const p = periodos('2026-11-16', util);
  assert.equal(p.ontem.rotulo, 'Último dia útil');
  assert.deepEqual([p.semana.de, p.passada.de, p.passada.ate], ['2026-11-16', '2026-11-09', '2026-11-15']);
});

test('situação: feita, não conseguiu (com motivo), atrasada em dias úteis e em aberto', () => {
  const notas = { '2026-11-16': { 't:b': { status: 'nao', nota: 'arena fechada' }, 't:a': { status: 'feito', nota: 'mandei' } } };
  assert.deepEqual(situacao(t('a', { done: true, doneAt: '2026-11-16' }), ctx(notas)), { tipo: 'feita', em: '2026-11-16', nota: 'mandei', prazo: null });
  assert.equal(situacao(t('b'), ctx(notas)).nota, 'arena fechada');
  const at = situacao(t('c', { due: '2026-11-13' }), ctx());
  assert.deepEqual([at.tipo, at.dias], ['atrasada', 2]); // seg e ter
  assert.equal(situacao(t('d', { due: '2026-11-20' }), ctx()).tipo, 'aberto');
});

test('lista do período: só da Lolis, pelo dia em que delegou, com a contagem', () => {
  const tasks = [
    t('a', { done: true }),
    t('b', { due: '2026-11-13' }),
    t('c', { createdAt: '2026-11-10' }),
    t('d', { who: 'laura' }),
    t('e', { whats: true }),
    t('f', { createdAt: undefined }),
  ];
  const r = delegadas(tasks, ctx(), { de: '2026-11-16', ate: '2026-11-16' });
  assert.deepEqual(r.itens.map((x) => x.id), ['b', 'a']); // atrasada antes da feita
  assert.deepEqual([r.conta.total, r.conta.feita, r.conta.atrasada], [2, 1, 1]);
  assert.equal(delegadas(tasks, ctx(), {}).conta.total, 4); // "Tudo" inclui a sem data
});

test('busca procura em tudo, sem acento, no título e nas notas', () => {
  const tasks = [t('a', { title: 'Ligar para a Arena Nova', createdAt: '2026-10-01' }), t('b', { notes: 'falar da arena' }), t('c')];
  assert.deepEqual(delegadas(tasks, ctx(), { de: REF, ate: REF, busca: 'arêna' }).itens.map((x) => x.id).sort(), ['a', 'b']);
});
