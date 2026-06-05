import { describe, expect, it } from 'vitest';
import { hybridRank } from '../../utils/hybrid-retrieval.util';

type Candidate = Parameters<typeof hybridRank>[1][number];

describe('hybridRank', () => {
  it('returns empty array for empty candidates', () => {
    expect(hybridRank('nestjs', [])).toEqual([]);
  });

  it('prefers lexical match when semantic scores are equal', () => {
    const candidates: Candidate[] = [
      {
        id: 'a',
        semanticScore: 0.5,
        chunkText: 'Unrelated text about databases',
        payload: {},
      },
      {
        id: 'b',
        semanticScore: 0.5,
        chunkText: 'NestJS module setup and dependency injection',
        payload: {},
      },
    ];

    const ranked = hybridRank('nestjs setup', candidates, 0.5, 0.5);
    expect(ranked[0].id).toBe('b');
    expect(ranked[0].finalScore).toBeGreaterThan(ranked[1].finalScore);
  });

  it('uses semantic ranking when lexical weight is zero', () => {
    const candidates: Candidate[] = [
      {
        id: 'low',
        semanticScore: 0.1,
        chunkText: 'nestjs nestjs',
        payload: {},
      },
      { id: 'high', semanticScore: 0.9, chunkText: 'random text', payload: {} },
    ];

    const ranked = hybridRank('nestjs', candidates, 1, 0);
    expect(ranked[0].id).toBe('high');
  });

  it('uses lexical ranking when semantic weight is zero', () => {
    const candidates: Candidate[] = [
      {
        id: 'lex-low',
        semanticScore: 0.9,
        chunkText: 'random words unrelated',
        payload: {},
      },
      {
        id: 'lex-high',
        semanticScore: 0.1,
        chunkText: 'docker compose setup for local development',
        payload: {},
      },
    ];

    const ranked = hybridRank('docker compose', candidates, 0, 1);
    expect(ranked[0].id).toBe('lex-high');
  });

  it('produces finite scores even when all semantic scores are equal', () => {
    const candidates: Candidate[] = [
      {
        id: 'one',
        semanticScore: 0.33,
        chunkText: 'qdrant vector database',
        payload: {},
      },
      {
        id: 'two',
        semanticScore: 0.33,
        chunkText: 'postgresql relational storage',
        payload: {},
      },
    ];

    const ranked = hybridRank('qdrant', candidates);
    expect(ranked).toHaveLength(2);
    for (const item of ranked) {
      expect(Number.isFinite(item.finalScore)).toBe(true);
      expect(Number.isFinite(item.lexicalScore)).toBe(true);
      expect(Number.isFinite(item.semanticNorm)).toBe(true);
      expect(Number.isFinite(item.lexicalNorm)).toBe(true);
    }
  });
});
