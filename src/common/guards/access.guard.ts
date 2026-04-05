import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
//пока что пустой guard заглушка для будущих проверок доступа
@Injectable()
export class AccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    void context;
    return true;
  }
}
