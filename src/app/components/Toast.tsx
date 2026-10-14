import { useEffect } from 'react';
import type { ToastMessage } from '../hooks/useToast';

export const TOAST_MS = 4000;

export interface ToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
}

/** A polite live region just above the dock; messages dismiss themselves after TOAST_MS. */
export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className={`toast ${message.tone}`} data-testid="toast" key={message.id}>
          <span>{message.text}</span>
          <button type="button" className="secondary" onClick={onDismiss}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
