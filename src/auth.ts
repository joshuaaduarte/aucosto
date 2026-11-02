import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { countEventsSince, recordEvent } from "@/lib/services/events";

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
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
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
