export const statusLabels = Object.freeze({
  matched: '一致', amount_mismatch: '金额差异', left_only: '仅左表', right_only: '仅右表', duplicate: '重复订单'
});

function quote(value) {
  let text = String(value ?? '');
  // Quoting alone does not prevent spreadsheet formula execution.
  if (/^[\s\u0000-\u001f\u007f]*[=+\-@＝＋－＠]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCSV(records) {
  const rows = [['状态', '订单号', '左表金额', '右表金额', '差额（右减左）']];
  for (const record of records) rows.push([
    statusLabels[record.status], record.key, record.leftAmounts.join('; '),
    record.rightAmounts.join('; '), record.difference
  ]);
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
