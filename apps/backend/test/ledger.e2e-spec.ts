import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Ledger', () => {
  let app: INestApplication;
  let ownerToken: string;
  let cashierToken: string;
  let technicianToken: string;
  let auditorToken: string;
  let customerId: string;
  let supplierId: string;
  let itemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    cashierToken = await loginAs(app, 'cashier');
    technicianToken = await loginAs(app, 'technician');
    auditorToken = await loginAs(app, 'auditor');

    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Ledger Test Customer', phone: '9800000001' })
      .expect(201);
    customerId = customer.body.id;

    const supplier = await authed(app, ownerToken)
      .post('/suppliers')
      .send({ name: 'Ledger Test Supplier', phone: '9800000002' })
      .expect(201);
    supplierId = supplier.body.id;

    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Ledger Test Item', category: 'Test', hsnCode: '0000', gstRate: 1800, unitPrice: 100000, stockQty: 100 })
      .expect(201);
    itemId = item.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function balances(): Promise<Map<string, { debit: number; credit: number }>> {
    const res = await authed(app, ownerToken).get('/ledger/trial-balance').expect(200);
    return new Map(res.body.map((r: { name: string; debit: number; credit: number }) => [r.name, r]));
  }

  it('rejects a Technician viewing ledger reports', async () => {
    await authed(app, technicianToken).get('/ledger/trial-balance').expect(403);
    await authed(app, technicianToken).get('/ledger/profit-and-loss').expect(403);
  });

  it('lets Owner and Auditor view the trial balance', async () => {
    await authed(app, ownerToken).get('/ledger/trial-balance').expect(200);
    await authed(app, auditorToken).get('/ledger/trial-balance').expect(200);
  });

  it('finalizing an invoice with a discount posts a balanced entry across Sundry Debtors/Sales/GST Payable/Discount Allowed', async () => {
    const before = await balances();
    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId,
        lineItems: [{ inventoryItemId: itemId, description: 'Ledger Test Item', qty: 1, unitPrice: 100000, gstRate: 1800 }],
        discount: 5000,
      })
      .expect(201);
    const finalized = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    expect(finalized.body.total).toBe(113000); // 100000 + 18000 - 5000

    const after = await balances();
    expect(after.get('Sundry Debtors')!.debit - before.get('Sundry Debtors')!.debit).toBe(113000);
    expect(after.get('Sales')!.credit - before.get('Sales')!.credit).toBe(100000);
    expect(after.get('GST Payable')!.credit - before.get('GST Payable')!.credit).toBe(18000);
    expect(after.get('Discount Allowed')!.debit - before.get('Discount Allowed')!.debit).toBe(5000);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of after.values()) {
      totalDebit += row.debit;
      totalCredit += row.credit;
    }
    expect(totalDebit).toBe(totalCredit);
  });

  it('recording and voiding a payment posts and reverses the Cash/Bank <-> Sundry Debtors entry', async () => {
    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId,
        lineItems: [{ inventoryItemId: itemId, description: 'Ledger Test Item', qty: 1, unitPrice: 100000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(201);
    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);

    const beforePay = await balances();
    const payment = await authed(app, cashierToken)
      .post(`/invoices/${invoice.body.id}/payments`)
      .send({ amount: 50000, mode: 'CASH' })
      .expect(201);
    const afterPay = await balances();
    expect(afterPay.get('Cash/Bank')!.debit - beforePay.get('Cash/Bank')!.debit).toBe(50000);
    expect(afterPay.get('Sundry Debtors')!.credit - beforePay.get('Sundry Debtors')!.credit).toBe(50000);

    await authed(app, ownerToken)
      .patch(`/payments/${payment.body.id}/void`)
      .send({ reason: 'test reversal' })
      .expect(200);
    const afterVoid = await balances();
    // Reversal restores Cash/Bank and Sundry Debtors to their pre-payment state.
    expect(afterVoid.get('Cash/Bank')!.debit).toBe(afterPay.get('Cash/Bank')!.debit);
    expect(afterVoid.get('Cash/Bank')!.credit - afterPay.get('Cash/Bank')!.credit).toBe(50000);
    expect(afterVoid.get('Sundry Debtors')!.debit - afterPay.get('Sundry Debtors')!.debit).toBe(50000);
  });

  it('recording a purchase bill with a discount posts a balanced entry across Purchases/GST Receivable/Sundry Creditors/Discount Received', async () => {
    const before = await balances();
    const bill = await authed(app, cashierToken)
      .post('/purchase-bills')
      .send({
        supplierId,
        lineItems: [{ inventoryItemId: itemId, description: 'Ledger Test Item', qty: 1, unitPrice: 100000, gstRate: 1800 }],
        discount: 3000,
      })
      .expect(201);
    expect(bill.body.total).toBe(115000); // 100000 + 18000 - 3000

    const after = await balances();
    expect(after.get('Purchases')!.debit - before.get('Purchases')!.debit).toBe(100000);
    expect(after.get('GST Receivable')!.debit - before.get('GST Receivable')!.debit).toBe(18000);
    expect(after.get('Sundry Creditors')!.credit - before.get('Sundry Creditors')!.credit).toBe(115000);
    expect(after.get('Discount Received')!.credit - before.get('Discount Received')!.credit).toBe(3000);
  });

  it('recording and voiding a supplier payment posts and reverses the Cash/Bank <-> Sundry Creditors entry', async () => {
    const bill = await authed(app, cashierToken)
      .post('/purchase-bills')
      .send({
        supplierId,
        lineItems: [{ inventoryItemId: itemId, description: 'Ledger Test Item', qty: 1, unitPrice: 100000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(201);

    const beforePay = await balances();
    const payment = await authed(app, cashierToken)
      .post(`/purchase-bills/${bill.body.id}/payments`)
      .send({ amount: 40000, mode: 'BANK_TRANSFER' })
      .expect(201);
    const afterPay = await balances();
    expect(afterPay.get('Sundry Creditors')!.debit - beforePay.get('Sundry Creditors')!.debit).toBe(40000);
    expect(afterPay.get('Cash/Bank')!.credit - beforePay.get('Cash/Bank')!.credit).toBe(40000);

    await authed(app, ownerToken)
      .patch(`/supplier-payments/${payment.body.id}/void`)
      .send({ reason: 'test reversal' })
      .expect(200);
    const afterVoid = await balances();
    expect(afterVoid.get('Cash/Bank')!.debit - afterPay.get('Cash/Bank')!.debit).toBe(40000);
    expect(afterVoid.get('Sundry Creditors')!.credit - afterPay.get('Sundry Creditors')!.credit).toBe(40000);
  });

  it('revising a finalized invoice reverses the old posting and posts the new one', async () => {
    const draft = await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId,
        lineItems: [{ inventoryItemId: itemId, description: 'Ledger Test Item', qty: 1, unitPrice: 100000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(201);
    const invoice = await authed(app, cashierToken).post(`/invoices/${draft.body.id}/finalize`).expect(201);
    expect(invoice.body.total).toBe(118000);

    const before = await balances();
    const revised = await authed(app, ownerToken)
      .patch(`/invoices/${invoice.body.id}/revise`)
      .send({
        lineItems: [{ inventoryItemId: itemId, description: 'Ledger Test Item', qty: 2, unitPrice: 100000, gstRate: 1800 }],
        discount: 0,
      })
      .expect(200);
    expect(revised.body.total).toBe(236000); // 2x the original

    const after = await balances();
    // Two postings land: a reversal of the old numbers (old total credited
    // back, old taxable/GST debited back) and a fresh posting with the new
    // numbers — never a signed delta, so both debit and credit sides move.
    expect(after.get('Sundry Debtors')!.debit - before.get('Sundry Debtors')!.debit).toBe(236000); // new total
    expect(after.get('Sundry Debtors')!.credit - before.get('Sundry Debtors')!.credit).toBe(118000); // old total reversed
    expect(after.get('Sales')!.credit - before.get('Sales')!.credit).toBe(200000); // new taxable
    expect(after.get('Sales')!.debit - before.get('Sales')!.debit).toBe(100000); // old taxable reversed
    expect(after.get('GST Payable')!.credit - before.get('GST Payable')!.credit).toBe(36000); // new GST
    expect(after.get('GST Payable')!.debit - before.get('GST Payable')!.debit).toBe(18000); // old GST reversed

    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of after.values()) {
      totalDebit += row.debit;
      totalCredit += row.credit;
    }
    expect(totalDebit).toBe(totalCredit);
  });

  it('recording a manual expense posts to the chosen account and Cash/Bank, and appears in GET /expenses', async () => {
    await authed(app, cashierToken)
      .post('/expenses')
      .send({ accountId: 'whatever', amount: 1000, narration: 'should be forbidden' })
      .expect(403);

    const accounts = await authed(app, ownerToken).get('/ledger/accounts').expect(200);
    const indirectExpenses = accounts.body.find((a: { name: string }) => a.name === 'Indirect Expenses');
    expect(indirectExpenses).toBeDefined();

    const before = await balances();
    await authed(app, ownerToken)
      .post('/expenses')
      .send({ accountId: indirectExpenses.id, amount: 25000, narration: 'Office rent' })
      .expect(201);
    const after = await balances();
    expect(after.get('Indirect Expenses')!.debit - before.get('Indirect Expenses')!.debit).toBe(25000);
    expect(after.get('Cash/Bank')!.credit - before.get('Cash/Bank')!.credit).toBe(25000);

    const list = await authed(app, ownerToken).get('/expenses').expect(200);
    expect(list.body.some((e: { narration: string; debit: number }) => e.narration === 'Office rent' && e.debit === 25000)).toBe(
      true,
    );

    const auditorList = await authed(app, auditorToken).get('/expenses').expect(200);
    expect(Array.isArray(auditorList.body)).toBe(true);
  });
});
