-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "lead_websites" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "pagesCrawled" INTEGER;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "enrichmentError" TEXT,
ADD COLUMN     "enrichmentJobId" TEXT,
ADD COLUMN     "enrichmentProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3);

