import { describe, expect, it } from 'vitest';
import { needsHumanPause } from '../src/security/distress';
import { artifactRequestAllowed } from '../src/security/networkPolicy';
describe('pause humaine sur exemples fictifs', () => {
  it.each([
    'Je veux me tuer.',
    'Je pense à mourir.',
    'J’ai envie de me faire du mal.',
    'Je veux en finir.',
    'Il me menace de mort.',
  ])('suspend la génération pour : %s', (text) => expect(needsHumanPause(text)).toBe(true));
  it('ne classe pas une image ordinaire comme une urgence', () =>
    expect(needsHumanPause('Je vois une porte bleue dans un jardin.')).toBe(false));
});
describe('sorties réseau limitées aux téléchargements', () => {
  const url = 'https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC/resolve/main/tokenizer.json';
  it('autorise le GET public pendant le chargement uniquement', () => {
    expect(artifactRequestAllowed(url, undefined, true, false)).toBe(true);
    expect(artifactRequestAllowed(url, undefined, false, false)).toBe(false);
    expect(artifactRequestAllowed(url, undefined, true, true)).toBe(false);
  });
  it('refuse les envois de corps, les API et les domaines arbitraires', () => {
    expect(
      artifactRequestAllowed(url, { method: 'POST', body: 'message fictif' }, true, false),
    ).toBe(false);
    expect(artifactRequestAllowed('https://api.example.org/chat', undefined, true, false)).toBe(
      false,
    );
    expect(artifactRequestAllowed('https://huggingface.co/autre/a', undefined, true, false)).toBe(
      false,
    );
  });
});
