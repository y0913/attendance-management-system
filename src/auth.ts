// NextAuth v5 完全設定 (Node runtime 専用)。
// Edge runtime (middleware) 用の最小設定は src/auth.config.ts を使う。

import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import authConfig from '@/auth.config';
import { prisma } from '@/lib/db';

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
        // EMAIL_INSECURE=true で平文許可。
        secure: process.env.EMAIL_INSECURE === 'true' ? false : undefined,
        ignoreTLS: process.env.EMAIL_INSECURE === 'true' ? true : undefined,
      },
      from: process.env.EMAIL_FROM,
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
          select: { id: true, email: true, name: true, role: true },
        });
        if (u) {
          token.id = u.id;
          token.email = u.email;
          token.name = u.name;
          token.role = u.role;
          token.refreshedAt = Date.now();
        }
        return token;
      }

      // 既存トークン: 一定時間経過 or 明示 update() で role を再取得。
      // middleware が見る JWT クレームと DB の真実を同期させる目的。
      // page / server action は getMockSession 経由で常に DB 最新を読むので
      // ここの refresh は middleware 用と捉えて良い。
      const ROLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 分
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
          },
        });
        if (!u || u.deactivatedAt) {
          // 削除済 or 無効化済 → トークンを実質無効化。
          // middleware は req.auth?.user?.id が無いので未認証扱いし /login にリダイレクト。
          delete token.id;
          delete token.role;
          delete token.email;
          delete token.name;
          return token;
        }
        token.role = u.role;
        token.name = u.name;
        token.email = u.email;
        token.refreshedAt = Date.now();
      }

      return token;
    },
  },
});
