import { useState } from 'react';
import { ArrowRight, Hand, HardDrive, Users } from 'lucide-react';
import { Modal } from './Modal';
export function Consent({ onAccept, close }: { onAccept: () => Promise<void>; close: () => void }) {
  const [agreed, setAgreed] = useState(false),
    [accompanied, setAccompanied] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Avant de laisser venir les mots" close={close}>
      <p>
        ÉCHO reformule et propose parfois une image. Ses réponses peuvent être maladroites ou
        inexactes. Il ne sait pas ce que vous vivez.
      </p>
      <div className="consent-points">
        <p>
          <Users size={21} />
          <span>
            <strong>Un tiers, entre deux humains.</strong> Cette expérimentation se fait avec un
            psychologue présent. ÉCHO n’apporte ni soin, ni diagnostic.
          </span>
        </p>
        <p>
          <HardDrive size={21} />
          <span>
            <strong>Des mots conservés ici.</strong> Le dialogue est chiffré sur cet appareil. Le
            psychologue peut le relire et demander une synthèse locale. Un export nécessite une
            action explicite.
          </span>
        </p>
        <p>
          <Hand size={21} />
          <span>
            <strong>Le droit de s’arrêter.</strong> Vous pouvez interrompre l’IA, demander une pause
            ou effacer la séance. Le téléchargement initial du modèle contacte ses hébergeurs, sans
            transmettre le dialogue.
          </span>
        </p>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          J’ai compris ce fonctionnement et j’accepte cette expérimentation et la relecture par le
          psychologue.
        </span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={accompanied}
          onChange={(e) => setAccompanied(e.target.checked)}
        />
        <span>
          Le psychologue est présent et a expliqué le cadre adapté à ma situation. Pour un mineur,
          il vérifie les accords nécessaires et son assentiment.
        </span>
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full"
        disabled={!agreed || !accompanied || busy}
        onClick={() => {
          setBusy(true);
          void onAccept().catch((err) => {
            setError(String(err));
            setBusy(false);
          });
        }}
      >
        Ouvrir la séance
        <ArrowRight size={17} />
      </button>
      <p className="fine-print">
        Vous pouvez refuser sans justification. Évitez les noms, adresses et autres détails
        identifiants dans ce prototype.
      </p>
    </Modal>
  );
}
