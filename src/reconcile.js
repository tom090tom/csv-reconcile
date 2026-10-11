/** Parse decimal amounts without passing through floating point arithmetic. */
export function parseAmount(input) {
  const raw = String(input).trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error('金额需为数字，最多两位小数；千分位应写成 1,234.56。');
  }
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^[+-]/, '').replaceAll(',', '').split('.');
  if (whole.length > 18) throw new Error('金额整数部分最多 18 位。');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

function formatAmount(cents) {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function indexTable(table, mapping, label) {
  const keyColumn = table.headers.indexOf(mapping?.key);
  const amountColumn = table.headers.indexOf(mapping?.amount);
  if (keyColumn < 0 || amountColumn < 0 || keyColumn === amountColumn) {
    throw new Error(`${label}：请选择存在且不同的订单号列与金额列。`);
  }
  const index = new Map();
  table.rows.forEach((row, position) => {
    const context = `${label}第 ${position + 2} 条记录`;
    const key = row[keyColumn].trim();
    if (!key) throw new Error(`${context}：订单号不能为空。`);
    let amount;
    try { amount = parseAmount(row[amountColumn]); }
    catch (error) { throw new Error(`${context}：${error.message}`); }
    const values = index.get(key) ?? [];
    values.push(amount);
    index.set(key, values);
  });
  return index;
}

/** Match unique textual keys. Duplicate groups never participate in amount matching. */
export function reconcile(left, right, mapping) {
  const leftIndex = indexTable(left, mapping?.left, '左表');
  const rightIndex = indexTable(right, mapping?.right, '右表');
  const keys = new Set([...leftIndex.keys(), ...rightIndex.keys()]);
  const summary = { total: keys.size, matched: 0, amount_mismatch: 0, left_only: 0, right_only: 0, duplicate: 0 };
  const records = [];
  for (const key of keys) {
    const l = leftIndex.get(key) ?? [], r = rightIndex.get(key) ?? [];
    let status, difference = null;
    if (l.length > 1 || r.length > 1) status = 'duplicate';
    else if (!r.length) status = 'left_only';
    else if (!l.length) status = 'right_only';
    else {
      difference = formatAmount(r[0] - l[0]);
      status = l[0] === r[0] ? 'matched' : 'amount_mismatch';
    }
    summary[status]++;
    records.push({ key, status, leftAmounts: l.map(formatAmount), rightAmounts: r.map(formatAmount), difference });
  }
  return { summary, records };
}
