import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import type { Message } from '../types';
export const CONTEXT_WINDOW = 4096;
export const byteLength = (text: string): number => new TextEncoder().encode(text).length;
// Conservative byte budget for byte-level Qwen tokenizers, with template and output reserves.
// Whole turns only: the full transcript stays stored even if old turns leave the model context.
export function fitConversation(
  system: string,
  messages: Message[],
  outputTokens = 160,
): { messages: ChatCompletionMessageParam[]; omitted: number } {
  const limit = CONTEXT_WINDOW - outputTokens - 384;
  let used = byteLength(system) + 32;
  const chosen: Message[] = [];
  const eligible = messages.filter(
    (m) => m.content && (m.role === 'user' || m.status === 'complete'),
  );
  for (const message of [...eligible].reverse()) {
    const cost = byteLength(message.content) + 32;
    if (used + cost > limit) break;
    chosen.unshift(message);
    used += cost;
  }
  while (chosen[0]?.role === 'assistant') chosen.shift();
  if (!chosen.length || chosen.at(-1)?.role !== 'user')
    throw new Error('Le message dépasse le contexte disponible.');
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const message of chosen) {
    const previous = turns.at(-1);
    if (previous?.role === message.role) previous.content += '\n\n' + message.content;
    else turns.push({ role: message.role, content: message.content });
  }
  return {
    messages: [{ role: 'system', content: system }, ...turns],
    omitted: eligible.length - chosen.length,
  };
}
