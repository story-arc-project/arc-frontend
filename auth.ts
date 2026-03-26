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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const { data } = await res.json();
          return {
            id: data.user_id ?? credentials.email,
            name: data.name ?? "",
            email: credentials.email as string,
            accessToken: data.access_token,
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

          const { data } = await res.json();
          // Attach accessToken to user object so jwt callback can pick it up
          (user as Record<string, unknown>).accessToken = data.access_token;
        } catch {
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.accessToken = (user as Record<string, unknown>).accessToken as string;
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
