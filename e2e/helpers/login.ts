// magic link 経由でログインする helper。mailpit の HTTP API からメール本文を取得して
// その中の URL に navigate する。

import type { Page } from '@playwright/test';

const MAILPIT_API = 'http://localhost:8025/api/v1';

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

interface MailpitMessageDetail {
  Text: string;
  HTML: string;
}

// 該当メールが届くまで polling
async function waitForMagicLinkEmail(
  email: string,
  maxAttempts = 30,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${MAILPIT_API}/messages?limit=50`);
    const json: { messages: MailpitMessage[] } = await res.json();
    const found = json.messages.find((m) =>
      m.To.some((to) => to.Address === email),
    );
    if (found) {
      const detail: MailpitMessageDetail = await (
        await fetch(`${MAILPIT_API}/message/${found.ID}`)
      ).json();
      // 本文中の最初の http(s) URL を抽出 (NextAuth が生成するリンク)
      const urlMatch = detail.Text.match(/https?:\/\/\S+/);
      if (!urlMatch) {
        throw new Error(`No URL found in email body: ${detail.Text}`);
      }
      // メール届いたら以後の検査用に削除しておく (並列テストで取り違え防止)
      await fetch(`${MAILPIT_API}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: [found.ID] }),
      });
      return urlMatch[0];
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Magic link for ${email} did not arrive within timeout`);
}

export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByRole('button', { name: 'ログインリンクを送信' }).click();

  const link = await waitForMagicLinkEmail(email);
  await page.goto(link);
  // ログイン完了後 /clock にリダイレクトする想定
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10_000,
  });
}
