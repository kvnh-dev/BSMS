import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Inventory', () => {
  let app: INestApplication;
  let ownerToken: string;
  let technicianToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    technicianToken = await loginAs(app, 'technician');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects non-Owner attempts to create inventory', async () => {
    await authed(app, technicianToken)
      .post('/inventory')
      .send({ name: 'x', category: 'x', hsnCode: '1234', gstRate: 1800, unitPrice: 100 })
      .expect(403);
  });

  it('creates and lists an inventory item', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Brake Pad', category: 'Parts', hsnCode: '8714', gstRate: 1800, unitPrice: 50000, stockQty: 10, reorderPoint: 2 })
      .expect(201);
    expect(created.body.stockQty).toBe(10);
    expect(created.body.reorderPoint).toBe(2);

    const list = await authed(app, ownerToken).get('/inventory').expect(200);
    expect(list.body.some((i: { id: string }) => i.id === created.body.id)).toBe(true);
  });

  it('stores SKU/barcode and rejects a duplicate', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({
        name: 'Air Filter',
        category: 'Parts',
        hsnCode: '8421',
        gstRate: 1800,
        unitPrice: 30000,
        sku: 'AIR-FLT-001',
        barcode: '890123456789',
      })
      .expect(201);
    expect(created.body.sku).toBe('AIR-FLT-001');
    expect(created.body.barcode).toBe('890123456789');

    await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Air Filter Copy', category: 'Parts', hsnCode: '8421', gstRate: 1800, unitPrice: 30000, sku: 'AIR-FLT-001' })
      .expect(400);
  });

  it('finds an item by SKU or barcode via lookup, 404s for an unknown code', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({
        name: 'Clutch Cable',
        category: 'Parts',
        hsnCode: '8483',
        gstRate: 1800,
        unitPrice: 25000,
        sku: 'CLU-CBL-002',
        barcode: '890000000002',
      })
      .expect(201);

    const bySku = await authed(app, ownerToken).get('/inventory/lookup?code=CLU-CBL-002').expect(200);
    expect(bySku.body.id).toBe(created.body.id);

    const byBarcode = await authed(app, ownerToken).get('/inventory/lookup?code=890000000002').expect(200);
    expect(byBarcode.body.id).toBe(created.body.id);

    await authed(app, ownerToken).get('/inventory/lookup?code=NO-SUCH-CODE').expect(404);
  });

  it('finds items via fuzzy search across name/sku/barcode/category (unlike lookup\'s exact match)', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({
        name: 'Go To Bar Search Widget',
        category: 'Parts',
        hsnCode: '8501',
        gstRate: 1800,
        unitPrice: 10000,
        sku: 'GTB-WIDGET-01',
      })
      .expect(201);

    const byPartialName = await authed(app, ownerToken).get('/inventory/search?q=go to bar').expect(200);
    expect(byPartialName.body.some((i: { id: string }) => i.id === created.body.id)).toBe(true);

    const byPartialSku = await authed(app, ownerToken).get('/inventory/search?q=gtb-widget').expect(200);
    expect(byPartialSku.body.some((i: { id: string }) => i.id === created.body.id)).toBe(true);

    const noMatch = await authed(app, ownerToken).get('/inventory/search?q=zzz-no-such-item-zzz').expect(200);
    expect(noMatch.body).toEqual([]);
  });

  it('adjusts stock in the purchase unit, converting to base units', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({
        name: 'Engine Oil 1L',
        category: 'Consumables',
        hsnCode: '2710',
        gstRate: 1800,
        unitPrice: 40000,
        stockQty: 5,
        baseUnit: 'Bottle',
        purchaseUnit: 'Box',
        purchaseUnitFactor: 12,
      })
      .expect(201);

    const adjusted = await authed(app, ownerToken)
      .post(`/inventory/${created.body.id}/adjust-stock`)
      .send({ delta: 2, reason: 'Restock from supplier', unit: 'PURCHASE' })
      .expect(201);
    expect(adjusted.body.stockQty).toBe(5 + 2 * 12);
  });

  it('rejects a purchase-unit adjustment when the item has no purchase unit configured', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Plain Bolt', category: 'Parts', hsnCode: '7318', gstRate: 1800, unitPrice: 500, stockQty: 100 })
      .expect(201);

    await authed(app, ownerToken)
      .post(`/inventory/${created.body.id}/adjust-stock`)
      .send({ delta: 1, reason: 'test', unit: 'PURCHASE' })
      .expect(400);
  });

  it('adjusts stock and records an audit log entry', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Chain Lube', category: 'Consumables', hsnCode: '3403', gstRate: 1800, unitPrice: 20000, stockQty: 5 })
      .expect(201);

    const adjusted = await authed(app, ownerToken)
      .post(`/inventory/${created.body.id}/adjust-stock`)
      .send({ delta: -2, reason: 'Damaged units removed' })
      .expect(201);
    expect(adjusted.body.stockQty).toBe(3);

    const log = await authed(app, ownerToken).get('/audit-log').expect(200);
    expect(
      log.body.some(
        (e: { entity: string; entityId: string; action: string }) =>
          e.entity === 'InventoryItem' && e.entityId === created.body.id && e.action === 'INVENTORY_STOCK_ADJUST',
      ),
    ).toBe(true);
  });

  it('rejects a stock adjustment that would go negative', async () => {
    const created = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Spark Plug', category: 'Parts', hsnCode: '8511', gstRate: 1800, unitPrice: 15000, stockQty: 1 })
      .expect(201);

    await authed(app, ownerToken)
      .post(`/inventory/${created.body.id}/adjust-stock`)
      .send({ delta: -5, reason: 'test' })
      .expect(400);
  });
});
