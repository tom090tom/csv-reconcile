/** Strict comma-separated CSV parser; quoted newlines remain part of the cell. */
export function parseCSV(input) {
  if (typeof input !== 'string') throw new Error('CSV 必须是文本。');
  const text = input.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], cell = '', state = 'plain', rowStarted = false;
  const finishCell = () => { row.push(cell); cell = ''; state = 'plain'; };
  const finishRow = () => {
    finishCell();
    if (rowStarted) {
      records.push(row);
      if (records.length > 50_001) throw new Error('CSV 每份最多 50,000 条数据记录，请拆分文件。');
    }
    row = [];
    rowStarted = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== '\r' && char !== '\n') rowStarted = true;
    if (state === 'quoted') {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') state = 'closed';
      else cell += char;
      continue;
    }
    if (char === ',') finishCell();
    else if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else if (state === 'closed') {
      throw new Error(`CSV 第 ${records.length + 1} 条记录：闭合引号后有多余字符。`);
    } else if (char === '"') {
      if (cell !== '') throw new Error(`CSV 第 ${records.length + 1} 条记录：引号必须位于字段开头。`);
      state = 'quoted';
    } else cell += char;
  }
  if (state === 'quoted') throw new Error(`CSV 第 ${records.length + 1} 条记录：存在未闭合的引号。`);
  if (rowStarted) finishRow();
  if (!records.length) throw new Error('CSV 为空，请提供表头。');
  const headers = records.shift().map(value => value.trim());
  if (headers.some(value => !value)) throw new Error('CSV 表头不能为空。');
  if (new Set(headers).size !== headers.length) throw new Error('CSV 表头不能重复。');
  records.forEach((record, index) => {
    if (record.length !== headers.length) throw new Error(`CSV 第 ${index + 2} 条记录：字段数与表头不一致。`);
  });
  return { headers, rows: records };
}
