const DB_NAME = 'echo-private-v1';
const STORE = 'vault';
export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error('Le stockage local est indisponible. Aucun message ne sera envoyé.'));
    request.onblocked = () =>
      reject(new Error('Fermez les autres fenêtres ÉCHO pour ouvrir le stockage.'));
  });
}
export async function readRecord<T>(): Promise<T | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('encrypted');
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function writeRecord<T>(value: T): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, 'encrypted');
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error('Enregistrement impossible. Vérifiez l’espace de stockage disponible.'));
      tx.onabort = () =>
        reject(new Error('Enregistrement interrompu. La séance reste en mémoire.'));
    });
  } finally {
    db.close();
  }
}
export async function eraseRecord(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('encrypted');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('L’effacement a échoué.'));
    });
  } finally {
    db.close();
  }
}
