import { describe, expect, it } from 'vitest';
import { chunkPatientMessages, serializeSources, validateSummary } from '../src/analysis/summary';
import { summaryPrompt } from '../src/skills/orchestrator';
import { fictionalSession } from '../src/fixtures';
import { byteLength, CONTEXT_WINDOW } from '../src/engine/context';
describe('synthèse sourcée', () => {
  const messages = fictionalSession().messages;
  it('accepte un constat descriptif relié à une parole patient', () => {
    const raw = JSON.stringify({
      observations: [{ text: 'Le patient évoque une porte bleue.', sourceIds: [messages[0].id] }],
      exploration: [],
    });
    expect(validateSummary(raw, messages).observations).toHaveLength(1);
  });
  it('refuse une citation de la machine attribuée au patient', () => {
    expect(() =>
      validateSummary(
        JSON.stringify({
          observations: [{ text: 'Une porte est mentionnée.', sourceIds: [messages[1].id] }],
          exploration: [],
        }),
        messages,
      ),
    ).toThrow('source absente');
  });
  it('refuse diagnostic, citation inventée et hypothèse affirmative', () => {
    for (const text of [
      'Le patient a une personnalité évitante.',
      'Le patient dit « je suis seul ».',
      'La porte symbolise un traumatisme.',
    ]) {
      expect(() =>
        validateSummary(
          JSON.stringify({
            observations: [{ text, sourceIds: [messages[0].id] }],
            exploration: [],
          }),
          messages,
        ),
      ).toThrow();
    }
    expect(() =>
      validateSummary(
        JSON.stringify({
          observations: [],
          exploration: [{ text: 'Il aurait peur de son père.', sourceIds: [messages[0].id] }],
        }),
        messages,
      ),
    ).toThrow('questions');
  });
  it('couvre toutes les paroles, y compris une longue parole en plusieurs fragments', () => {
    const long = {
      ...messages[0],
      id: 'long-fiction',
      content: 'Une porte très colorée 🌱. '.repeat(150),
    };
    const all = [long, ...messages.slice(2)];
    const chunks = chunkPatientMessages(all);
    expect(chunks.length).toBeGreaterThan(1);
    for (const original of all.filter((m) => m.role === 'user'))
      expect(
        chunks
          .flat()
          .filter((m) => m.id === original.id)
          .map((m) => m.content)
          .join(''),
      ).toBe(original.content);
    for (const chunk of chunks)
      expect(
        byteLength(summaryPrompt()) + byteLength(serializeSources(chunk)) + 640 + 384 + 32,
      ).toBeLessThanOrEqual(CONTEXT_WINDOW);
    expect(chunks.flat().every((m) => m.role === 'user')).toBe(true);
  });
  it('refuse un résultat incomplet au lieu de fabriquer une synthèse', () => {
    expect(() => validateSummary('{"observations":[', messages)).toThrow();
  });
});
