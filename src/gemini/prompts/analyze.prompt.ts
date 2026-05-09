import { AnalyzeArticleTask } from '../gemini.types';

type AnalyzePromptInput = {
  content: string;
  task: AnalyzeArticleTask;
};
const TASK_INSTRUCTIONS: Record<AnalyzeArticleTask, string> = {
  [AnalyzeArticleTask.REVIEW]:
    'Review the content and provide a summary of the main points.',
  [AnalyzeArticleTask.BUGS]:
    'Find the bugs in the content and provide a list of the bugs.',
  [AnalyzeArticleTask.OPTIMIZE]:
    'Optimize the content and provide a list of the optimizations.',
  [AnalyzeArticleTask.EXPLAIN]:
    'Explain the content and provide a list of the explanations.',
};

export function analyzePrompt(input: AnalyzePromptInput): string {
  const { content, task } = input;
  const taskInstruction = TASK_INSTRUCTIONS[task];
  return [
    'You are a content analyzer for an internal knowledge base.',
    '',
    'Requirements:',
    '- Use the same primary language as the article.',
    '- Only use information from the article. Do not invent facts.',
    '- Only return a JSON object, no markdown, no commentary.',
    '',
    'JSON shape (types are strict):',
    '{',
    '  "analysis": string,',
    '  "suggestions": string[],  // short actionable items; empty array allowed',
    '  "severity": "info" | "warning" | "error"',
    '}',
    '',
    'Guidance for severity:',
    '- "info": minor improvements or neutral review;',
    '- "warning": issues that should be fixed but are not blocking;',
    '- "error": factual/logic/safety problems that make the content misleading or unusable.',
    '',
    'Task:',
    taskInstruction,
    '',
    'Article:',
    content,
  ].join('\n');
}
