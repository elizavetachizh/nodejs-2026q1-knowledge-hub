import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { AnalyzeArticleTask } from "../gemini.types";

export class AnalyzeArticleRequest {
    @ApiProperty({ description: 'Task to analyze', example: AnalyzeArticleTask.REVIEW , default: AnalyzeArticleTask.REVIEW })
    @IsOptional()
    @IsEnum(AnalyzeArticleTask)
    task?: AnalyzeArticleTask = AnalyzeArticleTask.REVIEW;
}