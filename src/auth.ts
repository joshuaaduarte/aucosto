import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { countEventsSince, recordEvent } from "@/lib/services/events";
import { acceptPendingInviteForUser, isEmailAllowedToSignIn } from "@/lib/household";
import { isGoogleSignInConfigured } from "@/lib/auth-providers";

// Brute-force guard: after this many failed sign-ins in the window, the
// account refuses every attempt (even a correct password) until it passes.
// Stored in the Event log so it holds across serverless instances.
const LOGIN_FAILURE_LIMIT = 10;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // Invite-only: an OAuth sign-in is let through only for an email that
    // already has an account or holds a live household invite. Without this
    // the adapter would create an account for any Google user.
    async signIn({ account, profile, user }) {
      if (!account || account.provider === "credentials") return true;
      const email = profile?.email ?? user?.email;
      if (!email) return false;
      if (account.provider === "google" && profile?.email_verified !== true) {
        return false;
      }
      return isEmailAllowedToSignIn(email);
    },
    async jwt(params) {
      // `user` is only present at sign-in: join a household if this email
      // was invited (covers both the Google and password paths).
      if (params.user?.id && params.user.email) {
        try {
          await acceptPendingInviteForUser(params.user.id, params.user.email);
        } catch (error) {
          console.error("[auth] invite acceptance failed", error);
        }
      }
      return authConfig.callbacks.jwt(params);
    },
  },
  providers: [
    ...(isGoogleSignInConfigured()
      ? [
          Google({
            // Google verifies email ownership, and signIn above admits only
            // known or invited emails, so linking to the existing account
            // with the same email is safe here.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: parsed.data.email.trim(), mode: "insensitive" } },
        });
        if (!user?.password) return null;

        const recentFailures = await countEventsSince(
          user.id,
          "user.login_failed",
          new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS),
        );
        if (recentFailures >= LOGIN_FAILURE_LIMIT) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) {
          await recordEvent({
            userId: user.id,
            tool: "events",
            type: "user.login_failed",
          });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
