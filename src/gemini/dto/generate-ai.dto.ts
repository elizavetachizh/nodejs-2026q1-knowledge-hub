import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const PROMPT_MAX = 32_000;
const CONTEXT_MAX = 8000;

export class AiGenerateContentRequestDto {
  @ApiProperty({
    description: 'Free-form instructions for generation',
    maxLength: PROMPT_MAX,
    example:
      'List three bullet points that explain eventual consistency vs strong consistency.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROMPT_MAX)
  prompt: string;

  @ApiPropertyOptional({
    description: 'Optional background context (constraints, glossary, snippet)',
    maxLength: CONTEXT_MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CONTEXT_MAX)
  context?: string;
}

export class AiGenerateContentResponseDto {
  @ApiProperty({ description: 'Raw model output' })
  text: string;
}
