import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SummarizeArticleRequest } from './dto/summarize-gemini.dto';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import { SummarizeArticleResponse } from './gemini.types';

@Controller('ai')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('articles/:id/summarize')
  async summarizeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SummarizeArticleRequest,
  ): Promise<SummarizeArticleResponse> {
    return this.geminiService.summarizeArticle(id, body);
  }

  @Post('articles/:id/translate')
  async translateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TranslateArticleRequest,
  ) {
    return this.geminiService.translateArticle(id, body);
  }
  // @Post('ai/generate')
  // async generateContent(
  //   @Body() body: GenerateContentRequest,
  // ): Promise<GenerateContentResponse> {
  //   return this.geminiService.generateContent(body);
  // }
}
