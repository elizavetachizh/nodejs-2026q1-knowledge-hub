import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { UserRole } from './create-user.dto';
import { ApiProperty } from '@nestjs/swagger';

  export class UpdatePasswordDto {
    @IsNotEmpty()
    @IsString()
    oldPassword: string;
    @IsString()
    @IsNotEmpty()
    newPassword: string;
  }
  
export class UpdateUserRoleDto {
  @ApiProperty({ description: 'User role', example: UserRole.VIEWER, enum: UserRole })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole = UserRole.VIEWER;
}