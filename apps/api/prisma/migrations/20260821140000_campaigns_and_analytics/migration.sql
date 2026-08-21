-- CreateEnum
CREATE TYPE "CampaignService" AS ENUM ('WEBSITE_DEVELOPMENT', 'SEO', 'GOOGLE_BUSINESS_OPTIMIZATION', 'ONLINE_BOOKING', 'ECOMMERCE', 'SOCIAL_MEDIA', 'PAID_ADS', 'CUSTOM_SOFTWARE');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "channel" "OutreachChannel" NOT NULL,
ADD COLUMN     "service" "CampaignService" NOT NULL,
ADD COLUMN     "targetCategory" TEXT,
ADD COLUMN     "targetLocation" TEXT,
ADD COLUMN     "tone" "OutreachTone" NOT NULL;

-- AlterTable
ALTER TABLE "outreach_messages" ADD COLUMN     "campaignId" UUID;

-- CreateIndex
CREATE INDEX "outreach_messages_campaignId_idx" ON "outreach_messages"("campaignId");

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

