import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthService } from 'src/auth/auth.service';
import { UsersWriteService } from 'src/user/user-credentials.service';
import { UserRole } from 'src/user/dto/create-user.dto';
import { JwtPayload } from 'src/auth/auth.types';
import { UserRole as PrismaUserRole } from 'generated/prisma/enums';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

function makePrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

let prisma: ReturnType<typeof makePrismaMock>;
let jwtService: {
  signAsync: ReturnType<typeof vi.fn>;
  verifyAsync: ReturnType<typeof vi.fn>;
};
let usersWriteMock: { createUserWithPassword: ReturnType<typeof vi.fn> };
let authService: AuthService;

const loginPayload: JwtPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  role: UserRole.VIEWER,
  login: 'testuser',
};

function prismaUserForAuth(overrides: Record<string, unknown> = {}) {
  return {
    id: loginPayload.userId,
    login: loginPayload.login,
    password: 'hashed-password',
    role: PrismaUserRole.VIEWER,
    refreshTokenHash: 'stored-refresh-hash',
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'test-access-secret');
  vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret');
  vi.stubEnv('JWT_ACCESS_TTL', '15m');
  vi.stubEnv('JWT_REFRESH_TTL', '7d');

  prisma = makePrismaMock();
  jwtService = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };
  usersWriteMock = {
    createUserWithPassword: vi.fn(),
  };

  authService = new AuthService(
    prisma as unknown as PrismaService,
    jwtService as unknown as JwtService,
    usersWriteMock as unknown as UsersWriteService,
  );

  vi.mocked(bcrypt.compare).mockReset();
  vi.mocked(bcrypt.hash).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AuthService', () => {
  describe('login', () => {
    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ login: 'user1', password: 'password1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.login({ login: loginPayload.login, password: 'wrong' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns tokens and saves refresh hash on success', async () => {
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      vi.mocked(bcrypt.hash).mockResolvedValue('new-refresh-hash' as never);
      prisma.user.update.mockResolvedValue({} as never);

      const result = await authService.login({
        login: loginPayload.login,
        password: 'plain',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed-password');
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        {
          userId: loginPayload.userId,
          role: UserRole.VIEWER,
          login: loginPayload.login,
        },
        {
          secret: 'test-access-secret',
          expiresIn: '15m',
        },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        {
          userId: loginPayload.userId,
          role: UserRole.VIEWER,
          login: loginPayload.login,
        },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(
        'refresh-token',
        expect.any(Number),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: loginPayload.userId },
        data: { refreshTokenHash: 'new-refresh-hash' },
      });
    });

    it('throws when JWT_SECRET is not configured', async () => {
      const prev = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret');
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      try {
        await expect(
          authService.login({
            login: loginPayload.login,
            password: 'plain',
          }),
        ).rejects.toThrow('JWT_SECRET is not set');
      } finally {
        if (prev !== undefined) process.env.JWT_SECRET = prev;
      }
    });

    it('throws when JWT_REFRESH_SECRET is not configured', async () => {
      const prevR = process.env.JWT_REFRESH_SECRET;
      const prevK = process.env.JWT_SECRET_REFRESH_KEY;
      delete process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_SECRET_REFRESH_KEY;
      vi.stubEnv('JWT_SECRET', 'test-access-secret');
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      try {
        await expect(
          authService.login({
            login: loginPayload.login,
            password: 'plain',
          }),
        ).rejects.toThrow('JWT_REFRESH_SECRET is not set');
      } finally {
        if (prevR !== undefined) process.env.JWT_REFRESH_SECRET = prevR;
        else delete process.env.JWT_REFRESH_SECRET;
        if (prevK !== undefined) process.env.JWT_SECRET_REFRESH_KEY = prevK;
        else delete process.env.JWT_SECRET_REFRESH_KEY;
      }
    });
  });

  describe('signup', () => {
    it('delegates to UsersWriteService with VIEWER role', async () => {
      const publicUser = {
        id: 'new-user-id',
        login: 'newbie',
        role: UserRole.VIEWER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersWriteMock.createUserWithPassword.mockResolvedValue(publicUser);

      const result = await authService.signup({
        login: 'newbie',
        password: 'secret',
      });

      expect(usersWriteMock.createUserWithPassword).toHaveBeenCalledWith({
        login: 'newbie',
        password: 'secret',
        role: UserRole.VIEWER,
      });
      expect(result).toEqual({
        id: 'new-user-id',
        message: 'User created successfully',
      });
    });
  });

  describe('refreshToken', () => {
    it('throws Unauthorized when refresh token missing', async () => {
      await expect(
        authService.refreshToken({ refreshToken: undefined }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        authService.refreshToken({ refreshToken: '' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws Forbidden when verify fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        authService.refreshToken({ refreshToken: 'bad.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when user missing or has no refresh hash', async () => {
      jwtService.verifyAsync.mockResolvedValue(loginPayload);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshToken({ refreshToken: 'valid.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.user.findUnique.mockResolvedValue(
        prismaUserForAuth({ refreshTokenHash: null }),
      );
      await expect(
        authService.refreshToken({ refreshToken: 'valid.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when refresh token does not match stored hash', async () => {
      jwtService.verifyAsync.mockResolvedValue(loginPayload);
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.refreshToken({ refreshToken: 'valid.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns new tokens and rotates refresh hash on success', async () => {
      jwtService.verifyAsync.mockResolvedValue(loginPayload);
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      vi.mocked(bcrypt.hash).mockResolvedValue('rotated-hash' as never);
      prisma.user.update.mockResolvedValue({} as never);

      const result = await authService.refreshToken({
        refreshToken: 'valid.jwt',
      });

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt', {
        secret: 'test-refresh-secret',
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'valid.jwt',
        'stored-refresh-hash',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: loginPayload.userId },
        data: { refreshTokenHash: 'rotated-hash' },
      });
    });
  });

  describe('logout', () => {
    it('throws Unauthorized when refresh token missing', async () => {
      await expect(
        authService.logout({ refreshToken: undefined }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        authService.logout({ refreshToken: '' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws Forbidden when verify fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(
        authService.logout({ refreshToken: 'bad.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when user missing or has no refresh hash', async () => {
      jwtService.verifyAsync.mockResolvedValue(loginPayload);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.logout({ refreshToken: 'valid.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.user.findUnique.mockResolvedValue(
        prismaUserForAuth({ refreshTokenHash: null }),
      );
      await expect(
        authService.logout({ refreshToken: 'valid.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when token does not match hash', async () => {
      jwtService.verifyAsync.mockResolvedValue(loginPayload);
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.logout({ refreshToken: 'valid.jwt' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('clears refresh hash on success', async () => {
      jwtService.verifyAsync.mockResolvedValue(loginPayload);
      prisma.user.findUnique.mockResolvedValue(prismaUserForAuth());
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.user.update.mockResolvedValue({} as never);

      const result = await authService.logout({ refreshToken: 'valid.jwt' });

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: loginPayload.userId },
        data: { refreshTokenHash: null },
      });
    });
  });
});
