import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { SEEDED_ACCOUNTS } from '../src/ledger/ledger.constants.js';

// Runs once before the whole e2e suite (see vitest.config.e2e.ts's
// TEST_DATABASE_URL) — truncates the isolated test database and seeds a
// known showroom + one user per persona, so individual spec files don't
// need to repeat the setup-wizard flow and can just log in.
const TEST_DATABASE_URL = 'postgresql://garuda:garuda_dev_only@localhost:5433/bsms_test?schema=bsms';

export const TEST_PASSWORD = 'test-password-123';
export const TEST_USERS = {
  owner: { phone: '9000000001', name: 'Test Owner', personas: ['OWNER'] },
  technician: { phone: '9000000002', name: 'Test Technician', personas: ['TECHNICIAN'] },
  cashier: { phone: '9000000003', name: 'Test Cashier', personas: ['CASHIER'] },
  delivery: { phone: '9000000004', name: 'Test Delivery', personas: ['DELIVERY'] },
  auditor: { phone: '9000000005', name: 'Test Auditor', personas: ['AUDITOR'] },
} as const;

export default async function globalSetup() {
  const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "bsms"."UserPersona", "bsms"."Attendance", "bsms"."ServicePartUsed", "bsms"."InvoiceLineItem", "bsms"."Invoice", "bsms"."Estimate", "bsms"."ServiceTicket", "bsms"."Bike", "bsms"."Customer", "bsms"."InventoryItem", "bsms"."Supplier", "bsms"."Account", "bsms"."DelegationTask", "bsms"."AuditLog", "bsms"."User", "bsms"."GstSlab", "bsms"."ShowroomProfile" CASCADE`,
  );

  await prisma.showroomProfile.create({
    data: {
      name: 'Test Bike Showroom',
      address: '123 Test Road',
      contactNumber: '9876543210',
      email: 'owner@testshowroom.in',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      state: 'Karnataka',
      invoicePrefix: 'TST',
      invoiceSeq: 0,
    },
  });

  await prisma.gstSlab.createMany({
    data: [
      { label: 'GST 18%', rate: 1800, isDefault: false },
      { label: 'Standard - Two-wheelers (28%)', rate: 2800, isDefault: true },
    ],
  });

  await prisma.account.createMany({ data: [...SEEDED_ACCOUNTS] });

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  for (const user of Object.values(TEST_USERS)) {
    await prisma.user.create({
      data: {
        name: user.name,
        phone: user.phone,
        passwordHash,
        personas: { create: user.personas.map((persona) => ({ persona })) },
      },
    });
  }

  await prisma.$disconnect();
}
