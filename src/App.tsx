import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CircleHelp,
  Cpu,
  Feather,
  Hand,
  LockKeyhole,
  MessageCircle,
  Plus,
  ShieldCheck,
  Square,
  WifiOff,
} from 'lucide-react';
import { localEngine } from './engine/localEngine';
import { DEFAULT_MODEL, modelById } from './engine/models';
import { fitConversation } from './engine/context';
import { LocalVault } from './storage/vault';
import { downloadSession } from './storage/export';
import { needsHumanPause } from './security/distress';
import { patientPrompt, selectGesture } from './skills/orchestrator';
import { generateSummary } from './analysis/summary';
import { fictionalSession } from './fixtures';
import { newSession, type Message, type Session, type VaultData } from './types';
import { usePwa } from './hooks/usePwa';
import { PatientView } from './components/PatientView';
import { PsychologistView } from './components/PsychologistView';
import { EnginePanel } from './components/EnginePanel';
import { VaultGate } from './components/VaultGate';
import { Consent } from './components/Consent';
import { Modal } from './components/Modal';
import { EchoMark } from './components/EchoMark';

const vault = new LocalVault();
export default function App() {
  const engine = useSyncExternalStore(localEngine.subscribe, localEngine.snapshot);
  const pwa = usePwa();
  const secureContext = globalThis.isSecureContext === true && Boolean(globalThis.crypto?.subtle);
  const [data, setData] = useState<VaultData>(),
    dataRef = useRef<VaultData | undefined>(undefined);
  const [exists, setExists] = useState<boolean>(),
    [bootError, setBootError] = useState('');
  const [page, setPage] = useState<'patient' | 'psychologist'>('patient');
  const [selectedId, setSelectedId] = useState<string>(),
    [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [showEngine, setShowEngine] = useState(false),
    [showConsent, setShowConsent] = useState(false),
    [showAbout, setShowAbout] = useState(false);
  const [authIntent, setAuthIntent] = useState<'review' | 'resume'>(),
    [busy, setBusy] = useState(false),
    busyRef = useRef(false);
  const [notice, setNotice] = useState(''),
    [saveError, setSaveError] = useState(''),
    [omitted, setOmitted] = useState(0),
    [summaryProgress, setSummaryProgress] = useState('');
  const [online, setOnline] = useState(navigator.onLine),
    [otherTab, setOtherTab] = useState(false);
  const pending = useRef<{ sessionId: string; messageId: string } | undefined>(undefined),
    ticket = useRef(0),
    authFailures = useRef(0),
    blockedUntil = useRef(0);
  const active = data?.sessions.find((s) => s.id === data.activeSessionId);
  const selected = data?.sessions.find((s) => s.id === selectedId);
  const opened = Boolean(data);

  useEffect(() => {
    void vault
      .exists()
      .then(setExists)
      .catch((error) => setBootError(String(error)));
  }, []);
  // One editable tab prevents two vault snapshots overwriting each other. No transcript crosses tabs.
  useEffect(() => {
    if (!secureContext) return;
    if (!navigator.locks) {
      setOtherTab(true);
      return;
    }
    let release: (() => void) | undefined,
      cancelled = false;
    void navigator.locks
      .request('echo-private-editor', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          setOtherTab(true);
          return;
        }
        if (cancelled) return;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => setOtherTab(true));
    return () => {
      cancelled = true;
      release?.();
    };
  }, [secureContext]);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);
  const commit = useCallback(async (next: VaultData) => {
    dataRef.current = next;
    setData(next);
    try {
      await vault.save(next);
      setSaveError('');
    } catch {
      const message =
        'L’enregistrement local a échoué. Gardez cette page ouverte et réessayez avant de poursuivre.';
      setSaveError(message);
      throw new Error(message);
    }
  }, []);
  const changeSession = useCallback(
    async (id: string, update: (session: Session) => Session) => {
      const current = dataRef.current;
      if (!current) return;
      await commit({
        ...current,
        sessions: current.sessions.map((s) => (s.id === id ? update(s) : s)),
      });
    },
    [commit],
  );
  const stop = useCallback(async () => {
    ticket.current++;
    localEngine.stop();
    busyRef.current = false;
    setBusy(false);
    setSummaryProgress('');
    const inFlight = pending.current;
    pending.current = undefined;
    if (inFlight)
      await changeSession(inFlight.sessionId, (s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === inFlight.messageId ? { ...m, status: 'interrupted' } : m,
        ),
      }));
  }, [changeSession]);
  const lock = useCallback(async () => {
    try {
      await stop();
      await vault.flush();
    } catch {
      setNotice(
        'Le verrouillage attend un enregistrement réussi. Réessayez ou exportez depuis la relecture.',
      );
      return;
    }
    vault.lock();
    dataRef.current = undefined;
    setData(undefined);
    setPage('patient');
    setAuthIntent(undefined);
    setShowConsent(false);
    setShowEngine(false);
    setShowAbout(false);
    setNotice('');
  }, [stop]);
  useEffect(() => {
    if (!opened) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
    };
    const timer = setInterval(() => {
      if (Date.now() - lastActivity > 10 * 60_000) void lock();
    }, 15_000);
    const visibility = () => {
      if (document.hidden) {
        setPage('patient');
        setAuthIntent(undefined);
      }
    };
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [opened, lock]);
  useEffect(() => {
    if (!opened) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (busyRef.current || saveError) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [opened, saveError]);
  function alertError(error: unknown) {
    setNotice(error instanceof Error ? error.message : 'Cette action n’a pas abouti.');
  }
  async function openVault(password: string) {
    if (Date.now() < blockedUntil.current)
      throw new Error('Patientez quelques secondes avant de réessayer.');
    try {
      const contents = exists ? await vault.unlock(password) : await vault.create(password);
      // Opening never exposes the previous patient’s active transcript automatically.
      const next = { ...contents, activeSessionId: undefined };
      await commit(next);
      setExists(true);
      authFailures.current = 0;
    } catch (error) {
      authFailures.current++;
      if (authFailures.current >= 3)
        blockedUntil.current =
          Date.now() + Math.min(60_000, 2000 * 2 ** (authFailures.current - 3));
      throw error;
    }
  }
  async function authorize(password: string) {
    if (Date.now() < blockedUntil.current)
      throw new Error('Patientez quelques secondes avant de réessayer.');
    try {
      await vault.verify(password);
      authFailures.current = 0;
    } catch (error) {
      authFailures.current++;
      if (authFailures.current >= 3)
        blockedUntil.current =
          Date.now() + Math.min(60_000, 2000 * 2 ** (authFailures.current - 3));
      throw error;
    }
    if (authIntent === 'resume' && active) {
      await changeSession(active.id, (s) => ({ ...s, paused: false, pauseReason: undefined }));
      setPage('patient');
    } else {
      setSelectedId(selectedId ?? active?.id ?? dataRef.current?.sessions[0]?.id);
      setPage('psychologist');
    }
    setAuthIntent(undefined);
  }
  async function startSession() {
    const current = dataRef.current;
    if (!current) return;
    const session = newSession();
    session.title = `Séance du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    await commit({
      ...current,
      sessions: [session, ...current.sessions],
      activeSessionId: session.id,
    });
    setOmitted(0);
    setShowConsent(false);
    setPage('patient');
    setNotice('');
  }
  async function send(text: string) {
    const current = dataRef.current,
      session = current?.sessions.find((s) => s.id === current.activeSessionId);
    if (!session || session.paused || busyRef.current || saveError || engine.status !== 'ready')
      return;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    const run = ++ticket.current;
    const user: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      status: 'complete',
    };
    const humanPause = needsHumanPause(text);
    const assistant: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'interrupted',
      modelId: engine.modelId,
    };
    const messages = [...session.messages, user];
    const gesture = selectGesture(messages);
    assistant.gesture = gesture;
    try {
      await changeSession(session.id, (s) => ({
        ...s,
        summary: undefined,
        updatedAt: user.createdAt,
        paused: humanPause,
        pauseReason: humanPause ? 'distress' : undefined,
        messages: humanPause ? messages : [...messages, assistant],
      }));
      if (run !== ticket.current) return;
      if (humanPause) {
        localEngine.stop();
        return;
      }
      pending.current = { sessionId: session.id, messageId: assistant.id };
      const context = fitConversation(patientPrompt(gesture), messages);
      setOmitted(context.omitted);
      const generated = await localEngine.generate(
        {
          messages: context.messages,
          max_tokens: 160,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.08,
        },
        (partial) => {
          if (run !== ticket.current || !dataRef.current) return;
          // Partial output stays in memory; the final or explicitly interrupted reply is persisted.
          const next = {
            ...dataRef.current,
            sessions: dataRef.current.sessions.map((s) =>
              s.id === session.id
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistant.id ? { ...m, content: partial } : m,
                    ),
                  }
                : s,
            ),
          };
          dataRef.current = next;
          setData(next);
        },
      );
      if (run !== ticket.current) return;
      await changeSession(session.id, (s) => ({
        ...s,
        updatedAt: new Date().toISOString(),
        messages: s.messages.map((m) =>
          m.id === assistant.id
            ? {
                ...m,
                content: generated.text,
                durationMs: generated.durationMs,
                firstTokenMs: generated.firstTokenMs,
                finishReason: generated.finishReason,
                status: 'complete',
              }
            : m,
        ),
      }));
    } catch (error) {
      if (run !== ticket.current) return;
      const interrupted = error instanceof DOMException && error.name === 'AbortError';
      try {
        await changeSession(session.id, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistant.id ? { ...m, status: interrupted ? 'interrupted' : 'error' } : m,
          ),
        }));
      } catch {
        /* Save banner remains visible. */
      }
      if (!interrupted)
        setNotice(
          localEngine.snapshot().error ??
            (error instanceof Error ? error.message : 'La génération a échoué.'),
        );
    } finally {
      if (run === ticket.current) {
        busyRef.current = false;
        setBusy(false);
        pending.current = undefined;
      }
    }
  }
  async function pause() {
    const id = dataRef.current?.activeSessionId;
    await stop();
    if (id) await changeSession(id, (s) => ({ ...s, paused: true, pauseReason: 'human-request' }));
  }
  async function summarize() {
    if (!selected || busyRef.current || page !== 'psychologist' || saveError) return;
    const id = selected.id,
      messages = selected.messages,
      run = ++ticket.current;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    try {
      const summary = await generateSummary(localEngine, messages, (done, total) => {
        if (run !== ticket.current) throw new DOMException('Interrupted', 'AbortError');
        setSummaryProgress(`Fragment ${Math.min(done + 1, total)} / ${total}`);
      });
      if (run === ticket.current) await changeSession(id, (s) => ({ ...s, summary }));
    } catch (error) {
      if (run === ticket.current && !(error instanceof DOMException && error.name === 'AbortError'))
        alertError(error);
    } finally {
      if (run === ticket.current) {
        busyRef.current = false;
        setBusy(false);
        setSummaryProgress('');
      }
    }
  }
  async function eraseSession(id?: string) {
    if (
      !id ||
      busyRef.current ||
      !window.confirm('Effacer définitivement cette séance et sa synthèse de cet appareil ?')
    )
      return;
    const current = dataRef.current;
    if (!current) return;
    localEngine.unload();
    const next = {
      ...current,
      sessions: current.sessions.filter((s) => s.id !== id),
      activeSessionId: current.activeSessionId === id ? undefined : current.activeSessionId,
    };
    await commit(next);
    if (selectedId === id) setSelectedId(next.sessions[0]?.id);
    setOmitted(0);
  }
  async function eraseAll() {
    if (
      busyRef.current ||
      page !== 'psychologist' ||
      !window.confirm(
        'Supprimer toutes les séances et la phrase secrète de cet appareil ? Cette action est irréversible.',
      )
    )
      return;
    await stop();
    await vault.erase();
    dataRef.current = undefined;
    setData(undefined);
    setExists(false);
    setPage('patient');
    setSelectedId(undefined);
    setSaveError('');
  }
  async function addFiction() {
    const current = dataRef.current;
    if (!current || page !== 'psychologist') return;
    const session = fictionalSession();
    await commit({ ...current, sessions: [session, ...current.sessions] });
    setSelectedId(session.id);
  }
  async function resumeSelected() {
    const current = dataRef.current;
    if (!current || !selected || page !== 'psychologist') return;
    await commit({
      ...current,
      activeSessionId: selected.id,
      sessions: current.sessions.map((s) =>
        s.id === selected.id ? { ...s, paused: false, pauseReason: undefined } : s,
      ),
    });
    setPage('patient');
    setOmitted(0);
    setNotice('');
  }
  function exportSelected(format: 'json' | 'md') {
    if (!selected || page !== 'psychologist') return;
    if (
      window.confirm(
        'Cet export contient le dialogue en clair. Il sort de la protection chiffrée d’ÉCHO. Enregistrer ce fichier sur cet appareil ?',
      )
    )
      downloadSession(selected, format);
  }
  const sessionCount = data?.sessions.length ?? 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="./"
          onClick={(event) => {
            event.preventDefault();
            setPage('patient');
          }}
          aria-label="ÉCHO, espace patient"
        >
          <EchoMark small />
          <span>
            ÉCHO<sup>•°</sup>
            <small>un espace de résonance</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Les deux espaces">
          <button className={page === 'patient' ? 'active' : ''} onClick={() => setPage('patient')}>
            <MessageCircle size={16} />
            <span>L’échange</span>
          </button>
          <button
            className={page === 'psychologist' ? 'active' : ''}
            disabled={!opened || busy}
            onClick={() => {
              if (page !== 'psychologist') setAuthIntent('review');
            }}
          >
            <LockKeyhole size={15} />
            <span>Le psychologue</span>
          </button>
        </nav>
        <div className="header-actions">
          {!online && (
            <span className="offline-pill">
              <WifiOff size={14} />
              Hors ligne
            </span>
          )}
          <button className="engine-top-button" onClick={() => setShowEngine(true)}>
            <span
              className={`status-dot ${engine.status === 'ready' ? 'ready' : engine.status === 'loading' || busy ? 'working' : ''}`}
            />
            <span>
              {engine.status === 'loading'
                ? 'Préparation…'
                : engine.status === 'ready' || engine.status === 'generating'
                  ? 'Moteur local'
                  : 'Préparer l’IA'}
            </span>
            <Cpu size={16} />
          </button>
          {opened && (
            <button
              className="icon-button lock-button"
              onClick={() => void lock()}
              aria-label="Verrouiller l’espace et arrêter l’IA"
            >
              <LockKeyhole size={18} />
            </button>
          )}
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-top">
            <span className="eyebrow">LAISSER UNE PLACE</span>
            <h2>
              Aux mots.
              <br />
              Aux possibles.
            </h2>
            <p>
              Un dialogue à trois,
              <br />
              un sens à construire ensemble.
            </p>
          </div>
          <button
            className="button new-session-button"
            disabled={!opened || busy || Boolean(saveError)}
            onClick={() => setShowConsent(true)}
          >
            <Plus size={17} />
            Nouvelle séance
          </button>
          <div className="session-note">
            <span className="sidebar-caption">CET INSTANT</span>
            <strong>
              {active
                ? active.fictional
                  ? 'Une séance fictive'
                  : 'Une page ouverte'
                : 'Tout peut commencer'}
            </strong>
            <p>
              {active
                ? `${active.messages.filter((m) => m.role === 'user').length} paroles déposées · ${new Date(active.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                : 'Un cadre partagé, puis le premier mot.'}
            </p>
            {active && (
              <span className="consent-label">
                <CheckConsent />
                Cadre accepté ensemble
              </span>
            )}
          </div>
          <div className="process-guide">
            <div className={!active ? 'current' : ''}>
              <span>01</span>
              <p>
                Poser le cadre<small>Consentir, ensemble.</small>
              </p>
            </div>
            <div className={active && page === 'patient' ? 'current' : ''}>
              <span>02</span>
              <p>
                Laisser résonner<small>Suivre le fil des mots.</small>
              </p>
            </div>
            <div className={page === 'psychologist' ? 'current' : ''}>
              <span>03</span>
              <p>
                Revenir au dialogue<small>Avec le psychologue.</small>
              </p>
            </div>
          </div>
          <div className="sidebar-bottom">
            <div className="local-promise">
              <ShieldCheck size={20} />
              <p>
                Seulement ici.<small>Calcul local · séances chiffrées</small>
              </p>
            </div>
            <button className="text-button" onClick={() => setShowAbout(true)}>
              <CircleHelp size={15} />
              Comprendre ÉCHO
            </button>
            {pwa.installable && (
              <button className="text-button" onClick={() => void pwa.install()}>
                <ArrowDownToLine size={15} />
                Installer sur cet appareil
              </button>
            )}
            <span className="prototype-label">PROTOTYPE EXPÉRIMENTAL · v0.1</span>
          </div>
        </aside>
        <main
          id="main"
          className={page === 'psychologist' ? 'main-content psy-main' : 'main-content'}
        >
          <div className="workspace-topline">
            <span>
              <Feather size={14} />
              {page === 'patient' ? 'L’échange' : 'La relecture'}
              <span className="topline-separator">/</span>
              {page === 'patient'
                ? 'à votre rythme'
                : `${sessionCount} séance${sessionCount > 1 ? 's' : ''} sur cet appareil`}
            </span>
            <span className="topline-local">
              <span className="tiny-dot" />
              Sans transmission du dialogue
            </span>
          </div>
          {!secureContext && (
            <div className="notice" role="status">
              Ouvrez ÉCHO via HTTPS ou localhost. À cette adresse, le moteur, le chiffrement et le
              mode hors ligne ne peuvent pas être activés.
            </div>
          )}
          {(notice || saveError || pwa.error) && (
            <div className={`notice ${saveError ? 'error-box' : ''}`} role="alert">
              <span>{saveError || notice || pwa.error}</span>
              {saveError ? (
                <button
                  className="text-button"
                  onClick={() => {
                    if (dataRef.current) void commit(dataRef.current).catch(alertError);
                  }}
                >
                  Réessayer l’enregistrement
                </button>
              ) : (
                <button className="text-button" onClick={() => setNotice('')}>
                  Fermer
                </button>
              )}
            </div>
          )}
          {pwa.needsUpdate && (
            <div className="notice">
              <span>Une nouvelle version d’ÉCHO est prête.</span>
              <button
                className="text-button"
                disabled={busy || Boolean(saveError)}
                onClick={() =>
                  void lock().then(() => {
                    if (!dataRef.current) return pwa.update();
                  })
                }
              >
                Mettre à jour et verrouiller
              </button>
            </div>
          )}
          {page === 'patient' ? (
            <PatientView
              session={active}
              engine={engine}
              busy={busy || Boolean(saveError)}
              startAvailable={secureContext}
              onSend={send}
              onStop={() => void stop().catch(alertError)}
              onStart={() => setShowConsent(true)}
              onEngine={() => setShowEngine(true)}
              onPause={() => void pause().catch(alertError)}
              onResume={() => setAuthIntent('resume')}
              onErase={() => void eraseSession(active?.id).catch(alertError)}
              omitted={omitted}
            />
          ) : (
            <PsychologistView
              sessions={data?.sessions ?? []}
              selectedId={selectedId}
              select={setSelectedId}
              onSummary={() => void summarize()}
              busy={busy || Boolean(saveError)}
              progress={summaryProgress}
              engine={engine}
              onExport={exportSelected}
              onErase={() => void eraseSession(selected?.id).catch(alertError)}
              onEraseAll={() => void eraseAll().catch(alertError)}
              onFiction={() => void addFiction().catch(alertError)}
              onReview={() => {
                if (selected)
                  void changeSession(selected.id, (s) => ({
                    ...s,
                    summary: s.summary ? { ...s.summary, reviewed: true } : undefined,
                  })).catch(alertError);
              }}
              onResume={() => void resumeSelected().catch(alertError)}
              onRename={(title) => {
                if (selected && selected.title !== title)
                  void changeSession(selected.id, (s) => ({ ...s, title })).catch(alertError);
              }}
              onEngine={() => setShowEngine(true)}
            />
          )}
        </main>
      </div>
      {(busy || engine.status === 'loading') && (
        <button className="emergency-stop" onClick={() => void stop().catch(alertError)}>
          <Square size={13} fill="currentColor" />
          Interrompre l’IA
        </button>
      )}
      {!opened && !otherTab && secureContext && exists !== undefined && !showEngine && (
        <VaultGate
          exists={exists}
          onSubmit={openVault}
          onReset={async () => {
            await vault.erase();
            setExists(false);
            setSaveError('');
          }}
        />
      )}
      {authIntent && opened && (
        <VaultGate exists reauth onSubmit={authorize} close={() => setAuthIntent(undefined)} />
      )}
      {showConsent && opened && (
        <Consent onAccept={startSession} close={() => setShowConsent(false)} />
      )}
      {showEngine && (
        <EnginePanel
          state={engine}
          selectedId={selectedModel}
          select={setSelectedModel}
          close={() => setShowEngine(false)}
          busy={busy}
          shellCached={pwa.shellCached}
          stop={() => void stop().catch(alertError)}
        />
      )}
      {showAbout && (
        <Modal title="Une place pour l’inachevé" close={() => setShowAbout(false)}>
          <EchoMark small />
          <p>
            ÉCHO •° est une expérimentation de médiation projective conversationnelle. Le patient,
            le psychologue et l’outil partagent un espace de mots.
          </p>
          <p>
            La machine reformule, rapproche parfois deux images et accepte la suspension. Le sens
            appartient aux humains. Le modèle peut sortir de ce cadre : le psychologue reste présent
            et peut l’interrompre immédiatement.
          </p>
          <div className="about-item">
            <ShieldCheck size={20} />
            <p>
              Le dialogue n’est envoyé à aucun serveur. Le premier téléchargement contacte Hugging
              Face et GitHub pour les ressources publiques du modèle. Ces hébergeurs voient les
              métadonnées habituelles de connexion, sans recevoir les messages.
            </p>
          </div>
          <div className="about-item">
            <LockKeyhole size={20} />
            <p>
              Les séances sont chiffrées localement (AES-GCM, phrase dérivée par PBKDF2). L’espace
              se verrouille après 10 minutes d’inactivité. La relecture se referme quand l’onglet
              est masqué. Le verrou ne protège pas contre une personne ayant accès à une session
              déjà ouverte, au navigateur ou à un appareil compromis.
            </p>
          </div>
          <div className="about-item">
            <Hand size={20} />
            <p>
              Le bouton d’arrêt détruit le Worker. Une détection lexicale prudente peut proposer une
              pause humaine ; elle ne repère pas toutes les situations de détresse. En situation
              urgente, une personne doit prendre le relais.
            </p>
          </div>
          <p>
            Ce prototype n’est pas un dispositif clinique validé. Il ne remplace ni une relation de
            soin, ni une évaluation clinique. Une conformité réglementaire et les conditions d’un
            usage clinique réel doivent être étudiées séparément.
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => {
                setShowAbout(false);
                setShowEngine(true);
              }}
            >
              <BookOpen size={16} />
              Voir le moteur
              <ArrowRight size={15} />
            </button>
          </div>
          <p className="fine-print">
            Moteur : {modelById(engine.modelId ?? selectedModel)?.name} · WebLLM 0.2.87 · aucun
            compte, aucune télémétrie.
          </p>
        </Modal>
      )}
      {otherTab && (
        <Modal title="Un seul espace à la fois">
          <p>
            Une autre fenêtre ÉCHO est ouverte, ou le verrou inter-onglets est indisponible dans ce
            navigateur. Fermez l’autre fenêtre puis rechargez cette page pour éviter d’écraser des
            séances.
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            Recharger
          </button>
        </Modal>
      )}
      {bootError && (
        <Modal title="Le stockage est indisponible">
          <p>{bootError}</p>
          <p>Autorisez le stockage local et utilisez HTTPS ou localhost.</p>
          <button className="button primary" onClick={() => location.reload()}>
            Réessayer
          </button>
        </Modal>
      )}
    </div>
  );
}
function CheckConsent() {
  return <ShieldCheck size={12} />;
}
