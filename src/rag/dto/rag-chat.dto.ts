import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RagChatRequestDto {
  @ApiProperty({
    description: 'User question for grounded RAG answer generation',
    example: 'How set Prisma and PostgreSQL in this project?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    description: 'Conversation id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
