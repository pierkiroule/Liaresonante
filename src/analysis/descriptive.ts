import type { Message } from '../types';
const stopWords = new Set(
  'alors après aussi autre avec avoir avant beaucoup bien cela celle cette ceux chez comme comment dans depuis donc elle elles encore entre est être fait faire fois ici jamais leur leurs mais même mes moi mon notre nous parce pas pendant peut plus pour pourquoi quand quelque qui quoi rien sans ses son sont sous suis sur tes toi ton toujours toute toutes tout trop une vers vous vais veut les des aux un du de la le et en au ce ça ne se si il on où que qu je tu'.split(
    ' ',
  ),
);
export function wordsOf(text: string): string[] {
  return (text.toLocaleLowerCase('fr').match(/[\p{L}][\p{L}-]{2,}/gu) ?? []).filter(
    (w) => !stopWords.has(w),
  );
}
export type Recurrence = { word: string; count: number; sourceIds: string[] };
export function recurrences(messages: Message[]): Recurrence[] {
  const byWord = new Map<string, Recurrence>();
  for (const message of messages.filter((m) => m.role === 'user')) {
    for (const word of wordsOf(message.content)) {
      const item = byWord.get(word) ?? { word, count: 0, sourceIds: [] };
      item.count++;
      if (!item.sourceIds.includes(message.id)) item.sourceIds.push(message.id);
      byWord.set(word, item);
    }
  }
  return [...byWord.values()]
    .filter((w) => w.sourceIds.length > 1)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'fr'))
    .slice(0, 16);
}
export function associationTrail(
  messages: Message[],
): { from: Message; to: Message; shared: string[]; introduced: string[] }[] {
  const patient = messages.filter((m) => m.role === 'user');
  return patient.slice(1).map((to, index) => {
    const from = patient[index];
    const before = new Set(wordsOf(from.content)),
      after = new Set(wordsOf(to.content));
    return {
      from,
      to,
      shared: [...after].filter((w) => before.has(w)),
      introduced: [...after].filter((w) => !before.has(w)).slice(0, 6),
    };
  });
}
export function exactCitation(messages: Message[], id: string): string | undefined {
  return messages.find((m) => m.id === id && m.role === 'user')?.content;
}
