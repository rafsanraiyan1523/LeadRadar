-- CreateEnum
CREATE TYPE "OutreachKind" AS ENUM ('OUTREACH', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "OutreachTone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'CONSULTATIVE', 'SHORT');

-- CreateEnum
CREATE TYPE "OutreachLanguage" AS ENUM ('ENGLISH', 'BANGLA', 'BANGLISH');

-- CreateEnum
CREATE TYPE "AIProviderMode" AS ENUM ('MOCK', 'LOCAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AIFeature" AS ENUM ('LEAD_SUMMARY', 'GROWTH_ANALYSIS', 'OUTREACH', 'FOLLOW_UP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OutreachChannel" ADD VALUE 'WHATSAPP';
ALTER TYPE "OutreachChannel" ADD VALUE 'FACEBOOK';

-- DropIndex
DROP INDEX "ai_insights_leadId_idx";

-- AlterTable
ALTER TABLE "ai_insights" ADD COLUMN     "growthAnalysis" TEXT NOT NULL,
ADD COLUMN     "inputsHash" TEXT NOT NULL,
ADD COLUMN     "providerMode" "AIProviderMode" NOT NULL,
ADD COLUMN     "recommendedServices" TEXT[];

-- AlterTable
ALTER TABLE "outreach_messages" ADD COLUMN     "kind" "OutreachKind" NOT NULL DEFAULT 'OUTREACH',
ADD COLUMN     "language" "OutreachLanguage" NOT NULL,
ADD COLUMN     "model" TEXT NOT NULL,
ADD COLUMN     "providerMode" "AIProviderMode" NOT NULL,
ADD COLUMN     "tone" "OutreachTone" NOT NULL;

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "leadId" UUID,
    "feature" "AIFeature" NOT NULL,
    "providerMode" "AIProviderMode" NOT NULL,
    "model" TEXT NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_events_organizationId_createdAt_idx" ON "ai_usage_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_events_leadId_idx" ON "ai_usage_events"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_insights_leadId_key" ON "ai_insights"("leadId");

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

