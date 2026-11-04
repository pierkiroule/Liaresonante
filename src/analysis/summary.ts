import type { Message, Observation, Summary } from '../types';
import { summaryPrompt } from '../skills/orchestrator';
import { byteLength, CONTEXT_WINDOW } from '../engine/context';
import type { LocalEngine } from '../engine/localEngine';

const OUTPUT_TOKENS = 640;
const shape = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    ['observations', 'exploration'].map((key) => [
      key,
      {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            sourceIds: { type: 'array', minItems: 1, items: { type: 'string' } },
          },
          required: ['text', 'sourceIds'],
        },
      },
    ]),
  ),
  required: ['observations', 'exploration'],
};
const prohibited =
  /diagnostic|trouble (?:de|du|anxieux)|souffre d|personnalité|patholog|dépressi[fv]|psychos|psychoti|schizophr|bipol|traumati|refoul|inconscient|symbolise|révèle|dénote|traduit un|attachement|résistan[ct]|mécanisme de défense/iu;
export function validateSummary(
  raw: string,
  source: Message[],
): { observations: Observation[]; exploration: Observation[] } {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object')
    throw new Error('La synthèse n’a pas le format attendu.');
  const object = parsed as Record<string, unknown>;
  const allowed = new Set(source.filter((m) => m.role === 'user').map((m) => m.id));
  function validateList(key: string): Observation[] {
    if (!Array.isArray(object[key])) throw new Error('La synthèse n’a pas le format attendu.');
    return (object[key] as unknown[]).map((item) => {
      if (!item || typeof item !== 'object') throw new Error('Observation invalide.');
      const row = item as Record<string, unknown>;
      if (
        typeof row.text !== 'string' ||
        !row.text.trim() ||
        row.text.length > 650 ||
        !Array.isArray(row.sourceIds) ||
        !row.sourceIds.length
      )
        throw new Error('Observation non sourcée ou trop longue.');
      if (!row.sourceIds.every((id) => typeof id === 'string' && allowed.has(id)))
        throw new Error('La synthèse contient une source absente du discours du patient.');
      // Generated quotations are never trusted. Exact citations are reconstructed separately.
      if (/[«»“”"]/u.test(row.text) || prohibited.test(row.text))
        throw new Error(
          'La synthèse a été refusée : formulation interprétative ou citation générée. Relancez-la.',
        );
      if (key === 'exploration' && !row.text.trim().endsWith('?'))
        throw new Error('Les pistes doivent rester des questions à explorer.');
      return { text: row.text.trim(), sourceIds: [...new Set(row.sourceIds as string[])] };
    });
  }
  return { observations: validateList('observations'), exploration: validateList('exploration') };
}

/** Split all patient text, never silently truncate a session or send assistant text for attribution. */
export function chunkPatientMessages(messages: Message[], system = summaryPrompt()): Message[][] {
  const budget = CONTEXT_WINDOW - OUTPUT_TOKENS - 384 - byteLength(system);
  if (budget < 200)
    throw new Error('Les instructions de synthèse sont trop longues pour le contexte du modèle.');
  const chunks: Message[][] = [];
  let current: Message[] = [];
  const cost = (part: Message[]) => byteLength(serializeSources(part)) + 32;
  for (const message of messages.filter((m) => m.role === 'user' && m.content)) {
    // Unicode code points preserve accented text and emoji when segmenting.
    let segment = '';
    for (const char of message.content) {
      const test = [...current, { ...message, content: segment + char }];
      if (cost(test) > budget) {
        if (segment) {
          current.push({ ...message, content: segment });
          segment = '';
        }
        if (current.length) {
          chunks.push(current);
          current = [];
        }
        if (cost([{ ...message, content: char }]) > budget)
          throw new Error('Un identifiant de source dépasse le contexte disponible.');
      }
      segment += char;
    }
    if (segment) current.push({ ...message, content: segment });
  }
  if (current.length) chunks.push(current);
  return chunks;
}
export function serializeSources(messages: Message[]): string {
  return JSON.stringify(messages.map((m) => ({ id: m.id, texte: m.content })));
}
export async function generateSummary(
  engine: LocalEngine,
  messages: Message[],
  onProgress: (done: number, total: number) => void,
): Promise<Summary> {
  const modelId = engine.snapshot().modelId;
  if (engine.snapshot().status !== 'ready' || !modelId)
    throw new Error('Chargez le modèle pour demander une synthèse locale.');
  const system = summaryPrompt();
  const chunks = chunkPatientMessages(messages, system);
  if (!chunks.length) throw new Error('La séance ne contient pas encore de paroles du patient.');
  const start = performance.now();
  const observations: Observation[] = [],
    exploration: Observation[] = [];
  for (const [index, chunk] of chunks.entries()) {
    onProgress(index, chunks.length);
    const result = await engine.generate(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: serializeSources(chunk) },
        ],
        max_tokens: OUTPUT_TOKENS,
        temperature: 0.2,
        top_p: 0.85,
        response_format: { type: 'json_object', schema: JSON.stringify(shape) },
      },
      () => undefined,
    );
    if (result.finishReason === 'length')
      throw new Error(
        'La synthèse a atteint sa limite de longueur. Aucun résultat partiel n’a été enregistré.',
      );
    const checked = validateSummary(result.text, chunk);
    observations.push(...checked.observations);
    exploration.push(...checked.exploration);
    onProgress(index + 1, chunks.length);
  }
  const unique = (items: Observation[]) =>
    items.filter((item, index) => items.findIndex((other) => other.text === item.text) === index);
  return {
    createdAt: new Date().toISOString(),
    modelId,
    observations: unique(observations),
    exploration: unique(exploration),
    analyzedMessages: messages.filter((m) => m.role === 'user').length,
    chunks: chunks.length,
    durationMs: performance.now() - start,
    reviewed: false,
  };
}
