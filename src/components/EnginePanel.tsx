import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CircleHelp,
  Cpu,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { Modal } from './Modal';
import { localEngine } from '../engine/localEngine';
import { models } from '../engine/models';
import { auditModelCache, eraseModel, type CacheAudit } from '../engine/cache';
import { detectCapabilities, type Capabilities } from '../engine/capabilities';
import type { EngineState } from '../types';
export function EnginePanel({
  state,
  selectedId,
  select,
  close,
  busy,
  shellCached,
  stop,
}: {
  state: EngineState;
  selectedId: string;
  select: (id: string) => void;
  close: () => void;
  busy: boolean;
  shellCached: boolean;
  stop: () => void;
}) {
  const [caps, setCaps] = useState<Capabilities>(),
    [audits, setAudits] = useState<Record<string, CacheAudit>>({});
  const [offline, setOffline] = useState(!navigator.onLine),
    [actionError, setActionError] = useState(''),
    [checking, setChecking] = useState(false);
  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const [capabilities, checks] = await Promise.all([
        detectCapabilities(),
        Promise.all(
          models.map(async (model) => [model.id, await auditModelCache(model.id)] as const),
        ),
      ]);
      setCaps(capabilities);
      setAudits(Object.fromEntries(checks));
    } catch {
      setActionError('Impossible de vérifier le cache sur ce navigateur.');
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, state.status]);
  const model = models.find((m) => m.id === selectedId)!;
  const occupied = busy || state.status === 'loading' || state.status === 'generating';
  async function load() {
    setActionError('');
    try {
      await localEngine.load(selectedId, offline);
    } catch {
      /* Engine state carries the error. */
    }
  }
  return (
    <Modal title="Le moteur, sur cet appareil" close={close} wide>
      <p className="panel-intro">
        Les réponses sont calculées par votre GPU. Une première connexion télécharge le modèle ; les
        échanges restent sur l’appareil.
      </p>
      <div className={`capability-banner ${caps && !caps.supported ? 'unavailable' : ''}`}>
        <Cpu size={20} />
        <div>
          <strong>
            {!caps
              ? 'Détection WebGPU…'
              : caps.supported
                ? 'WebGPU disponible'
                : 'WebGPU indisponible'}
          </strong>
          <span>
            {caps?.reason ??
              (caps
                ? `Buffer maximal : ${caps.maxBufferMB} Mo · shader-f16 : ${caps.shaderF16 ? 'oui' : 'non'}`
                : 'Vérification de l’accélération graphique')}
          </span>
        </div>
      </div>
      <fieldset className="model-options" disabled={occupied}>
        <legend>Choisir une voix de calcul</legend>
        {models.map((item) => (
          <label
            key={item.id}
            className={`model-option ${selectedId === item.id ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="model"
              value={item.id}
              checked={selectedId === item.id}
              onChange={() => select(item.id)}
            />
            <span className="model-option-copy">
              <strong>{item.name}</strong>
              <span>{item.subtitle}</span>
              <small>
                ≈ {item.downloadMB} Mo à télécharger · GPU ≈{' '}
                {Math.ceil((item.record.vram_required_MB ?? 0) / 100) / 10} Go
              </small>
            </span>
            {audits[item.id]?.complete && (
              <span className="cache-tag">
                <Check size={12} /> En cache
              </span>
            )}
          </label>
        ))}
      </fieldset>
      <p className="fine-print">
        <CircleHelp size={15} /> Tailles indicatives. La mémoire GPU libre n’est pas accessible au
        navigateur. La qualité du français et le respect du cadre restent à évaluer.
      </p>
      <div className="offline-controls">
        <label className="check-row">
          <input
            type="checkbox"
            checked={offline}
            disabled={occupied}
            onChange={(e) => setOffline(e.target.checked)}
          />
          <span>
            <strong>Chargement hors ligne strict</strong>
            <small>Utiliser uniquement les ressources déjà présentes.</small>
          </span>
        </label>
        <button
          className="icon-button"
          onClick={() => void refresh()}
          aria-label="Vérifier à nouveau le cache"
          disabled={checking || occupied}
        >
          <RefreshCw size={17} className={checking ? 'spinning' : ''} />
        </button>
      </div>
      <div className="cache-status">
        <WifiOff size={17} />
        <span>
          Application : {shellCached ? 'mise en cache' : 'cache PWA à vérifier après un build'}
          <br />
          Modèle :{' '}
          {audits[selectedId]?.complete
            ? 'ressources complètes en cache'
            : `manque : ${audits[selectedId]?.missing.join(', ') ?? 'vérification en cours'}`}
        </span>
      </div>
      {state.status === 'loading' && (
        <div className="download-progress">
          <div>
            <span>Téléchargement et préparation</span>
            <strong>{Math.round(state.progress * 100)} %</strong>
          </div>
          <progress value={state.progress} max={1} aria-label="Chargement du modèle" />
          <p>{state.progressText}</p>
        </div>
      )}
      {(state.error || actionError) && (
        <p className="error-box" role="alert">
          {state.error || actionError}
        </p>
      )}
      <div className="button-row">
        {occupied ? (
          <button className="button danger" onClick={stop}>
            Arrêter le moteur
          </button>
        ) : (
          <button
            className="button primary"
            disabled={
              !caps?.supported ||
              (model.f16 && !caps.shaderF16) ||
              (offline && !audits[selectedId]?.complete)
            }
            onClick={() => void load()}
          >
            <Download size={17} />
            {state.status === 'ready' && state.modelId === selectedId
              ? 'Recharger ce modèle'
              : audits[selectedId]?.complete
                ? 'Charger depuis le cache'
                : 'Télécharger et charger'}
          </button>
        )}
        {state.status === 'ready' && !busy && (
          <button className="button secondary" onClick={() => localEngine.unload()}>
            Libérer le GPU
          </button>
        )}
      </div>
      <div className="storage-details">
        <p>
          <HardDrive size={16} />
          Espace navigateur disponible :{' '}
          {caps?.storageFreeMB !== undefined
            ? `${(caps.storageFreeMB / 1024).toFixed(1)} Go`
            : 'non communiqué'}
        </p>
        <p className="fine-print">
          {caps?.persistent
            ? 'Stockage persistant accordé par le navigateur.'
            : 'Le navigateur peut évincer le cache. Conservez vos exports si nécessaire.'}
        </p>
        <div className="button-row">
          <button
            className="text-button"
            onClick={() =>
              void navigator.storage
                ?.persist()
                .then(() => refresh())
                .catch(() => setActionError('La persistance n’a pas pu être demandée.'))
            }
          >
            Demander la persistance locale
          </button>
          <button
            className="text-button danger-text"
            disabled={occupied}
            onClick={() => {
              if (
                !window.confirm(
                  'Effacer les ressources de ce modèle ? Les séances sont conservées.',
                )
              )
                return;
              localEngine.unload();
              void eraseModel(selectedId)
                .then(refresh)
                .catch(() => setActionError('L’effacement du cache a échoué.'));
            }}
          >
            <Trash2 size={14} />
            Effacer ce modèle
          </button>
        </div>
      </div>
    </Modal>
  );
}
