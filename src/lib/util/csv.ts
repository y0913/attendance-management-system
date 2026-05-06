// UTF-8 BOM 付き CSV 生成。Excel での文字化け回避のため BOM を先頭に付与する。
const UTF8_BOM = '﻿';

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export function rowsToCsv(rows: unknown[][]): string {
  const lines = rows.map((r) => r.map(escapeCell).join(','));
  return UTF8_BOM + lines.join('\r\n');
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
