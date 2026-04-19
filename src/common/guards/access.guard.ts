import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
// Temporary empty guard stub for future access checks
@Injectable()
export class AccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    void context;
    return true;
  }
}
