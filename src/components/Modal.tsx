import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close?: () => void;
  wide?: boolean;
}) {
  const titleId = useId(),
    ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      );
    (focusable()[0] ?? node)?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          {close && (
            <button className="icon-button" onClick={close} aria-label="Fermer">
              <X size={20} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
