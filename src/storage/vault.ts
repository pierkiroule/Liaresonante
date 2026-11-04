import type { VaultData } from '../types';
import { emptyVault } from '../types';
import { eraseRecord, readRecord, writeRecord } from './database';

export type EncryptedRecord = {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
};
const ITERATIONS = 600_000;
const aad = new TextEncoder().encode('ECHO-VAULT-v1');
export async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function encryptData(
  data: VaultData,
  key: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
): Promise<EncryptedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return { version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt, iv, ciphertext };
}
export async function decryptData(
  record: EncryptedRecord,
  password: string,
): Promise<{ key: CryptoKey; data: VaultData }> {
  if (record.version !== 1 || record.kdf !== 'PBKDF2-SHA256' || record.iterations !== ITERATIONS)
    throw new Error('Format de stockage non pris en charge.');
  const key = await deriveKey(password, record.salt, record.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv, additionalData: aad },
      key,
      record.ciphertext,
    );
  } catch {
    throw new Error('Phrase secrète incorrecte, ou données locales endommagées.');
  }
  const data = JSON.parse(new TextDecoder().decode(plaintext)) as VaultData;
  if (data.schema !== 1 || !Array.isArray(data.sessions))
    throw new Error('Données locales incompatibles.');
  return { key, data };
}

/** Key stays in memory only. Writes serialize to avoid late encryption overwriting newer turns. */
export class LocalVault {
  private key?: CryptoKey;
  private salt?: Uint8Array<ArrayBuffer>;
  private queue: Promise<void> = Promise.resolve();
  private epoch = 0;
  async exists(): Promise<boolean> {
    return Boolean(await readRecord<EncryptedRecord>());
  }
  async create(password: string): Promise<VaultData> {
    if (password.length < 12)
      throw new Error('Choisissez une phrase secrète d’au moins 12 caractères.');
    if (await this.exists()) throw new Error('Un espace existe déjà. Déverrouillez-le.');
    this.salt = crypto.getRandomValues(new Uint8Array(16));
    this.key = await deriveKey(password, this.salt);
    const data = emptyVault();
    await this.save(data);
    return data;
  }
  async unlock(password: string): Promise<VaultData> {
    const record = await readRecord<EncryptedRecord>();
    if (!record) throw new Error('Aucun espace local à ouvrir.');
    const opened = await decryptData(record, password);
    this.key = opened.key;
    this.salt = record.salt;
    return opened.data;
  }
  async verify(password: string): Promise<void> {
    await this.queue;
    const record = await readRecord<EncryptedRecord>();
    if (!record) throw new Error('Aucun espace local à ouvrir.');
    await decryptData(record, password);
  }
  save(data: VaultData): Promise<void> {
    const key = this.key,
      salt = this.salt,
      epoch = this.epoch;
    if (!key || !salt) return Promise.reject(new Error('L’espace est verrouillé.'));
    const snapshot = structuredClone(data);
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (epoch !== this.epoch) return;
        const record = await encryptData(snapshot, key, salt);
        if (epoch === this.epoch) await writeRecord(record);
      });
    this.queue = next;
    return next;
  }
  async flush(): Promise<void> {
    await this.queue;
  }
  lock(): void {
    this.key = undefined;
    this.salt = undefined;
  }
  async erase(): Promise<void> {
    this.epoch++;
    await this.queue.catch(() => undefined);
    await eraseRecord();
    this.lock();
  }
}
