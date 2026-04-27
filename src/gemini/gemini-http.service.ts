import { Injectable } from '@nestjs/common';
import { AppHttpError } from 'src/common/errors/app-http.error';

@Injectable()
export class GeminiHttpService {
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL ||
    'https://generativelanguage.googleapis.com';
  private readonly model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  private readonly apiKey = process.env.GEMINI_API_KEY;
  constructor() {}

  async generateContent(prompt: string) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new AppHttpError(
        response.status,
        `Gemini API error: ${response.statusText}`,
      );
    }
    const data = await response.json();
    return { text: data.candidates[0].content.parts[0].text };
  }
}
