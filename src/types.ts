export type Gesture = 'resonance' | 'projection' | 'metaphores' | 'associations' | 'suspension';
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status: 'complete' | 'interrupted' | 'error';
  gesture?: Gesture;
  modelId?: string;
  durationMs?: number;
  firstTokenMs?: number;
  finishReason?: string;
};
export type Observation = { text: string; sourceIds: string[] };
export type Summary = {
  createdAt: string;
  modelId: string;
  observations: Observation[];
  exploration: Observation[];
  analyzedMessages: number;
  chunks: number;
  durationMs: number;
  reviewed: boolean;
};
export type Session = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  consentAt: string;
  consentVersion: '1';
  fictional: boolean;
  paused: boolean;
  pauseReason?: 'distress' | 'human-request';
  messages: Message[];
  summary?: Summary;
};
export type VaultData = { schema: 1; sessions: Session[]; activeSessionId?: string };
export type EngineState = {
  status: 'idle' | 'loading' | 'ready' | 'generating' | 'error';
  modelId?: string;
  progress: number;
  progressText: string;
  error?: string;
};
export const emptyVault = (): VaultData => ({ schema: 1, sessions: [] });
export function newSession(fictional = false): Session {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Séance sans titre',
    createdAt: now,
    updatedAt: now,
    consentAt: now,
    consentVersion: '1',
    fictional,
    paused: false,
    messages: [],
  };
}
