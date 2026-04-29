type TranslatePromptInput = {
  content: string;
  targetLanguage: string;
};
export function translatePrompt(input: TranslatePromptInput): string {
  const { content, targetLanguage } = input;
  return `Translate the following content to ${targetLanguage}: ${content}`;
}
