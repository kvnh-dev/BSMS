import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Categories', () => {
  let app: INestApplication;
  let ownerToken: string;
  let cashierToken: string;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    cashierToken = await loginAs(app, 'cashier');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a Cashier creating a category (Owner-only)', async () => {
    await authed(app, cashierToken)
      .post('/categories')
      .send({ name: 'Consumables', gstRate: 1800 })
      .expect(403);
  });

  it('lets the Owner create a category with a default GST rate', async () => {
    const res = await authed(app, ownerToken)
      .post('/categories')
      .send({ name: 'Consumables', gstRate: 1800 })
      .expect(201);
    expect(res.body.gstRate).toBe(1800);
    categoryId = res.body.id;
  });

  it('lists categories for any authenticated persona', async () => {
    const res = await authed(app, cashierToken).get('/categories').expect(200);
    expect(res.body.some((c: { id: string }) => c.id === categoryId)).toBe(true);
  });

  it('lets the Owner update a category', async () => {
    const res = await authed(app, ownerToken)
      .patch(`/categories/${categoryId}`)
      .send({ gstRate: 2800 })
      .expect(200);
    expect(res.body.gstRate).toBe(2800);
  });

  it('lets the Owner delete a category', async () => {
    await authed(app, ownerToken).delete(`/categories/${categoryId}`).expect(200);
    const res = await authed(app, ownerToken).get('/categories').expect(200);
    expect(res.body.some((c: { id: string }) => c.id === categoryId)).toBe(false);
  });
});
