import { describe, expect, it } from 'vitest';
import { recurrences, exactCitation, associationTrail } from '../src/analysis/descriptive';
import { fictionalSession } from '../src/fixtures';
describe('relecture descriptive sur un dialogue fictif', () => {
  it('compte les mots du patient, sans attribuer les relances IA', () => {
    const messages = fictionalSession().messages;
    messages.push({
      id: 'machine-only',
      role: 'assistant',
      content: 'Montagne montagne montagne.',
      createdAt: '',
      status: 'complete',
    });
    const result = recurrences(messages);
    expect(result.find((w) => w.word === 'porte')?.count).toBe(2);
    expect(result.find((w) => w.word === 'montagne')).toBeUndefined();
    expect(
      result.every((w) =>
        w.sourceIds.every((id) => messages.find((m) => m.id === id)?.role === 'user'),
      ),
    ).toBe(true);
  });
  it('restitue les citations sans modifier ponctuation ni accents', () => {
    const messages = fictionalSession().messages;
    expect(exactCitation(messages, messages[0].id)).toBe(messages[0].content);
    expect(exactCitation(messages, messages[1].id)).toBeUndefined();
  });
  it('garde les enchaînements chronologiques des seules paroles patient', () => {
    const steps = associationTrail(fictionalSession().messages);
    expect(steps).toHaveLength(3);
    expect(steps[0].shared).toContain('porte');
    expect(steps[0].introduced).toContain('jardin');
    expect(steps[2].to.content).toContain('envie d’avancer');
  });
});
