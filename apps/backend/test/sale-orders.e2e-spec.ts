import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Sale Orders', () => {
  let app: INestApplication;
  let ownerToken: string;
  let cashierToken: string;
  let technicianToken: string;
  let customerId: string;
  let itemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    cashierToken = await loginAs(app, 'cashier');
    technicianToken = await loginAs(app, 'technician');

    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Sale Order Customer', phone: '9600000001' })
      .expect(201);
    customerId = customer.body.id;

    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Chain Lube', category: 'Consumables', hsnCode: '3403', gstRate: 1800, unitPrice: 20000, stockQty: 20 })
      .expect(201);
    itemId = item.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a Technician creating a sale order', async () => {
    await authed(app, technicianToken)
      .post('/sale-orders')
      .send({ customerId, lineItems: [{ inventoryItemId: itemId, description: 'Chain Lube', qty: 1, unitPrice: 20000, gstRate: 1800 }] })
      .expect(403);
  });

  it('lets a Cashier create an OPEN sale order that does not touch stock', async () => {
    const order = await authed(app, cashierToken)
      .post('/sale-orders')
      .send({ customerId, lineItems: [{ inventoryItemId: itemId, description: 'Chain Lube', qty: 2, unitPrice: 20000, gstRate: 1800 }] })
      .expect(201);
    expect(order.body.status).toBe('OPEN');
    expect(order.body.total).toBe(47200); // 40000 + 18%

    const item = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);
    expect(item.body.stockQty).toBe(20); // untouched
  });

  it('lets Owner/Cashier edit an OPEN sale order', async () => {
    const order = await authed(app, cashierToken)
      .post('/sale-orders')
      .send({ customerId, lineItems: [{ inventoryItemId: itemId, description: 'Chain Lube', qty: 1, unitPrice: 20000, gstRate: 1800 }] })
      .expect(201);

    const edited = await authed(app, ownerToken)
      .patch(`/sale-orders/${order.body.id}`)
      .send({ customerId, lineItems: [{ inventoryItemId: itemId, description: 'Chain Lube', qty: 3, unitPrice: 20000, gstRate: 1800 }], discount: 0 })
      .expect(200);
    expect(edited.body.total).toBe(70800); // 60000 + 18%
  });

  it('converts an OPEN sale order into a real DRAFT invoice with matching line items, and deducts no stock until the invoice is finalized', async () => {
    const order = await authed(app, cashierToken)
      .post('/sale-orders')
      .send({ customerId, lineItems: [{ inventoryItemId: itemId, description: 'Chain Lube', qty: 2, unitPrice: 20000, gstRate: 1800 }] })
      .expect(201);

    const invoice = await authed(app, cashierToken).post(`/sale-orders/${order.body.id}/convert`).expect(201);
    expect(invoice.body.status).toBe('DRAFT');
    expect(invoice.body.invoiceNumber).toBeNull();
    expect(invoice.body.total).toBe(order.body.total);
    expect(invoice.body.lineItems).toHaveLength(1);
    expect(invoice.body.lineItems[0].description).toBe('Chain Lube');

    const itemBeforeFinalize = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);
    expect(itemBeforeFinalize.body.stockQty).toBe(20); // still untouched — only finalize deducts stock

    const reloadedOrder = await authed(app, ownerToken).get(`/sale-orders/${order.body.id}`).expect(200);
    expect(reloadedOrder.body.status).toBe('CONVERTED');
    expect(reloadedOrder.body.invoiceId).toBe(invoice.body.id);

    await authed(app, cashierToken).post(`/invoices/${invoice.body.id}/finalize`).expect(201);
    const itemAfterFinalize = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);
    expect(itemAfterFinalize.body.stockQty).toBe(18); // 20 - 2
  });

  it('rejects editing or converting a CONVERTED or CANCELLED sale order', async () => {
    const converted = await authed(app, cashierToken)
      .post('/sale-orders')
      .send({ customerId, lineItems: [{ description: 'Misc', qty: 1, unitPrice: 5000, gstRate: 0 }] })
      .expect(201);
    await authed(app, cashierToken).post(`/sale-orders/${converted.body.id}/convert`).expect(201);
    await authed(app, cashierToken)
      .patch(`/sale-orders/${converted.body.id}`)
      .send({ customerId, lineItems: [{ description: 'Misc', qty: 2, unitPrice: 5000, gstRate: 0 }], discount: 0 })
      .expect(400);
    await authed(app, cashierToken).post(`/sale-orders/${converted.body.id}/convert`).expect(400);

    const cancelled = await authed(app, cashierToken)
      .post('/sale-orders')
      .send({ customerId, lineItems: [{ description: 'Misc', qty: 1, unitPrice: 5000, gstRate: 0 }] })
      .expect(201);
    await authed(app, ownerToken).post(`/sale-orders/${cancelled.body.id}/cancel`).expect(201);
    await authed(app, cashierToken)
      .patch(`/sale-orders/${cancelled.body.id}`)
      .send({ customerId, lineItems: [{ description: 'Misc', qty: 2, unitPrice: 5000, gstRate: 0 }], discount: 0 })
      .expect(400);
  });
});
