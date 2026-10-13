-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN "analysesThisMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "analysesResetAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
