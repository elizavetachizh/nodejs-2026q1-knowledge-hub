import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class TranslateArticleRequest {
    @ApiProperty({ description: 'Target language', example: 'en' })
    @IsString()
    @IsNotEmpty()
    targetLanguage: string;

    @IsOptional()
    @IsString()
    sourceLanguage?: string
}