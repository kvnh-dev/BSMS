import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authed } from './utils/test-app.js';
import { TEST_PASSWORD, TEST_USERS } from './global-setup.js';

describe('Setup & Auth', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports setup as already complete (seeded by global setup)', async () => {
    const res = await request(app.getHttpServer()).get('/showroom-profile/setup-status').expect(200);
    expect(res.body).toEqual({ isSetupComplete: true });
  });

  it('rejects running the setup wizard a second time', async () => {
    await request(app.getHttpServer())
      .post('/showroom-profile/setup')
      .send({
        profile: {
          name: 'Duplicate',
          address: 'x',
          contactNumber: '9999999999',
          email: 'a@b.com',
          gstin: '29ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
          state: 'Karnataka',
          invoicePrefix: 'DUP',
          currency: 'INR',
          locale: 'en-IN',
        },
        owner: { name: 'Dup Owner', phone: '9999999998', password: 'password123' },
      })
      .expect(409);
  });

  it('rejects login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: TEST_USERS.owner.phone, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in and returns a usable access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: TEST_USERS.owner.phone, password: TEST_PASSWORD })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.personas).toEqual(['OWNER']);
  });

  it('/auth/me reflects the authenticated user', async () => {
    const token = await loginAs(app, 'owner');
    const res = await authed(app, token).get('/auth/me').expect(200);
    expect(res.body.phone).toBe(TEST_USERS.owner.phone);
  });

  it('rejects unauthenticated requests to a protected route', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('enforces persona-based RBAC (non-Owner cannot manage workers)', async () => {
    const technicianToken = await loginAs(app, 'technician');
    await authed(app, technicianToken).get('/users').expect(403);

    const ownerToken = await loginAs(app, 'owner');
    await authed(app, ownerToken).get('/users').expect(200);
  });
});
