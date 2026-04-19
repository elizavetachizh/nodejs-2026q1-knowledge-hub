import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export class CreateUserDto {
  @ApiProperty({ description: 'User login', example: 'Login' })
  @IsString({ message: 'Login must be a string' })
  @IsNotEmpty({ message: 'Login cannot be empty' })
  login: string;

  @ApiProperty({ description: 'User password', example: 'Password' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  password: string;

  @ApiPropertyOptional({
    description: 'User role',
    example: UserRole.VIEWER,
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role?: UserRole = UserRole.VIEWER; // defaults to 'viewer'
}
