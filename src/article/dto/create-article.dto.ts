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
  @IsString()
  @IsNotEmpty()
  title: string;
  @IsString()
  @IsNotEmpty()
  content: string;
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus = ArticleStatus.DRAFT;
  @IsOptional()
  @ValidateIf((object) => object.authorId !== null)
  @IsUUID()
  authorId: string | null;
  @IsOptional()
  @ValidateIf((object) => object.categoryId !== null)
  @IsUUID()
  categoryId: string | null;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
