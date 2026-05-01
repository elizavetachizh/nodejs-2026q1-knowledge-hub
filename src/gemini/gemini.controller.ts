import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { Throttle } from '@nestjs/throttler';
import { SummarizeArticleRequest } from './dto/summarize-gemini.dto';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import { ApiTags } from '@nestjs/swagger';
import { AnalyzeArticleRequest } from './dto/analyze-gemini.dto';
import { AppThrottlerGuard } from 'src/common/guards/throttler.guard';
import { getPositiveInt } from 'src/common/utils/get-positive-int';

@ApiTags('AI')
@Controller('ai')
@UseGuards(AppThrottlerGuard)
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('articles/:id/summarize')
  @Throttle({
    default: {
      ttl: getPositiveInt(process.env.AI_CACHE_TTL_SEC, 60000),
      limit: getPositiveInt(process.env.AI_RATE_LIMIT_RPM, 20),
    },
  })
  @HttpCode(HttpStatus.OK)
  async summarizeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SummarizeArticleRequest,
  ) {
    return this.geminiService.summarizeArticle(id, body);
  }

  @Post('articles/:id/translate')
  @Throttle({
    default: {
      ttl: getPositiveInt(process.env.AI_CACHE_TTL_SEC, 60000),
      limit: getPositiveInt(process.env.AI_RATE_LIMIT_RPM, 20),
    },
  })
  @HttpCode(HttpStatus.OK)
  async translateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TranslateArticleRequest,
  ) {
    return this.geminiService.translateArticle(id, body);
  }

  @Post('articles/:id/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AnalyzeArticleRequest,
  ) {
    return this.geminiService.analyzeArticle(id, body);
  }
  // @Post('ai/generate')
  // async generateContent(
  //   @Body() body: GenerateContentRequest,
  // ): Promise<GenerateContentResponse> {
  //   return this.geminiService.generateContent(body);
  // }
}
