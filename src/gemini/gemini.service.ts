import { Injectable } from '@nestjs/common';
import {
  SummarizeArticleMaxLength,
  TranslateArticleResponse,
} from './gemini.types';
import { ArticleService } from 'src/article/article.service';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import { summarizePrompt } from './prompts/summarize.prompt';
import { GeminiHttpService } from './gemini-http.service';

@Injectable()
export class GeminiService {
  constructor(
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
  ) {}

  async summarizeArticle(
    articleId: string,
    maxLength: SummarizeArticleMaxLength,
  ) {
    const article = await this.articleService.getArticle(articleId);
    const result = await this.geminiHttpService.generateContent(
      summarizePrompt({
        title: article.title,
        content: article.content,
        maxLength,
      }),
    );
    return {
      articleId: article.id,
      summary: result.text,
      originalLength: article.content.length,
      summaryLength: result.text.length,
    };
  }

  async translateArticle(
    articleId: string,
    translateArticleBody: TranslateArticleRequest,
  ): Promise<TranslateArticleResponse> {
    const article = await this.articleService.getArticle(articleId);
    const prompt = `Translate the following article: ${article.content}`;
    return {
      articleId: article.id,
      translatedText: prompt,
      detectedLanguage: 'en',
    };
  }
  //   async generateContent(generateContentBody: GenerateContentRequest):Promise<GenerateContentResponse> {
  //     const prompt = `Generate content for the following article: ${generateContentBody.articleId}`;
  //     return {
  //       articleId: generateContentBody.articleId,
  //       content: prompt,
  //     }
  //   }
}
