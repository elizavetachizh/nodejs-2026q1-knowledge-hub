import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { SummarizeArticleMaxLength } from "src/gemini/gemini.types";

export class SummarizeArticleRequest {
   
    @ApiPropertyOptional({
        description: 'Max length of the summary',
        enum: SummarizeArticleMaxLength,
        default: SummarizeArticleMaxLength.MEDIUM,
        example: SummarizeArticleMaxLength.MEDIUM,
    })
    @IsOptional()
    @IsEnum(SummarizeArticleMaxLength)
    maxLength?: SummarizeArticleMaxLength = SummarizeArticleMaxLength.MEDIUM;
}