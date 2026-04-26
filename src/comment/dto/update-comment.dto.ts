import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Comment text',
    example: 'Great article, thanks for sharing!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
