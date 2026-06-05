import { RerankInputChunk } from '../rag.types';

export function ragRerankPrompt(
  query: string,
  chunks: RerankInputChunk[],
): string {
  const lines = chunks
    .map(
      (c, i) =>
        `#${i + 1}\nid: ${c.id}\narticleTitle: ${c.articleTitle}\nchunkText: ${c.chunkText}\nbaseScore: ${c.baseScore}`,
    )
    .join('\n\n');

  return [
    'You are a retrieval reranker.',
    'Given the user query and candidate chunks, return only JSON.',
    'Task: score each chunk relevance to the query from 0.0 to 1.0.',
    'Do not invent ids; use ids exactly as provided.',
    'Output schema:',
    '{"items":[{"id":"string","relevance":0.0}]}',
    '',
    'Query:',
    query,
    '',
    'Candidates:',
    lines,
  ].join('\n');
}
