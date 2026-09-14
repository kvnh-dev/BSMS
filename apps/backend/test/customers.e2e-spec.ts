import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Customers search', () => {
  let app: INestApplication;
  let ownerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');

    await authed(app, ownerToken)
      .post('/customers')
      .send({ name: 'Go To Bar Test Customer', phone: '9555512345' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds a customer by partial, case-insensitive name match', async () => {
    const res = await authed(app, ownerToken).get('/customers/search?q=go to bar').expect(200);
    expect(res.body.some((c: { name: string }) => c.name === 'Go To Bar Test Customer')).toBe(true);
  });

  it('finds a customer by partial phone match', async () => {
    const res = await authed(app, ownerToken).get('/customers/search?q=55551234').expect(200);
    expect(res.body.some((c: { phone: string }) => c.phone === '9555512345')).toBe(true);
  });

  it('returns an empty array for no match', async () => {
    const res = await authed(app, ownerToken).get('/customers/search?q=zzz-no-such-customer-zzz').expect(200);
    expect(res.body).toEqual([]);
  });
});
