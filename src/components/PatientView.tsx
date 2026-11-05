import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CornerDownLeft, Hand, Plus, Send, Square, Trash2 } from 'lucide-react';
import type { EngineState, Session } from '../types';
import { HUMAN_PAUSE } from '../security/distress';
import { EchoMark } from './EchoMark';
export function PatientView({
  session,
  engine,
  busy,
  startAvailable = true,
  onSend,
  onStop,
  onStart,
  onEngine,
  onPause,
  onResume,
  onErase,
  omitted,
}: {
  session?: Session;
  engine: EngineState;
  busy: boolean;
  startAvailable?: boolean;
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
  onStart: () => void;
  onEngine: () => void;
  onPause: () => void;
  onResume: () => void;
  onErase: () => void;
  omitted: number;
}) {
  const [draft, setDraft] = useState(''),
    [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const submitting = useRef(false);
  const currentSessionId = useRef(session?.id);
  currentSessionId.current = session?.id;
  const hasMessages = Boolean(session?.messages.length);
  useEffect(() => {
    setDraft('');
    setError('');
  }, [session?.id]);
  useEffect(() => {
    if (nearBottom.current) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session?.messages.length, session?.messages.at(-1)?.content]);
  const canSend = Boolean(session && !session.paused && engine.status === 'ready' && !busy);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend || submitting.current || !draft.trim()) return;
    submitting.current = true;
    const sessionId = session?.id;
    const originalDraft = draft;
    const text = draft.trim();
    setDraft('');
    setError('');
    try {
      await onSend(text);
    } catch (err) {
      if (currentSessionId.current === sessionId) {
        setDraft((current) => current || originalDraft);
        setError(err instanceof Error ? err.message : 'Le message n’a pas pu être traité.');
      }
    } finally {
      submitting.current = false;
    }
    if (currentSessionId.current === sessionId) textarea.current?.focus();
  }
  return (
    <section
      className={`patient-view ${hasMessages ? 'has-messages' : ''}`}
      aria-label="Espace de conversation"
    >
      <div
        className="conversation-scroll"
        onScroll={(event) => {
          const el = event.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 130;
        }}
      >
        {!hasMessages ? (
          <div className="welcome">
            <span className="eyebrow">UN ESPACE, ENTRE NOUS</span>
            <EchoMark active={engine.status === 'loading'} />
            <h1>
              Ce qui vient.
              <br />
              <em>Ce qui résonne.</em>
            </h1>
            <p>
              Un mot, une image, une hésitation.
              <br />
              ÉCHO les accueille, vous leur donnez du sens.
            </p>
            {!session ? (
              <button
                className="button primary welcome-start"
                disabled={!startAvailable}
                onClick={onStart}
              >
                Ouvrir une séance
                <ArrowRight size={17} />
              </button>
            ) : (
              <span className="ready-invitation">La page est ouverte. À votre rythme.</span>
            )}
            <div className="welcome-values">
              <span>Pas de réponse à trouver</span>
              <i /> <span>Un psychologue à vos côtés</span>
            </div>
          </div>
        ) : (
          <div className="messages">
            <div className="thread-heading">
              <EchoMark small />
              <span>
                Les mots ont leur chemin.
                <small>
                  {session?.fictional
                    ? 'Séance fictive · exemple rédigé, non généré'
                    : 'Séance expérimentale · accompagnée'}
                </small>
              </span>
            </div>
            {session?.messages.map((message, index) => (
              <article
                key={message.id}
                className={`message ${message.role}`}
                id={`message-${message.id}`}
              >
                <div className="message-label">
                  {message.role === 'user' ? 'Vous' : 'ÉCHO •°'}
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p>
                  {message.content ||
                    (busy && index === session.messages.length - 1 ? (
                      <span className="typing-indicator">
                        <i />
                        <i />
                        <i />
                        <span className="sr-only">Génération locale en cours</span>
                      </span>
                    ) : (
                      'Réponse interrompue avant le premier mot.'
                    ))}
                </p>
                {message.role === 'assistant' && (
                  <span className="message-meta">
                    {message.status === 'interrupted'
                      ? 'Interrompu'
                      : message.status === 'error'
                        ? 'Génération non aboutie'
                        : message.durationMs
                          ? `${(message.durationMs / 1000).toFixed(1)} s · calcul local`
                          : ''}
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      {session?.paused && (
        <div className="human-pause" role="status">
          <Hand size={22} />
          <div>
            <strong>Un temps pour l’échange humain.</strong>
            <p>
              {session.pauseReason === 'distress'
                ? HUMAN_PAUSE
                : 'ÉCHO est en pause. Prenez ce temps avec le psychologue. La reprise se décide ensemble.'}
            </p>
            <button className="text-button" onClick={onResume}>
              Reprendre avec le psychologue
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      <div className="composer-area">
        {(error || engine.error) && (
          <p className="error-text" role="alert">
            {error || engine.error}
          </p>
        )}
        {omitted > 0 && (
          <p className="context-note">
            L’IA ne relit que les derniers échanges pour limiter la mémoire. Le dialogue complet
            reste accessible au psychologue.
          </p>
        )}
        {session &&
          !session.paused &&
          engine.status !== 'ready' &&
          engine.status !== 'generating' && (
            <div className="engine-invitation">
              <span>
                {engine.status === 'loading'
                  ? `Le moteur se prépare · ${Math.round(engine.progress * 100)} %`
                  : 'Un modèle local pour laisser l’échange se poursuivre.'}
              </span>
              <button className="text-button" onClick={onEngine}>
                {engine.status === 'loading' ? 'Voir la progression' : 'Préparer le moteur'}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        <form
          className={`composer ${session?.paused ? 'disabled' : ''}`}
          onSubmit={(event) => void submit(event)}
        >
          <label htmlFor="patient-message" className="sr-only">
            Votre message à ÉCHO
          </label>
          <textarea
            id="patient-message"
            ref={textarea}
            rows={2}
            maxLength={900}
            value={draft}
            disabled={!session || session.paused || busy}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              !session
                ? 'Ouvrez une séance pour commencer…'
                : session.paused
                  ? 'Un temps de pause, ensemble…'
                  : 'Ce qui vous vient, même inachevé…'
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                (event.ctrlKey || event.metaKey || window.matchMedia('(pointer: fine)').matches)
              ) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <div className="composer-bottom">
            <span className="composer-hint">
              <CornerDownLeft size={12} />
              {draft.length > 700 ? `${draft.length} / 900` : 'Prenez votre temps'}
            </span>
            {busy ? (
              <button
                type="button"
                className="send-button stop"
                onClick={onStop}
                aria-label="Interrompre immédiatement l’IA"
              >
                <Square size={17} fill="currentColor" />
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={!canSend || !draft.trim()}
                aria-label="Envoyer le message"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </form>
        <div className="below-composer">
          <span>Vos mots restent sur cet appareil.</span>
          {session && (
            <div>
              <button className="text-button" onClick={onPause} disabled={session.paused}>
                <Hand size={13} />
                Pause
              </button>
              <button className="text-button" onClick={onErase} disabled={busy}>
                <Trash2 size={13} />
                Effacer
              </button>
              <button className="text-button mobile-new" onClick={onStart} disabled={busy}>
                <Plus size={13} />
                Nouvelle séance
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
