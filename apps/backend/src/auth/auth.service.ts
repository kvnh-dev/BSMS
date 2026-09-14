import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Persona } from '@bsms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './types.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; phone: string; personas: Persona[] };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async loadUserWithPersonas(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { personas: true },
    });
    if (!user) return null;
    return { ...user, personas: user.personas.map((p) => p.persona as Persona) };
  }

  async validateCredentials(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { personas: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    return { ...user, personas: user.personas.map((p) => p.persona as Persona) };
  }

  private issueTokens(payload: { id: string; phone: string; personas: Persona[] }): {
    accessToken: string;
    refreshToken: string;
  } {
    const jwtPayload: JwtPayload = { sub: payload.id, phone: payload.phone, personas: payload.personas };
    const accessToken = this.jwt.sign(jwtPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = this.jwt.sign(
      { sub: payload.id },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: REFRESH_TOKEN_TTL },
    );
    return { accessToken, refreshToken };
  }

  async login(phone: string, password: string): Promise<AuthResult> {
    const user = await this.validateCredentials(phone, password);
    const { accessToken, refreshToken } = this.issueTokens(user);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, phone: user.phone, personas: user.personas },
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let sub: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.loadUserWithPersonas(sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = this.issueTokens(user);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, phone: user.phone, personas: user.personas },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
