// Testes do Acompanhamento da Lolis (rodar com: npm test). Dados de exemplo, sem nomes reais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoDoDia, cobrancas, elogios, semana, escalar, telefonesNoDia, guardarTelefones, metaTelefones, diasUteisEntre, METAS_PADRAO, MODELOS_PADRAO, preencher } from '../src/lib/acompanhamento.js';

const REF = '2026-11-06'; // sexta
const M = { ...METAS_PADRAO };
const util = (d) => ![0, 6].includes(new Date(`${d}T12:00`).getDay());
const iso = (d, h) => new Date(`${d}T${h}:00`).toISOString();
const dia = (extra = {}) => ({ date: REF, itens: [{ key: 't:a', titulo: 'Tarefa A' }, { key: 't:b', titulo: 'Tarefa B' }], sorteios: [], notas: {}, feitos: [], extras: [], ponto: null, telefones: null, ...extra });
const ctx = (hoje, extra = {}) => ({ ref: REF, hoje, anterior: null, atrasadas: [], expansao: null, agora: new Date(`${REF}T15:00`), ...extra });

test('telefones do dia: diferença por projeto entre a leitura do dia e a anterior', () => {
  let h = guardarTelefones({}, '2026-11-05', [{ id: 1, comResponsavel: 10 }, { id: 2, comResponsavel: 3 }]);
  h = guardarTelefones(h, REF, [{ id: 1, comResponsavel: 14 }, { id: 2, comResponsavel: 4 }, { id: 3, comResponsavel: 20 }]);
  assert.equal(telefonesNoDia(h, REF), 5); // projeto novo (id 3) não conta
  assert.equal(telefonesNoDia(h, '2026-11-05'), null); // sem leitura anterior
  assert.equal(telefonesNoDia(h, '2026-11-09'), null); // sem leitura no dia
});

test('meta de telefones: a da Laura vence; senão a da Expansão, com mínimo de 4', () => {
  const exp = { itens: [{ faltam: 0 }, { faltam: 30, porDia: 6 }] };
  assert.equal(metaTelefones(M, exp), 6);
  assert.equal(metaTelefones({ ...M, telefonesDia: 10 }, exp), 10);
  assert.equal(metaTelefones(M, { itens: [{ faltam: 3, porDia: null }] }), 4);
  assert.equal(metaTelefones(M, null), 0);
});

test('resumo conta feitas, não consegui e sorteio', () => {
  const r = resumoDoDia(dia({ itens: [...dia().itens, { key: 'sorteio', titulo: 'Sorteio' }], sorteios: ['sorteio'], feitos: ['t:a'], notas: { 't:b': { status: 'nao', nota: '' } } }), M, 4);
  assert.equal(r.feitas, 1);
  assert.equal(r.total, 3);
  assert.equal(r.naoConsegui.length, 1);
  assert.equal(r.sorteiosOk, 0);
});

test('cobra: atrasada há 2 dias úteis, não consegui sem nota, telefones abaixo, sorteio sem parabéns, saiu cedo', () => {
  const hoje = resumoDoDia(
    dia({
      itens: [...dia().itens, { key: 'sorteio', titulo: 'Sorteio' }],
      sorteios: ['sorteio'],
      notas: { 't:b': { status: 'nao', nota: '' } },
      ponto: { status: 'saiu', entrada: iso(REF, '14:00'), saida: iso(REF, '16:00'), minutos: 120, atraso: 0 },
      telefones: 2,
    }),
    M,
    5,
  );
  const ids = cobrancas(ctx(hoje, { atrasadas: [{ key: 't:x', titulo: 'Velha', era: '2026-11-03', dias: 3 }, { key: 't:y', titulo: 'Nova', era: '2026-11-05', dias: 1 }] }), M).map((c) => c.id.split(':')[0]);
  assert.deepEqual(ids.sort(), ['atraso', 'cedo', 'nao', 'ritmo-telefones', 'sorteio']);
});

test('não cobra telefones nem sorteio enquanto ela ainda está trabalhando', () => {
  const hoje = resumoDoDia(dia({ sorteios: ['sorteio'], ponto: { status: 'trabalhando', entrada: iso(REF, '14:00'), minutos: 60 }, telefones: 1 }), M, 5);
  assert.equal(cobrancas(ctx(hoje), M).length, 0);
});

test('saiu cedo mas puxou extra: não cobra, elogia', () => {
  const hoje = resumoDoDia(dia({ feitos: ['t:a', 't:b'], extras: [{ key: 'b:1', titulo: 'Banco 1' }], ponto: { status: 'saiu', entrada: iso(REF, '14:00'), saida: iso(REF, '16:00'), minutos: 120 } }), M, 0);
  assert.equal(cobrancas(ctx(hoje), M).length, 0);
  const el = elogios(ctx(hoje)).map((e) => e.id.split(':')[0]);
  assert.ok(el.includes('tudo') && el.includes('extra'));
});

test('expansão vencida vira cobrança com a cidade na mensagem', () => {
  const hoje = resumoDoDia(dia(), M, 0);
  const c = cobrancas(ctx(hoje, { expansao: { itens: [{ key: 't:e', titulo: '[Expansão Tênis Cidade X] Telefone do responsável', cidade: 'Cidade X', ate: '2026-11-02', vencida: true, faltam: 7 }] } }), M);
  assert.equal(c.length, 1);
  assert.match(c[0].mensagem, /prazo de Cidade X venceu em 02\/11 e ainda faltam 7 locais/);
});

test('escalar: entra na lista, depois de 2 dias úteis vira tarefa uma vez só, e sai quando resolve', () => {
  const c = [{ id: 'atraso:t:x', titulo: 'X atrasada', porque: 'Era para ontem.', mensagem: 'Lolis, ...' }];
  const u = (ref) => (desde) => diasUteisEntre(desde, ref, util);
  let r = escalar(undefined, c, '2026-11-04', u('2026-11-04'), M);
  assert.equal(r.criar.length, 0);
  assert.equal(r.reg['atraso:t:x'].desde, '2026-11-04');
  const mesmo = escalar(r.reg, c, '2026-11-05', u('2026-11-05'), M);
  assert.equal(mesmo.reg, r.reg); // nada mudou: mesmo objeto
  r = escalar(r.reg, c, REF, u(REF), M);
  assert.equal(r.criar.length, 1);
  assert.match(r.criar[0].title, /^Cobrar Lolis: X atrasada/);
  assert.equal(escalar({}, [{ ...c[0], tarefa: 'X desde 03/11' }], REF, () => 5, M).criar[0].title, 'Cobrar Lolis: X desde 03/11');
  assert.match(r.criar[0].notes, /Quem: Lolis[\s\S]*O que aconteceu[\s\S]*O que fazer[\s\S]*Mensagem pronta/);
  assert.equal(escalar(r.reg, c, '2026-11-09', u('2026-11-09'), M).criar.length, 0); // não cria de novo
  assert.deepEqual(escalar(r.reg, [], '2026-11-09', u('2026-11-09'), M).reg, {});
});

test('semana: soma o placar e monta a pauta com o que travou', () => {
  const a = resumoDoDia(dia({ date: '2026-11-05', feitos: ['t:a'], notas: { 't:b': { status: 'nao', nota: 'sem resposta' } }, ponto: { status: 'saiu', entrada: iso('2026-11-05', '14:20'), minutos: 240, atraso: 20 }, telefones: 3 }), M, 5);
  const b = resumoDoDia(dia({ feitos: ['t:a', 't:b'], ponto: { status: 'saiu', entrada: iso(REF, '14:00'), minutos: 230 }, telefones: 6 }), M, 5);
  const s = semana([a, b], M);
  assert.deepEqual([s.tot.feitas, s.tot.total, s.tot.telefones, s.tot.meta, s.tot.atrasos], [3, 4, 9, 10, 1]);
  assert.equal(s.metaHoras, 480);
  assert.ok(s.pauta.some((p) => /Tarefa B/.test(p) && /quinta/.test(p)));
  assert.ok(s.pauta.some((p) => /9 de 10/.test(p)));
});

test('modelos: o texto editado pela Laura troca as variáveis; vazio volta ao padrão', () => {
  assert.equal(preencher('Oi {cidade}, faltam {faltam}. {nada}', { cidade: 'X', faltam: 3 }), 'Oi X, faltam 3. {nada}');
  const hoje = resumoDoDia(dia(), M, 0);
  const exp = { itens: [{ key: 't:e', titulo: '[Expansão Tênis Cidade X] Telefone', cidade: 'Cidade X', ate: '2026-11-02', vencida: true, faltam: 7 }] };
  const [c] = cobrancas(ctx(hoje, { expansao: exp }), M, { expansao: 'Lolis, como está {cidade}? Faltam {faltam}.' });
  assert.equal(c.mensagem, 'Lolis, como está Cidade X? Faltam 7.');
  assert.equal(cobrancas(ctx(hoje, { expansao: exp }), M, { expansao: '  ' })[0].mensagem, preencher(MODELOS_PADRAO.expansao.texto, c.vars));
  const el = elogios(ctx(resumoDoDia(dia({ feitos: ['t:a', 't:b'] }), M, 0)), { 'elogio-tudo': 'Fechou as {total}!' });
  assert.equal(el.find((e) => e.tipo === 'elogio-tudo').mensagem, 'Fechou as 2!');
});

test('todo tipo usado nas regras tem modelo padrão, e as variáveis do padrão existem', () => {
  for (const [tipo, m] of Object.entries(MODELOS_PADRAO))
    for (const v of m.texto.match(/\{(\w+)\}/g) || []) assert.ok(v.slice(1, -1) in m.vars, `${tipo}: ${v}`);
});
