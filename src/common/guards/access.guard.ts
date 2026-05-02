import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  UnauthorizedError,
} from 'src/common/errors/app-http.error';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from 'src/user/dto/create-user.dto';

@Injectable()
export class AccessGuard implements CanActivate {
  private isArticleAiPost(method: string, path: string): boolean {
    if (method !== 'POST') return false;
    return /^\/ai\/articles\/[^/]+\/(summarize|translate|analyze)$/.test(path);
  }

  private roleAllows = (
    role: string,
    method: string,
    path: string,
  ): boolean => {
    if (path === '/auth/logout' && method === 'POST') return true;
    if (role === UserRole.ADMIN) return true;

    if (this.isArticleAiPost(method, path)) return true;

    if (role === UserRole.VIEWER) return method === 'GET';
    if (role === UserRole.EDITOR) {
      if (method === 'GET') return true;
      if (path.startsWith('/category') && method !== 'GET') return false;
      if (path.startsWith('/user') && method !== 'GET') return false;
      if (
        (path.startsWith('/article') || path.startsWith('/comment')) &&
        ['POST', 'PUT', 'DELETE'].includes(method)
      )
        return true;
      return false;
    }
    return false;
  };
  private isPublicRoute(path: string, method: string) {
    if (path === '/') return true;
    if (path.startsWith('/doc')) return true;
    if (path === '/auth/signup') return true;
    if (path === '/auth/login') return true;
    if (path === '/auth/refresh') return true;
    if (path === '/ai/generate' && method === 'POST') return true;
    return false;
  }
  private isBearerToken(authorizationHeader: unknown): string {
    if (typeof authorizationHeader !== 'string') {
      throw new UnauthorizedError('Authorization header is missing');
    }
    if (!authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid token');
    }
    const token = authorizationHeader?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Token is missing');
    }
    return token;
  }
  private verifyAccessToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!payload.userId || !payload.role || !payload.login) {
        throw new UnauthorizedError('Invalid token');
      }
      return payload;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.path;
    const method = request.method;

    if (this.isPublicRoute(path, method)) return true;

    const authHeader = request.headers.authorization;
    const token = this.isBearerToken(authHeader);

    const payload = this.verifyAccessToken(token);

    request.user = {
      userId: payload.userId,
      role: payload.role,
      login: payload.login,
    };

    const allowed = this.roleAllows(payload.role, method, path);
    if (!allowed) {
      throw new ForbiddenError('Access denied');
    }
    return true;
  }
}
