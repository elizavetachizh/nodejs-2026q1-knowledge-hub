import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from 'src/user/dto/create-user.dto';

// Temporary empty guard stub for future access checks
@Injectable()
export class AccessGuard implements CanActivate {
  private roleAllows = (
    role: string,
    method: string,
    path: string,
  ): boolean => {
    if (role === UserRole.ADMIN) return true;

    if (role === UserRole.VIEWER) return method === 'GET';
    if (role === UserRole.EDITOR) {
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
  private isPublicRoute(path: string) {
    if (path === '/') return true;
    if (path.startsWith('/doc')) return true;
    if (path.startsWith('/auth')) return true;
    return false;
  }
  private isBearerToken(authorizationHeader: unknown): string {
    if (typeof authorizationHeader !== 'string') {
      throw new UnauthorizedException('Authorization header is missing');
    }
    if (!authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token');
    }
    const token = authorizationHeader?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Token is missing');
    }
    return token;
  }
  private verifyAccessToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!payload.userId || !payload.role || !payload.login) {
        throw new UnauthorizedException('Invalid token');
      }
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.path;
    const method = request.method;

    if (this.isPublicRoute(path)) return true;

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
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
