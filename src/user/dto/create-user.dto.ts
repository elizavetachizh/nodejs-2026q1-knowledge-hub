import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  login: string;
  @IsNotEmpty()
  @IsString()
  password: string;
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.VIEWER; // defaults to 'viewer'
}
