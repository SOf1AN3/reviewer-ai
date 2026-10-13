import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env, isEmailEnabled } from "@/lib/env";
import { logEvent } from "@/lib/logger";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;

/**
 * Le provider Google n'est exposé que si ses identifiants sont configurés
 * (obligatoires en production, optionnels en développement). Sans eux, il est
 * simplement exclu de la liste : l'authentification par credentials continue
 * de fonctionner sans valeurs `undefined`.
 */
const googleProvider =
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
      })
    : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Validation stricte sans `as string` : un corps non textuel (nombres,
        // objets…) est refusé avant tout accès à la base.
        if (
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }

        const email = credentials.email.trim();
        if (email.length === 0) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
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
  callbacks: {
    /**
     * Garde-fou d'email vérifié (connexion par credentials uniquement) :
     * - `isEmailEnabled === false` (pas de clé RESEND_API_KEY) → bypass, la
     *   connexion est toujours acceptée : c'est la seule source de vérité du
     *   bypass, aucun booléen codé en dur ;
     * - `isEmailEnabled === true` → un compte créé avec `emailVerified === null`
     *   ne peut PAS se connecter tant que le lien de vérification n'a pas été
     *   ouvert (les comptes OAuth passent par `account.provider !== "credentials"`
     *   et ne sont pas concernés).
     * En cas d'erreur base : fail-closed (`false`), jamais de session à
     * l'aveugle. Le refus est journalisé sans détail sensible.
     */
    async signIn({ user, account }) {
      if (!isEmailEnabled) {
        return true;
      }

      if (!account || account.provider !== "credentials") {
        return true;
      }

      const email = user.email;
      if (!email) {
        return false;
      }

      try {
        const dbUser = await db.user.findUnique({
          where: { email },
          select: { emailVerified: true },
        });

        const allowed = dbUser !== null && dbUser.emailVerified !== null;
        if (!allowed) {
          logEvent("auth", {
            step: "signin_refused",
            reason: dbUser === null ? "user_not_found" : "email_not_verified",
          });
        }
        return allowed;
      } catch (error) {
        logEvent("auth", {
          step: "signin_guard_failed",
          error: error instanceof Error ? error.message : "unknown_error",
        });
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
