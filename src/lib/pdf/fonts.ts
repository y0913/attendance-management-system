import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Font } from '@react-pdf/renderer';

const FONT_FAMILY = 'NotoSansJP';

const fontPath = (filename: string) =>
  path.join(process.cwd(), 'public', 'fonts', filename);

let cachedRegular: string | null = null;
let cachedBold: string | null = null;

const loadDataUrl = (filename: string): string => {
  const buf = readFileSync(fontPath(filename));
  return `data:font/ttf;base64,${buf.toString('base64')}`;
};

export function ensureJapaneseFontRegistered(): string {
  cachedRegular ??= loadDataUrl('NotoSansJP-Regular.ttf');
  cachedBold ??= loadDataUrl('NotoSansJP-Bold.ttf');
  // 毎呼び出し re-register（dev HMR での古い URL 登録の上書き目的）。
  // Font.register は同 family を上書きするため副作用は実質キャッシュ更新のみ。
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: cachedRegular, fontWeight: 'normal' },
      { src: cachedBold, fontWeight: 'bold' },
    ],
  });
  return FONT_FAMILY;
}
