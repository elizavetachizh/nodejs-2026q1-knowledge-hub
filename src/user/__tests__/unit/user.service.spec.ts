import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';
import { JwtPayload } from 'src/auth/auth.types';
import { UserRole } from 'src/user/dto/create-user.dto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));
import { UserService } from 'src/user/user.service';
import { UsersWriteService } from 'src/user/user-credentials.service';
import { toPrismaRole, toPublicUser } from 'src/user/utils/user.mapper';

const editorId = '550e8400-e29b-41d4-a716-446655440000';
const adminId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const viewerId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const editorActor: JwtPayload = {
  userId: editorId,
  role: UserRole.EDITOR,
  login: 'editor1',
};
const adminActor: JwtPayload = {
  userId: adminId,
  role: UserRole.ADMIN,
  login: 'admin1',
};
const viewerActor: JwtPayload = {
  userId: viewerId,
  role: UserRole.VIEWER,
  login: 'viewer1',
};

function makePrismaMock() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(
      (callback: (tx: unknown) => unknown | Promise<unknown>) =>
        Promise.resolve(
          callback({
            user: {
              delete: vi.fn(),
            },
            article: {
              updateMany: vi.fn(),
            },
          }),
        ),
    ),
  };
}

let prisma: ReturnType<typeof makePrismaMock>;
let userService: UserService;
let usersWriteMock: { createUserWithPassword: ReturnType<typeof vi.fn> };

beforeEach(() => {
  prisma = makePrismaMock();
  usersWriteMock = {
    createUserWithPassword: vi.fn(),
  };
  userService = new UserService(
    prisma as unknown as PrismaService,
    usersWriteMock as unknown as UsersWriteService,
  );
  vi.mocked(bcrypt.compare).mockReset();
  vi.mocked(bcrypt.hash).mockReset();
});

function prismaUserRow(
  overrides: Partial<{
    id: string;
    login: string;
    password: string;
    role: ReturnType<typeof toPrismaRole>;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  return {
    id: '1',
    login: 'user1',
    password: 'password1',
    role: toPrismaRole(UserRole.VIEWER),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

describe('UserService', () => {
  it('should return all users', async () => {
    const mockUsers = [prismaUserRow({})];

    prisma.user.findMany.mockResolvedValue(mockUsers);
    await userService.getUsers();
    expect(prisma.user.findMany).toHaveBeenCalledWith();
  });
});

describe('getUser', () => {
  it('should return user by id', async () => {
    const row = prismaUserRow({});
    prisma.user.findUnique.mockResolvedValue(row);

    const result = await userService.getUser(row.id);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
    });
    expect(result).toEqual(toPublicUser(row));
    expect(typeof result.createdAt).toBe('number');
  });

  it('getUser throws when not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      userService.getUser('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('createUser', () => {
  it('delegates to UsersWriteService when actor is admin', async () => {
    const dto = {
      login: 'user1',
      password: 'password1',
      role: UserRole.EDITOR,
    };

    const row = prismaUserRow({
      id: 'created-id',
      login: dto.login,
      role: toPrismaRole(dto.role),
    });
    const publicUser = toPublicUser(row);

    usersWriteMock.createUserWithPassword.mockResolvedValue(publicUser);

    const result = await userService.createUser(dto, adminActor);

    expect(usersWriteMock.createUserWithPassword).toHaveBeenCalledWith({
      login: dto.login,
      password: dto.password,
      role: dto.role,
    });
    expect(result).toEqual(publicUser);
  });

  it('forbids non-admin', async () => {
    const dto = {
      login: 'user1',
      password: 'password1',
      role: UserRole.VIEWER,
    };

    await expect(
      userService.createUser(dto, viewerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersWriteMock.createUserWithPassword).not.toHaveBeenCalled();
  });
});

describe('deleteUser', () => {
  it('runs transaction: unlinks articles then deletes user', async () => {
    const row = prismaUserRow({ id: editorId });
    const tx = {
      user: {
        delete: vi.fn().mockResolvedValue(undefined),
      },
      article: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma.user.findUnique.mockResolvedValue(row);
    prisma.$transaction.mockImplementation((cb) => Promise.resolve(cb(tx)));

    await userService.deleteUser(row.id);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
    });
    expect(tx.article.updateMany).toHaveBeenCalledWith({
      where: { authorId: row.id },
      data: { authorId: null },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  it('throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      userService.deleteUser('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('updateUser', () => {
  it('updates password after bcrypt verify and hash', async () => {
    const existing = prismaUserRow({
      id: editorId,
    });
    prisma.user.findUnique.mockResolvedValue(existing);

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-new-password' as never);

    const updateDto = {
      oldPassword: 'password1',
      newPassword: 'password2',
    };

    const updatedRow = prismaUserRow({
      id: existing.id,
      password: 'hashed-new-password',
    });
    prisma.user.update.mockResolvedValue(updatedRow);

    await userService.updateUser(existing.id, updateDto);

    expect(bcrypt.compare).toHaveBeenCalledWith(
      updateDto.oldPassword,
      existing.password,
    );
    expect(bcrypt.hash).toHaveBeenCalledWith(
      updateDto.newPassword,
      expect.any(Number),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        password: 'hashed-new-password',
      },
    });
  });

  it('updates role when actor is admin', async () => {
    const existing = prismaUserRow({
      id: editorId,
    });
    prisma.user.findUnique.mockResolvedValue(existing);

    const updateDto = {
      role: UserRole.ADMIN,
    };

    const updatedRow = prismaUserRow({
      id: existing.id,
      role: toPrismaRole(updateDto.role),
    });
    prisma.user.update.mockResolvedValue(updatedRow);

    await userService.updateUserRole(existing.id, updateDto, adminActor);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        role: toPrismaRole(updateDto.role),
      },
    });
  });

  it('forbids role update when actor is not admin', async () => {
    const existing = prismaUserRow({ id: editorId });
    prisma.user.findUnique.mockResolvedValue(existing);

    await expect(
      userService.updateUserRole(
        existing.id,
        { role: UserRole.ADMIN },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when user missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      userService.updateUserRole(
        '550e8400-e29b-41d4-a716-446655440000',
        {
          role: UserRole.ADMIN,
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
