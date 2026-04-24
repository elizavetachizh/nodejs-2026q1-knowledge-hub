import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersWriteService } from 'src/user/user-credentials.service';
import { UserRole } from 'src/user/dto/create-user.dto';
import { Prisma } from 'generated/prisma/client';
import { UserRole as PrismaUserRole } from 'generated/prisma/enums';
import { toPrismaRole, toPublicUser } from 'src/user/utils/user.mapper';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

function makePrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
}

let prisma: ReturnType<typeof makePrismaMock>;
let service: UsersWriteService;

function prismaCreatedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    login: 'newuser',
    password: 'hashed-secret',
    role: PrismaUserRole.VIEWER,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  prisma = makePrismaMock();
  service = new UsersWriteService(prisma as unknown as PrismaService);
  vi.mocked(bcrypt.hash).mockReset();
});

describe('UsersWriteService', () => {
  describe('createUserWithPassword', () => {
    it('throws when login is missing', async () => {
      await expect(
        service.createUserWithPassword({
          login: '',
          password: 'secret',
          role: UserRole.VIEWER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createUserWithPassword({
          login: '',
          password: 'secret',
          role: UserRole.VIEWER,
        }),
      ).rejects.toThrow('Login and password are required');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws when password is missing', async () => {
      await expect(
        service.createUserWithPassword({
          login: 'user1',
          password: '',
          role: UserRole.VIEWER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws when login is already taken (pre-check)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        login: 'taken',
      });

      try {
        await service.createUserWithPassword({
          login: 'taken',
          password: 'secret',
          role: UserRole.EDITOR,
        });
        throw new Error('expected BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).getResponse()).toEqual({
          message: 'Login already taken',
          id: 'existing-id',
        });
      }

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates user with hashed password and returns PublicUser', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      const created = prismaCreatedRow({
        login: 'alice',
        password: 'hashed-password',
        role: PrismaUserRole.EDITOR,
      });
      prisma.user.create.mockResolvedValue(created);

      const result = await service.createUserWithPassword({
        login: 'alice',
        password: 'plain',
        role: UserRole.EDITOR,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('plain', expect.any(Number));
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          login: 'alice',
          password: 'hashed-password',
          role: toPrismaRole(UserRole.EDITOR),
        },
      });
      expect(result).toEqual(toPublicUser(created));
    });

    it('maps duplicate login on create (P2002) to BadRequest', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'race-dup-id', login: 'bob' });

      vi.mocked(bcrypt.hash).mockResolvedValue('hash' as never);

      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['login'] },
      });
      prisma.user.create.mockRejectedValue(p2002);

      try {
        await service.createUserWithPassword({
          login: 'bob',
          password: 'secret',
          role: UserRole.VIEWER,
        });
        throw new Error('expected BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).getResponse()).toEqual({
          message: 'Login already taken',
          id: 'race-dup-id',
        });
      }

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('rethrows non-unique errors from create', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hash' as never);
      const boom = new Error('database down');
      prisma.user.create.mockRejectedValue(boom);

      await expect(
        service.createUserWithPassword({
          login: 'carol',
          password: 'secret',
          role: UserRole.VIEWER,
        }),
      ).rejects.toThrow('database down');
    });
  });
});
