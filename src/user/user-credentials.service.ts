import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PublicUser } from './user.types';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { toPrismaRole, toPublicUser } from './utils/user.mapper';
import { UserRole } from './dto/create-user.dto';

@Injectable()
export class UsersWriteService {
  constructor(private readonly prisma: PrismaService) {}
  private getSaltRounds(): number {
    return parseInt(process.env.CRYPT_SALT || '10');
  }
  private isPrismaUniqueConstraintError(
    error: unknown,
    field: string,
  ): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;

    if (error.code !== 'P2002') return false;
    const target = error.meta?.target;
    if (!Array.isArray(target)) return false;
    return target.includes(field);
  }
  async createUserWithPassword(input: {
    login: string;
    password: string;
    role: UserRole;
  }): Promise<PublicUser> {
    if (!input.login || !input.password) {
      throw new BadRequestException('Login and password are required');
    }
    const existing = await this.prisma.user.findUnique({
      where: { login: input.login },
    });
    if (existing) {
      throw new BadRequestException('Login already taken');
    }
    const hashedPassword = await bcrypt.hash(
      input.password,
      this.getSaltRounds(),
    );
    try {
      const user = await this.prisma.user.create({
        data: {
          login: input.login,
          password: hashedPassword,
          role: toPrismaRole(input.role),
        },
      });
      return toPublicUser(user);
    } catch (error) {
      if (this.isPrismaUniqueConstraintError(error, 'login')) {
        throw new BadRequestException('Login already taken');
      }
      throw error;
    }
  }
}
