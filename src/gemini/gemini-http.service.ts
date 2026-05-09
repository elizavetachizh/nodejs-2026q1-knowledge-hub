import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { AppHttpError } from 'src/common/errors/app-http.error';
import { sanitizeForLog } from 'src/common/logging/sanitize-for-log';
import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';
import {
  GeminiGenerateContentResult,
  GeminiGenerationUsage,
} from './gemini-http.types';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_BASE_MS = 1_000;
const RETRY_AFTER_MAX_MS = 32_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attemptIndex: number): number {
  return RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(2, attemptIndex);
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  const sec = Number.parseInt(trimmed, 10);
  if (Number.isFinite(sec) && sec >= 0) {
    const ms = Math.min(sec * 1000, RETRY_AFTER_MAX_MS);
    return ms;
  }
  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) {
    const ms = date - Date.now();
    return ms > 0 ? Math.min(ms, RETRY_AFTER_MAX_MS) : undefined;
  }
  return undefined;
}

type UndiciResponse = Awaited<ReturnType<typeof undiciFetch>>;

function pickDelayAfter429(
  response: UndiciResponse,
  attemptIndex: number,
): number {
  const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
  const exp = backoffDelayMs(attemptIndex);
  return Math.max(exp, retryAfterMs ?? 0);
}

function normalizeUsage(metadata: unknown): GeminiGenerationUsage | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const u = metadata as Record<string, unknown>;
  const n = (k: string) =>
    typeof u[k] === 'number' && Number.isFinite(u[k])
      ? (u[k] as number)
      : undefined;
  const out: GeminiGenerationUsage = {};
  const p = n('promptTokenCount');
  const c = n('candidatesTokenCount');
  const t = n('totalTokenCount');
  if (p !== undefined) out.promptTokenCount = Math.trunc(p);
  if (c !== undefined) out.candidatesTokenCount = Math.trunc(c);
  if (t !== undefined) out.totalTokenCount = Math.trunc(t);
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Исходящие запросы к Gemini через undici `fetch` и {@link EnvHttpProxyAgent}:
 * HTTP_PROXY, HTTPS_PROXY, NO_PROXY (как у многих CLI).
 */
@Injectable()
export class GeminiHttpService implements OnApplicationShutdown {
  private readonly logger = new Logger(GeminiHttpService.name);
  private readonly fetchDispatcher = new EnvHttpProxyAgent();
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL || 'http://127.0.0.1:8787/v1beta/models';
  private readonly model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  private readonly apiKey = process.env.GEMINI_API_KEY;

  constructor() {
    const hasProxyHints =
      Boolean(
        process.env.HTTP_PROXY?.trim() ||
          process.env.HTTPS_PROXY?.trim() ||
          process.env.http_proxy?.trim() ||
          process.env.https_proxy?.trim(),
      ) ||
      Boolean(process.env.NO_PROXY?.trim() || process.env.no_proxy?.trim());
    if (hasProxyHints) {
      this.logger.log(
        'Gemini HTTP client uses EnvHttpProxyAgent (HTTP_PROXY / HTTPS_PROXY / NO_PROXY)',
      );
    }
  }

  async onApplicationShutdown(signal?: string) {
    await this.fetchDispatcher.close();
    if (signal) {
      this.logger.log(`Gemini HTTP proxy agent closed (${signal})`);
    }
  }

  async generateContent(prompt: string): Promise<GeminiGenerateContentResult> {
    if (!this.apiKey) {
      throw new AppHttpError(
        500,
        'GEMINI_API_KEY is not configured. Set it in environment for this process.',
      );
    }

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    for (
      let rateLimitAttempt = 0;
      rateLimitAttempt <= MAX_RATE_LIMIT_RETRIES;
      rateLimitAttempt++
    ) {
      let response: UndiciResponse;
      try {
        response = await undiciFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          dispatcher: this.fetchDispatcher,
        });
      } catch (err) {
        const e = err as Error & { cause?: unknown };
        const detail =
          err instanceof Error
            ? `${e.message}${
                e.cause !== undefined
                  ? ` | cause: ${
                      e.cause instanceof Error
                        ? e.cause.message
                        : String(e.cause)
                    }`
                  : ''
              }`
            : String(err);
        this.logger.error(`Gemini fetch failed: ${detail}`);
        throw new AppHttpError(
          503,
          'The generation service is temporarily unreachable.',
        );
      }

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          usageMetadata?: unknown;
        };
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== 'string') {
          throw new AppHttpError(
            502,
            'The generation service returned an invalid response.',
          );
        }
        const usageMetadata = normalizeUsage(data.usageMetadata);
        return usageMetadata !== undefined ? { text, usageMetadata } : { text };
      }

      const errRaw = await response.text().catch(() => '');
      let logPayload = errRaw.slice(0, 3000);
      try {
        const parsed = JSON.parse(errRaw) as Record<string, unknown>;
        logPayload = JSON.stringify(sanitizeForLog(parsed));
      } catch {
        /** not JSON — truncated text ok */
      }
      this.logger.warn(
        `Gemini upstream HTTP ${response.status} ${response.statusText || '(no status text)'}: ${logPayload}`,
      );

      const upstream = response.status;
      const isRetryableRateLimit =
        upstream === 429 && rateLimitAttempt < MAX_RATE_LIMIT_RETRIES;

      if (isRetryableRateLimit) {
        const delayMs = pickDelayAfter429(response, rateLimitAttempt);
        this.logger.warn(
          `Gemini rate limited (429), retry ${rateLimitAttempt + 1}/${MAX_RATE_LIMIT_RETRIES} after ${delayMs}ms`,
        );
        await sleep(delayMs);
        continue;
      }

      if (upstream === 401 || upstream === 403) {
        throw new AppHttpError(
          500,
          'Generation service authentication failed.',
        );
      }

      if (upstream === 429 || upstream === 503) {
        throw new AppHttpError(
          503,
          'The generation service is temporarily overloaded. Please try again later.',
        );
      }

      const status =
        upstream >= 400 && upstream < 600 ? upstream : 502;

      throw new AppHttpError(
        status,
        status === 400 || status === 404
          ? 'The generation service rejected the request.'
          : 'The generation service request failed.',
      );
    }

    throw new AppHttpError(
      503,
      'The generation service is temporarily overloaded. Please try again later.',
    );
  }
}
