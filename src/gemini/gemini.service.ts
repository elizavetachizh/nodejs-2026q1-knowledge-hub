import { Injectable } from '@nestjs/common';
import { TranslateArticleResponse } from './gemini.types';
import { ArticleService } from 'src/article/article.service';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import { summarizePrompt } from './prompts/summarize.prompt';
import { GeminiHttpService } from './gemini-http.service';
import { SummarizeArticleRequest } from './dto/summarize-gemini.dto';
import { translatePrompt } from './prompts/translate.prompt';
import { analyzePrompt } from './prompts/analyze.prompt';
import { AnalyzeArticleRequest } from './dto/analyze-gemini.dto';

@Injectable()
export class GeminiService {
  constructor(
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
  ) {}

  async summarizeArticle(articleId: string, body: SummarizeArticleRequest) {
    const article = await this.articleService.getArticle(articleId);
    const result = await this.geminiHttpService.generateContent(
      summarizePrompt({
        title: article.title,
        content: article.content,
        maxLength: body.maxLength,
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
    const result = await this.geminiHttpService.generateContent(
      translatePrompt({
        content: article.content,
        targetLanguage: translateArticleBody.targetLanguage,
      }),
    );
    return {
      articleId: article.id,
      translatedText: result.text,
      detectedLanguage: translateArticleBody.sourceLanguage,
    };
  }
  async analyzeArticle(
    articleId: string,
    analyzeArticleBody: AnalyzeArticleRequest,
  ) {
    const article = await this.articleService.getArticle(articleId);
    const result = await this.geminiHttpService.generateContent(
      analyzePrompt({
        content: article.content,
        task: analyzeArticleBody.task,
      }),
    );
    const analysis = JSON.parse(result.text) as {
      suggestions: string[];
      severity: 'info' | 'warning' | 'error';
    };
    return {
      articleId: article.id,
      analysis: result.text,
      suggestions: analysis.suggestions,
      severity: analysis.severity,
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
