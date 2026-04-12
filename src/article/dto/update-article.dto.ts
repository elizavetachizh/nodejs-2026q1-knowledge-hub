import {
  IsNotEmpty,
  IsString,
  IsEnum,
  ValidateIf,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ArticleStatus } from './create-article.dto';

export class UpdateArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;
  @IsString()
  @IsNotEmpty()
  content: string;
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
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
