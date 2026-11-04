import { prebuiltAppConfig, type AppConfig, type ModelRecord } from '@mlc-ai/web-llm';

export type LocalModel = {
  id: string;
  name: string;
  subtitle: string;
  downloadMB: number;
  f16: boolean;
  record: ModelRecord;
};
const choices = [
  ['Qwen3-0.6B-q4f16_1-MLC', 'Qwen3 · 0,6 B', 'Point de départ · multilingue', 450, true],
  ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3 · 1,7 B', 'Plus ample · mémoire accrue', 1150, true],
  [
    'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    'Qwen2.5 · 0,5 B',
    'Le plus léger · instructions directes',
    400,
    true,
  ],
  [
    'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
    'Qwen2.5 · 0,5 B · f32',
    'Alternative sans shader-f16',
    500,
    false,
  ],
] as const;
export const models: LocalModel[] = choices.map(([id, name, subtitle, downloadMB, f16]) => {
  const record = prebuiltAppConfig.model_list.find((m) => m.model_id === id);
  if (!record) throw new Error(`Modèle absent du catalogue WebLLM : ${id}`);
  return { id, name, subtitle, downloadMB, f16, record };
});
export const DEFAULT_MODEL = models[0].id;
// Both worker and UI must use exactly the same cache backend and model records.
export const appConfig: AppConfig = {
  cacheBackend: 'cache',
  model_list: models.map((m) => m.record),
};
export const modelById = (id: string) => models.find((m) => m.id === id);
export function modelRoot(record: ModelRecord): string {
  const root = record.model.replace(/\/$/u, '') + '/';
  return /\/resolve\/.+\//u.test(root) ? root : root + 'resolve/main/';
}
