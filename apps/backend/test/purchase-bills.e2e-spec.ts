import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Purchase Bills', () => {
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
      .send({ name: 'Bill Test Supplier', phone: '9700000002' })
      .expect(201);
    supplierId = supplier.body.id;

    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Engine Oil 1L', category: 'Consumables', hsnCode: '2710', gstRate: 1800, unitPrice: 25000, stockQty: 5 })
      .expect(201);
    itemId = item.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a Technician creating a purchase bill', async () => {
    await authed(app, technicianToken)
      .post('/purchase-bills')
      .send({ supplierId, lineItems: [{ inventoryItemId: itemId, description: 'Engine Oil 1L', qty: 1, unitPrice: 20000, gstRate: 1800 }] })
      .expect(403);
  });

  it('records a purchase bill and increases stock immediately — no draft stage', async () => {
    const bill = await authed(app, cashierToken)
      .post('/purchase-bills')
      .send({
        supplierId,
        billNumber: 'SUP-INV-001',
        lineItems: [{ inventoryItemId: itemId, description: 'Engine Oil 1L', qty: 10, unitPrice: 20000, gstRate: 1800 }],
      })
      .expect(201);
    expect(bill.body.total).toBe(236000); // 200000 + 18%
    expect(bill.body.billNumber).toBe('SUP-INV-001');

    const item = await authed(app, ownerToken).get(`/inventory/${itemId}`).expect(200);
    expect(item.body.stockQty).toBe(15); // 5 + 10, moved immediately
  });

  it('tracks balanceDue as payments are recorded and voided', async () => {
    const bill = await authed(app, cashierToken)
      .post('/purchase-bills')
      .send({
        supplierId,
        lineItems: [{ inventoryItemId: itemId, description: 'Engine Oil 1L', qty: 5, unitPrice: 20000, gstRate: 1800 }],
      })
      .expect(201);
    const billId = bill.body.id;

    let fetched = await authed(app, ownerToken).get(`/purchase-bills/${billId}`).expect(200);
    expect(fetched.body.paidAmount).toBe(0);
    expect(fetched.body.balanceDue).toBe(118000); // 100000 + 18%

    const payment = await authed(app, cashierToken)
      .post(`/purchase-bills/${billId}/payments`)
      .send({ amount: 50000, mode: 'BANK_TRANSFER', reference: 'NEFT001' })
      .expect(201);

    fetched = await authed(app, ownerToken).get(`/purchase-bills/${billId}`).expect(200);
    expect(fetched.body.paidAmount).toBe(50000);
    expect(fetched.body.balanceDue).toBe(68000);

    await authed(app, cashierToken).post(`/purchase-bills/${billId}/payments`).send({ amount: 68000, mode: 'CASH' }).expect(201);
    fetched = await authed(app, ownerToken).get(`/purchase-bills/${billId}`).expect(200);
    expect(fetched.body.paidAmount).toBe(118000);
    expect(fetched.body.balanceDue).toBe(0);

    // Cashier cannot void; Owner can, and it's logged + restores the balance.
    await authed(app, cashierToken)
      .patch(`/supplier-payments/${payment.body.id}/void`)
      .send({ reason: 'Wrong amount' })
      .expect(403);
    await authed(app, ownerToken)
      .patch(`/supplier-payments/${payment.body.id}/void`)
      .send({ reason: 'Wrong amount' })
      .expect(200);

    fetched = await authed(app, ownerToken).get(`/purchase-bills/${billId}`).expect(200);
    expect(fetched.body.paidAmount).toBe(68000);
    expect(fetched.body.balanceDue).toBe(50000);

    const list = await authed(app, ownerToken).get(`/purchase-bills/${billId}/payments`).expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.find((p: { id: string }) => p.id === payment.body.id).voided).toBe(true);
  });
});
