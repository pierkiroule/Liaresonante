import { describe, expect, it } from 'vitest';
import { sessionToMarkdown } from '../src/storage/export';
import { fictionalSession } from '../src/fixtures';
describe('export sur séance fictive', () => {
  it('conserve chaque parole exacte et explicite le caractère confidentiel en clair', () => {
    const session = fictionalSession();
    const text = sessionToMarkdown(session);
    expect(text).toContain('Export confidentiel en clair');
    expect(text).toContain('Séance fictive');
    for (const message of session.messages) expect(text).toContain(message.content);
  });
  it('n’ajoute aux observations que des citations réellement patient', () => {
    const session = fictionalSession();
    session.summary = {
      createdAt: '',
      modelId: 'unit-test-only',
      durationMs: 0,
      chunks: 1,
      analyzedMessages: 4,
      reviewed: false,
      exploration: [],
      observations: [
        {
          text: 'Exemple de constat fictif.',
          sourceIds: [session.messages[0].id, session.messages[1].id],
        },
      ],
    };
    const summarySection = sessionToMarkdown(session).split('## Synthèse descriptive générée')[1];
    expect(summarySection).toContain(session.messages[0].content);
    expect(summarySection).not.toContain(session.messages[1].content);
  });
});
