import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
  @IsNotEmpty()
  @IsUUID()
  articleId: string;
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  authorId: string;
}
