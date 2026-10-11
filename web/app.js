import { parseCSV } from '/src/csv.js';
import { reconcile } from '/src/reconcile.js';
import { reportCSV, statusLabels } from '/src/report.js';

const $ = id => document.getElementById(id);
const storageKey = 'csv-reconcile.mapping.v1';
const datasets = { left: null, right: null };
const versions = { left: 0, right: 0 };
let result = null;
let savedMapping = {};
try { savedMapping = JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {}; }
catch { /* Mapping persistence is optional, including in private browsing. */ }

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}

function invalidate() {
  result = null;
  $('results').hidden = true;
  $('compare').disabled = !datasets.left || !datasets.right;
}

function populate(side, table, name) {
  datasets[side] = table;
  $(`${side}-name`).textContent = name;
  $(`${side}-preview`).textContent = `${table.rows.length.toLocaleString()} 条记录 · ${table.headers.length} 列`;
  for (const field of ['key', 'amount']) {
    const select = $(`${side}-${field}`);
    select.replaceChildren();
    for (const header of table.headers) select.add(new Option(header, header));
    const remembered = savedMapping?.[side]?.[field];
    const pattern = field === 'key' ? /^(订单号|订单编号|order_id|order|id)$/i : /^(金额|实付金额|amount|value|total)$/i;
    select.value = table.headers.includes(remembered) ? remembered
      : table.headers.find(header => pattern.test(header)) ?? table.headers[field === 'amount' && table.headers.length > 1 ? 1 : 0];
    select.disabled = false;
  }
  invalidate();
}

function clearSide(side) {
  datasets[side] = null;
  $(`${side}-name`).textContent = 'UTF-8 · 逗号分隔 · 最多 5 MB';
  $(`${side}-preview`).textContent = '请重新选择有效文件。';
  for (const field of ['key', 'amount']) {
    const select = $(`${side}-${field}`);
    select.replaceChildren(new Option('先选择文件', ''));
    select.disabled = true;
  }
  invalidate();
}

async function loadFile(side, file) {
  const version = ++versions[side];
  clearSide(side);
  if (!file) return;
  message(`正在读取 ${file.name}…`);
  try {
    if (file.size > 5_000_000) throw new Error('文件超过 5 MB，请拆分后再试。');
    const bytes = await file.arrayBuffer();
    if (version !== versions[side]) return;
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('文件编码无法读取，请另存为 UTF-8 CSV。'); }
    populate(side, parseCSV(text), file.name);
    message(datasets.left && datasets.right ? '两张表已就绪，确认列映射后开始对账。' : '已读取一张表，请继续选择另一张。');
  } catch (error) {
    if (version === versions[side]) message(`${side === 'left' ? '左表' : '右表'}：${error.message}`, true);
  }
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderRows() {
  if (!result) return;
  const filter = $('filter').value;
  const records = result.records.filter(record => filter === 'all' || (filter === 'issues' ? record.status !== 'matched' : record.status === filter));
  const fragment = document.createDocumentFragment();
  for (const record of records.slice(0, 200)) {
    const row = node('tr');
    const status = node('td');
    status.append(node('span', statusLabels[record.status], `tag${record.status === 'matched' ? '' : ' issue'}`));
    row.append(status, ...[record.key, record.leftAmounts.join('; ') || '—', record.rightAmounts.join('; ') || '—', record.difference ?? '—'].map(value => node('td', value)));
    fragment.append(row);
  }
  if (!records.length) {
    const cell = node('td', '当前筛选没有订单。'); cell.colSpan = 5;
    const row = node('tr'); row.append(cell); fragment.append(row);
  }
  $('rows').replaceChildren(fragment);
  $('row-count').textContent = `共 ${records.length.toLocaleString()} 条${records.length > 200 ? ' · 展示前 200 条，导出包含全部' : ''}`;
}

function renderResult() {
  $('stats').replaceChildren();
  for (const [status, label] of Object.entries(statusLabels)) {
    const card = node('div', undefined, `stat${status === 'matched' ? '' : ' issue'}`);
    card.append(node('strong', result.summary[status].toLocaleString()), node('span', label));
    $('stats').append(card);
  }
  $('filter').value = 'all';
  $('results').hidden = false;
  renderRows();
}

for (const side of ['left', 'right']) {
  $(`${side}-file`).addEventListener('change', event => loadFile(side, event.target.files[0]));
  for (const field of ['key', 'amount']) $(`${side}-${field}`).addEventListener('change', () => {
    invalidate(); message('列映射已调整，请重新对账。');
  });
}

$('demo').addEventListener('click', async () => {
  const version = { left: ++versions.left, right: ++versions.right };
  clearSide('left'); clearSide('right');
  $('left-file').value = ''; $('right-file').value = '';
  $('demo').disabled = true;
  message('正在加载合成示例…');
  try {
    const texts = await Promise.all(['left', 'right'].map(async side => {
      const response = await fetch(`/examples/${side}.csv`);
      if (!response.ok) throw new Error('示例加载失败，请重试。');
      return response.text();
    }));
    if (version.left !== versions.left || version.right !== versions.right) return;
    populate('left', parseCSV(texts[0]), '示例：订单流水.csv');
    populate('right', parseCSV(texts[1]), '示例：结算流水.csv');
    message('示例已就绪，点击“开始对账”查看五种结果。');
  } catch (error) { message(error.message, true); }
  finally { $('demo').disabled = false; }
});

$('compare').addEventListener('click', () => {
  if (!datasets.left || !datasets.right) return;
  const mapping = Object.fromEntries(['left', 'right'].map(side => [side, { key: $(`${side}-key`).value, amount: $(`${side}-amount`).value }]));
  try {
    result = reconcile(datasets.left, datasets.right, mapping);
    try {
      if ($('remember').checked) { localStorage.setItem(storageKey, JSON.stringify(mapping)); savedMapping = mapping; }
      else { localStorage.removeItem(storageKey); savedMapping = {}; }
    } catch { /* Reconciliation remains usable when browser storage is blocked. */ }
    renderResult();
    const issues = result.summary.total - result.summary.matched;
    message(`已核对 ${result.summary.total.toLocaleString()} 个订单号，${issues.toLocaleString()} 个需要核查。`);
  } catch (error) { invalidate(); message(error.message, true); }
});

$('remember').addEventListener('change', () => {
  if (!$('remember').checked) {
    savedMapping = {};
    try { localStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
  }
});
$('filter').addEventListener('change', renderRows);
$('download').addEventListener('click', () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([reportCSV(result.records)], { type: 'text/csv;charset=utf-8' }));
  const anchor = node('a'); anchor.href = url; anchor.download = 'reconciliation-report.csv';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('全部报告已生成。导入表格软件时，将订单号列设为文本以保留前导零。');
});
