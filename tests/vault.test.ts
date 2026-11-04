import { beforeEach, describe, expect, it } from 'vitest';
import { LocalVault, type EncryptedRecord } from '../src/storage/vault';
import { eraseRecord, readRecord } from '../src/storage/database';
import { emptyVault } from '../src/types';
import { fictionalSession } from '../src/fixtures';
describe('séances fictives chiffrées dans IndexedDB', () => {
  beforeEach(async () => {
    await eraseRecord();
  });
  it('ne conserve pas le dialogue en clair et refuse une mauvaise phrase', async () => {
    const vault = new LocalVault();
    await vault.create('Une phrase de test 100% fictive');
    const data = { ...emptyVault(), sessions: [fictionalSession()] };
    await vault.save(data);
    const record = await readRecord<EncryptedRecord>();
    expect(record?.ciphertext).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(record?.ciphertext)).not.toContain('porte bleue');
    await expect(new LocalVault().unlock('Une phrase incorrecte')).rejects.toThrow('incorrecte');
    const restored = await new LocalVault().unlock('Une phrase de test 100% fictive');
    expect(restored.sessions[0].messages).toEqual(data.sessions[0].messages);
  });
  it('sérialise les écritures, utilise un IV différent et retire la clé au verrouillage', async () => {
    const vault = new LocalVault();
    await vault.create('Une autre phrase de test fictive');
    const before = await readRecord<EncryptedRecord>();
    const session = fictionalSession();
    await Promise.all([
      vault.save({ ...emptyVault(), sessions: [session] }),
      vault.save({ ...emptyVault(), sessions: [{ ...session, title: 'Version finale fictive' }] }),
    ]);
    const after = await readRecord<EncryptedRecord>();
    expect(after?.iv).not.toEqual(before?.iv);
    vault.lock();
    await expect(vault.save(emptyVault())).rejects.toThrow('verrouillé');
    expect((await vault.unlock('Une autre phrase de test fictive')).sessions[0].title).toBe(
      'Version finale fictive',
    );
  });
  it('efface les données et empêche une écriture en attente de ressusciter une séance', async () => {
    const vault = new LocalVault();
    await vault.create('Cette phrase reste un simple test');
    const pending = vault.save({ ...emptyVault(), sessions: [fictionalSession()] });
    await vault.erase();
    await pending;
    expect(await vault.exists()).toBe(false);
  });
});
