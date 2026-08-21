-- AlterEnum
BEGIN;
CREATE TYPE "OutreachChannel_new" AS ENUM ('EMAIL', 'WHATSAPP', 'FACEBOOK', 'LINKEDIN', 'SMS');
ALTER TABLE "outreach_messages" ALTER COLUMN "channel" TYPE "OutreachChannel_new" USING ("channel"::text::"OutreachChannel_new");
ALTER TYPE "OutreachChannel" RENAME TO "OutreachChannel_old";
ALTER TYPE "OutreachChannel_new" RENAME TO "OutreachChannel";
DROP TYPE "OutreachChannel_old";
COMMIT;

