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
        // mailpit は TLS 不要
        secure: false,
        ignoreTLS: true,
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
    async jwt({ token, user }) {
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
        }
      }
      return token;
    },
  },
});
