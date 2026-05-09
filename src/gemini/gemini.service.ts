import { Injectable } from '@nestjs/common';
import {
  AnalyzeArticleResponse,
  AiGenerateContentResponse,
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
import { getPositiveInt } from 'src/common/utils/get-positive-int';
import { GeminiUsageService } from './gemini-usage.service';
import { AiGenerateContentRequestDto } from './dto/generate-ai.dto';
import { genericGeneratePrompt } from './prompts/generic-generate.prompt';
import {
  normalizeAnalyzeResponseWithDiagnostics,
  normalizeTranslateResponseWithDiagnostics,
  parseTranslateFromCache,
  serializeTranslateForCache,
} from './structured-ai-response';

@Injectable()
export class GeminiService {
  private readonly cacheTtlMs =
    getPositiveInt(process.env.AI_CACHE_TTL_SEC, 300) * 1000;

  constructor(
    private readonly geminiHttpService: GeminiHttpService,
    private readonly articleService: ArticleService,
    private readonly geminiUsageService: GeminiUsageService,
  ) {}

  private cacheMap = new Map<string, { text: string; expiresAt: number }>();
  async summarizeArticle(articleId: string, body: SummarizeArticleRequest) {
    const article = await this.articleService.getArticle(articleId);
    const key = `${articleId}-${body.maxLength}-${article.updatedAt}`;
    const cached = this.cacheMap.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.geminiUsageService.recordCacheHit('summarize');
      return {
        articleId: article.id,
        summary: cached.text,
        originalLength: article.content.length,
        summaryLength: cached.text.length,
      };
    }
    this.geminiUsageService.recordCacheMiss('summarize');
    this.cacheMap.delete(key);
    const t0 = Date.now();
    const result = await this.geminiHttpService.generateContent(
      summarizePrompt({
        title: article.title,
        content: article.content,
        maxLength: body.maxLength,
      }),
    );
    const ms = Date.now() - t0;
    this.geminiUsageService.record('summarize', result.usageMetadata, ms);
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

  async translateArticle(
    articleId: string,
    translateArticleBody: TranslateArticleRequest,
  ): Promise<TranslateArticleResponse> {
    const article = await this.articleService.getArticle(articleId);
    const key = `${articleId}-${translateArticleBody.targetLanguage}-${article.updatedAt}`;
    const cached = this.cacheMap.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.geminiUsageService.recordCacheHit('translate');
      const canon = parseTranslateFromCache(cached.text);
      if (canon) {
        return {
          articleId: article.id,
          translatedText: canon.translatedText,
          detectedLanguage: canon.detectedLanguage,
        };
      }
      const salvaged = normalizeTranslateResponseWithDiagnostics(
        cached.text,
        translateArticleBody.sourceLanguage,
      );
      if (salvaged.usedStructuredFallback) {
        this.geminiUsageService.recordStructuredFallback('translate');
      }
      return {
        articleId: article.id,
        translatedText: salvaged.payload.translatedText,
        detectedLanguage: salvaged.payload.detectedLanguage,
      };
    }

    this.geminiUsageService.recordCacheMiss('translate');
    this.cacheMap.delete(key);
    const t0 = Date.now();
    const result = await this.geminiHttpService.generateContent(
      translatePrompt({
        title: article.title,
        content: article.content,
        targetLanguage: translateArticleBody.targetLanguage,
        sourceLanguage: translateArticleBody.sourceLanguage,
      }),
    );
    const ms = Date.now() - t0;
    this.geminiUsageService.record('translate', result.usageMetadata, ms);
    const normalized = normalizeTranslateResponseWithDiagnostics(
      result.text,
      translateArticleBody.sourceLanguage,
    );
    if (normalized.usedStructuredFallback) {
      this.geminiUsageService.recordStructuredFallback('translate');
    }
    this.cacheMap.set(key, {
      text: serializeTranslateForCache(normalized.payload),
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return {
      articleId: article.id,
      translatedText: normalized.payload.translatedText,
      detectedLanguage: normalized.payload.detectedLanguage,
    };
  }

  async analyzeArticle(
    articleId: string,
    analyzeArticleBody: AnalyzeArticleRequest,
  ): Promise<AnalyzeArticleResponse> {
    const article = await this.articleService.getArticle(articleId);
    const t0 = Date.now();
    const result = await this.geminiHttpService.generateContent(
      analyzePrompt({
        content: article.content,
        task: analyzeArticleBody.task,
      }),
    );
    const ms = Date.now() - t0;
    this.geminiUsageService.record('analyze', result.usageMetadata, ms);
    const { payload, usedStructuredFallback } =
      normalizeAnalyzeResponseWithDiagnostics(result.text);
    if (usedStructuredFallback) {
      this.geminiUsageService.recordStructuredFallback('analyze');
    }
    return {
      articleId: article.id,
      analysis: payload.analysis,
      suggestions: payload.suggestions,
      severity: payload.severity,
    };
  }

  async generateContent(
    body: AiGenerateContentRequestDto,
  ): Promise<AiGenerateContentResponse> {
    const t0 = Date.now();
    const result = await this.geminiHttpService.generateContent(
      genericGeneratePrompt({
        prompt: body.prompt,
        context: body.context,
      }),
    );
    const ms = Date.now() - t0;
    this.geminiUsageService.record('generate', result.usageMetadata, ms);
    return { text: result.text };
  }
}
