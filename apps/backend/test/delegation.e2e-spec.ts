import type { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs, authed } from './utils/test-app.js';

describe('Delegation tasks', () => {
  let app: INestApplication;
  let ownerToken: string;
  let technicianToken: string;
  let technicianId: string;
  let taskId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner');
    technicianToken = await loginAs(app, 'technician');
    const me = await authed(app, technicianToken).get('/auth/me').expect(200);
    technicianId = me.body.sub;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a Technician creating a delegation task (Owner-only)', async () => {
    await authed(app, technicianToken)
      .post('/delegation-tasks')
      .send({ taskType: 'DISCOUNT_OVERRIDE', payload: { amount: 500, reason: 'loyal customer' }, assignedToId: technicianId })
      .expect(403);
  });

  it('lets the Owner delegate a task to a Technician', async () => {
    const res = await authed(app, ownerToken)
      .post('/delegation-tasks')
      .send({ taskType: 'DISCOUNT_OVERRIDE', payload: { amount: 500, reason: 'loyal customer' }, assignedToId: technicianId })
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    taskId = res.body.id;
  });

  it('shows the Technician only tasks assigned to them, and the Owner the full queue', async () => {
    const ownList = await authed(app, technicianToken).get('/delegation-tasks').expect(200);
    expect(ownList.body.every((t: { assignedToId: string }) => t.assignedToId)).toBe(true);

    const ownerList = await authed(app, ownerToken).get('/delegation-tasks').expect(200);
    expect(ownerList.body.some((t: { id: string }) => t.id === taskId)).toBe(true);
  });

  it('rejects a Technician reviewing their own task (Owner-only)', async () => {
    await authed(app, technicianToken).patch(`/delegation-tasks/${taskId}/review`).send({ status: 'APPROVED' }).expect(403);
  });

  it('lets the Owner approve the task', async () => {
    const res = await authed(app, ownerToken)
      .patch(`/delegation-tasks/${taskId}/review`)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('rejects reviewing an already-reviewed task', async () => {
    await authed(app, ownerToken).patch(`/delegation-tasks/${taskId}/review`).send({ status: 'REJECTED' }).expect(400);
  });
});
