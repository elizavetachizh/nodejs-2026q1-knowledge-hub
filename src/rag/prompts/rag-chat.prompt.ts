import { ConversationMessage } from '../rag.types';

type RagPromptChunk = {
  articleId: string;
  articleTitle: string;
  chunkText: string;
};

type BuildRagChatPromptInput = {
  question: string;
  chunks: RagPromptChunk[];
  history: ConversationMessage[];
};

export function ragChatPrompt({
  question,
  chunks,
  history,
}: BuildRagChatPromptInput): string {
  const context = chunks
    .map(
      (chunk) =>
        `articleId: ${chunk.articleId}\narticleTitle: ${chunk.articleTitle}\nchunkText: ${chunk.chunkText}`,
    )
    .join('\n');
  const historyContext = history
    .map((message) => `role: ${message.role}\ncontent: ${message.content}`)
    .join('\n');
  return [
    'You are a helpful assistant for an internal knowledge base.',
    'Answer clearly and accurately. Stay within reasonable length.',
    '',
    'Question:',
    question,
    'Retrieved Context:',
    context,
    'History:',
    historyContext,
    'Output format:',
    '{' +
      '  "answer": string,' +
      '  "sources": Array<{articleId: string, articleTitle: string, relevantChunk: string}>,' +
      '  "conversationId": string' +
      '}' +
      'Output should be in the same language as the question.',
  ].join('\n');
}
