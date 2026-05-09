import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiService } from 'src/gemini/gemini.service';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import {
  AnalyzeArticleTask,
  SummarizeArticleMaxLength,
} from 'src/gemini/gemini.types';

function makeDeps() {
  return {
    geminiHttpService: {
      generateContent: vi.fn(),
    },
    articleService: {
      getArticle: vi.fn(),
    },
    geminiUsageService: {
      record: vi.fn(),
      recordCacheHit: vi.fn(),
      recordCacheMiss: vi.fn(),
      recordStructuredFallback: vi.fn(),
    },
  };
}

describe('GeminiService', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: GeminiService;

  const article = {
    id: 'article-1',
    title: 'Node + Nest',
    content: 'Article content for Gemini testing.',
    status: ArticleStatus.PUBLISHED,
    authorId: null,
    categoryId: null,
    tags: ['node'],
    createdAt: 1_735_000_000_000,
    updatedAt: 1_736_000_000_000,
  };

  beforeEach(() => {
    deps = makeDeps();
    service = new GeminiService(
      deps.geminiHttpService as never,
      deps.articleService as never,
      deps.geminiUsageService as never,
    );
  });

  it('summarizeArticle uses cache on repeated call', async () => {
    deps.articleService.getArticle.mockResolvedValue(article);
    deps.geminiHttpService.generateContent.mockResolvedValue({
      text: 'Short summary',
      usageMetadata: { totalTokenCount: 42 },
    });

    const first = await service.summarizeArticle(article.id, {
      maxLength: SummarizeArticleMaxLength.MEDIUM,
    });
    const second = await service.summarizeArticle(article.id, {
      maxLength: SummarizeArticleMaxLength.MEDIUM,
    });

    expect(first.summary).toBe('Short summary');
    expect(second.summary).toBe('Short summary');
    expect(deps.geminiHttpService.generateContent).toHaveBeenCalledOnce();
    expect(deps.geminiUsageService.recordCacheMiss).toHaveBeenCalledWith(
      'summarize',
    );
    expect(deps.geminiUsageService.recordCacheHit).toHaveBeenCalledWith(
      'summarize',
    );
  });

  it('translateArticle records structured fallback on non-JSON model output', async () => {
    deps.articleService.getArticle.mockResolvedValue(article);
    deps.geminiHttpService.generateContent.mockResolvedValue({
      text: 'Привет translated plain text',
      usageMetadata: undefined,
    });

    const result = await service.translateArticle(article.id, {
      targetLanguage: 'en',
      sourceLanguage: 'ru',
    });

    expect(result.articleId).toBe(article.id);
    expect(result.translatedText.length).toBeGreaterThan(0);
    expect(
      deps.geminiUsageService.recordStructuredFallback,
    ).toHaveBeenCalledWith('translate');
  });

  it('analyzeArticle records structured fallback when output is invalid', async () => {
    deps.articleService.getArticle.mockResolvedValue(article);
    deps.geminiHttpService.generateContent.mockResolvedValue({
      text: '{{{ invalid json',
      usageMetadata: undefined,
    });

    const result = await service.analyzeArticle(article.id, {
      task: AnalyzeArticleTask.REVIEW,
    });

    expect(result.articleId).toBe(article.id);
    expect(result.analysis.length).toBeGreaterThan(0);
    expect(
      deps.geminiUsageService.recordStructuredFallback,
    ).toHaveBeenCalledWith('analyze');
  });

  it('generateContent returns text and records usage metrics', async () => {
    deps.geminiHttpService.generateContent.mockResolvedValue({
      text: 'Generated generic output',
      usageMetadata: { promptTokenCount: 5, totalTokenCount: 12 },
    });

    const result = await service.generateContent({
      prompt: 'Write a short hello',
      context: 'for API docs',
    });

    expect(result).toEqual({ text: 'Generated generic output' });
    expect(deps.geminiUsageService.record).toHaveBeenCalledWith(
      'generate',
      { promptTokenCount: 5, totalTokenCount: 12 },
      expect.any(Number),
    );
  });
});
