type GenericGenerateInput = {
  prompt: string;
  context?: string;
};

export function genericGeneratePrompt(input: GenericGenerateInput): string {
  const { prompt, context } = input;
  const lines = [
    'You are a helpful assistant for internal technical documentation.',
    'Answer clearly and accurately. Stay within reasonable length.',
    '',
  ];
  if (context?.trim()) {
    lines.push(
      'Optional background context:',
      context.trim(),
      '',
      'User request:',
    );
  }
  lines.push(prompt.trim());
  return lines.join('\n');
}
