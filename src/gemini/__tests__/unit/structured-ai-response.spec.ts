import { describe, expect, it } from 'vitest';
import {
  normalizeAnalyzeResponse,
  normalizeAnalyzeResponseWithDiagnostics,
  normalizeTranslateResponse,
  normalizeTranslateResponseWithDiagnostics,
  parseTranslateFromCache,
  serializeTranslateForCache,
} from '../../structured-ai-response';

describe('structured-ai-response', () => {
  describe('normalizeAnalyzeResponse', () => {
    it('accepts strictly valid payloads', () => {
      expect(
        normalizeAnalyzeResponse(
          JSON.stringify({
            analysis: 'ok',
            suggestions: ['one'],
            severity: 'info',
          }),
        ),
      ).toEqual({
        analysis: 'ok',
        suggestions: ['one'],
        severity: 'info',
      });
    });

    it('falls back safely on invalid JSON with warning severity', () => {
      const r = normalizeAnalyzeResponse('```\nNOT JSON ```');
      expect(r.severity).toBe('warning');
      expect(r.suggestions).toEqual([]);
      expect(r.analysis).toContain('Structured analysis schema');
    });

    it('coerces missing severity and filters bad suggestion types', () => {
      expect(
        normalizeAnalyzeResponse(
          JSON.stringify({
            analysis: 'x',
            suggestions: ['a', null, 'b', 3],
            severity: 'alien',
          }),
        ),
      ).toMatchObject({
        analysis: 'x',
        suggestions: ['a', 'b'],
        severity: 'warning',
      });
    });

    it('falls back when analysis is missing after parse', () => {
      expect(
        normalizeAnalyzeResponse(
          JSON.stringify({ suggestions: ['nope'], severity: 'error' }),
        ).analysis,
      ).toContain('Structured analysis schema');
    });
  });

  describe('normalizeTranslateResponse', () => {
    it('parses canonical JSON shape', () => {
      expect(
        normalizeTranslateResponse(
          '{"translatedText":"hola","detectedLanguage":"en"}',
        ),
      ).toEqual({ translatedText: 'hola', detectedLanguage: 'en' });
    });

    it('treats non-JSON as plain translation with language hint fallback', () => {
      expect(
        normalizeTranslateResponse(
          `Просто текст без JSOn`,
          'ru-RU',
        ).translatedText,
      ).toMatch(/просто текст/i);
      expect(
        normalizeTranslateResponse('Привет.', 'KK').detectedLanguage,
      ).toBe('kk');
    });

    it('fills detectedLanguage from hint when omitted in JSON', () => {
      expect(
        normalizeTranslateResponse(
          '{"translatedText":"hi"}',
          'de',
        ).detectedLanguage,
      ).toBe('de');
    });

    it('reports diagnostics flags for analyze', () => {
      expect(
        normalizeAnalyzeResponseWithDiagnostics('{{{').usedStructuredFallback,
      ).toBe(true);
      expect(
        normalizeAnalyzeResponseWithDiagnostics(
          JSON.stringify({
            analysis: 'ok',
            suggestions: [],
            severity: 'error',
          }),
        ).usedStructuredFallback,
      ).toBe(false);
    });

    it('reports inferred-language path as structured fallback', () => {
      const r = normalizeTranslateResponseWithDiagnostics(
        '{"translatedText":"hi"}',
        'de',
      );
      expect(r.usedStructuredFallback).toBe(true);
      expect(r.payload.detectedLanguage).toBe('de');
    });

    it('reports JSON success without fallback when lang present', () => {
      expect(
        normalizeTranslateResponseWithDiagnostics(
          '{"translatedText":"x","detectedLanguage":"fi"}',
        ).usedStructuredFallback,
      ).toBe(false);
    });

    it('stores and reads cache blob', () => {
      const t = serializeTranslateForCache({
        translatedText: 'abc',
        detectedLanguage: 'fr',
      });
      expect(parseTranslateFromCache(t)).toEqual({
        translatedText: 'abc',
        detectedLanguage: 'fr',
      });
    });
  });
});
