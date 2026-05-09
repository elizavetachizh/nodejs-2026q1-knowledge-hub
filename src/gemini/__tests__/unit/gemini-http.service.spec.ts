import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch, mockClose } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockClose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('undici', () => {
  class MockEnvHttpProxyAgent {
    close = mockClose;
  }
  return {
    fetch: mockFetch,
    EnvHttpProxyAgent: MockEnvHttpProxyAgent,
  };
});

import { GeminiHttpService } from 'src/gemini/gemini-http.service';

type MockResponseInput = {
  ok: boolean;
  status: number;
  statusText?: string;
  jsonData?: unknown;
  textData?: string;
  retryAfter?: string | null;
};

function mockResponse(input: MockResponseInput) {
  return {
    ok: input.ok,
    status: input.status,
    statusText: input.statusText ?? '',
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'retry-after' ? (input.retryAfter ?? null) : null,
    },
    json: vi.fn().mockResolvedValue(input.jsonData),
    text: vi.fn().mockResolvedValue(input.textData ?? ''),
  };
}

describe('GeminiHttpService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_API_BASE_URL =
      'https://generativelanguage.googleapis.com/v1beta/models';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    process.env.GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
    mockFetch.mockReset();
    mockClose.mockClear();
  });

  it('generateContent returns text and normalized usage metadata', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        jsonData: {
          candidates: [{ content: { parts: [{ text: 'Generated answer' }] } }],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        },
      }),
    );

    const service = new GeminiHttpService();
    const result = await service.generateContent('What is NestJS?');

    expect(result).toEqual({
      text: 'Generated answer',
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain(
      '/gemini-2.0-flash:generateContent?key=test-key',
    );
  });

  it('embedContent returns vector values from embed API', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        jsonData: {
          embedding: { values: [0.1, 0.2, 0.3] },
        },
      }),
    );

    const service = new GeminiHttpService();
    const result = await service.embedContent('chunk text');

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain(
      '/text-embedding-004:embedContent?key=test-key',
    );
  });

  it('throws 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new GeminiHttpService();

    await expect(service.generateContent('Hello')).rejects.toMatchObject({
      statusCode: 500,
      message:
        'GEMINI_API_KEY is not configured. Set it in environment for this process.',
    });
  });

  it('throws 400 for empty embed text', async () => {
    const service = new GeminiHttpService();

    await expect(service.embedContent('   ')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Text for embedding must not be empty.',
    });
  });

  it('throws 502 when generation response does not contain text', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        jsonData: {
          candidates: [{ content: { parts: [{ wrong: 'shape' }] } }],
        },
      }),
    );

    const service = new GeminiHttpService();

    await expect(service.generateContent('Hello')).rejects.toMatchObject({
      statusCode: 502,
      message: 'The generation service returned an invalid response.',
    });
  });

  it('throws 503 when upstream fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
    const service = new GeminiHttpService();

    await expect(service.generateContent('Hello')).rejects.toMatchObject({
      statusCode: 503,
      message: 'The generation service is temporarily unreachable.',
    });
  });

  it('onApplicationShutdown closes fetch dispatcher', async () => {
    const service = new GeminiHttpService();

    await service.onApplicationShutdown();

    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('throws 502 when embedding payload is invalid', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        jsonData: {
          embedding: { values: [] },
        },
      }),
    );

    const service = new GeminiHttpService();

    await expect(service.embedContent('abc')).rejects.toMatchObject({
      statusCode: 502,
      message: 'The embedding service returned an invalid response.',
    });
  });
});
