import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({
    description: 'JWT refresh token',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token.signature',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'JWT refresh token to invalidate',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token.signature',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}