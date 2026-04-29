import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SummarizeArticleRequest } from './dto/summarize-gemini.dto';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import { ApiTags } from '@nestjs/swagger';
import { AnalyzeArticleRequest } from './dto/analyze-gemini.dto';

@ApiTags('AI')
@Controller('ai')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('articles/:id/summarize')
  @HttpCode(HttpStatus.OK)
  async summarizeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SummarizeArticleRequest,
  ) {
    return this.geminiService.summarizeArticle(id, body);
  }

  @Post('articles/:id/translate')
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
