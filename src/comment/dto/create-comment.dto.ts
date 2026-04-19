import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment text',
    example: 'Great article, thanks for sharing!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Article id (UUID) this comment belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  articleId: string;

  @ApiPropertyOptional({
    description: 'Author id (UUID). Can be null for anonymous comment',
    example: '660e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  authorId: string;
}
