-- AlterTable: add nullable first so existing rows can be backfilled
ALTER TABLE "Invoice" ADD COLUMN     "sellerSnapshot" JSONB;

-- Backfill existing rows from the current ShowroomProfile — this is
-- dev-only data at the time of writing (an approximation, since we can't
-- know what the profile looked like when these were actually created);
-- new rows always capture the profile at time of invoice creation, per
-- InvoicesService.create().
UPDATE "Invoice" i
SET "sellerSnapshot" = jsonb_build_object(
  'name', p."name",
  'address', p."address",
  'gstin', p."gstin",
  'pan', p."pan",
  'state', p."state",
  'contactNumber', p."contactNumber"
)
FROM "ShowroomProfile" p;

-- Now enforce NOT NULL
ALTER TABLE "Invoice" ALTER COLUMN "sellerSnapshot" SET NOT NULL;
