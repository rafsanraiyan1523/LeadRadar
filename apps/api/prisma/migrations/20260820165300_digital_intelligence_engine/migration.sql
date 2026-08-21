/*
  Warnings:

  - You are about to drop the column `description` on the `growth_opportunities` table. All the data in the column will be lost.
  - Added the required column `evidence` to the `growth_opportunities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recommendation` to the `growth_opportunities` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GoogleProfileStatus" AS ENUM ('FOUND', 'NOT_FOUND_IN_CURRENT_SEARCH', 'UNVERIFIED');

-- AlterTable
ALTER TABLE "google_business_profiles" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photosAvailable" BOOLEAN,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "status" "GoogleProfileStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "websiteUrl" TEXT,
ALTER COLUMN "placeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "growth_opportunities" DROP COLUMN "description",
ADD COLUMN     "evidence" TEXT NOT NULL,
ADD COLUMN     "recommendation" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "website_audits" ADD COLUMN     "contactabilityScore" INTEGER,
ADD COLUMN     "conversionScore" INTEGER,
ADD COLUMN     "mobileScore" INTEGER,
ADD COLUMN     "signals" JSONB,
ADD COLUMN     "technicalScore" INTEGER,
ADD COLUMN     "websiteScore" INTEGER;
