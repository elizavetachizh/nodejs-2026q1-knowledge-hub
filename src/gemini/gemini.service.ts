import { Injectable } from '@nestjs/common';
import {
  AnalyzeArticleResponse,
  AnalyzePayload,
  TranslateArticleResponse,
} from './gemini.types';
import { ArticleService } from 'src/article/article.service';
import { TranslateArticleRequest } from './dto/translate-gemini.dto';
import { summarizePrompt } from './prompts/summarize.prompt';
import { GeminiHttpService } from './gemini-http.service';
import { SummarizeArticleRequest } from './dto/summarize-gemini.dto';
import { translatePrompt } from './prompts/translate.prompt';
import { analyzePrompt } from './prompts/analyze.prompt';
import { AnalyzeArticleRequest } from './dto/analyze-gemini.dto';
import { AppHttpError } from 'src/common/errors/app-http.error';
import { getPositiveInt } from 'src/common/utils/get-positive-int';

@Injectable()
export class GeminiService {
  private readonly cacheTtlMs =
    getPositiveInt(process.env.AI_CACHE_TTL_SEC, 300) * 1000;

  constructor(
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
  ) {}

  private cacheMap = new Map<string, { text: string; expiresAt: number }>();
  private stripJsonFence(text: string): string {
    const t = text.trim();
    const m = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
    return m ? m[1].trim() : t;
  }
  async summarizeArticle(articleId: string, body: SummarizeArticleRequest) {
    const article = await this.articleService.getArticle(articleId);
    const key = `${articleId}-${body.maxLength}-${article.updatedAt}`;
    const cached = this.cacheMap.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        articleId: article.id,
        summary: cached.text,
        originalLength: article.content.length,
        summaryLength: cached.text.length,
      };
    } else {
      const result = await this.geminiHttpService.generateContent(
        summarizePrompt({
          title: article.title,
          content: article.content,
          maxLength: body.maxLength,
        }),
      );
      this.cacheMap.set(key, {
        text: result.text,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return {
        articleId: article.id,
        summary: result.text,
        originalLength: article.content.length,
        summaryLength: result.text.length,
      };
    }
  }

  async translateArticle(
    articleId: string,
    translateArticleBody: TranslateArticleRequest,
  ): Promise<TranslateArticleResponse> {
    const article = await this.articleService.getArticle(articleId);
    const key = `${articleId}-${translateArticleBody.targetLanguage}-${article.updatedAt}`;
    const cached = this.cacheMap.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      const raw = JSON.parse(cached.text) as {
        translatedText: string;
        detectedLanguage: string;
      };
      return {
        articleId: article.id,
        translatedText: raw.translatedText,
        detectedLanguage: raw.detectedLanguage,
      };
    } else {
      const result = await this.geminiHttpService.generateContent(
        translatePrompt({
          title: article.title,
          content: article.content,
          targetLanguage: translateArticleBody.targetLanguage,
          sourceLanguage: translateArticleBody.sourceLanguage,
        }),
      );
      let raw: {
        translatedText: string;
        detectedLanguage: string;
      };
      try {
        raw = JSON.parse(result.text);
      } catch {
        throw new AppHttpError(
          502,
          'The generation service returned an invalid response.',
        );
      }
      this.cacheMap.set(key, {
        text: result.text,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return {
        articleId: article.id,
        translatedText: raw.translatedText,
        detectedLanguage: raw.detectedLanguage,
      };
    }
  }
  async analyzeArticle(
    articleId: string,
    analyzeArticleBody: AnalyzeArticleRequest,
  ): Promise<AnalyzeArticleResponse> {
    const article = await this.articleService.getArticle(articleId);
    const result = await this.geminiHttpService.generateContent(
      analyzePrompt({
        content: article.content,
        task: analyzeArticleBody.task,
      }),
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.stripJsonFence(result.text));
    } catch {
      throw new AppHttpError(
        502,
        'The generation service returned an invalid response.',
      );
    }
    const p = parsed as Partial<AnalyzePayload>;
    if (
      typeof p.analysis !== 'string' ||
      !Array.isArray(p.suggestions) ||
      !p.suggestions.every((x) => typeof x === 'string') ||
      !['info', 'warning', 'error'].includes(p.severity as string)
    ) {
      throw new AppHttpError(
        502,
        'The generation service returned an invalid response.',
      );
    }

    return {
      articleId: article.id,
      analysis: p.analysis,
      suggestions: p.suggestions,
      severity: p.severity,
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
