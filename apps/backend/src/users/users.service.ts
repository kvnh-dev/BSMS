import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserInput, Persona, UpdateUserInput } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private toDto(user: { id: string; name: string; phone: string; isActive: boolean; personas: { persona: string }[] }) {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      isActive: user.isActive,
      personas: user.personas.map((p) => p.persona as Persona),
    };
  }

  async list() {
    const users = await this.prisma.user.findMany({
      include: { personas: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.toDto(u));
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { personas: true } });
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  async create(input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new ConflictException('A user with this phone number already exists');
    }
    const passwordHash = await this.auth.hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        passwordHash,
        personas: { create: input.personas.map((persona) => ({ persona })) },
      },
      include: { personas: true },
    });
    return this.toDto(user);
  }

  async update(id: string, input: UpdateUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    if (input.personas) {
      await this.prisma.userPersona.deleteMany({ where: { userId: id } });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        isActive: input.isActive,
        ...(input.personas && {
          personas: { create: input.personas.map((persona) => ({ persona })) },
        }),
      },
      include: { personas: true },
    });
    return this.toDto(user);
  }
}
