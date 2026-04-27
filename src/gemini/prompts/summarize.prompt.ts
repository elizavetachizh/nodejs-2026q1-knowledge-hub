import { SummarizeArticleMaxLength } from '../gemini.types';

const LENGTH_INSTRUCTIONS: Record<SummarizeArticleMaxLength, string> = {
  [SummarizeArticleMaxLength.SHORT]:
    'SHORT means roughly 1–2 sentences or about 40–80 words. Stay in this band.',
  [SummarizeArticleMaxLength.MEDIUM]:
    'MEDIUM means roughly 3–6 sentences or about 100–180 words. Stay in this band.',
  [SummarizeArticleMaxLength.DETAILED]:
    'DETAILED means roughly 200–400 words, preserving key terms and numbers; you may use short paragraphs, still no markdown unless the article already forces it.',
};

type SummarizePromptInput = {
  title: string;
  content: string;
  maxLength: SummarizeArticleMaxLength;
};

export function summarizePrompt(input: SummarizePromptInput): string {
  const { title, content, maxLength } = input;
  const lengthBlock = LENGTH_INSTRUCTIONS[maxLength];

  return [
    'You are a summarizer for an internal knowledge base.',
    '',
    'Requirements:',
    '- Use the same primary language as the article.',
    '- Only use information from the article. Do not invent facts.',
    '- Output plain text only: no title line, no "Summary:" prefix, no markdown code fences.',
    '',
    'Length target for this request (strict for this run):',
    lengthBlock,
    '',
    'Return ONLY the summary after reading the content below.',
    '',
    '---',
    `Title: ${title}`,
    '',
    'Article:',
    content,
  ].join('\n');
}