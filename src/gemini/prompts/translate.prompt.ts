type TranslatePromptInput = {
  title: string;
  content: string;
  targetLanguage: string;
  sourceLanguage?: string;
};
export function translatePrompt(input: TranslatePromptInput): string {
  const { title, content, targetLanguage, sourceLanguage } = input;
  return [
    'You are a translator for an internal knowledge base.',
    '',
    `Translate the article into ${targetLanguage} (target locale/code).`,
    `Source language hint: ${sourceLanguage}. If source language is not specified, use ISO 639-1 language code.`,
    'Return a single JSON object only, no markdown, no commentary:',
    '{"translatedText": string, "detectedLanguage": string}',
    '`detectedLanguage` must be an ISO 639-1 language code for the ORIGINAL article (e.g. en, ru).',
    '',
    `Title:\n${title}`,
    '',
    `Body:\n${content}`,
  ].join('\n');
}
