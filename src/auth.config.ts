import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config. No DB adapter, no provider implementations that
// touch Node-only APIs. Middleware imports this directly so it can verify
// the session JWT at the edge without dragging in Prisma/bcrypt.
export default {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnApp = nextUrl.pathname.startsWith("/app");
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnApp && !isLoggedIn) {
        return false;
      }
      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL("/app", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
