import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../src/csv.js';
import { parseAmount, reconcile } from '../src/reconcile.js';
import { reportCSV } from '../src/report.js';

const mapping = { left: { key: 'id', amount: 'amount' }, right: { key: 'order', amount: 'value' } };
const run = (left, right) => reconcile(parseCSV(`id,amount\n${left}`), parseCSV(`order,value\n${right}`), mapping);

test('CSV supports BOM, CRLF, quoted commas, escaped quotes and embedded newlines', () => {
  assert.deepEqual(parseCSV('\uFEFFid, note\r\n001,"a,b"\r\n002,"say ""hi""\nnext"\r\n'), {
    headers: ['id', 'note'], rows: [['001', 'a,b'], ['002', 'say "hi"\nnext']]
  });
});
test('CSV ignores empty lines but preserves empty trailing fields', () => {
  assert.deepEqual(parseCSV('a,b\n\n1,\n').rows, [['1', '']]);
});
test('explicitly quoted empty records are validated instead of silently skipped', () => {
  assert.throws(() => parseCSV('id,amount\n""\nA,1'), /2.*字段数/);
  assert.throws(() => parseCSV('""\nid,amount\nA,1'), /表头不能为空/);
});
test('unclosed quoted multiline fields report their logical record location', () => {
  assert.throws(() => parseCSV('id,amount\n\nA,1\nB,"2\n3'), /第 3 条记录.*未闭合/);
});
test('header-only CSV is a valid empty dataset', () => {
  assert.deepEqual(parseCSV('id,amount').rows, []);
});
test('CSV rejects more than 50,000 data records with a usable limit message', () => {
  assert.throws(() => parseCSV('id,amount\n' + 'A,1\n'.repeat(50_001)), /50,000/);
});
test('amounts exceeding the documented 18-digit integer limit are rejected', () => {
  assert.throws(() => parseAmount('1234567890123456789'), /18/);
});
for (const [name, input] of [
  ['empty file', ''], ['duplicate header', 'id,id\n1,2'], ['empty header', 'id,\n1,2'],
  ['unequal columns', 'id,amount\n1,2,3'], ['unclosed quote', 'id,amount\n1,"2'],
  ['quote in unquoted cell', 'id,amount\n1,2"3'], ['content after closing quote', 'id,amount\n1,"2"x']
]) test(`CSV rejects ${name}`, () => assert.throws(() => parseCSV(input)));

test('amounts are exact integer cents beyond Number safe integer range', () => {
  assert.equal(parseAmount('90,071,992,547,409.93'), 9007199254740993n);
  assert.equal(parseAmount(' -0.01 '), -1n);
  assert.equal(parseAmount('+2.1'), 210n);
});
for (const input of ['', '1e3', 'NaN', '1.001', '1,00.00', '￥2', '.50', '1 000', '1.234,56']) {
  test(`invalid amount rejected: ${JSON.stringify(input)}`, () => assert.throws(() => parseAmount(input)));
}
test('reconciliation finds each category and keeps leading zero identifiers', () => {
  const result = run('001,10.10\n002,20\n003,3\n005,1\n005,2', '001,10.1\n002,20.02\n004,4\n005,3');
  assert.deepEqual(result.summary, { total: 5, matched: 1, amount_mismatch: 1, left_only: 1, right_only: 1, duplicate: 1 });
  assert.equal(result.records[0].key, '001');
  assert.equal(result.records[1].difference, '0.02');
  assert.equal(result.records.at(-1).status, 'right_only');
});
test('duplicate keys are not silently summed or matched', () => {
  const record = run('A,1\nA,2', 'A,3').records[0];
  assert.equal(record.status, 'duplicate');
  assert.deepEqual(record.leftAmounts, ['1.00', '2.00']);
  assert.equal(record.difference, null);
});
test('duplicates on the right side are detected', () => {
  assert.equal(run('A,1', 'A,1\nA,1').records[0].status, 'duplicate');
});
test('difference is right minus left including negative values', () => {
  assert.equal(run('A,0.10', 'A,-0.20').records[0].difference, '-0.30');
});
test('keys trim whitespace but preserve case and prototype-like strings', () => {
  const result = run(' A ,1\n__proto__,2', 'A,1\n__proto__,2\na,1');
  assert.equal(result.summary.matched, 2);
  assert.equal(result.summary.right_only, 1);
});
test('blank keys stop reconciliation with a row reference', () => {
  assert.throws(() => run(' ,1', 'A,1'), /左表.*2/);
});
test('invalid amounts stop reconciliation instead of reporting false differences', () => {
  assert.throws(() => run('A,1', 'A,wrong'), /右表.*2/);
});
test('mapping must reference existing distinct columns', () => {
  const left = parseCSV('id,amount\nA,1');
  const right = parseCSV('order,value\nA,1');
  assert.throws(() => reconcile(left, right, { ...mapping, left: { key: 'missing', amount: 'amount' } }));
  assert.throws(() => reconcile(left, right, { ...mapping, left: { key: 'id', amount: 'id' } }));
});
test('empty datasets reconcile without invented rows', () => {
  assert.deepEqual(run('', '').summary, { total: 0, matched: 0, amount_mismatch: 0, left_only: 0, right_only: 0, duplicate: 0 });
});
test('export has a BOM, quotes CSV fields and blocks formula-leading identifiers', () => {
  const csv = reportCSV(run('"=HYPERLINK(""x"")",1', '').records);
  assert.ok(csv.startsWith('\uFEFF'));
  const parsed = parseCSV(csv);
  assert.equal(parsed.rows[0][1], '\'=HYPERLINK("x")');
});
test('export preserves commas and every amount of a duplicate', () => {
  const parsed = parseCSV(reportCSV(run('"A,B",1\n"A,B",2', '').records));
  assert.equal(parsed.rows[0][1], 'A,B');
  assert.equal(parsed.rows[0][2], '1.00; 2.00');
});
