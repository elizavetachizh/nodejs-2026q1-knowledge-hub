import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SummarizeArticleMaxLength } from 'src/gemini/gemini.types';

export class SummarizeArticleRequest {
  @ApiPropertyOptional({
    description:
      'Summary size preset. Allowed values: short (brief), medium (balanced), detailed (extended).',
    enum: SummarizeArticleMaxLength,
    enumName: 'SummarizeArticleMaxLength',
    default: SummarizeArticleMaxLength.MEDIUM,
    example: SummarizeArticleMaxLength.MEDIUM,
    examples: {
      short: {
        summary: 'Brief summary',
        value: SummarizeArticleMaxLength.SHORT,
      },
      medium: {
        summary: 'Balanced summary',
        value: SummarizeArticleMaxLength.MEDIUM,
      },
      detailed: {
        summary: 'Extended summary',
        value: SummarizeArticleMaxLength.DETAILED,
      },
    },
  })
  @IsOptional()
  @IsEnum(SummarizeArticleMaxLength)
  maxLength?: SummarizeArticleMaxLength = SummarizeArticleMaxLength.MEDIUM;
}
