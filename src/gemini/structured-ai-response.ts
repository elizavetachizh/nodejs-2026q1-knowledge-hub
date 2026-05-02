import type { AnalyzePayload } from './gemini.types';

const ANALYSIS_FALLBACK_MAX = 4500;

const ANALYSIS_SEVERITIES = new Set(['info', 'warning', 'error']);

export const ANALYSIS_FALLBACK_PREFIX =
  'Structured analysis schema was not satisfied or JSON could not be parsed.';

export function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
  return (m ? m[1].trim() : t).trim();
}

function truncateForFallback(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 20))}\n…(truncated)`;
}

function analyzeSchemaFallback(rawModelText: string): AnalyzePayload {
  const excerpt = truncateForFallback(
    stripJsonFence(rawModelText).trim() || '(empty model output)',
    ANALYSIS_FALLBACK_MAX,
  );
  return {
    analysis:
      `${ANALYSIS_FALLBACK_PREFIX} The following raw model output may still be informative:\n\n` +
      excerpt,
    suggestions: [],
    severity: 'warning',
  };
}

/** Coerce + report whether unstructured fallback was packaged for the API. */
export function normalizeAnalyzeResponseWithDiagnostics(rawModelText: string): {
  payload: AnalyzePayload;
  usedStructuredFallback: boolean;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(rawModelText));
  } catch {
    return {
      payload: analyzeSchemaFallback(rawModelText),
      usedStructuredFallback: true,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      payload: analyzeSchemaFallback(rawModelText),
      usedStructuredFallback: true,
    };
  }

  const o = parsed as Record<string, unknown>;

  let analysis = '';
  if (typeof o.analysis === 'string') analysis = o.analysis.trim();
  else if (typeof o.analysis === 'number' || typeof o.analysis === 'boolean') {
    analysis = String(o.analysis).trim();
  }

  let suggestions: string[] = [];
  if (Array.isArray(o.suggestions)) {
    suggestions = o.suggestions
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  let severity: AnalyzePayload['severity'] = 'warning';
  if (typeof o.severity === 'string' && ANALYSIS_SEVERITIES.has(o.severity)) {
    severity = o.severity as AnalyzePayload['severity'];
  }

  if (!analysis) {
    return {
      payload: analyzeSchemaFallback(rawModelText),
      usedStructuredFallback: true,
    };
  }

  return {
    payload: { analysis, suggestions, severity },
    usedStructuredFallback: false,
  };
}

export function normalizeAnalyzeResponse(rawModelText: string): AnalyzePayload {
  return normalizeAnalyzeResponseWithDiagnostics(rawModelText).payload;
}

type TranslateShape = { translatedText: string; detectedLanguage: string };

function translateSchemaFallback(
  rawModelText: string,
  sourceLanguageHint?: string,
): TranslateShape {
  const text = stripJsonFence(rawModelText).trim();
  const detectedLanguage =
    typeof sourceLanguageHint === 'string' &&
    sourceLanguageHint.trim().length > 0
      ? sourceLanguageHint.trim().toLowerCase().slice(0, 24)
      : 'und';

  const translatedText =
    text.length > 0
      ? text
      : 'Translation could not be derived from model output.';
  return {
    translatedText,
    detectedLanguage,
  };
}

function readFlexibleString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return undefined;
}

/** Parse/coerce translate response; marks non-JSON or lost-field recovery paths. */
export function normalizeTranslateResponseWithDiagnostics(
  rawModelText: string,
  sourceLanguageHint?: string,
): { payload: TranslateShape; usedStructuredFallback: boolean } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(rawModelText));
  } catch {
    return {
      payload: translateSchemaFallback(rawModelText, sourceLanguageHint),
      usedStructuredFallback: true,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      payload: translateSchemaFallback(rawModelText, sourceLanguageHint),
      usedStructuredFallback: true,
    };
  }

  const o = parsed as Record<string, unknown>;
  const translatedText = readFlexibleString(o.translatedText)?.trim() ?? '';

  const hintTrimmed =
    typeof sourceLanguageHint === 'string' ? sourceLanguageHint.trim() : '';

  let detectedLang = readFlexibleString(o.detectedLanguage)?.trim();

  if (!translatedText.length) {
    return {
      payload: translateSchemaFallback(rawModelText, sourceLanguageHint),
      usedStructuredFallback: true,
    };
  }

  let inferredLanguage = false;
  if (!detectedLang?.length) {
    inferredLanguage = true;
    detectedLang = hintTrimmed.length > 0 ? hintTrimmed : 'und';
  }

  return {
    payload: {
      translatedText,
      detectedLanguage: detectedLang.toLowerCase().slice(0, 40),
    },
    usedStructuredFallback: inferredLanguage,
  };
}

export function normalizeTranslateResponse(
  rawModelText: string,
  sourceLanguageHint?: string,
): TranslateShape {
  return normalizeTranslateResponseWithDiagnostics(
    rawModelText,
    sourceLanguageHint,
  ).payload;
}

export function serializeTranslateForCache(hit: TranslateShape): string {
  return JSON.stringify({
    translatedText: hit.translatedText,
    detectedLanguage: hit.detectedLanguage,
  });
}

export function parseTranslateFromCache(blob: string): TranslateShape | null {
  try {
    const parsed = JSON.parse(blob) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    const o = parsed as Record<string, unknown>;
    const translatedText = readFlexibleString(o.translatedText)?.trim() ?? '';
    const detectedLanguage =
      readFlexibleString(o.detectedLanguage)?.trim() ?? '';
    if (!translatedText || !detectedLanguage) return null;
    return { translatedText, detectedLanguage };
  } catch {
    return null;
  }
}
