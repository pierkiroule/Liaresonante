/// <reference lib="webworker" />
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
import { artifactRequestAllowed } from '../security/networkPolicy';

// Egress guard: only GETs for public model artifacts while explicitly loading.
// During inference both fetch and Cache.add network misses are denied.
let downloadsAllowed = true;
let strictOffline = false;
function permitted(input: RequestInfo | URL, init?: RequestInit): boolean {
  return artifactRequestAllowed(input, init, downloadsAllowed, strictOffline);
}
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (!permitted(input, init))
    return Promise.reject(new Error('Network blocked by ÉCHO local-only policy'));
  return originalFetch(input, init);
}) as typeof fetch;
const originalAdd = Cache.prototype.add;
Cache.prototype.add = function (request: RequestInfo | URL) {
  if (!permitted(request)) return Promise.reject(new Error('Network blocked: offline cache miss'));
  return originalAdd.call(this, request);
};
const originalAddAll = Cache.prototype.addAll;
Cache.prototype.addAll = function (requests: RequestInfo[]) {
  if (!requests.every((request) => permitted(request)))
    return Promise.reject(new Error('Network blocked by ÉCHO local-only policy'));
  return originalAddAll.call(this, requests);
};
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event: MessageEvent) => {
  if (event.data?.kind === 'echo-network-policy') {
    strictOffline = event.data.strictOffline === true;
    return;
  }
  if (event.data?.kind === 'reload') downloadsAllowed = true;
  if (['chatCompletionNonStreaming', 'chatCompletionStreamInit'].includes(event.data?.kind))
    downloadsAllowed = false;
  handler.onmessage(event);
};
