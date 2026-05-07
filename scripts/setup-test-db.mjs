#!/usr/bin/env node
// Integration テスト用 DB のセットアップ。
// 1. ams_test データベースが無ければ作成 (docker exec 経由)
// 2. .env.test を読み込んで prisma migrate deploy

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const envTestPath = path.join(root, '.env.test');
if (!existsSync(envTestPath)) {
  console.error(
    '✗ .env.test not found. Copy .env.test.example to .env.test first.',
  );
  process.exit(1);
}

// .env.test を手動で parse (dotenv-cli が無い環境でも動かす)
const envText = readFileSync(envTestPath, 'utf8');
const envOverride = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=("?)(.*?)\2\s*$/);
  if (m) envOverride[m[1]] = m[3];
}

console.log('→ Creating ams_test database (idempotent)...');
try {
  execSync(
    `docker exec ams_postgres psql -U ams -d ams -tc "SELECT 1 FROM pg_database WHERE datname='ams_test'" | grep -q 1 || docker exec ams_postgres psql -U ams -d ams -c "CREATE DATABASE ams_test;"`,
    { stdio: 'inherit', shell: '/bin/bash' },
  );
} catch (e) {
  console.error('✗ Failed to create ams_test. Is docker-compose running?');
  console.error(e.message);
  process.exit(1);
}

console.log('→ Running prisma migrate deploy on ams_test...');
execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, ...envOverride },
});

console.log('✓ Test DB ready.');
