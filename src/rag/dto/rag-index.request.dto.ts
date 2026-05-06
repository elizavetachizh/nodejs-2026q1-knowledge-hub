import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class RagIndexRequestDto {
  @ApiProperty({
    description: 'Only published articles',
  })
  @IsBoolean()
  @IsNotEmpty()
  onlyPublished?: boolean = true;

  @ApiPropertyOptional({
    description: 'Optional array of articles ids',
  })
  @IsOptional()
  @IsArray()
  articleIds?: string[];
}
