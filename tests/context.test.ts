import { describe, expect, it } from 'vitest';
import { fitConversation } from '../src/engine/context';
import { patientPrompt, selectGesture, localSkills } from '../src/skills/orchestrator';
import { fictionalSession } from '../src/fixtures';
import type { Gesture } from '../src/types';
describe('instructions et contexte local', () => {
  it('charge les sept fichiers Markdown réellement présents', () => {
    for (const name of [
      'resonance',
      'projection',
      'metaphores',
      'associations',
      'suspension',
      'synthese',
      'securite',
    ] as const)
      expect(localSkills.read(name).length).toBeGreaterThan(80);
  });
  it('conserve le cadre prioritaire pour chacun des cinq gestes', () => {
    for (const gesture of [
      'resonance',
      'projection',
      'metaphores',
      'associations',
      'suspension',
    ] as Gesture[])
      expect(patientPrompt(gesture)).toContain('Cadre prioritaire');
  });
  it('permet un message français de 900 caractères sans dépasser le budget', () => {
    const m = fictionalSession().messages[0];
    for (const gesture of [
      'resonance',
      'projection',
      'metaphores',
      'associations',
      'suspension',
    ] as Gesture[])
      expect(
        fitConversation(patientPrompt(gesture), [
          { ...m, content: 'Une image résonne. '.repeat(45).slice(0, 900) },
        ]).messages,
      ).toHaveLength(2);
  });
  it('écarte les anciens tours du modèle, en conservant la source originale', () => {
    const source = fictionalSession().messages;
    const original = structuredClone(source);
    const long = Array.from({ length: 20 }, () => source)
      .flat()
      .slice(0, -1);
    long.push(source[0]);
    const result = fitConversation(patientPrompt('resonance'), long);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.messages.at(-1)?.role).toBe('user');
    expect(source).toEqual(original);
  });
  it('rassemble deux tours utilisateur après une interruption', () => {
    const message = fictionalSession().messages[0];
    const result = fitConversation(patientPrompt('resonance'), [
      message,
      { ...message, id: 'next' },
    ]);
    expect(result.messages).toHaveLength(2);
  });
  it('refuse les messages hors contexte et accepte la suspension', () => {
    const message = fictionalSession().messages[0];
    expect(() =>
      fitConversation(patientPrompt('resonance'), [{ ...message, content: 'é'.repeat(10_000) }]),
    ).toThrow('contexte');
    expect(selectGesture([{ ...message, content: 'je ne sais pas' }])).toBe('suspension');
  });
});
