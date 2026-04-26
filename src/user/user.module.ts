import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UsersWriteService } from './user-credentials.service';
@Module({
  exports: [UsersWriteService],
  controllers: [UserController],
  providers: [UserService, UsersWriteService],
})
export class UserModule {}
