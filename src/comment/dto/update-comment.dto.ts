import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Comment text',
    example: 'Great article, thanks for sharing!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
