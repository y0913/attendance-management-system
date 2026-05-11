// NextAuth v5 完全設定 (Node runtime 専用)。
// Edge runtime (middleware) 用の最小設定は src/auth.config.ts を使う。

import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Nodemailer, {
  type NodemailerConfig,
} from 'next-auth/providers/nodemailer';
import { createTransport } from 'nodemailer';
import authConfig from '@/auth.config';
import { checkMagicLinkRateLimit } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/db';

// 本番で平文 SMTP 設定が残っていたら起動時に fail fast。
if (
  process.env.NODE_ENV === 'production' &&
  process.env.EMAIL_INSECURE === 'true'
) {
  throw new Error(
    'EMAIL_INSECURE must not be true in production. SMTP must use STARTTLS / TLS.',
  );
}

const APP_NAME = '勤怠管理システム';
const TOKEN_TTL_SECONDS = 15 * 60; // 15 分

const fmtJstTime = (d: Date): string =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    timeStyle: 'short',
  }).format(d);

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

const buildText = ({
  url,
  email,
  expiresJst,
}: {
  url: string;
  email: string;
  expiresJst: string;
}): string =>
  `${APP_NAME} へのログインリンクです。

下記のリンクをクリックするとログインできます:
${url}

有効期限: ${expiresJst} (${TOKEN_TTL_SECONDS / 60} 分)
このリンクは 1 回のみ使えます。

心当たりがない場合は、このメールを破棄してください。
誰かがあなたのメールアドレスを入力した可能性があります。

このメールは ${email} 宛に送信されています。`;

const buildHtml = ({
  url,
  email,
  expiresJst,
}: {
  url: string;
  email: string;
  expiresJst: string;
}): string => {
  const safeUrl = escapeHtml(url);
  const safeEmail = escapeHtml(email);
  return `<!DOCTYPE html>
<html lang="ja"><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <h2 style="font-size: 18px; margin: 0 0 16px;">${APP_NAME} ログイン</h2>
  <p>下記のボタンからログインしてください。</p>
  <p style="margin: 24px 0;">
    <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">ログイン</a>
  </p>
  <p style="font-size: 13px; color: #6b7280;">
    ボタンが押せない場合は次の URL にアクセスしてください:<br>
    <a href="${safeUrl}" style="color: #2563eb; word-break: break-all;">${safeUrl}</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 13px; color: #6b7280;">
    有効期限: <strong>${escapeHtml(expiresJst)}</strong>（${TOKEN_TTL_SECONDS / 60} 分）<br>
    1 回限り有効です。
  </p>
  <p style="font-size: 13px; color: #6b7280;">
    心当たりがない場合は、このメールを破棄してください。<br>
    このメールは ${safeEmail} 宛に送信されています。
  </p>
</body></html>`;
};

type SendVerificationParams = Parameters<
  NonNullable<NodemailerConfig['sendVerificationRequest']>
>[0];

async function sendVerificationRequest({
  identifier: email,
  url,
  expires,
  provider,
}: SendVerificationParams): Promise<void> {
  if (!checkMagicLinkRateLimit(email)) {
    // 攻撃者にレート制限を悟られないため、メッセージは曖昧にする。
    throw new Error('ログインリクエストが多すぎます。時間をおいて再試行してください。');
  }

  const transport = createTransport(provider.server);
  const expiresJst = fmtJstTime(expires);

  await transport.sendMail({
    to: email,
    from: provider.from,
    subject: `${APP_NAME} ログインリンク`,
    text: buildText({ url, email, expiresJst }),
    html: buildHtml({ url, email, expiresJst }),
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: process.env.EMAIL_SERVER_USER
          ? {
              user: process.env.EMAIL_SERVER_USER,
              pass: process.env.EMAIL_SERVER_PASSWORD,
            }
          : undefined,
        // dev (mailpit) は平文 SMTP、本番 (Resend 等) は STARTTLS。
        // EMAIL_INSECURE=true で平文許可（本番では起動時 fail fast）。
        secure: process.env.EMAIL_INSECURE === 'true' ? false : undefined,
        ignoreTLS: process.env.EMAIL_INSECURE === 'true' ? true : undefined,
      },
      from: process.env.EMAIL_FROM,
      maxAge: TOKEN_TTL_SECONDS,
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // 既存ユーザーのみ許可 (admin が招待した社員のみログイン可)。新規メアドは弾く。
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, deactivatedAt: true },
      });
      if (!existing) return false;
      if (existing.deactivatedAt) return false;
      return true;
    },
    async jwt({ token, user, trigger }) {
      // 初回 sign-in (user オブジェクトが存在する) → DB から焼き込み
      if (user?.email) {
        const u = await prisma.user.findUnique({
          where: { email: user.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tokenVersion: true,
          },
        });
        if (u) {
          token.id = u.id;
          token.email = u.email;
          token.name = u.name;
          token.role = u.role;
          token.tokenVersion = u.tokenVersion;
          token.refreshedAt = Date.now();
        }
        return token;
      }

      // 既存トークン: 一定時間経過 or 明示 update() で role/tokenVersion を再取得。
      // middleware が見る JWT クレームと DB の真実を同期させる目的。
      // tokenVersion 不一致なら force logout（admin が bump した or 自分で全端末ログアウトした）。
      // page / server action は getMockSession 経由で常に DB 最新を読むので
      // ここの refresh は middleware 用と捉えて良い。
      const ROLE_REFRESH_INTERVAL_MS = 60 * 1000; // 1 分
      const refreshedAt = token.refreshedAt ?? 0;
      const isStale = Date.now() - refreshedAt > ROLE_REFRESH_INTERVAL_MS;
      if ((trigger === 'update' || isStale) && token.id) {
        const u = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            deactivatedAt: true,
            tokenVersion: true,
          },
        });
        if (
          !u ||
          u.deactivatedAt ||
          u.tokenVersion !== token.tokenVersion
        ) {
          // 削除済 / 無効化済 / tokenVersion 不一致 → トークンを実質無効化。
          // middleware は req.auth?.user?.id が無いので未認証扱いし /login にリダイレクト。
          delete token.id;
          delete token.role;
          delete token.email;
          delete token.name;
          delete token.tokenVersion;
          return token;
        }
        token.role = u.role;
        token.name = u.name;
        token.email = u.email;
        token.tokenVersion = u.tokenVersion;
        token.refreshedAt = Date.now();
      }

      return token;
    },
  },
});
