import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: {},
        name: {},
      },
      async authorize(credentials, req) {
        if (!credentials?.email) return null;

        try {
          // FastAPI 쿠키가 유효한지 /auth/refresh로 검증
          const cookieHeader = (req as Request).headers.get("cookie") ?? "";
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookieHeader },
          });

          if (!res.ok) return null;

          // refresh 응답에서 실제 유저 정보를 파싱 — 백엔드 데이터가 없으면 세션 생성 거부
          const data = await res.json().catch(() => null);
          const backendUser = data?.user ?? data;

          if (!backendUser?.id || !backendUser?.email) return null;

          return {
            id: String(backendUser.id),
            name: backendUser.nickname ?? backendUser.name ?? "",
            email: backendUser.email,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user, account }) {
      // Social login: exchange provider token for backend token
      if (account?.provider === "google") {
        try {
          const res = await fetch(`${API_URL}/auth/social-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "google",
              token: account.id_token, // Google ID token — FastAPI verifies with Google's public keys
            }),
          });

          if (!res.ok) return false;
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
