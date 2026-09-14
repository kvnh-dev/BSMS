import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { TEST_PASSWORD, TEST_USERS } from '../global-setup.js';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  await app.init();
  return app;
}

export async function loginAs(
  app: INestApplication,
  role: keyof typeof TEST_USERS,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ phone: TEST_USERS[role].phone, password: TEST_PASSWORD })
    .expect(200);
  return res.body.accessToken;
}

export function authed(app: INestApplication, token: string) {
  return {
    get: (url: string) => request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app.getHttpServer()).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${token}`),
  };
}
