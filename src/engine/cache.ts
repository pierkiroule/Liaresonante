import { hasModelInCache } from '@mlc-ai/web-llm';
import { appConfig, modelById, modelRoot } from './models';
export type CacheAudit = { complete: boolean; missing: string[] };
/** Check weights, config, tokenizer AND WASM; hasModelInCache alone only checks weights. No fetch. */
export async function auditModelCache(id: string): Promise<CacheAudit> {
  const model = modelById(id);
  if (!model || !('caches' in globalThis))
    return { complete: false, missing: ['Cache navigateur'] };
  const missing: string[] = [];
  const root = modelRoot(model.record);
  const [weights, configCache, modelCache, wasmCache] = await Promise.all([
    hasModelInCache(id, appConfig),
    caches.open('webllm/config'),
    caches.open('webllm/model'),
    caches.open('webllm/wasm'),
  ]);
  if (!weights) missing.push('Poids');
  if (!(await wasmCache.match(model.record.model_lib))) missing.push('Bibliothèque WASM');
  const config = await configCache.match(new URL('mlc-chat-config.json', root).href);
  if (!config) missing.push('Configuration', 'Tokenizer');
  else {
    const data = (await config.json()) as { tokenizer_files?: string[] };
    const file = data.tokenizer_files?.includes('tokenizer.json')
      ? 'tokenizer.json'
      : 'tokenizer.model';
    if (!(await modelCache.match(new URL(file, root).href))) missing.push('Tokenizer');
  }
  return { complete: missing.length === 0, missing };
}
export async function eraseModel(id: string): Promise<void> {
  const model = modelById(id);
  if (!model || !('caches' in globalThis)) return;
  const root = modelRoot(model.record);
  // Delete by local key, including incomplete downloads; do not fetch a missing manifest to erase it.
  for (const scope of ['webllm/model', 'webllm/config', 'webllm/wasm']) {
    const cache = await caches.open(scope);
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((request) => request.url.startsWith(root) || request.url === model.record.model_lib)
        .map((request) => cache.delete(request)),
    );
  }
}
