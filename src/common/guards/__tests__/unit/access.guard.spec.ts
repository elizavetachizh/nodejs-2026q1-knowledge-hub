import { ExecutionContext } from '@nestjs/common';
import {
  ForbiddenError,
  UnauthorizedError,
} from 'src/common/errors/app-http.error';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AccessGuard } from 'src/common/guards/access.guard';
import { UserRole } from 'src/user/dto/create-user.dto';

function createContext(request: {
  path: string;
  method: string;
  authorization?: string;
}): { context: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = {
    path: request.path,
    method: request.method,
    headers: {
      ...(request.authorization !== undefined
        ? { authorization: request.authorization }
        : {}),
    },
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
  return { context, req };
}

let jwtService: { verify: ReturnType<typeof vi.fn> };
let guard: AccessGuard;

const validPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  role: UserRole.VIEWER,
  login: 'u1',
};

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
  jwtService = {
    verify: vi.fn(),
  };
  guard = new AccessGuard(jwtService as unknown as JwtService);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AccessGuard', () => {
  describe('public routes', () => {
    it.each([
      ['/', 'GET'],
      ['/doc', 'GET'],
      ['/doc/swagger', 'GET'],
      ['/auth/signup', 'POST'],
      ['/auth/login', 'POST'],
      ['/auth/refresh', 'POST'],
    ])('allows %s %s without Authorization', (path, method) => {
      const { context } = createContext({
        path,
        method: method as string,
      });
      expect(guard.canActivate(context)).toBe(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });
  });

  describe('authentication', () => {
    it('throws when Authorization header is missing', () => {
      const { context } = createContext({
        path: '/article',
        method: 'GET',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
      expect(() => guard.canActivate(context)).toThrow(
        'Authorization header is missing',
      );
    });

    it('throws when Authorization is not Bearer', () => {
      const { context } = createContext({
        path: '/article',
        method: 'GET',
        authorization: 'Basic xyz',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
      expect(() => guard.canActivate(context)).toThrow('Invalid token');
    });

    it('throws when Bearer token is empty', () => {
      const { context } = createContext({
        path: '/article',
        method: 'GET',
        authorization: 'Bearer ',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
      expect(() => guard.canActivate(context)).toThrow('Token is missing');
    });

    it('throws when JWT verify fails', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('expired');
      });
      const { context } = createContext({
        path: '/article',
        method: 'GET',
        authorization: 'Bearer token',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
      expect(() => guard.canActivate(context)).toThrow('Invalid token');
    });

    it('throws when payload is missing required fields', () => {
      jwtService.verify.mockReturnValue({ userId: 'x', role: UserRole.VIEWER });
      const { context } = createContext({
        path: '/article',
        method: 'GET',
        authorization: 'Bearer token',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
    });

    it('verifies with JWT_SECRET and attaches user to request', () => {
      jwtService.verify.mockReturnValue(validPayload);
      const { context, req } = createContext({
        path: '/article',
        method: 'GET',
        authorization: 'Bearer access.jwt',
      });

      expect(guard.canActivate(context)).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('access.jwt', {
        secret: 'test-jwt-secret',
      });
      expect(req.user).toEqual({
        userId: validPayload.userId,
        role: validPayload.role,
        login: validPayload.login,
      });
    });
  });

  describe('RBAC', () => {
    beforeEach(() => {
      jwtService.verify.mockReturnValue(validPayload);
    });

    it('allows viewer GET', () => {
      const { context } = createContext({
        path: '/article',
        method: 'GET',
        authorization: 'Bearer t',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('denies viewer non-GET', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.VIEWER,
      });
      const { context } = createContext({
        path: '/article',
        method: 'POST',
        authorization: 'Bearer t',
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });

    it('allows editor POST /article', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.EDITOR,
      });
      const { context } = createContext({
        path: '/article',
        method: 'POST',
        authorization: 'Bearer t',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('denies editor PATCH /article (only POST/PUT/DELETE allowed for mutations)', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.EDITOR,
      });
      const { context } = createContext({
        path: '/article/550e8400-e29b-41d4-a716-446655440000',
        method: 'PATCH',
        authorization: 'Bearer t',
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
    });

    it('denies editor mutating /category', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.EDITOR,
      });
      const { context } = createContext({
        path: '/category',
        method: 'POST',
        authorization: 'Bearer t',
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
    });

    it('allows editor GET /category', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.EDITOR,
      });
      const { context } = createContext({
        path: '/category',
        method: 'GET',
        authorization: 'Bearer t',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('denies editor mutating /user', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.EDITOR,
      });
      const { context } = createContext({
        path: '/user/1',
        method: 'DELETE',
        authorization: 'Bearer t',
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
    });

    it('allows admin POST /category', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.ADMIN,
      });
      const { context } = createContext({
        path: '/category',
        method: 'POST',
        authorization: 'Bearer t',
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows POST /auth/logout for viewer (explicit rule)', () => {
      jwtService.verify.mockReturnValue({
        ...validPayload,
        role: UserRole.VIEWER,
      });
      const { context } = createContext({
        path: '/auth/logout',
        method: 'POST',
        authorization: 'Bearer t',
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
