// Edge runtime 安全な NextAuth 設定（middleware 用）。
// Prisma Adapter / Nodemailer は Node 専用なので、ここでは含めず、
// 完全な設定は src/auth.ts 側で extend する。

import type { NextAuthConfig } from 'next-auth';

export default {
  session: { strategy: 'jwt' },
  providers: [], // 実 provider は src/auth.ts で追加
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
  callbacks: {
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) {
        (session.user as { role?: string }).role = token.role as string;
      }
      if (token.name) session.user.name = token.name as string;
      if (token.email) session.user.email = token.email as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
