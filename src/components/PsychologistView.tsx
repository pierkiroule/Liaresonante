import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCheck,
  Download,
  FileText,
  FlaskConical,
  LockKeyhole,
  Quote,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { EngineState, Observation, Session } from '../types';
import { associationTrail, recurrences } from '../analysis/descriptive';
export function PsychologistView({
  sessions,
  selectedId,
  select,
  onSummary,
  busy,
  progress,
  engine,
  onExport,
  onErase,
  onEraseAll,
  onFiction,
  onReview,
  onResume,
  onRename,
  onEngine,
}: {
  sessions: Session[];
  selectedId?: string;
  select: (id: string) => void;
  onSummary: () => void;
  busy: boolean;
  progress: string;
  engine: EngineState;
  onExport: (format: 'json' | 'md') => void;
  onErase: () => void;
  onEraseAll: () => void;
  onFiction: () => void;
  onReview: () => void;
  onResume: () => void;
  onRename: (title: string) => void;
  onEngine: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'dialogue' | 'trail'>('overview');
  const [filter, setFilter] = useState('');
  const session = sessions.find((s) => s.id === selectedId);
  const recurring = useMemo(() => recurrences(session?.messages ?? []), [session?.messages]);
  const trail = useMemo(() => associationTrail(session?.messages ?? []), [session?.messages]);
  const patient = session?.messages.filter((m) => m.role === 'user') ?? [];
  function evidence(item: Observation, index: number) {
    return (
      <div className="observation" key={`${index}-${item.text}`}>
        <p>{item.text}</p>
        <details>
          <summary>
            {item.sourceIds.length} source{item.sourceIds.length > 1 ? 's' : ''} patient · citations
            exactes
          </summary>
          {item.sourceIds.map((id) => {
            const source = patient.find((m) => m.id === id);
            return source ? (
              <blockquote key={id}>
                {source.content}
                <cite>
                  Parole {patient.indexOf(source) + 1} ·{' '}
                  {new Date(source.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </cite>
              </blockquote>
            ) : null;
          })}
        </details>
      </div>
    );
  }
  return (
    <section className="psychologist-view">
      <div className="psy-heading">
        <div>
          <span className="eyebrow">LE REGARD DU PSYCHOLOGUE</span>
          <h1>Revenir aux mots.</h1>
          <p>Observer le fil. Laisser le sens ouvert.</p>
        </div>
        <span className="privacy-chip">
          <LockKeyhole size={13} />
          Accès local déverrouillé
        </span>
      </div>
      <div className="psy-session-bar">
        <label className="field">
          <span>Séance à relire</span>
          <select
            value={session?.id ?? ''}
            onChange={(event) => {
              select(event.target.value);
              setFilter('');
            }}
            disabled={busy}
          >
            <option value="" disabled>
              Choisir une séance
            </option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fictional ? '[Fictive] ' : ''}
                {s.title} · {new Date(s.createdAt).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" disabled={busy} onClick={onFiction}>
          <FlaskConical size={16} />
          Séance fictive
        </button>
      </div>
      {!session ? (
        <div className="empty-psy">
          <FileText size={36} />
          <h2>Une relecture commence par un échange.</h2>
          <p>
            Vous pouvez ouvrir une séance fictive pour explorer les mots récurrents, les citations
            et le parcours associatif.
          </p>
        </div>
      ) : (
        <>
          <div className="session-title-row">
            <input
              className="session-title-input"
              key={session.id}
              defaultValue={session.title}
              aria-label="Titre de la séance, sans information identifiante"
              maxLength={80}
              disabled={busy}
              onBlur={(e) => onRename(e.target.value.trim() || 'Séance sans titre')}
            />
            <span>
              {patient.length} paroles patient ·{' '}
              {session.fictional ? 'données fictives' : 'expérimentation'}
            </span>
          </div>
          <div className="tabs" role="tablist" aria-label="Relecture de la séance">
            {(
              [
                ['overview', 'Vue descriptive'],
                ['dialogue', 'Dialogue & citations'],
                ['trail', 'Fil associatif'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'overview' && (
              <div className="overview-grid">
                <div className="analysis-card words-card">
                  <span className="card-kicker">01 · REPÈRES TEXTUELS</span>
                  <h2>Les mots qui reviennent</h2>
                  <p>
                    Comptage lexical dans au moins deux paroles du patient. Sans interprétation ni
                    regroupement sémantique.
                  </p>
                  <div className="word-cloud">
                    {recurring.length ? (
                      recurring.map((item) => (
                        <button
                          key={item.word}
                          aria-label={`${item.word}, ${item.count} occurrences dans ${item.sourceIds.length} paroles`}
                          onClick={() => {
                            setFilter(item.word);
                            setTab('dialogue');
                          }}
                          title={`${item.count} occurrences dans ${item.sourceIds.length} paroles`}
                        >
                          {item.word}
                          <span>{item.count}</span>
                        </button>
                      ))
                    ) : (
                      <span className="muted">
                        Pas encore de récurrence entre plusieurs paroles.
                      </span>
                    )}
                  </div>
                </div>
                <div className="analysis-card summary-card">
                  <span className="card-kicker">02 · SYNTHÈSE LOCALE</span>
                  <h2>Décrire, sans conclure</h2>
                  <p>
                    Le modèle relit uniquement les paroles du patient. Chaque proposition garde ses
                    sources. Une validation humaine reste nécessaire.
                  </p>
                  <div className="button-row">
                    <button
                      className="button primary"
                      disabled={busy || !patient.length || engine.status !== 'ready'}
                      onClick={onSummary}
                    >
                      <Sparkles size={16} />
                      {busy
                        ? progress || 'Synthèse en cours…'
                        : session.summary
                          ? 'Refaire la synthèse'
                          : 'Demander une synthèse'}
                    </button>
                    {engine.status !== 'ready' && !busy && (
                      <button className="text-button" onClick={onEngine}>
                        Charger le moteur
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {session.summary && (
                  <div className="summary-result analysis-card">
                    <div className="result-heading">
                      <span className="card-kicker">PROPOSITIONS GÉNÉRÉES · À RELIRE</span>
                      <span>
                        {(session.summary.durationMs / 1000).toFixed(1)} s ·{' '}
                        {session.summary.analyzedMessages} paroles · {session.summary.chunks}{' '}
                        fragment{session.summary.chunks > 1 ? 's' : ''}
                      </span>
                    </div>
                    <h2>Observations descriptives</h2>
                    {session.summary.observations.length ? (
                      session.summary.observations.map(evidence)
                    ) : (
                      <p>Aucun constat descriptif proposé.</p>
                    )}
                    <h2>Questions possibles pour l’exploration humaine</h2>
                    <p className="fine-print">
                      Ces questions ne sont pas des conclusions sur le patient.
                    </p>
                    {session.summary.exploration.length ? (
                      session.summary.exploration.map(evidence)
                    ) : (
                      <p>Aucune piste proposée.</p>
                    )}
                    {session.summary.chunks > 1 && (
                      <p className="fine-print">
                        Synthèse par fragments couvrant toutes les paroles. Les liens entre
                        fragments ne sont pas explorés automatiquement.
                      </p>
                    )}
                    <button
                      className={`button ${session.summary.reviewed ? 'secondary' : 'primary'}`}
                      disabled={busy || session.summary.reviewed}
                      onClick={onReview}
                    >
                      <CheckCheck size={17} />
                      {session.summary.reviewed
                        ? 'Relecture humaine indiquée'
                        : 'Marquer comme relue'}
                    </button>
                    <p className="fine-print">
                      Ce marqueur enregistre une relecture, sans certifier le contenu.
                    </p>
                  </div>
                )}
              </div>
            )}
            {tab === 'dialogue' && (
              <div className="analysis-card transcript">
                <label className="field search-field">
                  <span>Retrouver un mot ou une image</span>
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Chercher dans les paroles du patient…"
                  />
                </label>
                {session.messages
                  .filter(
                    (m) =>
                      !filter ||
                      (m.role === 'user' &&
                        m.content.toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr'))),
                  )
                  .map((message) => (
                    <article key={message.id} className={`transcript-message ${message.role}`}>
                      <div className="message-label">
                        {message.role === 'user'
                          ? 'Patient · citation exacte'
                          : 'ÉCHO · proposition de la machine'}
                        <span>
                          {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {message.role === 'user' ? (
                        <blockquote>
                          <Quote size={15} />
                          {message.content}
                        </blockquote>
                      ) : (
                        <p>{message.content || 'Génération interrompue.'}</p>
                      )}
                      <small>
                        {message.status === 'complete'
                          ? ''
                          : message.status === 'interrupted'
                            ? 'Réponse interrompue'
                            : 'Génération non aboutie'}
                        {message.durationMs ? ` · ${(message.durationMs / 1000).toFixed(1)} s` : ''}
                        {message.firstTokenMs
                          ? ` · premier mot ${(message.firstTokenMs / 1000).toFixed(1)} s`
                          : ''}
                      </small>
                    </article>
                  ))}
                {filter &&
                  !patient.some((m) =>
                    m.content.toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr')),
                  ) && <p>Aucune parole patient ne contient ce texte.</p>}
              </div>
            )}
            {tab === 'trail' && (
              <div className="analysis-card">
                <span className="card-kicker">L’ORDRE DES ASSOCIATIONS</span>
                <h2>Des paroles qui se déplacent</h2>
                <p>
                  Enchaînement chronologique de deux paroles patient, avec les mots communs et
                  nouveaux. Les relances d’ÉCHO restent consultables dans le dialogue. Aucun lien
                  psychologique ou causal n’est déduit.
                </p>
                <div className="association-trail">
                  {trail.length ? (
                    trail.map((step, index) => (
                      <article key={step.to.id}>
                        <span className="trail-index">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <blockquote>{step.from.content}</blockquote>
                          <ArrowRight size={17} className="trail-arrow" />
                          <blockquote>{step.to.content}</blockquote>
                          <p className="fine-print">
                            En commun : {step.shared.join(', ') || 'aucun mot lexical identique'}
                            <br />
                            Mots introduits : {step.introduced.join(', ') || 'aucun'}.
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>Deux paroles patient sont nécessaires pour voir un premier enchaînement.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="psy-actions">
            <div className="button-row">
              <button className="button secondary" onClick={() => onExport('md')} disabled={busy}>
                <Download size={16} />
                Exporter le texte
              </button>
              <button className="text-button" onClick={() => onExport('json')} disabled={busy}>
                JSON
              </button>
              <button className="text-button danger-text" onClick={onErase} disabled={busy}>
                <Trash2 size={15} />
                Effacer cette séance
              </button>
            </div>
            <button className="text-button" onClick={onResume} disabled={busy}>
              Reprendre avec le patient
              <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}
      <div className="psy-footer">
        <p>
          Les récurrences et rapprochements sont des repères textuels. Leur portée se discute entre
          humains.
        </p>
        <button className="text-button danger-text" onClick={onEraseAll} disabled={busy}>
          Effacer toutes les séances de cet appareil
        </button>
      </div>
    </section>
  );
}
