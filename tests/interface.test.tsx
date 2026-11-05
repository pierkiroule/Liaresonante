// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Consent } from '../src/components/Consent';
import { PatientView } from '../src/components/PatientView';
import { PsychologistView } from '../src/components/PsychologistView';
import { VaultGate } from '../src/components/VaultGate';
import { newSession } from '../src/types';
import { fictionalSession } from '../src/fixtures';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
describe('interface sur données exclusivement fictives', () => {
  it('demande les deux accords explicites avant de créer une séance', async () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    render(<Consent onAccept={accept} close={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Ouvrir la séance' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]);
    expect(button.disabled).toBe(true);
    fireEvent.click(boxes[1]);
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(accept).toHaveBeenCalledOnce());
  });
  it('ne permet pas l’envoi sans modèle chargé', () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(
      <PatientView
        session={newSession(true)}
        engine={{ status: 'idle', progress: 0, progressText: '' }}
        busy={false}
        onSend={send}
        onStop={() => undefined}
        onStart={() => undefined}
        onEngine={() => undefined}
        onPause={() => undefined}
        onResume={() => undefined}
        onErase={() => undefined}
        omitted={0}
      />,
    );
    fireEvent.change(screen.getByLabelText('Votre message à ÉCHO'), {
      target: { value: 'Une image entièrement fictive.' },
    });
    const button = screen.getByRole('button', { name: 'Envoyer le message' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
  it('affiche une panne du moteur directement dans le chat', () => {
    renderPatient(vi.fn(), {
      status: 'error',
      progress: 0,
      progressText: '',
      error: 'Le Worker local s’est arrêté. Rechargez le modèle.',
    });
    expect(screen.getByRole('alert').textContent).toContain('Le Worker local s’est arrêté');
  });
  it('conserve le texte après un refus et empêche deux envois simultanés', async () => {
    let reject!: (reason: Error) => void;
    const send = vi.fn(
      () =>
        new Promise<void>((_, failure) => {
          reject = failure;
        }),
    );
    renderPatient(send);
    const input = screen.getByLabelText('Votre message à ÉCHO') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Un message fictif à conserver.' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'Un autre message fictif.' } });
    fireEvent.submit(input.closest('form')!);
    expect(send).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: '' } });
    reject(new Error('Enregistrement impossible.'));
    await screen.findByText('Enregistrement impossible.');
    expect(input.value).toBe('Un message fictif à conserver.');
  });
  it('laisse un arrêt immédiat accessible pendant la génération', () => {
    const stop = vi.fn();
    render(
      <PatientView
        session={newSession(true)}
        engine={{ status: 'generating', progress: 1, progressText: '' }}
        busy
        onSend={async () => undefined}
        onStop={stop}
        onStart={() => undefined}
        onEngine={() => undefined}
        onPause={() => undefined}
        onResume={() => undefined}
        onErase={() => undefined}
        omitted={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Interrompre immédiatement l’IA' }));
    expect(stop).toHaveBeenCalledOnce();
  });
  it('n’ouvre pas l’espace si les deux phrases de création diffèrent', async () => {
    const submit = vi.fn();
    render(<VaultGate exists={false} onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('Phrase secrète'), {
      target: { value: 'Phrase entièrement fictive' },
    });
    fireEvent.change(screen.getByLabelText('Confirmer la phrase'), {
      target: { value: 'Une autre phrase fictive' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer cet espace local' }));
    await screen.findByText('Les deux phrases secrètes ne correspondent pas.');
    expect(submit).not.toHaveBeenCalled();
  });
  it('retrouve uniquement les citations patient quand on clique un mot récurrent', () => {
    const session = fictionalSession();
    render(
      <PsychologistView
        sessions={[session]}
        selectedId={session.id}
        select={() => undefined}
        onSummary={() => undefined}
        busy={false}
        progress=""
        engine={{ status: 'idle', progress: 0, progressText: '' }}
        onExport={() => undefined}
        onErase={() => undefined}
        onEraseAll={() => undefined}
        onFiction={() => undefined}
        onReview={() => undefined}
        onResume={() => undefined}
        onRename={() => undefined}
        onEngine={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'porte, 2 occurrences dans 2 paroles' }));
    expect(screen.getByText(session.messages[0].content)).toBeTruthy();
    expect(screen.queryByText(session.messages[1].content)).toBeNull();
  });
});

function renderPatient(
  onSend: (text: string) => Promise<void>,
  engine: import('../src/types').EngineState = { status: 'ready', progress: 1, progressText: '' },
) {
  return render(
    <PatientView
      session={newSession(true)}
      engine={engine}
      busy={false}
      onSend={onSend}
      onStop={() => undefined}
      onStart={() => undefined}
      onEngine={() => undefined}
      onPause={() => undefined}
      onResume={() => undefined}
      onErase={() => undefined}
      omitted={0}
    />,
  );
}
