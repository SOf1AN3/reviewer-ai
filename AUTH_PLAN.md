# Plan d'authentification - PaperLens

## Choix technologique

**NextAuth.js v5 (Auth.js)** avec :
- **Prisma Adapter** (stocker users/sessions/accounts dans PostgreSQL/Neon)
- **Google Provider** (OAuth)
- **Credentials Provider** (email + mot de passe, hashé avec bcrypt)

## Étapes

### 1. Installation des dépendances

```
next-auth@beta @next-auth/prisma-adapter bcryptjs @types/bcryptjs
```

### 2. Mise à jour du schema Prisma

Ajouter les modèles `User`, `Account`, `Session`, `VerificationToken` (modèles standard NextAuth).

Ajouter un champ `userId` à `Article` pour lier chaque article à un utilisateur.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?
  accounts      Account[]
  sessions      Session[]
  articles      Article[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}
```

Modifier `Article` :
```prisma
model Article {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  titre       String
  contenu     String    @db.Text
  auteur      String?
  revueCiblee String?
  dateCreation DateTime @default(now())
  analyses    Analyse[]
}
```

### 3. Fichier `src/lib/auth.ts`

Configuration NextAuth avec :
- PrismaAdapter
- Google Provider + Credentials Provider
- Stratégie JWT
- Callbacks pour attacher userId au token
- Fonction `register(email, password)` avec hash bcrypt

### 4. Route API `src/app/api/auth/[...nextauth]/route.ts`

Point d'entrée NextAuth (GET/POST).

### 5. Route API `src/app/api/auth/register/route.ts`

Endpoint POST pour l'inscription email/mot de passe :
- Validation Zod (email + password)
- Vérification unicité email
- Hash bcrypt du mot de passe
- Création utilisateur

### 6. Provider `src/components/SessionProvider.tsx`

Wrapper `<SessionProvider>` pour exposer la session côté client.

### 7. Middleware `src/middleware.ts`

Protéger les routes :
- `/historique`, `/analyse/[id]` → requiert auth
- `/api/analyze`, `/api/history`, `/api/analyse/[id]`, `/api/upload` → requiert auth
- `/`, `/api/auth/*` → public

### 8. Pages d'auth `src/app/(auth)/`

- `login/page.tsx` — formulaire email/mdp + bouton Google + lien inscription
- `register/page.tsx` — formulaire inscription + lien connexion

### 9. Mise à jour du Header

- Afficher nom/email + bouton "Déconnexion" si authentifié
- Afficher "Connexion" / "Inscription" sinon

### 10. Mise à jour des API routes

Modifier `/api/analyze`, `/api/history`, `/api/analyse/[id]`, `/api/upload` :
- Récupérer session via `getServerSession(authOptions)`
- Filtrer les données par `userId`
- Retourner 401 si non authentifié

### 11. Variables d'environnement

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<générer>
GOOGLE_CLIENT_ID=<Google Cloud Console>
GOOGLE_CLIENT_SECRET=<Google Cloud Console>
```

## Fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `prisma/schema.prisma` | Modifié |
| `src/lib/auth.ts` | Créé |
| `src/app/api/auth/[...nextauth]/route.ts` | Créé |
| `src/app/api/auth/register/route.ts` | Créé |
| `src/components/SessionProvider.tsx` | Créé |
| `src/middleware.ts` | Créé |
| `src/app/(auth)/login/page.tsx` | Créé |
| `src/app/(auth)/register/page.tsx` | Créé |
| `src/app/layout.tsx` | Modifié |
| `src/components/Header.tsx` | Modifié |
| `src/app/api/analyze/route.ts` | Modifié |
| `src/app/api/history/route.ts` | Modifié |
| `src/app/api/analyse/[id]/route.ts` | Modifié |
| `src/app/api/upload/route.ts` | Modifié |
| `.env.local` | Modifié |
