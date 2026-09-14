import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Service workflow', () => {
  let app: INestApplication;
  let ownerToken: string;
  let technicianToken: string;
  let cashierToken: string;
  let deliveryToken: string;

  let customerId: string;
  let bikeId: string;
  let ticketId: string;
  let inventoryItemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    technicianToken = await loginAs(app, 'technician');
    cashierToken = await loginAs(app, 'cashier');
    deliveryToken = await loginAs(app, 'delivery');

    const customer = await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Workflow Test Customer', phone: '9111111111', address: 'Test Street' })
      .expect(201);
    customerId = customer.body.id;

    const bike = await authed(app, ownerToken)
      .post('/bikes')
      .send({ regNo: 'KA05WF0001', chassisNo: 'WFCHASSIS0001', model: 'Activa', customerId })
      .expect(201);
    bikeId = bike.body.id;

    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({ name: 'Air Filter', category: 'Parts', hsnCode: '8421', gstRate: 1800, unitPrice: 30000, stockQty: 20 })
      .expect(201);
    inventoryItemId = item.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the bike by registration number or the customer phone', async () => {
    const byRegNo = await authed(app, technicianToken).get('/bikes/search?q=KA05WF0001').expect(200);
    expect(byRegNo.body.map((b: { id: string }) => b.id)).toContain(bikeId);

    const byPhone = await authed(app, technicianToken).get('/bikes/search?q=9111111111').expect(200);
    expect(byPhone.body.map((b: { id: string }) => b.id)).toContain(bikeId);
  });

  it('rejects ticket intake from a Cashier (Owner/Technician only)', async () => {
    await authed(app, cashierToken)
      .post('/service-tickets')
      .send({ bikeId, complaint: 'Should be rejected' })
      .expect(403);
  });

  it('creates a service ticket in INTAKE status, self-assigning the Technician who created it', async () => {
    const technicianUser = await authed(app, technicianToken).get('/auth/me').expect(200);
    const res = await authed(app, technicianToken)
      .post('/service-tickets')
      .send({ bikeId, complaint: 'Engine rattling noise' })
      .expect(201);
    expect(res.body.status).toBe('INTAKE');
    expect(res.body.technicianId).toBe(technicianUser.body.sub);
    ticketId = res.body.id;
  });

  it('lets an Owner assign a ticket to a specific Technician explicitly', async () => {
    const technicianUser = await authed(app, technicianToken).get('/auth/me').expect(200);
    const bike2 = await authed(app, ownerToken)
      .post('/bikes')
      .send({ regNo: 'KA05WF0002', chassisNo: 'WFCHASSIS0002', model: 'Activa', customerId })
      .expect(201);
    const res = await authed(app, ownerToken)
      .post('/service-tickets')
      .send({ bikeId: bike2.body.id, complaint: 'Brake squeal', technicianId: technicianUser.body.sub })
      .expect(201);
    expect(res.body.technicianId).toBe(technicianUser.body.sub);
  });

  it('rejects recording a part while the ticket is still in INTAKE', async () => {
    await authed(app, technicianToken)
      .post(`/service-tickets/${ticketId}/parts`)
      .send({ inventoryItemId, qty: 3 })
      .expect(400);
  });

  it('creates an estimate with a correct GST breakup', async () => {
    const res = await authed(app, technicianToken)
      .put(`/service-tickets/${ticketId}/estimate`)
      .send({
        lineItems: [
          { description: 'Air Filter', qty: 3, unitPricePaise: 30000, gstRateBps: 1800 },
          { description: 'Labor', qty: 1, unitPricePaise: 20000, gstRateBps: 1800 },
        ],
        discount: 0,
      })
      .expect(200);

    // taxable = 3*300 + 200 = 1100 rupees; GST 18% = 198; split 99/99
    expect(res.body.gstBreakup).toEqual({ cgstPaise: 9900, sgstPaise: 9900, igstPaise: 0 });

    const ticket = await authed(app, ownerToken).get(`/service-tickets/${ticketId}`).expect(200);
    expect(ticket.body.estimateAmount).toBe(129800); // 110000 + 19800
  });

  it('rejects a Delivery persona approving a ticket (wrong transition)', async () => {
    await authed(app, deliveryToken)
      .patch(`/service-tickets/${ticketId}/status`)
      .send({ status: 'APPROVED' })
      .expect(403);
  });

  it('progresses the ticket through APPROVED and IN_SERVICE', async () => {
    await authed(app, technicianToken)
      .patch(`/service-tickets/${ticketId}/status`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const res = await authed(app, technicianToken)
      .patch(`/service-tickets/${ticketId}/status`)
      .send({ status: 'IN_SERVICE' })
      .expect(200);
    expect(res.body.status).toBe('IN_SERVICE');
  });

  it('records a part used and deducts inventory stock, once In Service', async () => {
    await authed(app, technicianToken)
      .post(`/service-tickets/${ticketId}/parts`)
      .send({ inventoryItemId, qty: 3 })
      .expect(201);

    const item = await authed(app, ownerToken).get(`/inventory/${inventoryItemId}`).expect(200);
    expect(item.body.stockQty).toBe(17); // 20 - 3
  });

  it('deducts stock by saleUnitFactor when a part is sold in an alternate unit', async () => {
    const item = await authed(app, ownerToken)
      .post('/inventory')
      .send({
        name: 'Engine Oil 1L',
        category: 'Consumables',
        hsnCode: '2710',
        gstRate: 1800,
        unitPrice: 40000,
        stockQty: 50,
        baseUnit: 'Bottle',
        saleUnit: 'Box',
        saleUnitFactor: 12,
      })
      .expect(201);

    const bike = await authed(app, ownerToken)
      .post('/bikes')
      .send({ regNo: 'KA05WF0003', chassisNo: 'WFCHASSIS0003', model: 'Activa', customerId })
      .expect(201);
    const ticket = await authed(app, technicianToken)
      .post('/service-tickets')
      .send({ bikeId: bike.body.id, complaint: 'Oil change' })
      .expect(201);
    await authed(app, technicianToken)
      .patch(`/service-tickets/${ticket.body.id}/status`)
      .send({ status: 'APPROVED' })
      .expect(200);
    await authed(app, technicianToken)
      .patch(`/service-tickets/${ticket.body.id}/status`)
      .send({ status: 'IN_SERVICE' })
      .expect(200);

    const part = await authed(app, technicianToken)
      .post(`/service-tickets/${ticket.body.id}/parts`)
      .send({ inventoryItemId: item.body.id, qty: 2 })
      .expect(201);
    expect(part.body.unitFactor).toBe(12);
    expect(part.body.unitLabel).toBe('Box');

    const updatedItem = await authed(app, ownerToken).get(`/inventory/${item.body.id}`).expect(200);
    expect(updatedItem.body.stockQty).toBe(50 - 2 * 12);
  });

  it('records a service charge, once In Service', async () => {
    const res = await authed(app, technicianToken)
      .post(`/service-tickets/${ticketId}/charges`)
      .send({ description: 'Labor — filter replacement', amount: 20000, gstRate: 1800 })
      .expect(201);
    expect(res.body.amount).toBe(20000);

    const ticket = await authed(app, ownerToken).get(`/service-tickets/${ticketId}`).expect(200);
    expect(ticket.body.partsUsed).toHaveLength(1);
    expect(ticket.body.serviceCharges).toHaveLength(1);
  });

  it('rejects setting status directly to BILLED (only Invoice creation can do that)', async () => {
    await authed(app, ownerToken)
      .patch(`/service-tickets/${ticketId}/status`)
      .send({ status: 'BILLED' })
      .expect(400); // fails Zod validation — BILLED excluded from the schema
  });
});
