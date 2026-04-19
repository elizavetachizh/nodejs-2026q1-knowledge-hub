import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateIf,
  IsUUID,
} from 'class-validator';

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export class CreateArticleDto {
  @ApiProperty({ description: 'Article title', example: 'Title' })
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title cannot be empty' })
  title: string;

  @ApiProperty({ description: 'Article content', example: 'Content' })
  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content cannot be empty' })
  content: string;

  @ApiPropertyOptional({
    description: 'Article status',
    enum: ArticleStatus,
    default: ArticleStatus.DRAFT,
    example: ArticleStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus = ArticleStatus.DRAFT;

  @ApiPropertyOptional({
    description:
      'Author id (UUID). Use null to create article without linked author',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((object) => object.authorId !== null)
  @IsUUID()
  authorId: string | null;

  @ApiPropertyOptional({
    description:
      'Category id (UUID). Use null to create article without category',
    example: '660e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((object) => object.categoryId !== null)
  @IsUUID()
  categoryId: string | null;

  @ApiPropertyOptional({
    description: 'List of article tags',
    example: ['nodejs', 'nestjs', 'docker'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
