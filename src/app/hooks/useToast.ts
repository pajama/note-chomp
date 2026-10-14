import { useCallback, useState } from 'react';

export type ToastTone = 'error' | 'info';

export interface ToastMessage {
  /** Changes on every show(), so the same text shown twice restarts the timer. */
  id: number;
  text: string;
  tone: ToastTone;
}

export interface ToastApi {
  toast: ToastMessage | null;
  show: (text: string, tone?: ToastTone) => void;
  dismiss: () => void;
}

let nextId = 1;

export function useToast(): ToastApi {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const show = useCallback((text: string, tone: ToastTone = 'error') => {
    setToast({ id: nextId++, text, tone });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}
