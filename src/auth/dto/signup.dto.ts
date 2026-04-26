import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({
    description: 'User login',
    example: 'jane.doe',
  })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({
    description: 'User password',
    example: 'Str0ngP@ssw0rd!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
