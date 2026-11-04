import { WebWorkerMLCEngine, type ChatCompletionRequestStreaming } from '@mlc-ai/web-llm';
import type { EngineState } from '../types';
import { appConfig, modelById } from './models';
import { detectCapabilities, friendlyEngineError } from './capabilities';
import { auditModelCache } from './cache';
import { CONTEXT_WINDOW } from './context';

export type GeneratedText = {
  text: string;
  durationMs: number;
  firstTokenMs?: number;
  finishReason?: string;
};
export class LocalEngine {
  private worker?: Worker;
  private engine?: WebWorkerMLCEngine;
  private controller?: AbortController;
  private state: EngineState = { status: 'idle', progress: 0, progressText: '' };
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = (): EngineState => this.state;
  private update(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private async guarded<T>(
    operation: Promise<T>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(new DOMException('Interrupted', 'AbortError'));
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => reject(new Error('Local engine timed out')), timeoutMs);
    });
    try {
      return await Promise.race([operation, interrupted]);
    } finally {
      if (timer) clearTimeout(timer);
      if (abort) signal.removeEventListener('abort', abort);
    }
  }
  async load(id: string, strictOffline = false): Promise<void> {
    if (['loading', 'generating'].includes(this.state.status))
      throw new Error('Le moteur est occupé.');
    this.release();
    const model = modelById(id);
    if (!model) throw new Error('Modèle inconnu.');
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.update({
      status: 'loading',
      modelId: id,
      progress: 0,
      progressText: 'Vérification du navigateur…',
      error: undefined,
    });
    try {
      const caps = await detectCapabilities();
      if (!caps.supported) throw new Error(caps.reason ?? 'WebGPU indisponible');
      if (model.f16 && !caps.shaderF16) throw new Error('shader-f16 not supported');
      if ((strictOffline || !navigator.onLine) && !(await auditModelCache(id)).complete)
        throw new Error('Offline cache incomplete');
      if (
        caps.storageFreeMB !== undefined &&
        caps.storageFreeMB < model.downloadMB * 1.3 &&
        !(await auditModelCache(id)).complete
      )
        throw new Error('Storage quota insufficient');
      if (signal.aborted) throw new DOMException('Interrupted', 'AbortError');
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
        name: 'echo-local-inference',
      });
      this.worker.postMessage({ kind: 'echo-network-policy', strictOffline });
      this.worker.onerror = () => {
        this.controller?.abort();
        this.release();
        this.update({
          status: 'error',
          error: 'Le Worker local s’est arrêté. Rechargez le modèle.',
        });
      };
      this.engine = new WebWorkerMLCEngine(this.worker, {
        appConfig,
        logLevel: 'SILENT',
        initProgressCallback: (report) => {
          if (!signal.aborted)
            this.update({
              progress: Math.max(0, Math.min(1, report.progress)),
              progressText: report.text,
            });
        },
      });
      await this.guarded(
        this.engine.reload(id, { context_window_size: CONTEXT_WINDOW }),
        signal,
        15 * 60_000,
      );
      this.update({
        status: 'ready',
        progress: 1,
        progressText: 'Modèle chargé sur cet appareil.',
      });
    } catch (error) {
      if (!signal.aborted) {
        this.release();
        this.update({ status: 'error', error: friendlyEngineError(error) });
      }
      if (!signal.aborted) throw error;
    }
  }
  async generate(
    request: Omit<ChatCompletionRequestStreaming, 'stream'>,
    onText: (text: string) => void,
  ): Promise<GeneratedText> {
    if (!this.engine || this.state.status !== 'ready')
      throw new Error('Chargez le modèle avant de commencer.');
    const engine = this.engine;
    const modelId = this.state.modelId!;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.update({ status: 'generating', error: undefined });
    const start = performance.now();
    try {
      const run = async (): Promise<GeneratedText> => {
        // No cross-session KV cache or crash-resumable transcript persistence.
        await engine.resetChat();
        const stream = await engine.chat.completions.create({
          ...request,
          stream: true,
          extra_body: {
            ...(modelId.startsWith('Qwen3-') ? { enable_thinking: false } : {}),
            resumable: { enabled: false },
          },
        });
        let text = '',
          firstTokenMs: number | undefined,
          finishReason: string | undefined;
        for await (const chunk of stream) {
          if (signal.aborted) throw new DOMException('Interrupted', 'AbortError');
          const delta = chunk.choices[0]?.delta.content;
          if (delta) {
            firstTokenMs ??= performance.now() - start;
            text += delta;
            onText(text);
          }
          finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
        }
        if (!text.trim()) throw new Error('Empty local generation');
        await engine.resetChat();
        return {
          text: text.trim(),
          durationMs: performance.now() - start,
          firstTokenMs,
          finishReason,
        };
      };
      const result = await this.guarded(run(), signal, 120_000);
      if (signal.aborted) throw new DOMException('Interrupted', 'AbortError');
      this.update({ status: 'ready' });
      return result;
    } catch (error) {
      if (!signal.aborted) {
        this.release();
        this.update({ status: 'error', error: friendlyEngineError(error) });
      }
      throw error;
    }
  }
  stop(): void {
    this.engine?.interruptGenerate();
    this.controller?.abort();
    // Termination is immediate, including when prefill is too busy to handle an interrupt message.
    this.release();
    this.update({
      status: 'idle',
      progress: 0,
      progressText: 'IA arrêtée. Rechargez le modèle pour reprendre.',
      error: undefined,
    });
  }
  private release(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.engine = undefined;
  }
  unload(): void {
    this.stop();
  }
}
export const localEngine = new LocalEngine();
