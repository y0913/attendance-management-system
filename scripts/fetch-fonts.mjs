#!/usr/bin/env node
// Noto Sans JP の TTF を Google Fonts CSS API 経由で取得して public/fonts/ に保存する。
// Google Fonts CSS の URL は version (v55, v56...) が変わると差し替わるため、
// 直接 hardcoded URL ではなく毎回 CSS 経由で動的に解決する。

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const fontsDir = path.join(projectRoot, 'public', 'fonts');

const TARGETS = [
  { weight: 400, filename: 'NotoSansJP-Regular.ttf' },
  { weight: 700, filename: 'NotoSansJP-Bold.ttf' },
];

// css v2 は woff2/woff のみ返すが、古い css v1 エンドポイントは ttf も返してくれる。
const CSS_URL =
  'https://fonts.googleapis.com/css?family=Noto+Sans+JP:400,700&subset=japanese';

const UA_FOR_TTF =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

async function fetchCss() {
  const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA_FOR_TTF } });
  if (!res.ok) {
    throw new Error(`Failed to fetch CSS: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function extractTtfUrl(css, weight) {
  // @font-face ブロックを weight 別に分割して URL を抽出
  const blocks = css.split('@font-face');
  for (const block of blocks) {
    if (!block.includes(`font-weight: ${weight};`)) continue;
    const m = block.match(/url\((https?:\/\/[^)]+\.ttf)\)/);
    if (m) return m[1];
  }
  throw new Error(`No TTF URL found for weight ${weight}`);
}

async function fetchAndSave(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  if (!existsSync(fontsDir)) mkdirSync(fontsDir, { recursive: true });

  // 全部既存ならスキップ
  const allExist = TARGETS.every((t) =>
    existsSync(path.join(fontsDir, t.filename)),
  );
  if (allExist && !process.env.FORCE_REFETCH) {
    console.log('✓ fonts already present, skipping (set FORCE_REFETCH=1 to override)');
    return;
  }

  console.log('Fetching Google Fonts CSS...');
  const css = await fetchCss();
  for (const target of TARGETS) {
    const dest = path.join(fontsDir, target.filename);
    if (existsSync(dest) && !process.env.FORCE_REFETCH) continue;
    const url = extractTtfUrl(css, target.weight);
    const size = await fetchAndSave(url, dest);
    console.log(`✓ ${target.filename} (${(size / 1024).toFixed(0)} KB)`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('fetch-fonts failed:', err.message);
  process.exit(1);
});
