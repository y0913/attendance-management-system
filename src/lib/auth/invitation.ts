// 招待メール送信ユーティリティ。
//
// NextAuth の Nodemailer Provider と完全互換な形式で magic link を発行する:
//   - token は 32 byte の hex 乱数 (= NextAuth の randomString(32) と同等)
//   - DB の verification_tokens.token には SHA256(token + AUTH_SECRET) で hashed して保存
//   - URL には unhashed token を載せる → ユーザーがクリックすると NextAuth の
//     /api/auth/callback/nodemailer が同じハッシュ計算で照合 → 通常ログインと同じパスを通る
//
// signIn() を経由せず直接送るので、招待を打った admin の session/redirect を巻き込まない。

import { createTransport } from 'nodemailer';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';

const APP_NAME = '勤怠管理システム';
const TOKEN_TTL_SECONDS = 15 * 60;

const ROLE_LABEL: Record<Role, string> = {
  admin: '管理者',
  approver: '承認者',
  general: '一般',
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;',
  );

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

async function hashTokenForStorage(rawToken: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  const data = new TextEncoder().encode(`${rawToken}${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

function getBaseUrl(): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function buildTransport() {
  return createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: process.env.EMAIL_SERVER_USER
      ? {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        }
      : undefined,
    secure: process.env.EMAIL_INSECURE === 'true' ? false : undefined,
    ignoreTLS: process.env.EMAIL_INSECURE === 'true' ? true : undefined,
  });
}

const fmtJstTime = (d: Date): string =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    timeStyle: 'short',
  }).format(d);

interface InvitationParams {
  email: string;
  name: string;
  role: Role;
  inviterName: string;
  companyName: string;
}

const buildText = (
  params: InvitationParams,
  url: string,
  expiresJst: string,
): string =>
  `${params.companyName} の ${params.inviterName} さんから ${APP_NAME} に招待されました。

ロール: ${ROLE_LABEL[params.role]}

下記のリンクから初回ログインしてください:
${url}

有効期限: ${expiresJst} (${TOKEN_TTL_SECONDS / 60} 分)
このリンクは 1 回のみ使えます。期限切れ時は ${getBaseUrl()}/login からメールアドレスを入力すれば再送できます。

心当たりがない場合は、このメールを破棄してください。

このメールは ${params.email} 宛に送信されています。`;

const buildHtml = (
  params: InvitationParams,
  url: string,
  expiresJst: string,
): string => {
  const safeUrl = escapeHtml(url);
  const safeEmail = escapeHtml(params.email);
  const safeInviter = escapeHtml(params.inviterName);
  const safeCompany = escapeHtml(params.companyName);
  const safeRole = escapeHtml(ROLE_LABEL[params.role]);
  return `<!DOCTYPE html>
<html lang="ja"><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <h2 style="font-size: 18px; margin: 0 0 16px;">${APP_NAME} へのご招待</h2>
  <p>
    <strong>${safeCompany}</strong> の ${safeInviter} さんから ${APP_NAME} に招待されました。<br>
    ロール: <strong>${safeRole}</strong>
  </p>
  <p style="margin: 24px 0;">
    <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">初回ログイン</a>
  </p>
  <p style="font-size: 13px; color: #6b7280;">
    ボタンが押せない場合は次の URL にアクセスしてください:<br>
    <a href="${safeUrl}" style="color: #2563eb; word-break: break-all;">${safeUrl}</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 13px; color: #6b7280;">
    有効期限: <strong>${escapeHtml(expiresJst)}</strong>（${TOKEN_TTL_SECONDS / 60} 分）<br>
    1 回限り有効です。期限切れ時は ${getBaseUrl()}/login から再送できます。
  </p>
  <p style="font-size: 13px; color: #6b7280;">
    心当たりがない場合は、このメールを破棄してください。<br>
    このメールは ${safeEmail} 宛に送信されています。
  </p>
</body></html>`;
};

export async function sendInvitationEmail(
  params: InvitationParams,
): Promise<void> {
  const rawToken = generateRawToken();
  const hashedToken = await hashTokenForStorage(rawToken);
  const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

  await prisma.verificationToken.create({
    data: {
      identifier: params.email,
      token: hashedToken,
      expires,
    },
  });

  const baseUrl = getBaseUrl();
  const callbackUrl = `${baseUrl}/clock`;
  const url = `${baseUrl}/api/auth/callback/nodemailer?${new URLSearchParams({
    callbackUrl,
    token: rawToken,
    email: params.email,
  })}`;

  const transport = buildTransport();
  const expiresJst = fmtJstTime(expires);
  await transport.sendMail({
    to: params.email,
    from: process.env.EMAIL_FROM,
    subject: `${APP_NAME} へのご招待`,
    text: buildText(params, url, expiresJst),
    html: buildHtml(params, url, expiresJst),
  });
}
