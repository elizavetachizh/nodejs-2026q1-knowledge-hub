import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RagRerankService } from 'src/rag/rag-rerank.service';

function makeGeminiMock() {
  return {
    generateContent: vi.fn(),
  };
}

describe('RagRerankService', () => {
  let geminiHttpService: ReturnType<typeof makeGeminiMock>;
  let service: RagRerankService;

  beforeEach(() => {
    geminiHttpService = makeGeminiMock();
    service = new RagRerankService(geminiHttpService as never);
  });

  it('returns empty list when no candidates', async () => {
    const result = await service.rerank('q', []);

    expect(result).toEqual([]);
    expect(geminiHttpService.generateContent).not.toHaveBeenCalled();
  });

  it('parses valid JSON and clamps relevance to [0..1]', async () => {
    geminiHttpService.generateContent.mockResolvedValue({
      text: JSON.stringify({
        items: [
          { id: 'a', relevance: 1.5 },
          { id: 'b', relevance: -0.2 },
          { id: 'c', relevance: 0.4 },
          { id: 123, relevance: 0.9 },
          { id: 'd', relevance: '0.9' },
        ],
      }),
    });

    const result = await service.rerank('What is Nest?', [
      {
        id: 'a',
        articleId: 'article-1',
        articleTitle: 'A1',
        chunkText: 'Chunk 1',
        baseScore: 0.6,
      },
    ]);

    expect(result).toEqual([
      { id: 'a', relevance: 1 },
      { id: 'b', relevance: 0 },
      { id: 'c', relevance: 0.4 },
    ]);
  });

  it('throws 502 when reranker returns non-JSON', async () => {
    geminiHttpService.generateContent.mockResolvedValue({
      text: 'not-json',
    });

    await expect(
      service.rerank('What is Nest?', [
        {
          id: 'a',
          articleId: 'article-1',
          articleTitle: 'A1',
          chunkText: 'Chunk 1',
          baseScore: 0.6,
        },
      ]),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: 'Reranker returned non-JSON response',
    });
  });
});
