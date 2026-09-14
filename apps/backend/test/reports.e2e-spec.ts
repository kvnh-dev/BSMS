import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Reports', () => {
  let app: INestApplication;
  let ownerToken: string;
  let cashierToken: string;
  let technicianToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    cashierToken = await loginAs(app, 'cashier');
    technicianToken = await loginAs(app, 'technician');

    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Reports Test Customer', phone: '9444444444' })
      .expect(201);
    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Tyre', category: 'Parts', hsnCode: '4011', gstRate: 1800, unitPrice: 200000, stockQty: 10 })
      .expect(201);
    await authed(app, cashierToken)
      .post('/invoices')
      .send({
        customerId: customer.body.id,
        lineItems: [{ inventoryItemId: item.body.id, description: 'Tyre', qty: 1, unitPrice: 200000, gstRate: 1800 }],
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a Technician viewing reports (Owner/Auditor only)', async () => {
    await authed(app, technicianToken).get('/reports/dashboard-summary').expect(403);
  });

  it('includes the invoice in today’s and this month’s sales', async () => {
    const res = await authed(app, ownerToken).get('/reports/dashboard-summary').expect(200);
    expect(res.body.todaySalesPaise).toBeGreaterThanOrEqual(236000); // 200000 + 18%
    expect(res.body.monthSalesPaise).toBeGreaterThanOrEqual(236000);
  });

  it('includes an 8-day sales trend with today last and today’s sale counted', async () => {
    const res = await authed(app, ownerToken).get('/reports/dashboard-summary').expect(200);
    expect(res.body.salesTrend).toHaveLength(8);
    expect(res.body.salesTrend.at(-1)).toMatchObject({ label: 'Today' });
    expect(res.body.salesTrend.at(-1).totalPaise).toBeGreaterThanOrEqual(236000);
  });

  it('includes today’s sale when `to` is today (regression: date-range end-of-day boundary)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await authed(app, ownerToken)
      .get(`/reports/gst-export?from=${today}&to=${today}`)
      .expect(200);
    const tyreRow = res.body.find((r: { hsnCode: string }) => r.hsnCode === '4011');
    expect(tyreRow).toBeTruthy();
    expect(tyreRow.taxableValuePaise).toBe(200000);
    expect(tyreRow.cgstPaise + tyreRow.sgstPaise).toBe(36000);
  });

  it('excludes sales outside the requested date range', async () => {
    const res = await authed(app, ownerToken)
      .get('/reports/gst-export?from=2020-01-01&to=2020-01-31')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('lists a technician as checked in today after check-in, and no longer once checked out', async () => {
    const technicianUser = await authed(app, technicianToken).get('/auth/me').expect(200);
    await authed(app, technicianToken).post('/attendance/check-in').expect(201);

    const inRes = await authed(app, ownerToken).get('/reports/dashboard-summary').expect(200);
    const inEntry = inRes.body.workersToday.find((w: { userId: string }) => w.userId === technicianUser.body.sub);
    expect(inEntry).toMatchObject({ name: 'Test Technician', isCheckedIn: true });

    await authed(app, technicianToken).post('/attendance/check-out').expect(201);
    const outRes = await authed(app, ownerToken).get('/reports/dashboard-summary').expect(200);
    const outEntry = outRes.body.workersToday.find((w: { userId: string }) => w.userId === technicianUser.body.sub);
    expect(outEntry).toMatchObject({ isCheckedIn: false });
  });

  it('counts an open (non-delivered) ticket toward its technician’s pending workload', async () => {
    const technicianUser = await authed(app, technicianToken).get('/auth/me').expect(200);
    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Workload Test Customer', phone: '9455555555' })
      .expect(201);
    const bike = await authed(app, ownerToken)
      .post('/bikes')
      .send({ regNo: 'KA05RP0001', chassisNo: 'RPCHASSIS0001', model: 'Activa', customerId: customer.body.id })
      .expect(201);
    await authed(app, technicianToken)
      .post('/service-tickets')
      .send({ bikeId: bike.body.id, complaint: 'Pending workload regression' })
      .expect(201);

    const res = await authed(app, ownerToken).get('/reports/dashboard-summary').expect(200);
    const entry = res.body.technicianWorkload.find(
      (t: { technicianId: string }) => t.technicianId === technicianUser.body.sub,
    );
    expect(entry).toBeTruthy();
    expect(entry.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it('lists an item at or below its reorder point as low stock, and excludes one comfortably above it', async () => {
    const lowItem = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Brake Cable', category: 'Parts', hsnCode: '8714', gstRate: 1800, unitPrice: 15000, stockQty: 2, reorderPoint: 5 })
      .expect(201);

    const res = await authed(app, ownerToken).get('/reports/dashboard-summary').expect(200);
    const ids = res.body.lowStockItems.map((i: { id: string }) => i.id);
    expect(ids).toContain(lowItem.body.id);

    const tyreRes = await authed(app, ownerToken).get('/inventory/search?q=Tyre').expect(200);
    expect(ids).not.toContain(tyreRes.body[0].id); // stockQty 10 > default reorderPoint 0
  });
});
