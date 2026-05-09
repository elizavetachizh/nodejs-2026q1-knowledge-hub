type HybridCandidate = {
  id: string;
  semanticScore: number; // Qdrant score
  chunkText: string;
  payload: Record<string, unknown>;
};

type HybridRanked = HybridCandidate & {
  lexicalScore: number;
  semanticNorm: number;
  lexicalNorm: number;
  finalScore: number;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function minMaxNormalize(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

function computeIdf(
  queryTerms: string[],
  docs: string[][],
): Map<string, number> {
  const N = docs.length;
  const idf = new Map<string, number>();
  for (const term of queryTerms) {
    let df = 0;
    for (const d of docs) {
      if (d.includes(term)) df++;
    }
    // BM25 IDF
    const val = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    idf.set(term, val);
  }
  return idf;
}

function bm25ScoreDoc(
  queryTerms: string[],
  docTokens: string[],
  idf: Map<string, number>,
  avgdl: number,
  k1 = 1.2,
  b = 0.75,
): number {
  const tf = termFreq(docTokens);
  const dl = docTokens.length || 1;

  let score = 0;
  for (const t of queryTerms) {
    const f = tf.get(t) ?? 0;
    if (!f) continue;
    const termIdf = idf.get(t) ?? 0;
    const denom = f + k1 * (1 - b + b * (dl / avgdl));
    score += termIdf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

export function hybridRank(
  query: string,
  candidates: HybridCandidate[],
  wSemantic = 0.75,
  wLexical = 0.25,
  bm25k1 = 1.2,
  bm25b = 0.75,
): HybridRanked[] {
  if (!candidates.length) return [];

  const queryTerms = [...new Set(tokenize(query))];
  const docs = candidates.map((c) => tokenize(c.chunkText));
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;
  const idf = computeIdf(queryTerms, docs);

  const lexicalRaw = docs.map((d) =>
    bm25ScoreDoc(queryTerms, d, idf, avgdl, bm25k1, bm25b),
  );
  const semanticRaw = candidates.map((c) => c.semanticScore);

  const lexicalNorm = minMaxNormalize(lexicalRaw);
  const semanticNorm = minMaxNormalize(semanticRaw);

  return candidates
    .map((c, i) => {
      const finalScore =
        wSemantic * semanticNorm[i] + wLexical * lexicalNorm[i];
      return {
        ...c,
        lexicalScore: lexicalRaw[i],
        semanticNorm: semanticNorm[i],
        lexicalNorm: lexicalNorm[i],
        finalScore,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
