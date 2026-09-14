-- AlterTable: add nullable first so existing rows can be backfilled
ALTER TABLE "ServicePartUsed" ADD COLUMN     "gstRateAtUse" INTEGER;

-- Backfill existing rows from the inventory item's current GST rate — this
-- is dev-only test data at the time of writing, so "current rate" is an
-- acceptable approximation; new rows always capture the rate at time of use.
UPDATE "ServicePartUsed" sp
SET "gstRateAtUse" = i."gstRate"
FROM "InventoryItem" i
WHERE sp."inventoryItemId" = i."id";

-- Now enforce NOT NULL
ALTER TABLE "ServicePartUsed" ALTER COLUMN "gstRateAtUse" SET NOT NULL;

-- CreateTable
CREATE TABLE "ServiceCharge" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "gstRate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCharge_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
