import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { AppHttpError } from 'src/common/errors/app-http.error';
import { sanitizeForLog } from 'src/common/logging/sanitize-for-log';
import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';

/**
 * Исходящие запросы к Gemini идут через undici `fetch` с {@link EnvHttpProxyAgent}:
 * учитываются переменные окружения HTTP_PROXY, HTTPS_PROXY, NO_PROXY (как у curl / многих CLI).
 *
 * Пример для Fiddler (macOS, часто порт 8888):
 *   HTTPS_PROXY=http://127.0.0.1:8888
 * Для HTTPS MITM Fiddler может понадобиться доверие к корневому сертификату Fiddler.
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

  async generateContent(prompt: string) {
    if (!this.apiKey) {
      throw new AppHttpError(
        500,
        'GEMINI_API_KEY is not configured. Set it in environment for this process.',
      );
    }

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    let response;
    try {
      response = await undiciFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(10000),
        dispatcher: this.fetchDispatcher,
      });
    } catch (err) {
      const e = err as Error & { cause?: unknown };
      const detail =
        err instanceof Error
          ? `${e.message}${
              e.cause !== undefined
                ? ` | cause: ${
                    e.cause instanceof Error ? e.cause.message : String(e.cause)
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
    if (!response.ok) {
      const errRaw = await response.text().catch(() => '');
      let logPayload = errRaw.slice(0, 3000);
      try {
        const parsed = JSON.parse(errRaw) as Record<string, unknown>;
        logPayload = JSON.stringify(sanitizeForLog(parsed));
      } catch {
        /** not JSON — keep truncated text */
      }
      this.logger.warn(
        `Gemini upstream HTTP ${response.status} ${response.statusText || '(no status text)'}: ${logPayload}`,
      );

      const status =
        response.status >= 400 && response.status < 600 ? response.status : 502;

      throw new AppHttpError(
        status,
        response.status === 429 || response.status === 503
          ? 'The generation service is temporarily overloaded. Please try again later.'
          : status === 400 || status === 404
            ? 'The generation service rejected the request.'
            : status === 401 || status === 403
              ? 'Generation service authentication failed.'
              : 'The generation service request failed.',
      );
    }
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new AppHttpError(
        502,
        'The generation service returned an invalid response.',
      );
    }
    return { text };
  }
}
