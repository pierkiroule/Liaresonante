import { useState, type FormEvent } from 'react';
import { KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
export function VaultGate({
  exists,
  reauth,
  error,
  onSubmit,
  close,
  onReset,
}: {
  exists: boolean;
  reauth?: boolean;
  error?: string;
  onSubmit: (password: string) => Promise<void>;
  close?: () => void;
  onReset?: () => Promise<void>;
}) {
  const [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState(''),
    [reset, setReset] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError('');
    if (!exists && password !== confirmation) {
      setLocalError('Les deux phrases secrètes ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(password);
      setPassword('');
      setConfirmation('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Ouverture impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        reauth
          ? 'Le regard du psychologue'
          : exists
            ? 'Retrouver cet espace'
            : 'Préparer un espace à deux'
      }
      close={busy ? undefined : close}
    >
      <div className="modal-emblem">
        <KeyRound size={24} />
      </div>
      <p>
        {reauth
          ? 'La relecture des séances est réservée au psychologue. Saisissez la phrase secrète de cet appareil.'
          : exists
            ? 'Les séances sont chiffrées sur cet appareil. Votre phrase secrète permet de les ouvrir.'
            : 'Le psychologue choisit une phrase secrète. Elle protège les séances et donne accès à leur relecture.'}
      </p>
      <form onSubmit={(event) => void submit(event)} className="stack">
        <label className="field">
          Phrase secrète
          <input
            type="password"
            autoComplete={exists ? 'current-password' : 'new-password'}
            minLength={exists ? 1 : 12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
            placeholder={exists ? 'Votre phrase secrète' : 'Au moins 12 caractères'}
          />
        </label>
        {!exists && (
          <label className="field">
            Confirmer la phrase
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              minLength={12}
              disabled={busy}
            />
          </label>
        )}
        {(localError || error) && (
          <p className="error-text" role="alert">
            {localError || error}
          </p>
        )}
        <button className="button primary" type="submit" disabled={busy}>
          {busy
            ? 'Ouverture…'
            : reauth
              ? 'Accéder à la relecture'
              : exists
                ? 'Ouvrir cet espace'
                : 'Créer cet espace local'}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="fine-print">
        <ShieldCheck size={15} /> La phrase n’est pas envoyée. Conservez-la : elle ne peut pas être
        récupérée.
      </p>
      {!reauth && exists && onReset && (
        <div className="reset-box">
          {reset ? (
            <>
              <p>
                L’effacement supprimera toutes les séances de cet appareil. Cette action est
                irréversible.
              </p>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onReset()
                    .catch((err) => setLocalError(String(err)))
                    .finally(() => setBusy(false));
                }}
              >
                Effacer les séances et recommencer
              </button>
              <button className="text-button" onClick={() => setReset(false)}>
                Annuler
              </button>
            </>
          ) : (
            <button className="text-button muted" onClick={() => setReset(true)}>
              Phrase oubliée : réinitialiser cet espace
            </button>
          )}
        </div>
      )}
      <p className="fine-print">
        Prototype expérimental, non validé cliniquement. Le verrou local ne remplace pas la
        protection de l’appareil.
      </p>
    </Modal>
  );
}
