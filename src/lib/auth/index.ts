import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Demo auth: accept any email/password combo
        // TODO: Replace with real DB lookup + bcrypt check against users table
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Return a demo user object
        return {
          id: "demo-user-001",
          email: credentials.email,
          name: credentials.email.split("@")[0],
          role: "student",
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: "/auth/signin",
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, persist user fields into the JWT
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "student";
      }
      return token;
    },

    async session({ session, token }) {
      // Expose id and role on the client-side session object
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
