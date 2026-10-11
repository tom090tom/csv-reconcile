import { readFile, stat, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { parseCSV } from '../src/csv.js';
import { reconcile } from '../src/reconcile.js';
import { reportCSV } from '../src/report.js';

const usage = `CSV Reconcile — 同币种 CSV 按订单号对账
node bin/reconcile.js left.csv right.csv --left-key 订单号 --left-amount 金额 --right-key order_id --right-amount amount [--output report.csv]
输入需为 UTF-8 逗号分隔 CSV，每份最多 5 MB。默认报告输出到 stdout；不覆盖已有输出文件。`;

async function load(path) {
  if ((await stat(path)).size > 5_000_000) throw new Error(`${path}：文件超过 5 MB。`);
  const bytes = await readFile(path);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error(`${path}：请转换为 UTF-8 CSV 后重试。`); }
  return parseCSV(text);
}

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'left-key': { type: 'string' }, 'left-amount': { type: 'string' },
      'right-key': { type: 'string' }, 'right-amount': { type: 'string' },
      output: { type: 'string' }, help: { type: 'boolean' }
    }
  });
  if (values.help) console.log(usage);
  else {
    if (positionals.length !== 2 || ['left-key', 'left-amount', 'right-key', 'right-amount'].some(key => !values[key])) throw new Error(usage);
    const result = reconcile(await load(positionals[0]), await load(positionals[1]), {
      left: { key: values['left-key'], amount: values['left-amount'] },
      right: { key: values['right-key'], amount: values['right-amount'] }
    });
    const output = reportCSV(result.records);
    if (values.output) await writeFile(values.output, output, { encoding: 'utf8', flag: 'wx' });
    else process.stdout.write(output);
    console.error(`汇总：${JSON.stringify(result.summary)}`);
  }
} catch (error) { console.error(`对账失败：${error.message}`); process.exitCode = 1; }
