-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "invoiceNumber" DROP NOT NULL,
ALTER COLUMN "sellerSnapshot" DROP NOT NULL;

-- Existing rows already have a real invoiceNumber + sellerSnapshot — they
-- were fully issued under the pre-DRAFT workflow, so they're FINAL, not
-- DRAFT (the column default above only applies to future inserts).
UPDATE "Invoice" SET "status" = 'FINAL', "finalizedAt" = "createdAt" WHERE "invoiceNumber" IS NOT NULL;
