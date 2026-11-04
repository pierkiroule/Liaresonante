export type Capabilities = {
  supported: boolean;
  reason?: string;
  shaderF16: boolean;
  maxBufferMB: number;
  deviceMemoryGB?: number;
  storageFreeMB?: number;
  persistent: boolean;
};
export async function detectCapabilities(): Promise<Capabilities> {
  const result: Capabilities = {
    supported: false,
    shaderF16: false,
    maxBufferMB: 0,
    persistent: false,
  };
  if (!isSecureContext)
    return { ...result, reason: 'WebGPU et le chiffrement demandent HTTPS ou localhost.' };
  if (!navigator.gpu)
    return {
      ...result,
      reason:
        'WebGPU n’est pas exposé par ce navigateur. Essayez un navigateur récent avec accélération graphique.',
    };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
      return {
        ...result,
        reason: 'Aucun adaptateur WebGPU disponible. Vérifiez l’accélération graphique.',
      };
    result.supported = true;
    result.shaderF16 = adapter.features.has('shader-f16');
    result.maxBufferMB = Math.round(adapter.limits.maxStorageBufferBindingSize / 1024 ** 2);
    // deviceMemory is coarse system RAM, never free GPU memory.
    result.deviceMemoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  } catch {
    result.reason = 'La détection WebGPU a échoué. Vérifiez le navigateur et le pilote graphique.';
  }
  try {
    const estimate = await navigator.storage?.estimate();
    if (estimate?.quota !== undefined && estimate.usage !== undefined)
      result.storageFreeMB = Math.floor((estimate.quota - estimate.usage) / 1024 ** 2);
    result.persistent = (await navigator.storage?.persisted()) ?? false;
  } catch {
    /* Quota information is optional. GPU availability is independent. */
  }
  return result;
}
export function friendlyEngineError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (
    /out of memory|memory allocation|buffer.*size|device.*lost|GPUDeviceLost|GPU.*lost/iu.test(text)
  )
    return 'La mémoire graphique est insuffisante, ou le GPU a été réinitialisé. Fermez d’autres onglets, puis chargez un modèle plus léger. La séance reste locale.';
  if (/quota|disk|storage|cache.*put/iu.test(text))
    return 'Le stockage du navigateur est plein. Libérez de l’espace ou effacez un modèle en cache.';
  if (/shader-f16|f16.*support/iu.test(text))
    return 'Le GPU ne prend pas en charge shader-f16. Sélectionnez le modèle f32.';
  if (/network|fetch|load.*failed|offline|blocked/iu.test(text))
    return 'Une ressource du modèle manque ou son téléchargement a échoué. Vérifiez la connexion, le cache et les domaines autorisés.';
  if (/context|token.*exceed|window.*size/iu.test(text))
    return 'Le texte dépasse le contexte disponible. Raccourcissez ce message ou ouvrez une nouvelle séance.';
  if (/timed out|délai/iu.test(text))
    return 'Le moteur n’a pas répondu dans le délai prévu. Il a été arrêté. Rechargez le modèle.';
  return 'Le moteur local a rencontré une erreur. Rechargez le modèle. Aucune réponse de remplacement n’est générée.';
}
