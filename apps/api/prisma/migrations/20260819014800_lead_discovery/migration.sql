-- CreateEnum
CREATE TYPE "SearchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderMode" AS ENUM ('MOCK', 'GOOGLE');

-- DropIndex
DROP INDEX "searches_organizationId_idx";

-- AlterTable
ALTER TABLE "search_results" DROP COLUMN "googlePlaceId",
ADD COLUMN     "businessStatus" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "googleMapsUri" TEXT,
ADD COLUMN     "hasGoogleProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opportunityScore" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER,
ADD COLUMN     "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "searches" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerMode" "ProviderMode" NOT NULL,
ADD COLUMN     "status" "SearchStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "search_results_searchId_rating_idx" ON "search_results"("searchId", "rating");

-- CreateIndex
CREATE INDEX "searches_organizationId_createdAt_idx" ON "searches"("organizationId", "createdAt");

