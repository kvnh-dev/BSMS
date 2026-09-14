-- Reorder Point rename: a plain column rename preserves all existing data
-- (unlike drop+add, which would silently reset every item's threshold to 0).
ALTER TABLE "InventoryItem" RENAME COLUMN "reorderLevel" TO "reorderPoint";

-- SKU/barcode: nullable + unique, so existing rows are unaffected and
-- uniqueness is enforced only once a value is set.
ALTER TABLE "InventoryItem" ADD COLUMN     "sku" TEXT,
ADD COLUMN     "barcode" TEXT;
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");
CREATE UNIQUE INDEX "InventoryItem_barcode_key" ON "InventoryItem"("barcode");

-- Units of measure: all-defaulted so every existing item keeps behaving
-- exactly as before (baseUnit=saleUnit=purchaseUnit="PCS"-equivalent,
-- factor 1) until an owner explicitly configures alternate units.
ALTER TABLE "InventoryItem" ADD COLUMN     "baseUnit" TEXT NOT NULL DEFAULT 'PCS',
ADD COLUMN     "purchaseUnit" TEXT,
ADD COLUMN     "purchaseUnitFactor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "saleUnit" TEXT,
ADD COLUMN     "saleUnitFactor" INTEGER NOT NULL DEFAULT 1;

-- Snapshot the resolved sale unit onto each historical line-item row so a
-- later change to an item's unit setup never rewrites past documents —
-- same convention as priceAtUse/gstRateAtUse.
ALTER TABLE "ServicePartUsed" ADD COLUMN     "unitFactor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unitLabel" TEXT;

ALTER TABLE "InvoiceLineItem" ADD COLUMN     "unitFactor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unitLabel" TEXT;

ALTER TABLE "SaleOrderLineItem" ADD COLUMN     "unitFactor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unitLabel" TEXT;
