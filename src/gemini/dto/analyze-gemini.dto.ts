import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AnalyzeArticleTask } from '../gemini.types';

export class AnalyzeArticleRequest {
  @ApiProperty({
    description: 'Task to analyze. Allowed values: review, bugs, optimize, explain',
    enum: AnalyzeArticleTask,
    enumName: 'AnalyzeArticleTask',
    example: AnalyzeArticleTask.REVIEW,
    default: AnalyzeArticleTask.REVIEW,
    examples: {
      review: {
        value: AnalyzeArticleTask.REVIEW,
        description: 'Review the content and provide a summary of the main points.',
      },
      bugs: {
        value: AnalyzeArticleTask.BUGS,
        description: 'Find the bugs in the content and provide a list of the bugs.',
      },
      optimize: {
        value: AnalyzeArticleTask.OPTIMIZE,
        description: 'Optimize the content and provide a list of the optimizations.',
      },
      explain: {
        value: AnalyzeArticleTask.EXPLAIN,
        description: 'Explain the content and provide a list of the explanations.',
      },
    },
  })
  @IsOptional()
  @IsEnum(AnalyzeArticleTask)
  task?: AnalyzeArticleTask = AnalyzeArticleTask.REVIEW;
}
