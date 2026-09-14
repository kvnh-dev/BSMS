import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

// Builds a ticket through to IN_SERVICE with an estimate (the customer-facing
// quote) *and* an actual recorded service charge (what billing is derived
// from) — mirroring service-workflow.e2e-spec.ts — kept self-contained here
// rather than depending on that file's data, since cross-file ordering
// shouldn't be load-bearing.
let bikeCounter = 0;

async function buildBillableTicket(app: INestApplication, ownerToken: string, technicianToken: string) {
  bikeCounter += 1;
  const customer = await authed(app, ownerToken)
    .post('/customers')
    .send({ name: 'Billing Test Customer', phone: '9222222222' })
    .expect(201);
  const bike = await authed(app, ownerToken)
    .post('/bikes')
    .send({
      regNo: `KA05BL${String(bikeCounter).padStart(4, '0')}`,
      chassisNo: `BLCHASSIS${String(bikeCounter).padStart(4, '0')}`,
      model: 'Splendor',
      customerId: customer.body.id,
    })
    .expect(201);
  const ticket = await authed(app, technicianToken)
    .post('/service-tickets')
    .send({ bikeId: bike.body.id, complaint: 'Brake service' })
    .expect(201);
  await authed(app, technicianToken)
    .put(`/service-tickets/${ticket.body.id}/estimate`)
    .send({ lineItems: [{ description: 'Brake pads', qty: 1, unitPricePaise: 50000, gstRateBps: 1800 }], discount: 0 })
    .expect(200);
  await authed(app, technicianToken).patch(`/service-tickets/${ticket.body.id}/status`).send({ status: 'APPROVED' }).expect(200);
  await authed(app, technicianToken).patch(`/service-tickets/${ticket.body.id}/status`).send({ status: 'IN_SERVICE' }).expect(200);
  // The actual work recorded during service — this, not the estimate above,
  // is what InvoicesService derives the bill from.
  await authed(app, technicianToken)
    .post(`/service-tickets/${ticket.body.id}/charges`)
    .send({ description: 'Brake pads', amount: 50000, gstRate: 1800 })
    .expect(201);
  return { ticketId: ticket.body.id, customerId: customer.body.id };
}

describe('Invoices & Delivery', () => {
  let app: INestApplication;
  let ownerToken: string;
  let technicianToken: string;
  let cashierToken: string;
  let deliveryToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    technicianToken = await loginAs(app, 'technician');
    cashierToken = await loginAs(app, 'cashier');
    deliveryToken = await loginAs(app, 'delivery');
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a DRAFT with no invoice number, then Finalize assigns one and moves the ticket to BILLED', async () => {
    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);

    const draft = await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);
    expect(draft.body.status).toBe('DRAFT');
    expect(draft.body.invoiceNumber).toBeNull();

    const ticketStillInService = await authed(app, ownerToken).get(`/service-tickets/${ticketId}`).expect(200);
    expect(ticketStillInService.body.status).toBe('IN_SERVICE');

    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    expect(invoice.body.status).toBe('FINAL');
    expect(invoice.body.invoiceNumber).toMatch(/^TST-\d{4}-\d{4}$/);
    expect(invoice.body.total).toBe(59000); // 50000 + 18% GST

    const ticket = await authed(app, ownerToken).get(`/service-tickets/${ticketId}`).expect(200);
    expect(ticket.body.status).toBe('BILLED');
    expect(ticket.body.actualAmount).toBe(59000);
  });

  it('rejects billing the same ticket twice', async () => {
    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);
    await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);
    await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(400);
  });

  it('rejects a Technician marking a billed ticket delivered, and records who/when it was delivered', async () => {
    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);
    const draft = await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);
    await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);

    await authed(app, technicianToken)
      .patch(`/service-tickets/${ticketId}/status`)
      .send({ status: 'DELIVERED' })
      .expect(403);

    const deliveryUser = await authed(app, deliveryToken).get('/auth/me').expect(200);
    await authed(app, deliveryToken)
      .patch(`/service-tickets/${ticketId}/status`)
      .send({ status: 'DELIVERED' })
      .expect(200);

    const ticket = await authed(app, ownerToken).get(`/service-tickets/${ticketId}`).expect(200);
    expect(ticket.body.deliveredById).toBe(deliveryUser.body.sub);
    expect(ticket.body.deliveredBy.name).toBe('Test Delivery');
    expect(ticket.body.deliveredAt).toBeTruthy();
  });

  it('counts a just-delivered ticket toward its technician in the reports dashboard', async () => {
    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);
    const technicianUser = await authed(app, technicianToken).get('/auth/me').expect(200);
    const draft = await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);
    await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    await authed(app, deliveryToken).patch(`/service-tickets/${ticketId}/status`).send({ status: 'DELIVERED' }).expect(200);

    const res = await authed(app, ownerToken).get('/reports/dashboard-summary?period=month').expect(200);
    const entry = res.body.technicianPerformance.find(
      (t: { technicianId: string }) => t.technicianId === technicianUser.body.sub,
    );
    expect(entry).toBeTruthy();
    expect(entry.ticketsDelivered).toBeGreaterThanOrEqual(1);
  });

  it('creates a standalone sale draft (no stock deducted yet), and Finalize deducts inventory stock', async () => {
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Walk-in Customer', phone: '9333333333' })
      .expect(201);
    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Helmet', category: 'Accessories', hsnCode: '6506', gstRate: 1800, unitPrice: 150000, stockQty: 5 })
      .expect(201);

    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId: customer.body.id,
        lineItems: [{ inventoryItemId: item.body.id, description: 'Helmet', qty: 2, unitPrice: 150000, gstRate: 1800 }],
      })
      .expect(201);
    expect(draft.body.total).toBe(354000); // 300000 + 18%

    const itemBeforeFinalize = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(itemBeforeFinalize.body.stockQty).toBe(5); // untouched while still a draft

    await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);

    const updatedItem = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(updatedItem.body.stockQty).toBe(3); // 5 - 2
  });

  it('rejects an invoice with neither ticketId nor customerId', async () => {
    await authed(app, cashierToken)
      .post('/invoices')
      .send({ lineItems: [{ description: 'x', qty: 1, unitPrice: 100, gstRate: 0 }] })
      .expect(400);
  });

  it('rejects billing a ticket with no parts or charges recorded, even with an estimate', async () => {
    bikeCounter += 1;
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'No Work Recorded', phone: '9444444444' })
      .expect(201);
    const bike = await authed(app, ownerToken)
      .post('/bikes')
      .send({
        regNo: `KA05BL${String(bikeCounter).padStart(4, '0')}`,
        chassisNo: `BLCHASSIS${String(bikeCounter).padStart(4, '0')}`,
        model: 'Splendor',
        customerId: customer.body.id,
      })
      .expect(201);
    const ticket = await authed(app, technicianToken)
      .post('/service-tickets')
      .send({ bikeId: bike.body.id, complaint: 'Brake service' })
      .expect(201);
    await authed(app, technicianToken)
      .put(`/service-tickets/${ticket.body.id}/estimate`)
      .send({ lineItems: [{ description: 'Brake pads', qty: 1, unitPricePaise: 50000, gstRateBps: 1800 }], discount: 0 })
      .expect(200);
    await authed(app, technicianToken).patch(`/service-tickets/${ticket.body.id}/status`).send({ status: 'APPROVED' }).expect(200);
    await authed(app, technicianToken).patch(`/service-tickets/${ticket.body.id}/status`).send({ status: 'IN_SERVICE' }).expect(200);

    await authed(app, cashierToken).post('/invoices').send({ ticketId: ticket.body.id }).expect(400);
  });

  it('keeps a previously-issued invoice showing the seller details at the time it was created, even after the profile is renamed', async () => {
    const profileBefore = await authed(app, ownerToken).get('/showroom-profile').expect(200);
    const originalName = profileBefore.body.name;

    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Snapshot Test Customer', phone: '9555555555' })
      .expect(201);
    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({ customerId: customer.body.id, lineItems: [{ description: 'x', qty: 1, unitPrice: 100, gstRate: 0 }] })
      .expect(201);
    expect(draft.body.sellerSnapshot).toBeNull(); // not captured until finalize
    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    expect(invoice.body.sellerSnapshot.name).toBe(originalName);

    try {
      await authed(app, ownerToken).patch('/showroom-profile').send({ name: 'Renamed Showroom Co' }).expect(200);

      const reloaded = await authed(app, cashierToken).get(`/invoices/${invoice.body.id}`).expect(200);
      expect(reloaded.body.sellerSnapshot.name).toBe(originalName);
      expect(reloaded.body.sellerSnapshot.name).not.toBe('Renamed Showroom Co');

      const profileAfter = await authed(app, ownerToken).get('/showroom-profile').expect(200);
      expect(profileAfter.body.name).toBe('Renamed Showroom Co');
    } finally {
      // Restore so later tests (and re-runs) see the original seeded name.
      await authed(app, ownerToken).patch('/showroom-profile').send({ name: originalName }).expect(200);
    }
  });

  it('lets Owner/Cashier edit a standalone-sale draft before finalizing, but rejects editing a ticket-based draft', async () => {
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Draft Edit Customer', phone: '9666666666' })
      .expect(201);
    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({ customerId: customer.body.id, lineItems: [{ description: 'Oil change', qty: 1, unitPrice: 10000, gstRate: 1800 }] })
      .expect(201);
    expect(draft.body.total).toBe(11800);

    const edited = await authed(app, cashierToken)
      .patch(`/invoices/${draft.body.id}/draft`)
      .send({ lineItems: [{ description: 'Oil change', qty: 2, unitPrice: 10000, gstRate: 1800 }], discount: 0 })
      .expect(200);
    expect(edited.body.total).toBe(23600);

    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);
    const ticketDraft = await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);
    await authed(app, cashierToken)
      .patch(`/invoices/${ticketDraft.body.id}/draft`)
      .send({ lineItems: [{ description: 'x', qty: 1, unitPrice: 100, gstRate: 0 }], discount: 0 })
      .expect(400);
  });

  it('rejects editing an already-finalized invoice via the draft route', async () => {
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Final Edit Reject Customer', phone: '9777777777' })
      .expect(201);
    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({ customerId: customer.body.id, lineItems: [{ description: 'x', qty: 1, unitPrice: 100, gstRate: 0 }] })
      .expect(201);
    await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);

    await authed(app, cashierToken)
      .patch(`/invoices/${draft.body.id}/draft`)
      .send({ lineItems: [{ description: 'y', qty: 1, unitPrice: 200, gstRate: 0 }], discount: 0 })
      .expect(400);
  });

  it('rejects a Cashier revising a finalized invoice, but lets the Owner revise it with stock reconciled and an audit trail', async () => {
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Revise Test Customer', phone: '9888888888' })
      .expect(201);
    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Brake Pad Set', category: 'Parts', hsnCode: '8714', gstRate: 1800, unitPrice: 50000, stockQty: 10 })
      .expect(201);

    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId: customer.body.id,
        lineItems: [{ inventoryItemId: item.body.id, description: 'Brake Pad Set', qty: 2, unitPrice: 50000, gstRate: 1800 }],
      })
      .expect(201);
    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);

    const afterFinalize = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(afterFinalize.body.stockQty).toBe(8); // 10 - 2

    await authed(app, cashierToken)
      .patch(`/invoices/${invoice.body.id}/revise`)
      .send({
        lineItems: [{ inventoryItemId: item.body.id, description: 'Brake Pad Set', qty: 3, unitPrice: 50000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(403);

    const revised = await authed(app, ownerToken)
      .patch(`/invoices/${invoice.body.id}/revise`)
      .send({
        lineItems: [{ inventoryItemId: item.body.id, description: 'Brake Pad Set', qty: 3, unitPrice: 50000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(200);
    expect(revised.body.total).toBe(177000); // 3 * 50000 + 18%

    // Stock reconciled: the original 2 restored, then 3 deducted -> net 10 - 3 = 7.
    const afterRevise = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(afterRevise.body.stockQty).toBe(7);

    const auditLog = await authed(app, ownerToken).get('/audit-log').expect(200);
    const entry = auditLog.body.find(
      (e: { entity: string; entityId: string }) => e.entity === 'Invoice' && e.entityId === invoice.body.id,
    );
    expect(entry).toBeTruthy();
    expect(entry.action).toBe('INVOICE_REVISED');
  });

  it('reverses a revised line using its OLD snapshotted unit factor, not the item\'s current one', async () => {
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Unit Factor Revise Customer', phone: '9777777777' })
      .expect(201);
    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({
        name: 'Coolant',
        category: 'Consumables',
        hsnCode: '3820',
        gstRate: 1800,
        unitPrice: 60000,
        stockQty: 100,
        baseUnit: 'Bottle',
        saleUnit: 'Box',
        saleUnitFactor: 6,
      })
      .expect(201);

    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId: customer.body.id,
        lineItems: [{ inventoryItemId: item.body.id, description: 'Coolant', qty: 2, unitPrice: 60000, gstRate: 1800 }],
      })
      .expect(201);
    expect(draft.body.lineItems[0].unitFactor).toBe(6);
    expect(draft.body.lineItems[0].unitLabel).toBe('Box');

    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    const afterFinalize = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(afterFinalize.body.stockQty).toBe(100 - 2 * 6); // 88

    // The item's unit setup changes after the invoice was issued.
    await authed(app, ownerToken).patch(`/inventory/${item.body.id}`).send({ saleUnitFactor: 10 }).expect(200);

    await authed(app, ownerToken)
      .patch(`/invoices/${invoice.body.id}/revise`)
      .send({
        lineItems: [{ inventoryItemId: item.body.id, description: 'Coolant', qty: 3, unitPrice: 60000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(200);

    // Reversal must use the OLD line's factor (6, restoring 12), not the
    // item's now-current factor (10) — then the new line deducts using the
    // item's current factor (10 * 3 = 30).
    const afterRevise = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(afterRevise.body.stockQty).toBe(100 - 3 * 10); // 70, not 78
  });

  it('rejects a payment against a DRAFT invoice — only a finalized one can receive one', async () => {
    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);
    const draft = await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);

    await authed(app, cashierToken)
      .post(`/invoices/${draft.body.id}/payments`)
      .send({ amount: 1000, mode: 'CASH' })
      .expect(400);
  });

  it('tracks balanceDue as payments are recorded and voided', async () => {
    const { ticketId } = await buildBillableTicket(app, ownerToken, technicianToken);
    const draft = await authed(app, cashierToken).post('/invoices').send({ ticketId }).expect(201);
    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    expect(invoice.body.total).toBe(59000);

    const fresh = await authed(app, ownerToken).get(`/invoices/${invoice.body.id}`).expect(200);
    expect(fresh.body.paidAmount).toBe(0);
    expect(fresh.body.balanceDue).toBe(59000);

    const payment = await authed(app, cashierToken)
      .post(`/invoices/${invoice.body.id}/payments`)
      .send({ amount: 20000, mode: 'UPI', reference: 'txn123' })
      .expect(201);

    const afterPartial = await authed(app, ownerToken).get(`/invoices/${invoice.body.id}`).expect(200);
    expect(afterPartial.body.paidAmount).toBe(20000);
    expect(afterPartial.body.balanceDue).toBe(39000);

    await authed(app, cashierToken)
      .post(`/invoices/${invoice.body.id}/payments`)
      .send({ amount: 39000, mode: 'CASH' })
      .expect(201);

    const afterFull = await authed(app, ownerToken).get(`/invoices/${invoice.body.id}`).expect(200);
    expect(afterFull.body.paidAmount).toBe(59000);
    expect(afterFull.body.balanceDue).toBe(0);

    // Void the first payment — balance must go back up, and only the Owner
    // may do it.
    await authed(app, cashierToken)
      .patch(`/payments/${payment.body.id}/void`)
      .send({ reason: 'wrong amount' })
      .expect(403);
    await authed(app, ownerToken).patch(`/payments/${payment.body.id}/void`).send({ reason: 'wrong amount' }).expect(200);

    const afterVoid = await authed(app, ownerToken).get(`/invoices/${invoice.body.id}`).expect(200);
    expect(afterVoid.body.paidAmount).toBe(39000);
    expect(afterVoid.body.balanceDue).toBe(20000);

    // The invoice list view reports the same balance, computed in bulk.
    const list = await authed(app, ownerToken).get('/invoices').expect(200);
    const listed = list.body.find((i: { id: string }) => i.id === invoice.body.id);
    expect(listed.balanceDue).toBe(20000);
  });
});
