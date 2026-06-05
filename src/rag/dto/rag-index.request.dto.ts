import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional } from 'class-validator';

export class RagIndexRequestDto {
  @ApiPropertyOptional({
    description: 'Only published articles',
  })
  @IsBoolean()
  @IsOptional()
  onlyPublished?: boolean = true;

  @ApiPropertyOptional({
    description: 'Optional array of articles ids',
  })
  @IsOptional()
  @IsArray()
  articleIds?: string[];
}
