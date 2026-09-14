import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Purchase Orders', () => {
  let app: INestApplication;
  let ownerToken: string;
  let cashierToken: string;
  let technicianToken: string;
  let supplierId: string;
  let itemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    cashierToken = await loginAs(app, 'cashier');
    technicianToken = await loginAs(app, 'technician');

    const supplier = await authed(app, ownerToken)
      .post('/suppliers')
      .send({ name: 'PO Test Supplier', phone: '9700000001' })
      .expect(201);
    supplierId = supplier.body.id;

    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Brake Pad', category: 'Consumables', hsnCode: '8708', gstRate: 1800, unitPrice: 30000, stockQty: 10 })
      .expect(201);
    itemId = item.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a Technician creating a purchase order', async () => {
    await authed(app, technicianToken)
      .post('/purchase-orders')
      .send({ supplierId, lineItems: [{ inventoryItemId: itemId, description: 'Brake Pad', qty: 1, unitPrice: 30000, gstRate: 1800 }] })
      .expect(403);
  });

  it('lets a Cashier create an OPEN purchase order that does not touch stock', async () => {
    const order = await authed(app, cashierToken)
      .post('/purchase-orders')
      .send({ supplierId, lineItems: [{ inventoryItemId: itemId, description: 'Brake Pad', qty: 2, unitPrice: 30000, gstRate: 1800 }] })
      .expect(201);
    expect(order.body.status).toBe('OPEN');
    expect(order.body.total).toBe(70800); // 60000 + 18%

    const item = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);
    expect(item.body.stockQty).toBe(10); // untouched
  });

  it('lets Owner/Cashier edit an OPEN purchase order', async () => {
    const order = await authed(app, cashierToken)
      .post('/purchase-orders')
      .send({ supplierId, lineItems: [{ inventoryItemId: itemId, description: 'Brake Pad', qty: 1, unitPrice: 30000, gstRate: 1800 }] })
      .expect(201);

    const edited = await authed(app, ownerToken)
      .patch(`/purchase-orders/${order.body.id}`)
      .send({ supplierId, lineItems: [{ inventoryItemId: itemId, description: 'Brake Pad', qty: 3, unitPrice: 30000, gstRate: 1800 }], discount: 0 })
      .expect(200);
    expect(edited.body.total).toBe(106200); // 90000 + 18%
  });

  it('converts an OPEN purchase order into a real PurchaseBill and increases stock immediately', async () => {
    const order = await authed(app, cashierToken)
      .post('/purchase-orders')
      .send({ supplierId, lineItems: [{ inventoryItemId: itemId, description: 'Brake Pad', qty: 4, unitPrice: 30000, gstRate: 1800 }] })
      .expect(201);

    const itemBefore = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);

    const bill = await authed(app, cashierToken).post(`/purchase-orders/${order.body.id}/convert`).expect(201);
    expect(bill.body.total).toBe(order.body.total);
    expect(bill.body.lineItems).toHaveLength(1);
    expect(bill.body.lineItems[0].description).toBe('Brake Pad');

    const itemAfter = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);
    expect(itemAfter.body.stockQty).toBe(itemBefore.body.stockQty + 4); // stock moves right away — no draft stage

    const reloadedOrder = await authed(app, ownerToken).get(`/purchase-orders/${order.body.id}`).expect(200);
    expect(reloadedOrder.body.status).toBe('CONVERTED');
    expect(reloadedOrder.body.purchaseBillId).toBe(bill.body.id);
  });

  it('rejects editing or converting a CONVERTED or CANCELLED purchase order', async () => {
    const converted = await authed(app, cashierToken)
      .post('/purchase-orders')
      .send({ supplierId, lineItems: [{ description: 'Freight', qty: 1, unitPrice: 5000, gstRate: 0 }] })
      .expect(201);
    await authed(app, cashierToken).post(`/purchase-orders/${converted.body.id}/convert`).expect(201);
    await authed(app, cashierToken)
      .patch(`/purchase-orders/${converted.body.id}`)
      .send({ supplierId, lineItems: [{ description: 'Freight', qty: 2, unitPrice: 5000, gstRate: 0 }], discount: 0 })
      .expect(400);
    await authed(app, cashierToken).post(`/purchase-orders/${converted.body.id}/convert`).expect(400);

    const cancelled = await authed(app, cashierToken)
      .post('/purchase-orders')
      .send({ supplierId, lineItems: [{ description: 'Freight', qty: 1, unitPrice: 5000, gstRate: 0 }] })
      .expect(201);
    await authed(app, ownerToken).post(`/purchase-orders/${cancelled.body.id}/cancel`).expect(201);
    await authed(app, cashierToken)
      .patch(`/purchase-orders/${cancelled.body.id}`)
      .send({ supplierId, lineItems: [{ description: 'Freight', qty: 2, unitPrice: 5000, gstRate: 0 }], discount: 0 })
      .expect(400);
  });
});
